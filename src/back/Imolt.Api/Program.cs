using System.Globalization;
using Imolt.Api;
using Imolt.Database;
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
  options.SerializerOptions.PropertyNamingPolicy = ImoltJson.Options.PropertyNamingPolicy;
  options.SerializerOptions.PropertyNameCaseInsensitive = ImoltJson.Options.PropertyNameCaseInsensitive;
  options.SerializerOptions.NumberHandling = ImoltJson.Options.NumberHandling;
  foreach (var converter in ImoltJson.Options.Converters)
  {
    options.SerializerOptions.Converters.Add(converter);
  }
});

// Время приходит в области портом: домен не обращается к системным часам
// (правило ARCH-025).
builder.Services.AddSingleton<IClock, SystemClock>();

var connectionString = builder.Configuration["DATABASE_URL"];
if (!string.IsNullOrWhiteSpace(connectionString))
{
  // Пул соединений один на службу. Соединение на каждый запрос стоит
  // дороже самого запроса и упирается в предел соединений базы.
  // Источник заводится вручную, без отдельного пакета расширений: одна
  // строка не стоит ещё одной зависимости в замке версий.
  builder.Services.AddSingleton(_ => NpgsqlDataSource.Create(connectionString));
}

var app = builder.Build();

// Схему применяет тот, кто разворачивает, а не служба при каждом старте:
// база общая с будущей службой сбора, и две единицы, молча накатывающие
// схему на старте, дают гонку (ADR-0002, инвариант 6). Признак задаётся
// окружением и включён в compose.
if (builder.Configuration.GetValue("IMOLT_APPLY_MIGRATIONS", false)
    && !string.IsNullOrWhiteSpace(connectionString))
{
  var applied = await MigrationRunner.ApplyAsync(connectionString, CancellationToken.None);
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
