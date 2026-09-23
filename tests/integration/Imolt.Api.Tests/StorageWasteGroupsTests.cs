using Npgsql;
using Xunit;

namespace Imolt.Api.Tests;

/// Хранение справочника групп отходов — уровень схемы, а не HTTP.
///
/// Схема — общий контракт службы и хранилища (ADR-0002): её читают две
/// единицы, и CHECK-ограничения — единственный способ, каким хранилище
/// защищается от записи, которую служба сбора могла бы принести мимо
/// серверной проверки. Ответы точек проверяются отдельно, в интеграциях
/// области; здесь проверяется, что в базу не проходит цена перевозки или
/// плотность вне объявленных пределов и что код ФККО нельзя повесить на
/// несуществующую группу.
///
/// Проверки пишут пробные записи заведомо новыми идентификаторами и не
/// оставляют ни одной: каждая вставка обязана быть отвергнута, а успешная
/// вставка сделала бы последующий прогон неверным.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-039c
[Collection(ImoltReferencesCollection.Name)]
public sealed class StorageWasteGroupsTests(ImoltReferencesStand stand)
{
  [Fact(DisplayName = "группа отходов хранит поля, объявленные инженерной моделью СУЩ-01")]
  public async Task WasteGroupTablesMatchTheModel()
  {
    var columns = await ColumnNamesAsync("waste_group");

    Assert.Equal(
        new[] { "id", "name", "transport_price_per_ton_km", "density_ton_per_m3", "updated_at" },
        columns);

    Assert.Equal(1, await CountAsync(
        "select count(*) from information_schema.tables " +
        "where table_name = 'waste_group_fkko_code'"));
  }

  [Theory(DisplayName = "группа с негодной ценой перевозки или плотностью не записывается")]
  [InlineData(0.00, 2.00)]
  [InlineData(-12.00, 2.00)]
  [InlineData(12.00, 0.00)]
  [InlineData(12.00, -0.50)]
  public async Task NonPositivePriceOrDensityIsRejected(decimal price, decimal density)
  {
    var failure = await Assert.ThrowsAsync<PostgresException>(() => ExecuteAsync(
        """
        insert into waste_group (id, name, transport_price_per_ton_km, density_ton_per_m3, updated_at)
        values ('proverka-otkaza', 'Проверочная запись отказа', @price, @density, date '2026-09-17')
        """,
        ("@price", price),
        ("@density", density)));

    Assert.Equal(PostgresErrorCodes.CheckViolation, failure.SqlState);
  }

  [Fact(DisplayName = "код каталога ФККО нельзя записать без группы-владельца")]
  public async Task FkkoCodeWithoutGroupIsRejected()
  {
    var failure = await Assert.ThrowsAsync<PostgresException>(() => ExecuteAsync(
        """
        insert into waste_group_fkko_code (waste_group_id, code)
        values ('net-takoy-gruppy', '8 99 999 99 99 9 9')
        """));

    Assert.Equal(PostgresErrorCodes.ForeignKeyViolation, failure.SqlState);
  }

  private async Task<List<string>> ColumnNamesAsync(string table)
  {
    var names = new List<string>();

    await using var connection = await OpenConnectionAsync();
    await using var command = new NpgsqlCommand(
        """
        select column_name from information_schema.columns
        where table_name = @table
        order by ordinal_position
        """,
        connection);
    command.Parameters.AddWithValue("@table", table);

    await using var reader = await command.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
      names.Add(reader.GetString(0));
    }

    return names;
  }

  private async Task<long> CountAsync(string sql)
  {
    await using var connection = await OpenConnectionAsync();
    await using var command = new NpgsqlCommand(sql, connection);

    return Convert.ToInt64(await command.ExecuteScalarAsync()
        ?? throw new InvalidOperationException("счётчик вернул пустоту"));
  }

  private async Task ExecuteAsync(string sql, params (string Name, object Value)[] parameters)
  {
    await using var connection = await OpenConnectionAsync();
    await using var command = new NpgsqlCommand(sql, connection);

    foreach (var (name, value) in parameters)
    {
      command.Parameters.AddWithValue(name, value);
    }

    await command.ExecuteNonQueryAsync();
  }

  private async Task<NpgsqlConnection> OpenConnectionAsync()
  {
    var connection = new NpgsqlConnection(stand.ConnectionString);
    await connection.OpenAsync();
    return connection;
  }
}
