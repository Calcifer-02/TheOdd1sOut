using Imolt.Database;
using Npgsql;
using Xunit;

namespace Imolt.Api.Tests;

/// Применение миграций к настоящей базе. Схема — общий контракт службы и
/// хранилища, поэтому её версии ведутся таблицей schema_migration, а не
/// памятью о том, что на стенде уже запускали.
///
/// Проверка фальсифицируема: она падает, если первый запуск ничего не
/// применит, если второй запуск повторно применит миграции или упадёт
/// (тогда развёртывание перестанет быть повторяемым) и если применённая
/// версия не оставит в таблице строки с непустым отпечатком — по отпечатку
/// ловится задним числом изменённая миграция.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @supports: R-011
[Collection(ImoltApiCollection.Name)]
public sealed class MigrationRunnerTests(ImoltApiStand stand)
{
    [Fact(DisplayName = "миграции применяются один раз, повторный запуск не применяет ничего")]
    public async Task MigrationsAreAppliedOnceAndStayIdempotent()
    {
        var first = await MigrationRunner.ApplyAsync(stand.ConnectionString, CancellationToken.None);
        Assert.NotEmpty(first);

        var second = await MigrationRunner.ApplyAsync(stand.ConnectionString, CancellationToken.None);
        Assert.True(
            second.Count == 0,
            "повторный запуск применил миграции заново: " + string.Join(", ", second));

        var recorded = await RecordedMigrationsAsync(stand.ConnectionString);

        Assert.Equal(
            first.OrderBy(version => version, StringComparer.Ordinal).ToList(),
            recorded.Keys.OrderBy(version => version, StringComparer.Ordinal).ToList());

        foreach (var (version, checksum) in recorded)
        {
            Assert.False(
                string.IsNullOrWhiteSpace(checksum),
                $"у версии {version} пустой отпечаток: изменённую задним числом миграцию так не поймать");
        }
    }

    // Таблица читается напрямую, а не через ту же сборку миграций: иначе
    // проверка подтверждала бы сама себя.
    private static async Task<Dictionary<string, string>> RecordedMigrationsAsync(string connectionString)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();

        await using var command = new NpgsqlCommand(
            "select version, checksum from schema_migration order by version", connection);
        await using var reader = await command.ExecuteReaderAsync();

        var recorded = new Dictionary<string, string>(StringComparer.Ordinal);
        while (await reader.ReadAsync())
        {
            recorded[reader.GetString(0)] = reader.IsDBNull(1) ? string.Empty : reader.GetString(1);
        }

        return recorded;
    }
}
