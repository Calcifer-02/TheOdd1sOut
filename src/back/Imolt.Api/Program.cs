using System.Globalization;
using Npgsql;

// Плацдарм расчётной части сервиса: пока здесь только точки проверки
// работоспособности, по которым проверяется связность служб в compose.
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
