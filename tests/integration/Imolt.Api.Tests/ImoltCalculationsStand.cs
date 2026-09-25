using System.Globalization;
using Imolt.Database;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace Imolt.Api.Tests;

/// Стенд области «расчёт»: одноразовая база со схемой, начальным набором
/// данных и достройкой до предусловий приёмочных критериев расчёта.
///
/// Стенд соседний, а не дополненный ImoltReferencesStand, по трём причинам.
/// Первая: AC-029a требует группу отходов, которую не принимает ни один
/// полигон, — на стенде справочников ту же «drevesina» принимает «Восток»,
/// и снятие тарифа там сделало бы AC-040b верным по другой причине. Вторая:
/// стенд справочников досевает десять групп ради предела страницы (AC-060a),
/// и в подборе полигонов они были бы шумом. Третья: у расчёта своя
/// достройка — заблокированный полигон в подборе, адрес без сохранённых
/// плеч, — и общий стенд стал бы объединением двух несвязанных наборов, где
/// причина исхода уже не читается.
///
/// Сезонный коэффициент перевозки (AC-022a) живёт на третьем стенде
/// (ImoltSeasonalTransportStand), и это вынужденно: действующий коэффициент
/// меняет стоимость перевозки любого расчёта, а здесь числа обязаны сойтись
/// с примером договора без коэффициента (AC-018a — AC-018c).
///
public sealed class ImoltCalculationsStand : IAsyncLifetime
{
  /// Адрес вывоза примера договора вместе с координатами: от него в наборе
  /// сохранены плечи 45 и 52 км.
  public const string PickupValue = "г Москва, ул Годовикова, д 9";

  public const double PickupLatitude = 55.8055;

  public const double PickupLongitude = 37.6206;

  /// Адрес вывоза в Московской области из начального набора вместе с
  /// координатами: от него сохранены плечи до полигонов, и по нему проверяется
  /// мера расчёта второй зоны (AC-016b, AC-016c).
  public const string RegionPickupValue = "Московская обл., г Балашиха, ш Энтузиастов, д 1";

  public const double RegionPickupLatitude = 55.7963;

  public const double RegionPickupLongitude = 37.9385;

  /// Адрес, которого в справочнике нет. Взят заведомо несуществующим: по
  /// такому адресу зону назвать нечем, и расчёт обязан отказать (AC-016d).
  public const string UnknownAddressValue = "г Москва, ул Которой Нет, д 1";

  public const double UnknownAddressLatitude = 55.7501;

  public const double UnknownAddressLongitude = 37.6001;

  /// Адрес вывоза, для которого не сохранено ни одного плеча перевозки.
  /// Заводится в справочнике адресов, а не выдумывается запросом: иначе отказ
  /// расчёта можно было бы списать на неизвестный адрес, а проверять надо
  /// отсутствие расстояния (AC-020b).
  public const string AddressWithoutStoredLegValue = "г Москва, ул Сущёвский Вал, д 5";

  public const double AddressWithoutStoredLegLatitude = 55.7908;

  public const double AddressWithoutStoredLegLongitude = 37.6194;

  /// Полигон со статусом «заблокирован», участвующий в подборе. Плечо 47 км и
  /// тариф 500,00 ₽ за тонну выбраны так, чтобы запись не перебила порядок
  /// примера договора: по совокупной цене она третья (21 280,00 ₽), а по
  /// расстоянию стоит между «Востоком» (45 км) и «Икшей» (52 км) и потому не
  /// становится первой ни при сортировке по цене, ни при сортировке по
  /// расстоянию по убыванию (AC-024a, AC-024b, AC-028a).
  public const string BlockedLandfillInPlacementId = "polygon-na-remonte";

  public const double BlockedLandfillDistanceKm = 47;

  /// Группа отходов, которую на этом стенде не принимает ни один полигон
  /// (AC-029a).
  public const string UnacceptedWasteGroupId = "drevesina";

  /// Дата актуальности всего, что лежит на стенде. Совпадает с датой
  /// начального набора (0002_demo_dataset.sql).
  public const string DataDate = "2026-09-17";

  private readonly PostgreSqlContainer database = new PostgreSqlBuilder("postgres:17-alpine")
      .WithDatabase("imolt")
      .WithUsername("imolt")
      .WithPassword("imolt")
      .Build();

  private ImoltApiFactory? service;

  public string ConnectionString => database.GetConnectionString();

  public HttpClient Client { get; private set; } = null!;

  public async Task InitializeAsync()
  {
    await database.StartAsync();

    await MigrationRunner.ApplyAsync(ConnectionString, CancellationToken.None);
    await SeedAsync(CancellationToken.None);

    service = new ImoltApiFactory(ConnectionString);
    Client = service.CreateClient();
  }

  public async Task DisposeAsync()
  {
    Client?.Dispose();
    service?.Dispose();
    await database.DisposeAsync();
  }

  // Достройка начального набора до предусловий критериев расчёта. Объявлена
  // здесь, а не в отдельных проверках: данные общие на все сценарии области,
  // и разбросанные по проверкам вставки сделали бы исход зависимым от порядка
  // запуска.
  private async Task SeedAsync(CancellationToken cancellationToken)
  {
    await using var connection = new NpgsqlConnection(ConnectionString);
    await connection.OpenAsync(cancellationToken);

    await using var command = new NpgsqlCommand(
        $"""
            -- Заблокированный полигон в подборе (AC-028a). Начальный набор
            -- держит оба полигона активными, и предупреждение выбора на них
            -- проверить нечем.
            insert into landfill (
                id, name, legal_entity, address, latitude, longitude,
                object_kind, registered_in_ais_ossig, status, status_reason,
                status_source, status_updated_at
            ) values (
                '{BlockedLandfillInPlacementId}', 'Полигон «На ремонте»', 'ООО «Ремонт»',
                'Московская обл., Ленинский г. о., д. Ремонтная', 55.5600, 37.7100,
                'disposal', true, 'blocked', 'приём приостановлен на время ремонта карты',
                'manual', date '{DataDate}'
            )
            on conflict (id) do nothing;

            -- Тариф заблокированного полигона по лому бетона: без тарифа он не
            -- попал бы в подбор и предупреждение выбора проверять было бы не на чем.
            insert into landfill_tariff (landfill_id, waste_group_id, disposal_price_per_ton, updated_at)
            values ('{BlockedLandfillInPlacementId}', 'beton-lom', 500.00, date '{DataDate}')
            on conflict (landfill_id, waste_group_id) do nothing;

            -- Плечо до заблокированного полигона от адреса вывоза примера
            -- договора. Координаты округлены до пяти знаков — так устроен ключ
            -- таблицы road_distance.
            insert into road_distance (
                from_latitude, from_longitude, landfill_id, distance_km,
                duration_minutes, source, obtained_at
            ) values (
                55.80550, 37.62060, '{BlockedLandfillInPlacementId}', 47.000,
                66, 'stand', timestamptz '{DataDate} 12:00:00+03'
            )
            on conflict (from_latitude, from_longitude, landfill_id) do nothing;

            -- Плечи до полигонов, о которых критерии подбора не говорят.
            -- Демонстрационный набор (0009_moscow_region_landfills.sql) принёс
            -- ещё восемь полигонов и плечи до них от всех адресов справочника,
            -- и от адреса примера договора они встали бы в тот же список.
            -- Лишнее снимается здесь, а не подгоняется числами критериев:
            -- AC-024a и AC-024b говорят о порядке списка, а не о размере
            -- демонстрационного набора, и подгонка ожиданий под набор сделала
            -- бы исход критерия зависимым от наполнения справочника.
            delete from road_distance
             where from_latitude = 55.80550
               and from_longitude = 37.62060
               and landfill_id not in (
                   'vostok-timohovo', 'iksha', '{BlockedLandfillInPlacementId}');

            -- Адрес вывоза без единого сохранённого плеча (AC-020b). Ни одной
            -- строки в road_distance для этих координат не заводится: расчёт
            -- обязан отказать, а не подставить расстояние по прямой.
            insert into address_directory (id, value, latitude, longitude, area)
            values (
                'msk-suschevskiy-val-5', '{AddressWithoutStoredLegValue}',
                {AddressWithoutStoredLegLatitude.ToString(CultureInfo.InvariantCulture)},
                {AddressWithoutStoredLegLongitude.ToString(CultureInfo.InvariantCulture)},
                'moscow'
            )
            on conflict (id) do nothing;

            -- AC-029a требует группу, которую не принимает ни один полигон, и
            -- называет «drevesina». Начальный набор даёт ей тариф «Востока»
            -- (300,00 ₽ — помечено в наборе как демонстрационное значение),
            -- поэтому предусловие критерия устанавливается здесь. Набор описывает
            -- демонстрацию, стенд — предусловие критерия; расхождение названо,
            -- а не обойдено молча.
            delete from landfill_tariff where waste_group_id = '{UnacceptedWasteGroupId}';
            """,
        connection);

    await command.ExecuteNonQueryAsync(cancellationToken);
  }
}

/// Общий стенд расчёта на все проверки области: контейнер поднимается один
/// раз, а не на каждый класс проверок.
[CollectionDefinition(Name)]
public sealed class ImoltCalculationsCollection : ICollectionFixture<ImoltCalculationsStand>
{
  public const string Name = "расчёт ИМОЛТ на базе с начальным набором";
}
