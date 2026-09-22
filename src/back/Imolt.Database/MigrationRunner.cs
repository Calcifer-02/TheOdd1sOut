using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Npgsql;

namespace Imolt.Database;

/// Применение схемы базы данных. Схема — общий контракт расчётной части и
/// службы сбора справочных данных (КНТ-02, ADR-0002), поэтому применяет её
/// общая сборка, а не одна из сторон.
///
/// Файлы миграций едут внутри сборки: применять схему должен тот, кто её
/// несёт, а не тот, кто угадал путь к каталогу.
///
/// @supports: R-007, R-048
/// @adr: ADR-0002
public static class MigrationRunner
{
  private const string ResourcePrefix = "Imolt.Database.Migrations.";

  /// Применяет непринятые миграции по возрастанию версии и возвращает то,
  /// что применил. Повторный вызов не применяет ничего: перезапуск службы
  /// не должен ни падать, ни накатывать схему заново.
  public static async Task<IReadOnlyCollection<string>> ApplyAsync(
      string connectionString,
      CancellationToken cancellationToken)
  {
    var migrations = Load();

    await using var connection = new NpgsqlConnection(connectionString);
    await connection.OpenAsync(cancellationToken);
    await EnsureJournalAsync(connection, cancellationToken);

    var recorded = await RecordedAsync(connection, cancellationToken);
    var applied = new List<string>();

    foreach (var migration in migrations)
    {
      if (recorded.TryGetValue(migration.Version, out var knownChecksum))
      {
        // Правка уже применённой миграции — не «ещё одно изменение», а
        // расхождение схемы между узлами: у одних она накатана в старой
        // редакции, у других в новой. Такое чинят новой миграцией.
        if (!string.Equals(knownChecksum, migration.Checksum, StringComparison.Ordinal))
        {
          throw new InvalidOperationException(
              $"миграция {migration.Version} изменена после применения: " +
              $"записан отпечаток {knownChecksum}, у файла {migration.Checksum}");
        }

        continue;
      }

      // Каждая миграция едет своей транзакцией: неудача на пятой не
      // должна откатывать четыре применённые до неё.
      await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

      await using (var command = new NpgsqlCommand(migration.Sql, connection, transaction))
      {
        command.CommandTimeout = 300;
        await command.ExecuteNonQueryAsync(cancellationToken);
      }

      await using (var journal = new NpgsqlCommand(
          "insert into schema_migration (version, checksum, applied_at) values (@version, @checksum, now())",
          connection,
          transaction))
      {
        journal.Parameters.AddWithValue("version", migration.Version);
        journal.Parameters.AddWithValue("checksum", migration.Checksum);
        await journal.ExecuteNonQueryAsync(cancellationToken);
      }

      await transaction.CommitAsync(cancellationToken);
      applied.Add(migration.Version);
    }

    return applied;
  }

  /// Журнал применённого заводится вне миграций: миграция номер один сама
  /// нуждается в месте, куда записать, что она применена (СУЩ-15).
  private static async Task EnsureJournalAsync(NpgsqlConnection connection, CancellationToken cancellationToken)
  {
    await using var command = new NpgsqlCommand(
        """
            create table if not exists schema_migration (
                version    text        primary key,
                checksum   text        not null,
                applied_at timestamptz not null
            )
            """,
        connection);

    await command.ExecuteNonQueryAsync(cancellationToken);
  }

  private static async Task<Dictionary<string, string>> RecordedAsync(
      NpgsqlConnection connection,
      CancellationToken cancellationToken)
  {
    await using var command = new NpgsqlCommand("select version, checksum from schema_migration", connection);
    await using var reader = await command.ExecuteReaderAsync(cancellationToken);

    var recorded = new Dictionary<string, string>(StringComparer.Ordinal);
    while (await reader.ReadAsync(cancellationToken))
    {
      recorded[reader.GetString(0)] = reader.GetString(1);
    }

    return recorded;
  }

  private static List<Migration> Load()
  {
    var assembly = Assembly.GetExecutingAssembly();

    return assembly.GetManifestResourceNames()
        .Where(name => name.StartsWith(ResourcePrefix, StringComparison.Ordinal)
                       && name.EndsWith(".sql", StringComparison.Ordinal))
        .Select(name => Read(assembly, name))
        .OrderBy(migration => migration.Version, StringComparer.Ordinal)
        .ToList();
  }

  private static Migration Read(Assembly assembly, string resourceName)
  {
    using var stream = assembly.GetManifestResourceStream(resourceName)
        ?? throw new InvalidOperationException($"миграция {resourceName} не читается из сборки");
    using var reader = new StreamReader(stream, Encoding.UTF8);

    var sql = reader.ReadToEnd();
    var fileName = resourceName[ResourcePrefix.Length..];
    var version = fileName.Split('_', 2)[0];
    var checksum = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(sql)));

    return new Migration(version, sql, checksum);
  }

  private sealed record Migration(string Version, string Sql, string Checksum);
}
