using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using Imolt.Database;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace Imolt.Api.Tests;

/// Стенд редактора цен и справочников: одноразовая база со схемой и начальным
/// набором, служба с объявленным ключом бота платформы MAX и объявленным
/// составом обладателей права вести справочники.
///
/// Стенд отдельный, а не переиспользованный, по трём причинам.
///
/// Первая и главная: проверки этого среза меняют справочник, а соседние
/// классы закрепляют его исходные величины. ImoltReferencesStand закрепляет
/// среднюю оценку «Востока» величиной 4,5 (AC-031a) и дату актуальности
/// 17.09.2026 у всех записей (AC-048a, AC-048b), а цены и тарифы примера
/// договора — 12,00 ₽ за тонна-километр и 450,00 ₽ за тонну — входят в
/// ожидаемые суммы проверок расчёта. Правка цены на общем стенде сделала бы
/// те проверки неверными по чужой причине, и порядок запуска классов решал бы
/// их исход.
///
/// Вторая: только здесь службе объявлен состав обладателей права
/// `manageReferences` (ADR-0007). Стенд доступа его не объявляет намеренно —
/// пустая переменная прав не трогает вовсе, и его участники остаются без
/// права. Общая настройка развела бы смысл маркера надвое.
///
/// Третья: критерии AC-044d и AC-044e наблюдают наличие и отсутствие записи
/// в таблице `sync_run`, а на общем стенде число прогонов зависело бы от
/// того, подтверждал ли импорт соседний класс проверок.
///
/// Право выдаётся переменной окружения, а не записью в таблицу прав: так его
/// выдачу объявил ADR-0007 («состав обладателей права называет
/// развёртывание»), и проверка не вправе заводить свой способ — он расходился
/// бы с объявленным при первой же правке модели прав.
///
public sealed class ImoltReferenceEditorStand : IAsyncLifetime
{
  /// Название настройки, перечисляющей обладателей права вести справочники.
  /// Имя и форма — из ADR-0007: учётные записи действующего поставщика
  /// личности через запятую.
  public const string DataManagersSetting = "IMOLT_DATA_MANAGERS";

  /// Учётная запись платформы, которой право выдано. Единственная в списке:
  /// ADR-0007 разрешает пустой состав, и проверка обязана отличать «право
  /// выдано названному» от «право есть у всякого вошедшего».
  public const long DataManagerMaxUserId = 770101;

  /// Учётная запись платформы, которой право не выдано. Сессия у неё
  /// настоящая — иначе отказ по праву был бы неотличим от отказа по входу
  /// (AC-042c).
  public const long OutsiderMaxUserId = 770102;

  /// Дата актуальности всего, что кладёт начальный набор и достройка стенда.
  /// Совпадает с датой набора 0002_demo_dataset.sql. Она заведомо раньше дня
  /// прогона, и на этом держится предусловие AC-048c.
  public const string SeedDate = "2026-09-17";

  public const string WasteGroupsPath = "/v1/waste-groups";

  public const string LandfillsPath = "/v1/landfills";

  public const string DataFreshnessPath = "/v1/data-freshness";

  public const string ReferenceImportsPath = "/v1/reference-imports";

  public const string SyncRunsLatestPath = "/v1/sync-runs/latest";

  /// Группа отходов, которой AC-042a задаёт цену перевозки 32,00.
  public const string PriceEditorGroupId = "proverka-redaktor-ceny";

  /// Группа отходов, на которой AC-042b наблюдает сохранность непереданных
  /// полей. У неё непустой перечень кодов ФККО и плотность, отличная от
  /// единицы: на значении по умолчанию потеря поля была бы незаметна.
  public const string PartialUpdateGroupId = "proverka-chastichnaya-pravka";

  public const string PartialUpdateGroupName = "Проверочная группа частичной правки";

  public const string PartialUpdateFkkoCode = "8 99 999 01 21 5";

  public const double PartialUpdateDensity = 1.7;

  /// Группа отходов, которую AC-042c пытается править без права.
  public const string WithoutPermissionGroupId = "proverka-bez-prava";

  public const string WithoutPermissionPrice = "22.00";

  /// Группа отходов, на которой AC-043a наблюдает перенос новой цены в
  /// расчёт. Цена 30,00 — из предусловия критерия.
  public const string CalculationGroupId = "proverka-cena-rascheta";

  /// Группа отходов, на которой AC-048c наблюдает сдвиг даты актуальности цен.
  public const string FreshnessGroupId = "proverka-data-cen";

  /// Группа отходов ячейки «полигон и группа отходов» (AC-042d, AC-042e).
  public const string TariffGroupId = "proverka-tarif";

  /// Полигон ячейки тарифа: тот же, что в примере договора, — у него в
  /// начальном наборе сохранены плечи перевозки.
  public const string TariffLandfillId = "vostok-timohovo";

  /// Полигон, которому AC-044a ставит статус вручную.
  public const string ManualStatusLandfillId = "proverka-status-ruchnoy";

  /// Полигон, на котором AC-044b проверяет отказ статусу вне перечня.
  public const string StatusVocabularyLandfillId = "proverka-status-perechen";

  /// Полигон, который AC-044c ищет отбором по статусу.
  public const string StatusFilterLandfillId = "proverka-status-otbor";

  /// Группа отходов, по которой AC-045a получает предпросмотр расхождения.
  public const string PreviewGroupId = "proverka-import-predprosmotr";

  public const string PreviewGroupPrice = "25.00";

  /// Две группы отходов ровно на два расхождения AC-045c.
  public const string AppliedFirstGroupId = "proverka-import-pervaya";

  public const string AppliedSecondGroupId = "proverka-import-vtoraya";

  /// Группа отходов устаревающего предпросмотра (AC-045d).
  public const string StalePreviewGroupId = "proverka-import-ustarevanie";

  /// Группа отходов книги в записи табличного редактора (AC-045h). Отдельная
  /// от прочих: эта проверка проходит оба шага и меняет вместе с ценой
  /// название, а соседние критерии закрепляют свои величины.
  public const string EditorWrittenGroupId = "proverka-import-zapis-redaktora";

  public const string EditorWrittenGroupPrice = "36.00";

  /// Полигон, которого в реестре нет: книга заводит его (AC-046a). Координаты
  /// настоящие — деревня Тимохово Богородского городского округа, — но сам
  /// объект проверочный: заводить в набор данных несуществующий полигон с
  /// правдоподобным именем значило бы засорить демонстрацию.
  public const string NewLandfillId = "proverka-import-novyy-poligon";

  public const string NewLandfillName = "Проверочный объект приёма из перечня";

  public const string NewLandfillAddress = "Московская обл., проверочный адрес объекта";

  public const double NewLandfillLatitude = 55.6789;

  public const double NewLandfillLongitude = 38.1234;

  /// Полигон, у строки которого в книге нет координат (AC-046b).
  public const string IncompleteLandfillId = "proverka-import-bez-koordinat";

  /// Полигон, которого заводят между разбором и подтверждением (AC-046c).
  public const string RaceLandfillId = "proverka-import-gonka";

  /// Группа отходов со столбцом кодов ФККО (AC-045f).
  public const string FkkoImportGroupId = "proverka-import-fkko";

  public const string FkkoImportCode = "8 88 888 01 21 5";

  /// Группа отходов строки, где цена записана словом (AC-045b).
  public const string WrittenPriceGroupId = "proverka-import-slovom";

  /// Группа отходов строки с формулой в ячейке (AC-045b).
  public const string FormulaGroupId = "proverka-import-formula";

  /// Идентификатор, которого в справочнике нет: строка со ссылкой на
  /// неизвестную запись (AC-045b). Импорт новых записей не заводит.
  public const string UnknownGroupId = "proverka-import-neizvestnaya";

  /// Две группы отходов ровно на два изменения импорта, записывающего прогон
  /// обновления (AC-044d). Отдельные от AC-045c: иначе число применённых
  /// изменений зависело бы от того, какой класс проверок отработал раньше.
  public const string SyncRunFirstGroupId = "proverka-progon-pervaya";

  public const string SyncRunSecondGroupId = "proverka-progon-vtoraya";

  /// Полигон, которого нет в справочнике (AC-042e).
  public const string UnknownLandfillId = "proverka-net-takogo-poligona";

  private readonly PostgreSqlContainer database = new PostgreSqlBuilder("postgres:17-alpine")
      .WithDatabase("imolt")
      .WithUsername("imolt")
      .WithPassword("imolt")
      .Build();

  private ImoltApiFactory? service;

  public string ConnectionString => database.GetConnectionString();

  public HttpClient Client { get; private set; } = null!;

  /// День, которым критерии называют «дату правки». Считается по тому же
  /// поясу обслуживаемой области, что и у службы (SystemClock): пояс машины,
  /// на которой идёт проверка, к обещанию о свежести данных отношения не
  /// имеет, и на машине за пределами Москвы проверка иначе мигала бы по
  /// причине, к поведению не относящейся.
  public string EditDate => DateOnly
      .FromDateTime(DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(3)).DateTime)
      .ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

  public async Task InitializeAsync()
  {
    await database.StartAsync();

    await MigrationRunner.ApplyAsync(ConnectionString, CancellationToken.None);
    await SeedAsync(CancellationToken.None);

    service = new ImoltApiFactory(
        ConnectionString,
        new Dictionary<string, string?>
        {
          // Ключ бота берётся у стенда доступа, а не заводится второй строкой:
          // подпись стартовых параметров считается этим значением с обеих
          // сторон, и второй проверочный ключ развёл бы одно окружение надвое.
          [ImoltAccessStand.BotTokenSetting] = ImoltAccessStand.BotToken,

          // Состав обладателей права. Инвариантная культура обязательна:
          // служба читает список как строку идентификаторов, а разделитель
          // разрядов русской локали порвал бы идентификатор пополам.
          [DataManagersSetting] = DataManagerMaxUserId.ToString(CultureInfo.InvariantCulture),
        });

    Client = service.CreateClient();
  }

  public async Task DisposeAsync()
  {
    Client?.Dispose();
    service?.Dispose();
    await database.DisposeAsync();
  }

  /// Маркер участника, которому право вести справочники выдано.
  public Task<string> DataManagerTokenAsync() => AccessChecks.TokenAsync(Client, DataManagerMaxUserId);

  /// Маркер участника с сессией, но без права вести справочники.
  public Task<string> OutsiderTokenAsync() => AccessChecks.TokenAsync(Client, OutsiderMaxUserId);

  /// Чтение с маркером либо без него: пустой маркер означает гостя.
  public Task<HttpResponseMessage> GetAsync(string path, string? token = null)
      => Client.SendAsync(Request(HttpMethod.Get, path, token, content: null));

  /// Отправка тела JSON выбранным методом. Метод передаётся отдельно, потому
  /// что редактор объявлен договором тремя разными методами: PATCH у группы
  /// отходов, PUT у тарифа и статуса.
  public Task<HttpResponseMessage> SendJsonAsync(
      HttpMethod method,
      string path,
      string json,
      string? token)
      => Client.SendAsync(Request(method, path, token, new StringContent(json, Encoding.UTF8, "application/json")));

  /// Загрузка файла справочника формой multipart/form-data — так объявлен
  /// договором запрос операции startReferenceImport.
  public Task<HttpResponseMessage> UploadReferenceAsync(
      byte[] file,
      string fileName,
      string kind,
      string? token,
      string mediaType = WorkbookBuilder.MediaType)
  {
    var form = new MultipartFormDataContent();

    var part = new ByteArrayContent(file);
    part.Headers.ContentType = new MediaTypeHeaderValue(mediaType);
    form.Add(part, "file", fileName);
    form.Add(new StringContent(kind), "kind");

    return Client.SendAsync(Request(HttpMethod.Post, ReferenceImportsPath, token, form));
  }

  /// Подтверждение разобранного импорта. Тела у операции нет — состав
  /// изменений хранит предпросмотр, а не запрос.
  public Task<HttpResponseMessage> ConfirmReferenceImportAsync(string importId, string? token)
      => Client.SendAsync(
          Request(HttpMethod.Post, $"{ReferenceImportsPath}/{importId}/confirmation", token, content: null));

  /// Сколько записей хранилища отвечает условию. Нужно там, где критерий
  /// говорит «запись не создана»: отказ с кодом 404 и отказ с кодом 404 и
  /// заведённой записью выглядят для клиента одинаково (AC-042e).
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

  /// Заведение полигона в обход импорта. Через хранилище, а не через точку
  /// договора: операции заведения полигона договор не объявляет вовсе — в том
  /// и состоит R-046, — а критерий AC-046c требует, чтобы запись появилась
  /// между разбором книги и её подтверждением.
  public async Task AddLandfillAsync(string id, string name)
  {
    await using var connection = new NpgsqlConnection(ConnectionString);
    await connection.OpenAsync(CancellationToken.None);

    await using var command = new NpgsqlCommand(
        """
        insert into landfill (id, name, address, latitude, longitude,
                              status, status_source, status_updated_at)
        values (@id, @name, 'Московская обл., адрес чужой записи', 55.5, 38.5,
                'active', 'manual', current_date)
        on conflict (id) do nothing
        """,
        connection);
    command.Parameters.AddWithValue("id", id);
    command.Parameters.AddWithValue("name", name);

    await command.ExecuteNonQueryAsync(CancellationToken.None);
  }

  /// Приведение хранилища к предусловию «прогонов обновления не записано»
  /// (AC-044e). Через хранилище, а не через точку договора: операции удаления
  /// прогона договор не объявляет, а подтверждённый импорт соседнего класса
  /// проверок прогон записывает. Классы одной коллекции идут по очереди,
  /// поэтому очистка и следующее за ней чтение не переплетаются с чужими
  /// подтверждениями.
  public async Task ClearSyncRunsAsync()
  {
    await using var connection = new NpgsqlConnection(ConnectionString);
    await connection.OpenAsync(CancellationToken.None);

    await using var command = new NpgsqlCommand("delete from sync_run", connection);
    await command.ExecuteNonQueryAsync(CancellationToken.None);
  }

  private static HttpRequestMessage Request(
      HttpMethod method,
      string path,
      string? token,
      HttpContent? content)
  {
    var request = new HttpRequestMessage(method, path) { Content = content };

    // Маркер кладётся в каждый запрос отдельно, а не в DefaultRequestHeaders
    // клиента: клиент на стенде один на все классы проверок, и общий
    // заголовок сделал бы гостевой запрос соседней проверки запросом
    // участника — ровно то, что проверяют AC-042c и AC-044e.
    if (!string.IsNullOrEmpty(token))
    {
      request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    return request;
  }

  // Достройка начального набора до предусловий критериев редактора. Объявлена
  // здесь, а не в отдельных проверках: записи общие на пять классов, и
  // разбросанные по проверкам вставки сделали бы исход зависимым от порядка
  // запуска. У каждого критерия своя запись — правка одного критерия не
  // должна менять предусловие соседнего.
  private async Task SeedAsync(CancellationToken cancellationToken)
  {
    await using var connection = new NpgsqlConnection(ConnectionString);
    await connection.OpenAsync(cancellationToken);

    await using var command = new NpgsqlCommand(
        $"""
            -- Группы отходов редактора. Цены различаются у каждой записи: на
            -- одинаковых величинах перепутанная запись прошла бы проверку.
            insert into waste_group (id, name, transport_price_per_ton_km, density_ton_per_m3, updated_at) values
                ('{PriceEditorGroupId}',      'Проверочная группа редактора цен',             20.00, 1.0000, date '{SeedDate}'),
                ('{PartialUpdateGroupId}',    '{PartialUpdateGroupName}',                     21.00, 1.7000, date '{SeedDate}'),
                ('{WithoutPermissionGroupId}','Проверочная группа без права',   {WithoutPermissionPrice}, 1.0000, date '{SeedDate}'),
                -- 30,00 — предусловие AC-043a: цена, при которой выполнен
                -- первый расчёт.
                ('{CalculationGroupId}',      'Проверочная группа расчёта',                   30.00, 1.0000, date '{SeedDate}'),
                ('{FreshnessGroupId}',        'Проверочная группа даты актуальности',         23.00, 1.0000, date '{SeedDate}'),
                ('{TariffGroupId}',           'Проверочная группа тарифа',                    24.00, 1.0000, date '{SeedDate}'),
                ('{PreviewGroupId}',          'Проверочная группа предпросмотра', {PreviewGroupPrice}, 1.0000, date '{SeedDate}'),
                ('{AppliedFirstGroupId}',     'Проверочная группа импорта первая',            26.00, 1.0000, date '{SeedDate}'),
                ('{AppliedSecondGroupId}',    'Проверочная группа импорта вторая',            27.00, 1.0000, date '{SeedDate}'),
                ('{StalePreviewGroupId}',     'Проверочная группа устаревшего предпросмотра', 28.00, 1.0000, date '{SeedDate}'),
                ('{FkkoImportGroupId}',       'Проверочная группа кодов ФККО',                29.00, 1.0000, date '{SeedDate}'),
                ('{WrittenPriceGroupId}',     'Проверочная группа цены словом',               31.00, 1.0000, date '{SeedDate}'),
                ('{FormulaGroupId}',          'Проверочная группа формулы',                   33.00, 1.0000, date '{SeedDate}'),
                ('{SyncRunFirstGroupId}',     'Проверочная группа прогона первая',            34.00, 1.0000, date '{SeedDate}'),
                ('{SyncRunSecondGroupId}',    'Проверочная группа прогона вторая',            35.00, 1.0000, date '{SeedDate}'),
                ('{EditorWrittenGroupId}',    'Проверочная группа записи редактора', {EditorWrittenGroupPrice}, 1.0000, date '{SeedDate}')
            on conflict (id) do nothing;

            -- Коды ФККО двум группам: AC-042b наблюдает их сохранность при
            -- частичной правке, AC-045f — отказ импорта от этого столбца.
            -- Пустой перечень обе проверки сделал бы вырожденными.
            insert into waste_group_fkko_code (waste_group_id, code) values
                ('{PartialUpdateGroupId}', '{PartialUpdateFkkoCode}'),
                ('{FkkoImportGroupId}',    '{FkkoImportCode}')
            on conflict do nothing;

            -- Полигоны ручного статуса. Все три начинают активными: критерии
            -- AC-044a и AC-044c наблюдают переход в «заблокирован», а на уже
            -- заблокированной записи перехода не видно.
            insert into landfill (
                id, name, legal_entity, address, latitude, longitude,
                object_kind, registered_in_ais_ossig, status, status_source, status_updated_at
            ) values
                ('{ManualStatusLandfillId}', 'Площадка «Ручной статус»', 'ООО «Ручной статус»',
                 'Московская обл., Богородский г. о., д. Ручная', 55.8100, 38.4100,
                 'disposal', true, 'active', 'registry', date '{SeedDate}'),
                ('{StatusVocabularyLandfillId}', 'Площадка «Перечень статусов»', 'ООО «Перечень»',
                 'Московская обл., Богородский г. о., д. Перечневая', 55.8200, 38.4200,
                 'disposal', true, 'active', 'registry', date '{SeedDate}'),
                ('{StatusFilterLandfillId}', 'Площадка «Отбор по статусу»', 'ООО «Отбор»',
                 'Московская обл., Богородский г. о., д. Отборная', 55.8300, 38.4300,
                 'disposal', true, 'active', 'registry', date '{SeedDate}')
            on conflict (id) do nothing;

            -- Тарифы утилизации. Полигоны ручного статуса принимают только
            -- группу тарифа: плеча перевозки до них в наборе нет, и попади они
            -- в подбор расчёта AC-043a, вариант размещения считать было бы
            -- нечем.
            insert into landfill_tariff (landfill_id, waste_group_id, disposal_price_per_ton, updated_at) values
                ('{TariffLandfillId}',           '{CalculationGroupId}', 400.00, date '{SeedDate}'),
                ('{TariffLandfillId}',           '{TariffGroupId}',      400.00, date '{SeedDate}'),
                ('{ManualStatusLandfillId}',     '{TariffGroupId}',      500.00, date '{SeedDate}'),
                ('{StatusVocabularyLandfillId}', '{TariffGroupId}',      500.00, date '{SeedDate}'),
                ('{StatusFilterLandfillId}',     '{TariffGroupId}',      500.00, date '{SeedDate}')
            on conflict (landfill_id, waste_group_id) do nothing;
            """,
        connection);

    await command.ExecuteNonQueryAsync(cancellationToken);
  }
}

/// Общий стенд редактора справочников на все проверки среза: контейнер
/// поднимается один раз, а не на каждый класс проверок, и классы коллекции
/// идут по очереди — от этого зависят предусловия AC-044d и AC-044e.
[CollectionDefinition(Name)]
public sealed class ImoltReferenceEditorCollection : ICollectionFixture<ImoltReferenceEditorStand>
{
  public const string Name = "редактор цен и справочников ИМОЛТ с выданным правом ведения";
}
