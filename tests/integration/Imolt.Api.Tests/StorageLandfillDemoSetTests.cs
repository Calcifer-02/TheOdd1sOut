using Imolt.Database;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace Imolt.Api.Tests;

/// Пригодность демонстрационного набора полигонов: набор, который приносят
/// миграции, обязан давать экрану сравнения предмет сравнения.
///
/// Проверка нужна потому, что неполный набор не падает, а тихо обедняет
/// ответ. Полигон без тарифа не попадает ни в один расчёт (R-019): он есть в
/// реестре и его нет в результатах. Набор из одинаковых статусов оставляет
/// непроверенным показ блокировки (R-044). Набор, целиком лежащий по одну
/// сторону от порога «до 50 км», делает отбор по расстоянию либо пустым,
/// либо бездействующим (R-025, R-026) — и то и другое выглядит как рабочий
/// экран.
///
/// Полнота плеч перевозки проверяется соседним набором
/// (StorageRoadDistancesTests); здесь предмет — состав самого реестра.
///
/// Стенд свой, а не общий, по той же причине, что и у соседа: предмет
/// проверки — набор, каким его приносят миграции. ImoltReferencesStand
/// досевает заблокированный полигон, ImoltCalculationsStand — свои записи,
/// и на любом из них утверждение о составе набора говорило бы об оснастке.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @supports: R-025, R-040, R-044
public sealed class StorageLandfillDemoSetTests : IAsyncLifetime
{
  /// Нижняя граница набора, на котором сравнение перестаёт быть словом.
  /// Двух полигонов начального набора не хватает: список из двух строк не
  /// различает ни порядок по цене, ни отбор по расстоянию.
  private const int MinimalLandfillCount = 8;

  /// Значение отбора по расстоянию по умолчанию (R-026). Порог взят здесь не
  /// как величина расчёта, а как точка, по обе стороны от которой у набора
  /// обязаны быть полигоны.
  private const int DefaultDistanceKm = 50;

  private readonly PostgreSqlContainer database = new PostgreSqlBuilder("postgres:17-alpine")
      .WithDatabase("imolt")
      .WithUsername("imolt")
      .WithPassword("imolt")
      .Build();

  public string ConnectionString => database.GetConnectionString();

  public async Task InitializeAsync()
  {
    await database.StartAsync();
    await MigrationRunner.ApplyAsync(ConnectionString, CancellationToken.None);
  }

  public async Task DisposeAsync() => await database.DisposeAsync();

  [Fact(DisplayName = "в наборе не меньше восьми полигонов, и каждый принимает хотя бы одну группу отходов")]
  public async Task EveryLandfillOfTheDemoSetAcceptsAtLeastOneWasteGroup()
  {
    var landfills = await CountAsync("select count(*) from landfill");

    Assert.True(
        landfills >= MinimalLandfillCount,
        $"полигонов в наборе {landfills}: меньше {MinimalLandfillCount} "
        + "не дают экрану сравнения предмета сравнения");

    var withoutTariff = await NamesAsync(
        """
        select l.id
          from landfill as l
         where not exists (select 1 from landfill_tariff as t where t.landfill_id = l.id)
         order by l.id
        """);

    Assert.True(
        withoutTariff.Count == 0,
        "полигон без тарифа ни по одной группе отходов в расчёт не попадает и в результатах не виден: "
        + string.Join(", ", withoutTariff));
  }

  [Fact(DisplayName = "набор полигонов показывает все три объявленных статуса приёма")]
  public async Task TheDemoSetCoversEveryDeclaredIntakeStatus()
  {
    var statuses = await NamesAsync("select distinct status from landfill order by status");

    // Перечень повторяет CHECK таблицы landfill (0001_initial_schema.sql).
    // Однородный набор оставляет показ блокировки непроверенным: отличить
    // «полигон не заблокирован» от «признак не показывается» на нём нечем.
    Assert.Equal(new[] { "active", "blocked", "unconfirmed" }, statuses);
  }

  [Fact(DisplayName = "порог отбора «до 50 км» делит набор полигонов, а не отсекает его целиком")]
  public async Task TheDefaultDistanceThresholdSplitsTheDemoSet()
  {
    var nearest = await CountAsync(
        $"""
        select coalesce(max(near), 0) from (
          select count(*) filter (where distance_km <= {DefaultDistanceKm}) as near
            from road_distance
           group by from_latitude, from_longitude) as legs
        """);
    var farthest = await CountAsync(
        $"""
        select coalesce(max(far), 0) from (
          select count(*) filter (where distance_km > {DefaultDistanceKm}) as far
            from road_distance
           group by from_latitude, from_longitude) as legs
        """);

    // Три — наименьшее число строк, на котором порядок списка виден: две
    // строки переставляются местами при любом ключе сортировки.
    Assert.True(
        nearest >= 3,
        $"ни с одного адреса ближе {DefaultDistanceKm} км не набирается трёх полигонов "
        + $"(наибольшее — {nearest}): отбор по умолчанию оставляет список, в котором нечего упорядочивать");
    Assert.True(
        farthest >= 3,
        $"ни с одного адреса дальше {DefaultDistanceKm} км не набирается трёх полигонов "
        + $"(наибольшее — {farthest}): отбор по расстоянию ничего не отсекает и потому ничего не проверяет");
  }

  private async Task<List<string>> NamesAsync(string sql)
  {
    var names = new List<string>();

    await using var connection = new NpgsqlConnection(ConnectionString);
    await connection.OpenAsync();

    await using var command = new NpgsqlCommand(sql, connection);
    await using var reader = await command.ExecuteReaderAsync();

    while (await reader.ReadAsync())
    {
      names.Add(reader.GetString(0));
    }

    return names;
  }

  private async Task<int> CountAsync(string sql)
  {
    await using var connection = new NpgsqlConnection(ConnectionString);
    await connection.OpenAsync();

    await using var command = new NpgsqlCommand(sql, connection);

    return Convert.ToInt32(await command.ExecuteScalarAsync());
  }
}
