using Imolt.Bot.Domain;
using Imolt.Bot.Ports;

namespace Imolt.Bot.Tests;

/// Двойник порта обращений к платформе MAX: считает обращения, запоминает их
/// состав и момент и отвечает отказом столько раз, сколько назначено.
///
/// Настоящих обращений к платформе здесь нет ни одного: ни токена, ни сети,
/// ни адреса. Пределы платформы объявлены портом (R-081, R-082), и проверить
/// их соблюдение можно только на том, кто порт вызывает, — сама платформа в
/// проверке не участвует (ADR-0009, раздел последствий).
///
/// Время двойник не берёт у системы: момент обращения приходит функцией
/// извне. Иначе проверка предела удаления зависела бы от того, насколько
/// быстро машина исполнила цикл, и падала бы не по делу.
///
/// @supports: R-081, R-082
public sealed class RecordingMaxMessages(
    Func<DateTimeOffset> now,
    int refusedSends = 0,
    BotIdentity? identity = null) : IMaxMessages
{
  private readonly List<string> deleted = [];
  private readonly List<DateTimeOffset> deleteMoments = [];
  private readonly List<string> edited = [];
  private readonly List<OutgoingMessage> sent = [];
  private readonly List<BotUpdate> pending = [];

  /// Учётная запись, которой двойник представляется. По умолчанию — та, что
  /// вернул `GET /me` 24.09.2026 (ADR-0009, раздел результата проверки).
  public BotIdentity Identity { get; } = identity ?? new BotIdentity("t782_hakaton_max_bot", 418419942);

  /// Идентификаторы, для которых запрашивалось удаление, в порядке обращений.
  public IReadOnlyList<string> Deleted => deleted;

  /// Момент каждого обращения на удаление по часам, переданным проверкой.
  public IReadOnlyList<DateTimeOffset> DeleteMoments => deleteMoments;

  /// Идентификаторы, для которых запрашивалась правка сообщения.
  public IReadOnlyList<string> Edited => edited;

  /// Состав каждой попытки отправки, включая отклонённые.
  public IReadOnlyList<OutgoingMessage> Sent => sent;

  /// Сколько раз вызывали отправку — с учётом повторов.
  public int SendCalls { get; private set; }

  /// Сколько раз спрашивали очередную порцию обновлений.
  public int UpdatesCalls { get; private set; }

  /// Сколько раз объявляли платформе перечень команд.
  public int DeclareCommandsCalls { get; private set; }

  /// Перечень команд, объявленный платформе последним обращением.
  public IReadOnlyList<BotCommand> DeclaredCommands { get; private set; } = [];

  /// Положить обновление, которое двойник отдаст следующим опросом.
  public void Offer(BotUpdate update) => pending.Add(update);

  public Task<BotIdentity> WhoAmIAsync(CancellationToken cancellationToken) =>
      Task.FromResult(Identity);

  public Task DeclareCommandsAsync(IReadOnlyList<BotCommand> commands, CancellationToken cancellationToken)
  {
    DeclareCommandsCalls++;
    DeclaredCommands = commands;
    return Task.CompletedTask;
  }

  public Task<string> SendAsync(long chatId, OutgoingMessage message, CancellationToken cancellationToken)
  {
    SendCalls++;
    sent.Add(message);

    if (SendCalls <= refusedSends)
    {
      // Отказ платформы. Объявленная поверхность знает один вид отказа, им
      // двойник и отвечает; повтор — дело вызывающего, а не порта (R-082).
      return Task.FromException<string>(
          new MaxRefusedException($"платформа отклонила отправку, обращение {SendCalls}"));
    }

    return Task.FromResult("msg-" + SendCalls.ToString("00", System.Globalization.CultureInfo.InvariantCulture));
  }

  public Task EditAsync(string messageId, OutgoingMessage message, CancellationToken cancellationToken)
  {
    edited.Add(messageId);
    sent.Add(message);
    return Task.CompletedTask;
  }

  public Task DeleteAsync(string messageId, CancellationToken cancellationToken)
  {
    deleted.Add(messageId);
    deleteMoments.Add(now());
    return Task.CompletedTask;
  }

  public Task<(IReadOnlyList<BotUpdate> Updates, long? Marker)> UpdatesAsync(
      long? marker,
      CancellationToken cancellationToken)
  {
    UpdatesCalls++;
    IReadOnlyList<BotUpdate> updates = pending.ToList();
    pending.Clear();
    return Task.FromResult((updates, marker));
  }
}
