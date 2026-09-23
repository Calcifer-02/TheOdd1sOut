using Imolt.Shared;
using Npgsql;
using Xunit;

namespace Imolt.Api.Tests;

/// Хранение реестра полигонов — уровень схемы, а не HTTP, плюс сверка
/// начального набора с каноническим примером договора.
///
/// Два предмета здесь держатся вместе по одной причине: и ограничения
/// записи, и согласованность демонстрационных данных проверяются прямо в
/// базе и на той же базе, что видит служба. Тариф, цена перевозки и плечо
/// складываются в цену из примера договора (R-018): если начальный набор
/// разойдётся с формулой, каждая проверка расчёта начнёт сверяться с
/// испорченной эталонной парой чисел, а заметят это позже, чем по цене
/// ошибки в смете.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-040d, AC-040e, AC-041b
[Collection(ImoltReferencesCollection.Name)]
public sealed class StorageLandfillsTests(ImoltReferencesStand stand)
{
  [Fact(DisplayName = "полигон хранит поля, объявленные инженерной моделью СУЩ-02")]
  public async Task LandfillTablesMatchTheModel()
  {
    var columns = await ColumnNamesAsync("landfill");

    Assert.Equal(
        new[]
        {
          "id", "name", "legal_entity", "address", "latitude", "longitude",
          "object_kind", "daily_intake_limit_tons", "registered_in_ais_ossig",
          "has_electronic_ticket_agreement", "status", "status_reason",
          "status_source", "status_updated_at",
        },
        columns);

    Assert.Equal(2, await CountAsync(
        """
        select count(*) from information_schema.tables
        where table_name in ('landfill_tariff', 'landfill_legal_entity_history')
        """));
  }

  [Theory(DisplayName = "полигон со статусом вне объявленного перечня не записывается")]
  [InlineData("paused")]
  [InlineData("ACTIVE")]
  [InlineData("")]
  public async Task StatusOutsideTheDeclaredSetIsRejected(string status)
  {
    var failure = await Assert.ThrowsAsync<PostgresException>(() => ExecuteAsync(
        """
        insert into landfill (
            id, name, address, latitude, longitude, status, status_updated_at
        ) values (
            'proverka-statusa', 'Площадка «Проверочная»',
            'Московская обл., Богородский г. о., д. Проверочная',
            55.8500, 38.4400, @status, date '2026-09-17'
        )
        """,
        ("@status", status)));

    Assert.Equal(PostgresErrorCodes.CheckViolation, failure.SqlState);
  }

  [Fact(DisplayName = "история юрлица с перевёрнутым периодом не записывается")]
  public async Task ReversedHistoryPeriodIsRejected()
  {
    var failure = await Assert.ThrowsAsync<PostgresException>(() => ExecuteAsync(
        """
        insert into landfill_legal_entity_history (landfill_id, legal_entity, since, until)
        values ('iksha', 'ООО «Проверочная»', date '2026-05-05', date '2026-05-01')
        """));

    Assert.Equal(PostgresErrorCodes.CheckViolation, failure.SqlState);
  }

  [Fact(DisplayName = "смена юрлица в истории не обнуляет накопленные тарифы")]
  public async Task HistoryChangeKeepsTariffs()
  {
    Assert.Equal(2, await CountAsync(
        """
        select count(*) from landfill_legal_entity_history
        where landfill_id = 'vostok-timohovo'
        """));

    // Открытый период ровно один: действующее юрлицо у полигона одно,
    // иначе «текущий владелец» теряет смысл (R-041).
    Assert.Equal(1, await CountAsync(
        """
        select count(*) from landfill_legal_entity_history
        where landfill_id = 'vostok-timohovo' and until is null
        """));

    Assert.True(
        await CountAsync(
            "select count(*) from landfill_tariff where landfill_id = 'vostok-timohovo'") > 0,
        "смена юрлица обнулила тарифы полигона: история осталась, накопленные цены ушли");
  }

  [Fact(DisplayName = "начальный набор складывается в цену канонического примера договора")]
  public async Task DemoExampleSatisfiesTheCostFormula()
  {
    var pricePerTonKm = await ScalarAsync<decimal>(
        """
        select transport_price_per_ton_km from waste_group where id = 'beton-lom'
        """);
    var tariffPerTon = await ScalarAsync<decimal>(
        """
        select disposal_price_per_ton from landfill_tariff
        where landfill_id = 'vostok-timohovo' and waste_group_id = 'beton-lom'
        """);
    var distanceKm = await ScalarAsync<decimal>(
        """
        select distance_km from road_distance
        where from_latitude = 55.80550 and from_longitude = 37.62060
          and landfill_id = 'vostok-timohovo'
        """);

    // 20 тонн — объём из примера договора: перевозка 10 800,00,
    // утилизация 9 000,00, итог 19 800,00 (раздел «Пример» договора).
    Assert.Equal(
        Money.Rubles(10800.00m),
        Money.Rubles(pricePerTonKm) * 20m * distanceKm);
    Assert.Equal(
        Money.Rubles(9000.00m),
        Money.Rubles(tariffPerTon) * 20m);
    Assert.Equal(
        Money.Rubles(19800.00m),
        Money.Rubles(pricePerTonKm) * 20m * distanceKm + Money.Rubles(tariffPerTon) * 20m);
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

  private async Task<T> ScalarAsync<T>(string sql)
  {
    await using var connection = await OpenConnectionAsync();
    await using var command = new NpgsqlCommand(sql, connection);

    var value = await command.ExecuteScalarAsync();

    return (T)value!;
  }

  private async Task<long> CountAsync(string sql)
      => Convert.ToInt64(await ScalarAsync<object>(sql));

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
