using System.Globalization;
using Imolt.Database;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace Imolt.Api.Tests;

/// Стенд доступа и кабинета участника: одноразовая база со схемой, начальным
/// набором данных и службой, которой объявлен проверочный ключ бота платформы
/// MAX.
///
/// Стенд соседний, а не переиспользованный ImoltDealsStand или
/// ImoltReferencesStand, по трём причинам. Первая: только здесь службе задан
/// ключ бота, и это меняет смысл всех её точек — запрос с маркером перестаёт
/// быть гостевым. Стенды сделки и справочников проверяют как раз гостевое
/// поведение, и общий ключ сделал бы их исход зависимым от того, приложил ли
/// соседний класс заголовок Authorization. Вторая: AC-049b и AC-054b наблюдают
/// отсутствие записи в таблицах `subscriber` и `document_service_order`, а
/// счёт записей на общем стенде зависел бы от порядка запуска соседних
/// классов. Третья: AC-031c сверяет среднюю оценку полигона до и после отзыва,
/// а стенд справочников кладёт «Востоку» две оценки и закрепляет его среднюю
/// величиной 4,5 критерием AC-031a — добавленный отзыв сделал бы ту проверку
/// неверной.
///
/// Срок давности стартовых параметров объявляется настройкой службы: договором
/// он числом не назван, и проверка не вправе требовать конкретной величины.
/// Здесь она задаётся стендом, а критерий AC-049c требует лишь того, чтобы
/// параметры суточной давности маркера не давали.
///
public sealed class ImoltAccessStand : IAsyncLifetime
{
  /// Название настройки с ключом бота платформы MAX. Имя взято из уже
  /// заведённой переменной окружения проекта (.env.example, раздел «Платформа
  /// MAX»): второе имя для того же секрета развело бы одно окружение надвое.
  public const string BotTokenSetting = "MAX_BOT_TOKEN";

  /// Проверочный ключ бота. Строка заведомо неповторима, чтобы её появление в
  /// ответе нельзя было списать на совпадение (AC-056c). Настоящий ключ
  /// выдают организаторы трека, и проверке он не нужен: подпись считается
  /// этим ключом с обеих сторон.
  public const string BotToken = "7714829301:PROVERKA-imolt-b3f1a97c5d024e68";

  /// Название настройки, объявляющей срок давности стартовых параметров.
  /// Имя предложено проверкой: договор величину не называет, а ADR-0006
  /// требует отказывать устаревшим параметрам.
  public const string InitDataTtlSetting = "MAX_INIT_DATA_TTL_SECONDS";

  /// Значение настройки на стенде. Намеренно не круглое: и 60, и 300, и 86 400
  /// секунд — правдоподобные величины по умолчанию, и проверка со значением из
  /// этого ряда прошла бы при жёстко записанном сроке.
  public const int InitDataTtlSeconds = 437;

  /// Адрес вывоза примера договора вместе с координатами: от него в начальном
  /// наборе сохранены плечи до обоих полигонов.
  public const string PickupValue = "г Москва, ул Годовикова, д 9";

  public const double PickupLatitude = 55.8055;

  public const double PickupLongitude = 37.6206;

  public const string ConcreteGroupId = "beton-lom";

  /// Объём примера договора: 20 тонн лома бетона.
  public const int ConcreteTons = 20;

  /// Предел расстояния, при котором в подбор попадают оба полигона примера
  /// договора (45 и 52 км).
  public const int WideDistanceKm = 60;

  /// Полигон, на котором проверяется пересчёт средней оценки. Взята «Икша»:
  /// в начальном наборе отзывов нет ни у одного полигона, и этот стенд их не
  /// досевает — средняя считается от того состояния, которое проверка видит
  /// сама.
  public const string ReviewedLandfillId = "iksha";

  /// Услуга каталога с ценой «от» из примера договора (ответ
  /// listDocumentServices).
  public const string PricedServiceId = "ossig-mo";

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
          [BotTokenSetting] = BotToken,

          // Инвариантная культура: настройка читается службой как число, а не
          // человеком, и разделитель разрядов русской локали её порвал бы.
          [InitDataTtlSetting] = InitDataTtlSeconds.ToString(CultureInfo.InvariantCulture),
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
  /// говорит «учётная запись не заведена» или «заказ не создан»: отказ с
  /// кодом 401 и отказ с кодом 401 и заведённой записью выглядят для клиента
  /// одинаково (AC-049b, AC-054b, AC-054c).
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

  // Достройка начального набора до предусловий критериев кабинета. Объявлена
  // здесь, а не в отдельных проверках: каталог услуг общий на всю область, и
  // разбросанные по проверкам вставки сделали бы исход зависимым от порядка
  // запуска.
  private async Task SeedAsync(CancellationToken cancellationToken)
  {
    await using var connection = new NpgsqlConnection(ConnectionString);
    await connection.OpenAsync(cancellationToken);

    await using var command = new NpgsqlCommand(
        $"""
            -- Услуга каталога, которую заказывает участник (AC-052b, AC-054c).
            -- Начальный набор оставляет каталог пустым намеренно: состав пакета
            -- заказчиком не подтверждён (Q-005). Предусловие критерия заводится
            -- стендом, а не правкой набора, — иначе неподтверждённый состав
            -- уехал бы в развёртывание.
            --
            -- Запись взята из примера ответа listDocumentServices: услуга с
            -- ценой «от» 50 000,00 ₽. Второй услуги здесь нет — критериям
            -- заказа довольно одной, а лишняя запись ничего не различает.
            insert into document_service (id, name, price_from, price_on_request) values
                ('{PricedServiceId}', 'Разрешение на перемещение ОССиГ (Московская область)', 50000.00, false)
            on conflict (id) do nothing;
            """,
        connection);

    await command.ExecuteNonQueryAsync(cancellationToken);
  }
}

/// Общий стенд доступа на все проверки области: контейнер поднимается один
/// раз, а не на каждый класс проверок.
[CollectionDefinition(Name)]
public sealed class ImoltAccessCollection : ICollectionFixture<ImoltAccessStand>
{
  public const string Name = "доступ и кабинет ИМОЛТ на базе с начальным набором";
}
