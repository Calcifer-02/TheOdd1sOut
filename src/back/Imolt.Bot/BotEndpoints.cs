using System.Text.Json;
using Imolt.Bot.Adapters;
using Imolt.Bot.Application;
using Imolt.Bot.Domain;
using Imolt.Bot.Ports;
using Microsoft.Extensions.Options;

namespace Imolt.Bot;

/// Точки входа службы чат-бота.
///
/// Рабочий путь обновлений — длинный опрос (ADR-0009): здесь он не виден
/// вовсе. Вебхук объявлен возможностью настройки, а извещение о смене статуса
/// заявки приходит службе снаружи (R-083).
///
/// @supports: R-067, R-083
/// @adr: ADR-0009
public static class BotEndpoints
{
  /// Заголовок, которым внутренний вызывающий представляется службе бота.
  public const string NoticeTokenHeader = "X-Imolt-Notice-Token";

  /// Извещение о смене статуса заявки на вывоз (R-083).
  ///
  /// Кто вызывает эту точку, сегодня не назначено: смены статуса заявки в
  /// договоре расчётной части нет — состояние заявки объявлено единственным
  /// (`accepted`). Поэтому точка принимает номер и новый статус готовыми, а
  /// словарь статусов чат-бот не заводит.
  public sealed record NoticeRequest(long ChatId, string RequestNumber, string Status);

  public static void MapBotEndpoints(this WebApplication app)
  {
    ArgumentNullException.ThrowIfNull(app);

    var tokenConfigured = !string.IsNullOrWhiteSpace(app.Configuration["MAX_BOT_TOKEN"]);

    app.MapGet("/health", () => Results.Ok(new
    {
      service = "bot",
      status = "ok",
      token_configured = tokenConfigured,
    }));

    MapWebhook(app);
    MapNotices(app);
  }

  /// Приём обновлений вебхуком — возможность настройки, а не условие работы
  /// (ADR-0009, «Обновления»). Выключенная точка отвечает отказом, а не
  /// молчанием: иначе платформа считала бы обновления доставленными.
  private static void MapWebhook(WebApplication app)
  {
    app.MapPost("/max/webhook", async (
        HttpRequest request,
        HttpContext context,
        IOptions<BotOptions> options,
        ILogger<Program> logger,
        CancellationToken cancellationToken) =>
    {
      if (!options.Value.WebhookEnabled)
      {
        logger.LogWarning("Получено обновление вебхуком, но приём вебхуком не включён настройкой");

        return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
      }

      // Нехватка настройки — токена платформы или строки подключения — видна
      // только при разборе состава: его поставщики объявлены, но бросают на
      // отсутствующем значении. Необработанное исключение здесь означало бы
      // ответ 500 вместо внятного отказа, а платформа решала бы, что виновата
      // она.
      DialogScenarios? scenarios;

      try
      {
        scenarios = context.RequestServices.GetService<DialogScenarios>();
      }
      catch (InvalidOperationException failure)
      {
        logger.LogWarning(failure, "Приём обновления невозможен: службе не хватает настройки");

        return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
      }

      if (scenarios is null)
      {
        logger.LogWarning("Получено обновление вебхуком, но токен платформы MAX не задан");

        return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
      }

      using var reader = new StreamReader(request.Body);
      var payload = await reader.ReadToEndAsync(cancellationToken);

      using var document = JsonDocument.Parse(payload);
      var update = MaxUpdates.Read(document.RootElement);

      await scenarios.HandleAsync(update, cancellationToken);

      return Results.Ok(new { accepted = true });
    });
  }

  private static void MapNotices(WebApplication app)
  {
    app.MapPost("/max/notices", async (
        NoticeRequest notice,
        HttpContext context,
        IConfiguration configuration,
        ILogger<Program> logger,
        CancellationToken cancellationToken) =>
    {
      var expected = configuration["BOT_NOTICE_TOKEN"];
      var scenarios = context.RequestServices.GetService<DialogScenarios>();

      if (string.IsNullOrWhiteSpace(expected) || scenarios is null)
      {
        // Незаданный общий ключ — рабочее состояние: извещения тогда никто не
        // шлёт. Открытая точка, рассылающая сообщения в любую переписку, —
        // не то, что оставляют «на всякий случай».
        logger.LogWarning(
            "Извещение отклонено: не задан BOT_NOTICE_TOKEN либо токен MAX, и отправлять его нечем");

        return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
      }

      if (!string.Equals(context.Request.Headers[NoticeTokenHeader], expected, StringComparison.Ordinal))
      {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
      }

      await scenarios.NotifyAsync(
          notice.ChatId,
          new PickupRequestNotice(notice.RequestNumber, notice.Status),
          cancellationToken);

      return Results.Ok(new { delivered = true });
    });
  }
}
