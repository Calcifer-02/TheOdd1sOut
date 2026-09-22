using System.Globalization;
using Npgsql;

// Плацдарм расчётной части сервиса: пока здесь только точки проверки
// работоспособности и отдача договора API, по которому интерфейсная часть
// разрабатывается, не дожидаясь сервера.
// Предметные области раскладываются внутри этого проекта по документу
// docs/РАСКЛАДКА_КОДА.md, когда появится первая из них.

var builder = WebApplication.CreateBuilder(args);

// Суммы и даты сервиса показываются в русской локали (правила проекта,
// раздел «Язык и термины»), поэтому культура задаётся явно, а не наследуется
// от локали контейнера, где она равна инвариантной.
var culture = new CultureInfo("ru-RU");
CultureInfo.DefaultThreadCurrentCulture = culture;
CultureInfo.DefaultThreadCurrentUICulture = culture;

var app = builder.Build();

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

app.Run();
