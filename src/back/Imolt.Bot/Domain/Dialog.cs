namespace Imolt.Bot.Domain;

/// Исходящее сообщение чат-бота. Карточка — сообщение, которое бот ведёт
/// одним на переписку и переписывает при изменении (R-079); всё остальное
/// отправляется обычным сообщением.
///
/// @supports: R-079
public sealed record OutgoingMessage(string Text, Keyboard? Keyboard, bool IsCard);

/// Состояние переписки. Живёт в базе решения, а не в самой переписке: всё,
/// что переживает удаление сообщения, обязано лежать снаружи (R-080).
///
/// Состав только сериализуемый: идентификаторы и признак. Список хранит
/// идентификаторы сообщений самого бота — чужие в него не попадают, и
/// удалять бот умеет только то, что здесь записано (R-078).
///
/// @req: R-080
/// @adr: ADR-0009
public sealed record DialogState(
    long ChatId,
    string? ParticipantId,
    string? CardMessageId,
    IReadOnlyList<string> OwnMessageIds,
    bool CommandsAnnounced)
{
  public static DialogState Empty(long chatId) => new(chatId, null, null, [], false);
}

/// Что сделать с перепиской, чтобы показать очередное сообщение: изменить
/// прежнюю карточку или отправить новое, и какие свои сообщения удалить.
///
/// @supports: R-078, R-079
public sealed record DialogPlan(string? EditMessageId, IReadOnlyList<string> Delete);

/// Политика переписки (R-078, R-079, решение по Q-020).
///
/// Правил два. Карточка переписывается, а не отправляется заново: иначе
/// каждое изменение расчёта оставляет в переписке ещё одно сообщение.
/// Своих сообщений сверх предела не остаётся: лишние удаляются, начиная с
/// самых ранних. Сообщения участника не трогаются никогда — платформа этого
/// в диалоге и не позволяет.
///
/// @req: R-078, R-079
/// @adr: ADR-0009
public static class DialogPolicy
{
  /// Предел по умолчанию. Решение по Q-020 от 23.09.2026; значение
  /// приходит настройкой, а здесь названо, чтобы не расходиться с ней молча.
  public const int DefaultDepth = 10;

  /// Что сделать с перепиской перед показом очередного сообщения.
  ///
  /// Предел приходит доводом, а не читается здесь из настройки: политика —
  /// чистое правило, а источник предела называет состав изделия (R-078).
  public static DialogPlan Plan(DialogState state, OutgoingMessage message, int depth)
  {
    ArgumentNullException.ThrowIfNull(state);
    ArgumentNullException.ThrowIfNull(message);
    ArgumentOutOfRangeException.ThrowIfLessThan(depth, 1);

    // Карточка переписывается, а не отправляется заново (R-079). Правится
    // только та, что числится за ботом: чужого сообщения у бота нет.
    var edited = message.IsCard
        && state.CardMessageId is { } card
        && state.OwnMessageIds.Contains(card, StringComparer.Ordinal)
            ? card
            : null;

    // Правка сообщений в переписке не прибавляет, поэтому место освобождается
    // только под новую отправку.
    var arriving = edited is null ? 1 : 0;
    var excess = state.OwnMessageIds.Count + arriving - depth;

    return new DialogPlan(edited, excess <= 0 ? [] : Earliest(state, excess));
  }

  /// Состояние после того, как план выполнен: какие идентификаторы остались
  /// за ботом и какая карточка теперь ведётся.
  public static DialogState Applied(
      DialogState state,
      OutgoingMessage message,
      DialogPlan plan,
      string messageId)
  {
    ArgumentNullException.ThrowIfNull(state);
    ArgumentNullException.ThrowIfNull(message);
    ArgumentNullException.ThrowIfNull(plan);
    ArgumentException.ThrowIfNullOrWhiteSpace(messageId);

    var own = state.OwnMessageIds
        .Where(id => !plan.Delete.Contains(id, StringComparer.Ordinal))
        .ToList();

    // Правка оставляет прежний идентификатор: он уже числится за ботом, и
    // второй записи о том же сообщении не появляется.
    if (plan.EditMessageId is not null)
    {
      return state with { OwnMessageIds = own };
    }

    own.Add(messageId);

    return state with
    {
      OwnMessageIds = own,
      CardMessageId = message.IsCard ? messageId : state.CardMessageId,
    };
  }

  /// Самые ранние сообщения бота, кроме ведущейся карточки: карточка
  /// переписывается и потому переживает наведение порядка (R-079).
  private static List<string> Earliest(DialogState state, int count)
  {
    var chosen = new List<string>(count);

    foreach (var id in state.OwnMessageIds)
    {
      if (chosen.Count == count)
      {
        break;
      }

      if (string.Equals(id, state.CardMessageId, StringComparison.Ordinal))
      {
        continue;
      }

      chosen.Add(id);
    }

    return chosen;
  }
}
