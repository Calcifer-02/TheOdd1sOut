using System.Globalization;
using Imolt.Api;
using Imolt.Database;
using Imolt.Shared;
using Microsoft.AspNetCore.Diagnostics;
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

// Договор API отдаётся как есть: файл contracts/openapi.yaml — источник, а не
// производная кода, поэтому описание не порождается из контроллеров
// (docs/architecture/ЗАПИСЬ_АРХИТЕКТУРНОГО_РЕШЕНИЯ_ADR-0003.md). Файл едет
// рядом со сборкой: и при локальном запуске, и в образе он лежит в
// подкаталоге contracts каталога приложения.
var contractPath = Path.Combine(AppContext.BaseDirectory, "contracts", "openapi.yaml");

app.MapGet("/v1/openapi.yaml", () =>
    File.Exists(contractPath)
        ? Results.File(contractPath, "application/yaml; charset=utf-8")
        : Results.Problem(
            title: "Договор API не найден",
            detail: $"Ожидался файл {contractPath}",
            statusCode: StatusCodes.Status500InternalServerError));

// Страница Swagger UI смотрит на тот же файл. Средство здесь только
// показывает договор человеку и ничего о коде не знает.
app.UseSwaggerUI(options =>
{
    // Адрес договора задан относительно страницы, а не от корня узла.
    // Снаружи служба стоит за префиксом /api, который внешний узел срезает:
    // абсолютный путь ушёл бы мимо службы, на страницу мини-приложения, и
    // Swagger UI получил бы разметку вместо договора.
    options.SwaggerEndpoint("../v1/openapi.yaml", "ИМОЛТ — расчётная часть, версия 1");
    options.RoutePrefix = "swagger";
    options.DocumentTitle = "Договор API ИМОЛТ";
});

// Живость: отвечает, пока процесс жив. Внешних зависимостей не трогает —
// иначе перезапуск базы данных выглядел бы как отказ самой службы.
app.MapGet("/health", () => Results.Ok(new
{
    service = "api",
    status = "ok"
}));

// Готовность: подтверждает, что служба видит базу данных по строке
// подключения из окружения. Именно эта точка ловит разорванную связку
// api → db в compose.
app.MapGet("/ready", async (IConfiguration configuration, CancellationToken cancellationToken) =>
{
    var connectionString = configuration["DATABASE_URL"];
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Json(new
        {
            service = "api",
            status = "not_ready",
            reason = "переменная DATABASE_URL не задана"
        }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    try
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("select 1", connection);
        await command.ExecuteScalarAsync(cancellationToken);
    }
    catch (NpgsqlException exception)
    {
        return Results.Json(new
        {
            service = "api",
            status = "not_ready",
            reason = exception.Message
        }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    return Results.Ok(new
    {
        service = "api",
        status = "ready",
        database = "reachable"
    });
});

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
