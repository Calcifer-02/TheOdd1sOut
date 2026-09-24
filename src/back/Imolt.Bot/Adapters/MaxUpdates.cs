using System.Globalization;
using System.Text.Json;
using Imolt.Bot.Ports;

namespace Imolt.Bot.Adapters;

/// Разбор обновления платформы MAX.
///
/// Вынесен отдельно, потому что обновление приходит двумя путями: длинным
/// опросом (рабочий путь по ADR-0009) и вебхуком (возможность настройки).
/// Разбор у них один: два разных чтения одного формата разошлись бы.
///
/// Формат на живой платформе не проверялся (ADR-0009, «Что не проверено»),
/// поэтому чтение мягкое: недостающее поле даёт пустое значение, незнакомый
/// вид обновления — `Unknown`, и служба продолжает работу.
///
/// @supports: R-070
/// @adr: ADR-0009
public static class MaxUpdates
{
  public static BotUpdate Read(JsonElement update)
  {
    var kind = Text(update, "update_type") switch
    {
      "bot_started" => UpdateKind.BotStarted,
      "message_created" => UpdateKind.MessageCreated,
      "message_callback" => UpdateKind.Callback,
      _ => UpdateKind.Unknown,
    };

    var message = Property(update, "message") ?? default;
    var sender = Property(message, "sender") ?? Property(update, "user");
    var body = Property(message, "body");
    var recipient = Property(message, "recipient");

    var chatId = Number(update, "chat_id")
        ?? (recipient is { } to ? Number(to, "chat_id") : null)
        ?? 0;

    var maxUserId = (sender is { } from ? Number(from, "user_id") : null)
        ?.ToString(CultureInfo.InvariantCulture) ?? string.Empty;

    var payload = Text(update, "payload")
        ?? (Property(update, "callback") is { } callback ? Text(callback, "payload") : null);

    return new BotUpdate(
        kind,
        chatId,
        maxUserId,
        sender is { } named ? Text(named, "name") : null,
        body is { } said ? Text(said, "text") : null,
        payload);
  }

  /// Идентификатор отправленного сообщения из ответа платформы.
  public static string? MessageId(JsonElement root)
  {
    var message = Property(root, "message");
    var body = message is { } carried ? Property(carried, "body") : null;

    return body is { } said ? Text(said, "mid") : null;
  }

  public static JsonElement? Property(JsonElement element, string name) =>
      element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var found)
          ? found
          : null;

  public static string? Text(JsonElement element, string name) =>
      Property(element, name) is { ValueKind: JsonValueKind.String } found ? found.GetString() : null;

  public static long? Number(JsonElement element, string name) =>
      Property(element, name) is { ValueKind: JsonValueKind.Number } found && found.TryGetInt64(out var value)
          ? value
          : null;
}
