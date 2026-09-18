// Плацдарм чат-бота MAX: приёмник вебхука и точка проверки работоспособности.
// Сценарии бота здесь ещё не реализованы — задача этого проекта на текущем шаге
// в том, чтобы служба поднималась в compose и принимала обновления платформы.
// Условия трека, разд. 4 п. 2: MAX — среда реализации и взаимодействия.

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// Токен выдают организаторы, в репозиторий он не попадает (условия трека,
// разд. 4 п. 9). Отсутствие токена не мешает службе подняться: так плацдарм
// проверяется без секретов, а нехватка настройки видна в журнале.
var botToken = app.Configuration["MAX_BOT_TOKEN"];
if (string.IsNullOrWhiteSpace(botToken))
{
    app.Logger.LogWarning(
        "Переменная MAX_BOT_TOKEN не задана: служба поднята, обращения к API MAX невозможны");
}

app.MapGet("/health", () => Results.Ok(new
{
    service = "bot",
    status = "ok",
    token_configured = !string.IsNullOrWhiteSpace(botToken)
}));

// Точка приёма обновлений от платформы. Платформа ожидает быстрый ответ,
// поэтому разбор обновления и работа сценариев выносятся отдельным шагом,
// а не выполняются в обработчике запроса.
app.MapPost("/max/webhook", async (HttpRequest request, ILogger<Program> logger) =>
{
    using var reader = new StreamReader(request.Body);
    var payload = await reader.ReadToEndAsync();
    logger.LogInformation("Получено обновление MAX, длина тела: {Length} байт", payload.Length);
    return Results.Ok(new { accepted = true });
});

app.Run();
