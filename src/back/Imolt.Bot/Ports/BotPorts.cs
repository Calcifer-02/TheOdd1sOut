using Imolt.Bot.Domain;

namespace Imolt.Bot.Ports;

/// Вид обновления, которое приносит платформа. Различаются только те, на
/// которые бот отвечает; остальные он пропускает, а не разбирает впрок.
///
/// @supports: R-069, R-070
public enum UpdateKind
{
  Unknown,
  BotStarted,
  MessageCreated,
  Callback,
}

/// Обновление платформы в том виде, в каком его читает сценарий: кто, откуда
/// и что сказал. Разбор формата платформы остаётся в переходнике.
///
/// @supports: R-070
public sealed record BotUpdate(
    UpdateKind Kind,
    long ChatId,
    string MaxUserId,
    string? DisplayName,
    string? Text,
    string? Payload);

/// Обращения к платформе MAX. Единственное место, которое знает её формат.
///
/// Пределы платформы — часть порта, а не догадка вызывающего: удаление идёт
/// не быстрее двух сообщений в секунду (R-081), отклонённая отправка
/// повторяется ограниченное число раз (R-082).
///
/// @supports: R-069, R-078, R-079, R-081, R-082
public interface IMaxMessages
{
  /// Кто мы: учётная запись бота и его идентификатор. Из них складывается
  /// кнопка открытия мини-приложения (R-069).
  Task<BotIdentity> WhoAmIAsync(CancellationToken cancellationToken);

  /// Объявить платформе перечень команд (R-070).
  Task DeclareCommandsAsync(IReadOnlyList<BotCommand> commands, CancellationToken cancellationToken);

  Task<string> SendAsync(long chatId, OutgoingMessage message, CancellationToken cancellationToken);

  Task EditAsync(string messageId, OutgoingMessage message, CancellationToken cancellationToken);

  Task DeleteAsync(string messageId, CancellationToken cancellationToken);

  /// Очередная порция обновлений. Метка — то, с чего продолжать; пусто
  /// означает «с начала непрочитанного».
  Task<(IReadOnlyList<BotUpdate> Updates, long? Marker)> UpdatesAsync(
      long? marker,
      CancellationToken cancellationToken);
}

/// Состояние переписок. Переживает перезапуск службы и удаление сообщений
/// (R-080).
///
/// @supports: R-080
public interface IDialogs
{
  Task<DialogState> FindAsync(long chatId, CancellationToken cancellationToken);

  Task SaveAsync(DialogState state, CancellationToken cancellationToken);
}

/// Платформа отклонила обращение и повторы исчерпаны. Служба обязана назвать
/// отказ и продолжить принимать следующие обновления (R-082).
///
/// @supports: R-082
public sealed class MaxRefusedException(string message, Exception? inner = null)
    : Exception(message, inner);
