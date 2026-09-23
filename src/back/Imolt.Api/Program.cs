using System.Globalization;
using Imolt.Api;
using Imolt.Calculations.Adapters;
using Imolt.Calculations.Application;
using Imolt.Calculations.Ports;
using Imolt.Database;
using Imolt.Deals.Adapters;
using Imolt.Deals.Application;
using Imolt.Deals.Ports;
using Imolt.References.Adapters;
using Imolt.References.Application;
using Imolt.References.Ports;
using Imolt.Shared;
using Npgsql;

// Вход расчётной части: хост, состав зависимостей, маршруты и отдача
// договора. Предметная логика живёт в сборках областей — справочники, расчёт,
// сделка (ADR-0001, ADR-0005); здесь только сборка изделия.

var builder = WebApplication.CreateBuilder(args);

// Суммы и даты сервиса показываются в русской локали (правила проекта,
// раздел «Язык и термины»), поэтому культура задаётся явно, а не наследуется
// от локали контейнера, где она равна инвариантной.
var culture = new CultureInfo("ru-RU");
CultureInfo.DefaultThreadCurrentCulture = culture;
CultureInfo.DefaultThreadCurrentUICulture = culture;

// Настройки JSON — общие с областями: копия настроек начинает отдавать другой
// договор, а денежная сумма уходит числом вместо строки.
builder.Services.ConfigureHttpJsonOptions(options =>
{
  // Настройки берутся целиком, а не по одному свойству: перенос выборочных
  // полей уже стоил одного расхождения — необязательное поле уходило в ответ
  // пустым там, где договор пустоты не допускает.
  var shared = ImoltJson.Options;
  options.SerializerOptions.PropertyNamingPolicy = shared.PropertyNamingPolicy;
  options.SerializerOptions.PropertyNameCaseInsensitive = shared.PropertyNameCaseInsensitive;
  options.SerializerOptions.NumberHandling = shared.NumberHandling;
  options.SerializerOptions.DefaultIgnoreCondition = shared.DefaultIgnoreCondition;
  foreach (var converter in shared.Converters)
  {
    options.SerializerOptions.Converters.Add(converter);
  }
});

// Время приходит в области портом: домен не обращается к системным часам
// (правило ARCH-025).
builder.Services.AddSingleton<IClock, SystemClock>();

// Столбцы базы именуются через подчёркивание, поля записей — словами с
// заглавной. Сопоставление включается один раз на процесс: настройка у
// средства доступа к данным глобальная, и второе место её задания разошлось
// бы с первым.
Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;

// Строка подключения и адрес внешней службы читаются в момент разрешения
// зависимости, а не при сборке состава. Причина не в красоте: проверочный
// стенд добавляет свои настройки позже, чем выполняется этот файл, и ветвление
// по конфигурации прямо здесь оставляло службу вовсе без переходников.
builder.Services.AddSingleton(services =>
{
  var connectionString = services.GetRequiredService<IConfiguration>()["DATABASE_URL"];

  return string.IsNullOrWhiteSpace(connectionString)
      ? throw new InvalidOperationException("переменная DATABASE_URL не задана")
      : NpgsqlDataSource.Create(connectionString);
});

// Переходники области «справочники». Область наружу открывает только порты, а
// какой переходник за портом стоит — решает состав изделия (ADR-0005).
builder.Services.AddScoped<IWasteGroupCatalog, WasteGroupCatalog>();
builder.Services.AddScoped<ILandfillRegistry, LandfillRegistry>();
builder.Services.AddScoped<IDataFreshnessSource, DataFreshnessSource>();

// Ведение справочников (R-042, R-044, R-045). Читатель книги объявлен портом:
// библиотека разбора — вариант переходника, а не правило проекта, и её замена
// не должна трогать сценарий импорта (карточка практики PRACT-033).
builder.Services.AddScoped<IReferenceEditor, ReferenceEditor>();
builder.Services.AddScoped<IReferenceImports, ReferenceImportStore>();
builder.Services.AddScoped<ISyncRuns, SyncRunStore>();
builder.Services.AddSingleton<IWorkbookReader, WorkbookReader>();
builder.Services.AddScoped<ReferenceImportScenarios>();

// Подсказки адреса: справочник проекта — основной источник, внешняя служба
// включается настройкой. Целевая служба заказчиком не назначена (Q-014),
// поэтому выбор источника остаётся настройкой, а не правкой кода области.
builder.Services.AddScoped<AddressDirectorySuggestions>();
builder.Services.AddHttpClient<UpstreamAddressSuggestions>(client =>
{
  // Граница ожидания обязательна: без неё отказ источника превращается в
  // зависший запрос, а не в объявленный договором отказ (ADR-0002).
  client.Timeout = TimeSpan.FromSeconds(5);
});
builder.Services.AddScoped<IAddressSuggestions>(services =>
{
  var upstream = services.GetRequiredService<IConfiguration>()["ADDRESS_SUGGESTIONS_URL"];

  if (string.IsNullOrWhiteSpace(upstream))
  {
    return services.GetRequiredService<AddressDirectorySuggestions>();
  }

  var suggestions = services.GetRequiredService<UpstreamAddressSuggestions>();
  suggestions.Use(new Uri(upstream));
  return suggestions;
});

// Область «расчёт». Справочные данные приходят переходником к соседней
// области, а расстояния, коэффициенты и хранение расчёта — её собственные
// переходники: это её данные, а не справочник (R-020, R-022, R-058).
builder.Services.AddScoped<IReferenceData, CalculationReferences>();
builder.Services.AddScoped<IRoadDistances, RoadDistances>();
builder.Services.AddScoped<ITransportCoefficients, TransportCoefficients>();
builder.Services.AddScoped<ICalculationStore, CalculationStore>();
builder.Services.AddScoped<CalculationScenarios>();

// Область «сделка». Срок действия цены читается настройкой в момент
// разрешения зависимости: длительность заказчиком не названа (Q-010), и
// значение по умолчанию помечено демонстрационным.
builder.Services.AddScoped<ICalculationSnapshot, CalculationSnapshot>();
builder.Services.AddScoped<IQuoteStore, QuoteStore>();
builder.Services.AddScoped<IPickupRequestStore, PickupRequestStore>();
builder.Services.AddScoped<IDocumentServiceCatalog, DocumentServiceCatalog>();
builder.Services.AddSingleton<IQuoteDocumentWriter, QuoteDocumentWriter>();
builder.Services.AddScoped<IPriceValidity>(services => new PriceValidity(
    services.GetRequiredService<IConfiguration>()
        .GetValue("QUOTE_VALIDITY_DAYS", PriceValidity.DemonstrationDays)));
builder.Services.AddScoped<DealScenarios>();

// Личность от платформы MAX (ADR-0006). Ключ бота и срок давности стартовых
// параметров читаются настройками в момент разрешения зависимости: ключ —
// секрет, которому не место в коде (R-056), а срок договором не назван.
builder.Services.AddScoped<ISubscriberStore, SubscriberStore>();
builder.Services.AddScoped<IParticipantPermissions, ParticipantPermissionStore>();
builder.Services.AddScoped<IDocumentServiceOrderStore, DocumentServiceOrderStore>();
builder.Services.AddSingleton<IAccessTokens>(services =>
{
    var configuration = services.GetRequiredService<IConfiguration>();

    return new AccessTokens(
        configuration["IMOLT_SESSION_SECRET"],
        configuration.GetValue("IMOLT_SESSION_TTL_SECONDS", 86400));
});
builder.Services.AddScoped(services =>
{
    var configuration = services.GetRequiredService<IConfiguration>();

    return new MaxIdentitySettings(
        configuration["MAX_BOT_TOKEN"] ?? string.Empty,
        TimeSpan.FromSeconds(configuration.GetValue(
            "MAX_INIT_DATA_TTL_SECONDS",
            (int)MaxIdentitySettings.DemonstrationLifetime.TotalSeconds)));
});
// Состав обладателей права вести справочники называет развёртывание:
// владельца данных заказчик не назначал (Q-013, ADR-0007). Незаданная
// переменная прав не трогает вовсе.
builder.Services.AddScoped(services => DataManagerSettings.Parse(
    services.GetRequiredService<IConfiguration>()["IMOLT_DATA_MANAGERS"]));
builder.Services.AddScoped<AccessScenarios>();

var app = builder.Build();

// Схему применяет тот, кто разворачивает, а не служба при каждом старте:
// база общая с будущей службой сбора, и две единицы, молча накатывающие
// схему на старте, дают гонку (ADR-0002, инвариант 6). Признак задаётся
// окружением и включён в compose.
var databaseUrl = app.Configuration["DATABASE_URL"];
if (app.Configuration.GetValue("IMOLT_APPLY_MIGRATIONS", false)
    && !string.IsNullOrWhiteSpace(databaseUrl))
{
  var applied = await MigrationRunner.ApplyAsync(databaseUrl, CancellationToken.None);
  app.Logger.LogInformation(
      "Схема базы данных приведена к последней версии, применено миграций: {Count}", applied.Count);
}

// Единственное место, где исключение превращается в документ об ошибке
// формата RFC 9457. Второе такое место означало бы два разных договора об
// ошибках у одной службы.
app.UseExceptionHandler(ProblemResponses.ExceptionHandler);

// Маршруты собраны единицами по назначению: договор отдельно, служебные
// точки отдельно. Так у каждой есть символ, к которому крепится якорь
// трассируемости, — в операторах верхнего уровня крепить его не к чему.
app.MapContractEndpoints();
app.MapServiceEndpoints();
app.MapReferenceEndpoints();
app.MapReferenceMaintenanceEndpoints();
app.MapCalculationEndpoints();
app.MapDealEndpoints();
app.MapAccessEndpoints();

// Неизвестный путь отвечает тем же документом об ошибке, что и остальные
// отказы. Пустое тело с кодом 404 клиенту разбирать нечем, а на общем узле
// такой ответ вдобавок легко спутать со страницей мини-приложения (ADR-0004).
app.MapFallback(ProblemResponses.UnknownPath);

app.Run();

// Точка входа объявлена открытой ради интеграционных проверок: они поднимают
// в процессе ту же службу, что уходит в образ. WebApplicationFactory требует
// открытый тип точки входа, а операторы верхнего уровня оставляют его
// внутренним.
public partial class Program { }
