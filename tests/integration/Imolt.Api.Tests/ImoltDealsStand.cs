using System.Globalization;
using Imolt.Database;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace Imolt.Api.Tests;

/// Стенд области «сделка»: одноразовая база со схемой, начальным набором
/// данных и достройкой до предусловий приёмочных критериев маршрута,
/// коммерческого предложения, заявки на вывоз и каталога услуг.
///
/// Стенд соседний, а не переиспользованный ImoltCalculationsStand, по трём
/// причинам. Первая: каталог услуг по документации в начальном наборе пуст, и
/// AC-052a требует ровно две записи заданной формы; досев этих строк на стенд
/// расчёта добавил бы туда данные, к расчёту не относящиеся. Вторая: AC-054a
/// проверяет отсутствие записи в хранилище заявок, а стенд расчёта поднимается
/// на весь свой набор классов, и наблюдение за таблицей стало бы зависимым от
/// порядка их запуска. Третья: числа предложения обязаны сойтись с примером
/// договора, а стенд расчёта нарочно добавляет заблокированный полигон и
/// снимает тариф древесины — предусловия, которых в сделке быть не должно.
///
/// Срок действия цены объявляется настройкой службы: величина заказчиком не
/// названа (Q-010), и проверка не вправе требовать конкретного числа дней.
/// Здесь она задаётся стендом, а критерий AC-038a требует лишь того, чтобы
/// поле validUntil и дата в документе назывались этой же величиной.
///
public sealed class ImoltDealsStand : IAsyncLifetime
{
  /// Адрес вывоза примера договора вместе с координатами: от него в начальном
  /// наборе сохранены плечи 45 и 52 км.
  public const string PickupValue = "г Москва, ул Годовикова, д 9";

  public const double PickupLatitude = 55.8055;

  public const double PickupLongitude = 37.6206;

  public const string ConcreteGroupId = "beton-lom";

  /// Наименование группы отходов из начального набора: критерий AC-037a
  /// требует его в тексте документа, а не идентификатор.
  public const string ConcreteGroupName = "Лом бетона и железобетона";

  public const string VostokId = "vostok-timohovo";

  /// Плечо перевозки до «Востока» из начального набора: 45 км. По нему же
  /// посчитана стоимость перевозки примера договора.
  public const double VostokDistanceKm = 45;

  public const string IkshaId = "iksha";

  /// Объём примера договора: 20 тонн лома бетона.
  public const int ConcreteTons = 20;

  /// Предел расстояния, при котором в подбор попадают оба полигона примера
  /// договора (45 и 52 км).
  public const int WideDistanceKm = 60;

  /// Итог примера договора по двум выбранным полигонам: 19 800,00 + 20 080,00.
  /// Число взято из примера ответа setCalculationSelection.
  public const string SelectionTotalAmount = "39880.00";

  /// Название настройки, объявляющей срок действия цены предложения (R-038).
  /// Имя предложено проверкой: длительность заказчиком не названа (Q-010), и
  /// единственное, что критерий AC-038a требует, — одна величина на ответ и на
  /// документ.
  public const string ValidityDaysSetting = "QUOTE_VALIDITY_DAYS";

  /// Значение настройки на стенде. Намеренно не круглое: и семь, и четырнадцать
  /// дней — правдоподобные величины по умолчанию, и проверка со значением из
  /// этого ряда прошла бы при жёстко записанном сроке.
  public const int ValidityDays = 11;

  /// Название настройки, объявляющей допустимое отклонение цены (R-059).
  public const string ToleranceSetting = "QUOTE_PRICE_TOLERANCE_PERCENT";

  /// Значение настройки на стенде. Намеренно не совпадает со значением по
  /// умолчанию: с десятью процентами проверка прошла бы и у службы, которая
  /// настройку не читает вовсе.
  public const decimal TolerancePercent = 7m;

  /// Реквизиты исполнителя объявляет стенд, а не проверка. Значения из
  /// appsettings — настройка развёртывания; проверка, записавшая их у себя,
  /// подтверждала бы совпадение двух записей, а не то, что документ берёт
  /// реквизиты из настройки (R-037).
  public const string IssuerName = "ИМОЛТ на стенде проверок";

  public const string IssuerPhone = "+7 495 000-00-00";

  public const string IssuerEmail = "checks@imolt.test";

  /// Услуга с ценой «от» из примера договора (ответ listDocumentServices).
  public const string PricedServiceId = "ossig-mo";

  /// Услуга без цены, считаемая по запросу (там же).
  public const string OnRequestServiceId = "laboratory";

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

    service = new ImoltApiFactory(
        ConnectionString,
        new Dictionary<string, string?>
        {
          // Инвариантная культура: настройка читается службой как число, а не
          // человеком, и разделитель разрядов русской локали её порвал бы.
          [ValidityDaysSetting] = ValidityDays.ToString(CultureInfo.InvariantCulture),
          [ToleranceSetting] = TolerancePercent.ToString(CultureInfo.InvariantCulture),
          ["Quote:Issuer:Name"] = IssuerName,
          ["Quote:Issuer:Phone"] = IssuerPhone,
          ["Quote:Issuer:Email"] = IssuerEmail,
          ["Quote:Issuer:City"] = "Москва",
        });

    Client = service.CreateClient();
  }

  public async Task DisposeAsync()
  {
    Client?.Dispose();
    service?.Dispose();
    await database.DisposeAsync();
  }

  /// Сколько записей хранилища отвечает условию. Нужно там, где критерий
  /// говорит «заявка не создана»: отказ с кодом 422 и отказ с кодом 422 и
  /// записью в базе выглядят для клиента одинаково (AC-054a).
  public async Task<long> CountAsync(string sql, params (string Name, object Value)[] arguments)
  {
    await using var connection = new NpgsqlConnection(ConnectionString);
    await connection.OpenAsync(CancellationToken.None);

    await using var command = new NpgsqlCommand(sql, connection);
    foreach (var (name, value) in arguments)
    {
      command.Parameters.AddWithValue(name, value);
    }

    return (long)(await command.ExecuteScalarAsync(CancellationToken.None))!;
  }

  // Достройка начального набора до предусловий критериев сделки. Объявлена
  // здесь, а не в отдельных проверках: каталог услуг общий на всю область, и
  // разбросанные по проверкам вставки сделали бы исход зависимым от порядка
  // запуска.
  private async Task SeedAsync(CancellationToken cancellationToken)
  {
    await using var connection = new NpgsqlConnection(ConnectionString);
    await connection.OpenAsync(cancellationToken);

    await using var command = new NpgsqlCommand(
        $"""
            -- Каталог услуг по документации (AC-052a). Начальный набор
            -- оставляет таблицу пустой намеренно: состав пакета заказчиком не
            -- подтверждён (Q-005). Предусловие критерия заводится стендом, а
            -- не правкой набора, — иначе неподтверждённый состав уехал бы в
            -- развёртывание.
            --
            -- Обе записи — из примера ответа listDocumentServices: услуга с
            -- ценой «от» 50 000,00 ₽ и услуга без цены, считаемая по запросу.
            -- Перечень услуг целиком назван требованием R-052, здесь взяты две
            -- записи, которых критерию довольно: с ценой и без неё.
            insert into document_service (id, name, price_from, price_on_request) values
                ('{PricedServiceId}', 'Разрешение на перемещение ОССиГ (Московская область)', 50000.00, false),
                ('{OnRequestServiceId}', 'Лабораторные исследования и паспорта отходов', null, true)
            on conflict (id) do nothing;
            """,
        connection);

    await command.ExecuteNonQueryAsync(cancellationToken);
  }
}

/// Общий стенд сделки на все проверки области: контейнер поднимается один раз,
/// а не на каждый класс проверок.
[CollectionDefinition(Name)]
public sealed class ImoltDealsCollection : ICollectionFixture<ImoltDealsStand>
{
  public const string Name = "сделка ИМОЛТ на базе с начальным набором";
}
