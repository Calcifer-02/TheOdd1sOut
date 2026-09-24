using System.Globalization;
using Imolt.Bot;
using Imolt.Bot.Adapters;
using Imolt.Bot.Application;
using Imolt.Bot.Ports;
using Npgsql;

// Состав изделия «чат-бот MAX» (КОМП-07): хост, зависимости и точки входа.
// Сценарии переписки живут в `Application`, формат платформы — в `Adapters`,
// правила — в `Domain`. Обновления бот читает длинным опросом, как объявляет
// ADR-0009; вебхук остаётся возможностью настройки.

var builder = WebApplication.CreateBuilder(args);

// Суммы и даты в переписке показываются русской локалью (правила проекта,
// раздел «Язык и термины»), поэтому культура задаётся явно, а не наследуется
// от локали контейнера, где она равна инвариантной.
var culture = CultureInfo.GetCultureInfo("ru-RU");
CultureInfo.DefaultThreadCurrentCulture = culture;
CultureInfo.DefaultThreadCurrentUICulture = culture;

// Столбцы базы именуются через подчёркивание, поля записей — словами с
// заглавной. Сопоставление включается один раз на процесс.
Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;

// Пределы переписки и обращений к платформе — настройка службы, а не
// константы в коде (R-078, R-081, R-082). Неверное значение останавливает
// запуск, а не всплывает первым отказом платформы.
builder.Services.AddOptions<BotOptions>()
    .Bind(builder.Configuration.GetSection(BotOptions.Section))
    .ValidateDataAnnotations()
    .ValidateOnStart();

// Те же настройки нужны раньше, чем поднимется состав зависимостей: по ним
// задаётся граница ожидания обращения к платформе. Читаются они из того же
// раздела — второго источника значений не появляется.
var settings = new BotOptions();
builder.Configuration.GetSection(BotOptions.Section).Bind(settings);

builder.Services.AddSingleton(TimeProvider.System);

// Ожидание между обращениями к платформе приходит зависимостью: так проверка
// пределов двигает время сама и не ждёт по-настоящему.
builder.Services.AddSingleton<Wait>(_ => (span, cancellationToken) => Task.Delay(span, cancellationToken));

// Состояние переписок переживает перезапуск службы и удаление сообщений
// (R-080). Строка подключения читается в момент разрешения зависимости:
// служба обязана подниматься и без базы, называя нехватку настройки.
builder.Services.AddSingleton(services =>
{
  var connectionString = services.GetRequiredService<IConfiguration>()["DATABASE_URL"];

  return string.IsNullOrWhiteSpace(connectionString)
      ? throw new InvalidOperationException("переменная DATABASE_URL не задана")
      : NpgsqlDataSource.Create(connectionString);
});
builder.Services.AddScoped<IDialogs, PostgresDialogs>();

// Справочники и расчёт спрашиваются у расчётной части: своей модели расчёта у
// бота нет (ADR-0009, инвариант 4). Адрес называет развёртывание; при местном
// запуске расчётная часть слушает порт из README.
var apiBaseUrl = builder.Configuration["API_BASE_URL"];
builder.Services.AddHttpClient<IReferenceCatalog, ImoltReferenceCatalog>(client =>
{
  // Граница ожидания обязательна: без неё отказ соседней службы превращается
  // в зависший ответ участнику, а не в названную недоступность.
  client.BaseAddress = Address(string.IsNullOrWhiteSpace(apiBaseUrl) ? "http://localhost:18080" : apiBaseUrl);
  client.Timeout = TimeSpan.FromSeconds(15);
});

// Языковая модель — необязательный переходник (решение по Q-019). Поставщик
// заказчиком не назван, поэтому в составе стоит выключенное обращение:
// участник получает справочный ответ и об отсутствии возможности не узнаёт
// (AC-077b).
builder.Services.AddSingleton<ILanguageModel, DisabledLanguageModel>();

// Токен выдают организаторы, в репозиторий он не попадает (условия трека,
// разд. 4 п. 9). Отсутствие токена не мешает службе подняться: обращений к
// платформе тогда нет вовсе, и нехватка настройки видна в журнале.
var botToken = builder.Configuration["MAX_BOT_TOKEN"];

if (!string.IsNullOrWhiteSpace(botToken))
{
  var maxApiBaseUrl = builder.Configuration["MAX_API_BASE_URL"];

  builder.Services.AddSingleton(new MaxAccess(botToken));
  builder.Services.AddHttpClient<IMaxMessages, MaxMessages>(client =>
  {
    client.BaseAddress = Address(
        string.IsNullOrWhiteSpace(maxApiBaseUrl) ? "https://platform-api.max.ru" : maxApiBaseUrl);

    // Длинный опрос держит соединение до своей выдержки; граница ожидания
    // обязана быть больше неё, иначе каждый опрос обрывался бы своим же
    // ожиданием.
    client.Timeout = TimeSpan.FromSeconds(settings.UpdatesTimeoutSeconds + 15);
  });

  builder.Services.AddSingleton<BotAccount>();
  builder.Services.AddScoped<DialogScenarios>();
  builder.Services.AddHostedService<BotAnnouncement>();
  builder.Services.AddHostedService<UpdatePump>();
}

var app = builder.Build();

if (string.IsNullOrWhiteSpace(botToken))
{
  app.Logger.LogWarning(
      "Переменная MAX_BOT_TOKEN не задана: служба поднята, обращения к API MAX невозможны");
}

app.MapBotEndpoints();

app.Run();

// Адрес службы с завершающей косой чертой: без неё относительный путь
// затирает последний отрезок базового адреса.
static Uri Address(string value) => new(value.TrimEnd('/') + "/");

// Точка входа объявлена открытой ради проверок, поднимающих службу в
// процессе: они запускают ту же сборку, что уходит в образ.
public partial class Program { }
