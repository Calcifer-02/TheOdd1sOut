using Imolt.Database;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace Imolt.Api.Tests;

/// Полнота начального набора плеч перевозки: каждый адрес справочника обязан
/// иметь сохранённое расстояние по дорожной сети до каждого полигона.
///
/// Проверка нужна потому, что неполный набор ломается не там, где заведён.
/// Расчёт сознательно отказывается считать по прямой — заниженная смета хуже
/// отказа (R-020) — и адрес без единого плеча отвечает отказом уже на первом
/// расчёте, хотя в подсказках выглядит пригодным (R-012). Дыру в данных ловит
/// не разбор отказа, а сверка двух таблиц.
///
/// Плечо ищется по ключу «координаты, округлённые до пяти знаков, плюс
/// полигон» (RoadDistances.KeyPrecision), поэтому сверка соединяет таблицы
/// тем же округлением: адрес, у которого плечо записано по другим координатам,
/// для расчёта равносилен адресу без плеча, и различать их тут нечем.
///
/// Стенд свой, а не общий, по одной причине: предмет проверки — набор, каким
/// его приносят миграции. Стенд справочников досевает полигон без плеч
/// (ImoltReferencesStand), стенд расчёта — адрес без плеч намеренно
/// (ImoltCalculationsStand, AC-020b), а общий ImoltApiStand отдан проверке
/// повторяемости миграций, которая утверждает, что первое применение
/// непустое. На любом из них сверка говорила бы об оснастке, а не о наборе.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @supports: R-012, R-020
public sealed class StorageRoadDistancesTests : IAsyncLifetime
{
  /// Нижняя граница живого справочника. Три адреса начального набора
  /// демонстрацию не держат: подсказки с тремя строками не похожи на
  /// подсказки, а зона обслуживания на них не различается.
  private const int MinimalDirectorySize = 100;

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

  [Fact(DisplayName = "у каждого адреса справочника сохранено плечо перевозки до каждого полигона")]
  public async Task EveryDirectoryAddressCarriesARoadLegToEveryLandfill()
  {
    var addresses = await CountAsync("select count(*) from address_directory");
    var landfills = await CountAsync("select count(*) from landfill");

    // Пустые таблицы соединяются без единой непокрытой пары, и без этих
    // утверждений проверка прошла бы на вычищенном наборе.
    Assert.True(
        addresses >= MinimalDirectorySize,
        $"в справочнике адресов {addresses} записей: набор меньше {MinimalDirectorySize} "
        + "не показывает ни подсказок, ни зоны обслуживания");
    Assert.True(landfills >= 2, $"полигонов в наборе {landfills}: сравнивать варианты размещения не с чем");

    // Обе зоны обслуживания присутствуют: правило «Москва и область»
    // проверяется только на наборе, где есть и та, и другая (R-012).
    Assert.True(
        await CountAsync("select count(*) from address_directory where area = 'moscow'") > 0,
        "в справочнике нет ни одного адреса Москвы");
    Assert.True(
        await CountAsync("select count(*) from address_directory where area = 'moscowRegion'") > 0,
        "в справочнике нет ни одного адреса Московской области: зону обслуживания различать не на чем");

    var uncovered = await UncoveredPairsAsync();

    Assert.True(
        uncovered.Count == 0,
        $"без сохранённого плеча осталось пар «адрес — полигон»: {uncovered.Count}. "
        + "Расчёт с такого адреса отвечает отказом, а не считает по прямой (R-020). "
        + "Первые: " + string.Join("; ", uncovered.Take(5)));

    // Плечо длиной ноль означало бы бесплатную перевозку: формула умножает на
    // расстояние (R-018), и такая строка тише, чем отсутствующая.
    Assert.Equal(
        0,
        await CountAsync("select count(*) from road_distance where distance_km <= 0"));
  }

  // Пары «адрес — полигон», для которых плечо не нашлось по ключу таблицы.
  // Соединение повторяет округление переходника: сверка обязана промахиваться
  // там же, где промахнётся расчёт.
  private async Task<List<string>> UncoveredPairsAsync()
  {
    var pairs = new List<string>();

    await using var connection = new NpgsqlConnection(ConnectionString);
    await connection.OpenAsync();

    await using var command = new NpgsqlCommand(
        """
        select address.value, landfill.id
          from address_directory as address
         cross join landfill
          left join road_distance as leg
            on leg.from_latitude = round(address.latitude::numeric, 5)
           and leg.from_longitude = round(address.longitude::numeric, 5)
           and leg.landfill_id = landfill.id
         where leg.landfill_id is null
         order by address.value, landfill.id
        """,
        connection);
    await using var reader = await command.ExecuteReaderAsync();

    while (await reader.ReadAsync())
    {
      pairs.Add($"{reader.GetString(0)} → {reader.GetString(1)}");
    }

    return pairs;
  }

  private async Task<int> CountAsync(string sql)
  {
    await using var connection = new NpgsqlConnection(ConnectionString);
    await connection.OpenAsync();

    await using var command = new NpgsqlCommand(sql, connection);

    return Convert.ToInt32(await command.ExecuteScalarAsync());
  }
}
