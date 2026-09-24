using System.Globalization;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Imolt.Bot.Domain;
using Imolt.Bot.Ports;

namespace Imolt.Bot.Adapters;

/// Токен доступа к платформе MAX.
///
/// Объявлен отдельным типом, а не строкой в составе изделия: строку в
/// зависимостях легко спутать с любой другой, а этот тип называет, что
/// именно в нём лежит. Значение приходит переменной `MAX_BOT_TOKEN` и в
/// репозиторий не попадает (условия трека, разд. 4 п. 9).
///
/// @supports: R-069
public sealed record MaxAccess(string Token);

/// Обращения к платформе MAX по её интерфейсу чат-ботов.
///
/// Единственное место, которое знает формат платформы. Всё остальное решение
/// видит порт `IMaxMessages`, поэтому смена формата платформы — правка одного
/// файла, а не поиск по проекту.
///
/// Что о формате известно достоверно: `GET /me` проверен 24.09.2026 и вернул
/// учётную запись бота (ADR-0009, «Результат проверки»). Остальные операции
/// собраны по документации платформы и на живой платформе не выполнялись —
/// ни отправка, ни правка, ни удаление, ни опрос обновлений. Состав тела
/// запроса и имена полей ответа здесь поэтому названы в одном месте и
/// разбираются мягко: неизвестное поле пропускается, а не роняет службу.
///
/// Токен доступа в журнал не пишется и в тело запроса не попадает: он
/// добавляется в адрес обращения и живёт только в настройке службы
/// (условия трека, разд. 4 п. 9).
///
/// @supports: R-069, R-070, R-078, R-079, R-081, R-082
/// @adr: ADR-0009
public sealed class MaxMessages(HttpClient client, MaxAccess access, ILogger<MaxMessages> logger)
    : IMaxMessages
{
  /// Имя параметра, которым платформа принимает токен доступа.
  private const string TokenParameter = "access_token";

  /// Вид вложения, которым платформа принимает встроенную клавиатуру.
  private const string KeyboardAttachment = "inline_keyboard";

  private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
  {
    PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
  };

  public async Task<BotIdentity> WhoAmIAsync(CancellationToken cancellationToken)
  {
    using var answer = await CallAsync(
        HttpMethod.Get,
        Address("me"),
        content: null,
        cancellationToken).ConfigureAwait(false);

    var root = answer.RootElement;

    var username = MaxUpdates.Text(root, "username")
        ?? throw new MaxRefusedException("ответ платформы о себе не назвал учётную запись бота");

    var contactId = MaxUpdates.Number(root, "user_id")
        ?? throw new MaxRefusedException("ответ платформы о себе не назвал идентификатор бота");

    return new BotIdentity(username, contactId);
  }

  public async Task DeclareCommandsAsync(
      IReadOnlyList<BotCommand> commands,
      CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(commands);

    var payload = new
    {
      commands = commands.Select(command => new { name = command.Name, description = command.Description }),
    };

    using var answer = await CallAsync(
        HttpMethod.Patch,
        Address("me/commands"),
        JsonContent.Create(payload, options: Json),
        cancellationToken).ConfigureAwait(false);

    logger.LogInformation("Платформе MAX объявлено команд: {Count}", commands.Count);
  }

  public async Task<string> SendAsync(
      long chatId,
      OutgoingMessage message,
      CancellationToken cancellationToken)
  {
    using var answer = await CallAsync(
        HttpMethod.Post,
        Address("messages", ("chat_id", chatId.ToString(CultureInfo.InvariantCulture))),
        JsonContent.Create(Body(message), options: Json),
        cancellationToken).ConfigureAwait(false);

    return MaxUpdates.MessageId(answer.RootElement)
        ?? throw new MaxRefusedException("платформа приняла сообщение, но не назвала его идентификатор");
  }

  public async Task EditAsync(
      string messageId,
      OutgoingMessage message,
      CancellationToken cancellationToken)
  {
    using var answer = await CallAsync(
        HttpMethod.Put,
        Address("messages", ("message_id", messageId)),
        JsonContent.Create(Body(message), options: Json),
        cancellationToken).ConfigureAwait(false);
  }

  public async Task DeleteAsync(string messageId, CancellationToken cancellationToken)
  {
    using var answer = await CallAsync(
        HttpMethod.Delete,
        Address("messages", ("message_id", messageId)),
        content: null,
        cancellationToken).ConfigureAwait(false);
  }

  public async Task<(IReadOnlyList<BotUpdate> Updates, long? Marker)> UpdatesAsync(
      long? marker,
      CancellationToken cancellationToken)
  {
    var timeout = ((int)client.Timeout.TotalSeconds - 5).ToString(CultureInfo.InvariantCulture);

    using var answer = await CallAsync(
        HttpMethod.Get,
        Address(
            "updates",
            ("marker", marker?.ToString(CultureInfo.InvariantCulture)),
            ("timeout", timeout)),
        content: null,
        cancellationToken).ConfigureAwait(false);

    var root = answer.RootElement;
    var updates = new List<BotUpdate>();

    if (root.TryGetProperty("updates", out var listed) && listed.ValueKind == JsonValueKind.Array)
    {
      foreach (var update in listed.EnumerateArray())
      {
        updates.Add(MaxUpdates.Read(update));
      }
    }

    return (updates, MaxUpdates.Number(root, "marker"));
  }

  /// Тело сообщения: текст и, если кнопки есть, вложение со встроенной
  /// клавиатурой.
  private static object Body(OutgoingMessage message)
  {
    ArgumentNullException.ThrowIfNull(message);

    if (message.Keyboard is null)
    {
      return new { text = message.Text };
    }

    var rows = message.Keyboard.Rows
        .Select(row => row.Select(Button).ToList())
        .ToList();

    return new
    {
      text = message.Text,
      attachments = new[]
      {
        new { type = KeyboardAttachment, payload = new { buttons = rows } },
      },
    };
  }

  /// Состав кнопки для платформы. Поля кнопки открытия мини-приложения
  /// собирает домен (`MiniAppButton`), здесь они только переименовываются в
  /// имена платформы.
  private static object Button(KeyboardButton button)
  {
    // Учётная запись бота уезжает вложенным составом: платформа отличает по
    // нему запуск мини-приложения от перехода по ссылке. Адрес приложения
    // платформа берёт из настроек бота и в кнопку не подставляется
    // (ADR-0009, инвариант 1).
    object? webApp = button.WebApp is null ? null : new { bot_username = button.WebApp };

    return new
    {
      type = button.Type,
      text = button.Text,
      web_app = webApp,
      contact_id = button.ContactId,
      url = button.Url,
      payload = button.Payload,
    };
  }

  /// Обращение к платформе. Любой неуспех объявляется отказом платформы:
  /// повторять его или нет, решает доставка (R-082).
  private async Task<JsonDocument> CallAsync(
      HttpMethod method,
      string address,
      HttpContent? content,
      CancellationToken cancellationToken)
  {
    using var request = new HttpRequestMessage(method, address) { Content = content };

    HttpResponseMessage answer;

    try
    {
      answer = await client.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }
    catch (HttpRequestException failure)
    {
      throw new MaxRefusedException("платформа MAX недоступна: " + failure.Message, failure);
    }
    catch (TaskCanceledException failure) when (!cancellationToken.IsCancellationRequested)
    {
      throw new MaxRefusedException("платформа MAX не ответила в отведённое время", failure);
    }

    using (answer)
    {
      var body = await answer.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);

      if (!answer.IsSuccessStatusCode)
      {
        // В отказ попадает код и начало тела, но не адрес обращения: в
        // адресе стоит токен, и в журнале ему не место.
        throw new MaxRefusedException(string.Format(
            CultureInfo.InvariantCulture,
            "платформа MAX ответила кодом {0}: {1}",
            (int)answer.StatusCode,
            Shortened(body)));
      }

      return string.IsNullOrWhiteSpace(body)
          ? JsonDocument.Parse("{}")
          : JsonDocument.Parse(body);
    }
  }

  /// Адрес обращения с токеном доступа. Собирается одним местом: токен,
  /// забытый в одном обращении, даёт отказ платформы без видимой причины.
  private string Address(string path, params (string Name, string? Value)[] query)
  {
    var address = new StringBuilder(path);
    address.Append('?').Append(TokenParameter).Append('=').Append(Uri.EscapeDataString(access.Token));

    foreach (var (name, value) in query)
    {
      if (!string.IsNullOrEmpty(value))
      {
        address.Append('&').Append(name).Append('=').Append(Uri.EscapeDataString(value));
      }
    }

    return address.ToString();
  }

  private static string Shortened(string body) =>
      body.Length <= 200 ? body : body[..200];
}
