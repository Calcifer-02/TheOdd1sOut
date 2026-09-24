using System.Globalization;
using Imolt.Bot.Domain;
using Imolt.Bot.Ports;

namespace Imolt.Bot.Application;

/// Обращения к платформе MAX с оглядкой на её пределы (R-081, R-082).
///
/// Пределы соблюдает тот, кто вызывает порт: сам порт их только объявляет, а
/// россыпь проверок по месту вызова расходится от места к месту. Поэтому
/// выдержка между удалениями и повтор отклонённой отправки живут здесь — в
/// одном явном типе доставки.
///
/// Время приходит доводом `wait`, а не берётся у системных часов: иначе
/// проверка предела ждала бы по-настоящему и зависела от скорости машины
/// (правила проекта, «Детерминизм там, где важен повтор»).
///
/// @req: R-081, R-082
/// @adr: ADR-0009
public static class MaxDelivery
{
  /// Предел платформы по умолчанию: не более двух удалений в секунду
  /// (R-081). Ограничение платформы, а не выбор проекта; действующее
  /// значение приходит настройкой службы.
  public const int DefaultDeletionsPerSecond = 2;

  /// Предел повторов по умолчанию: отклонённая отправка повторяется не более
  /// трёх раз (R-082). Действующее значение приходит настройкой службы.
  public const int DefaultSendRetries = 3;

  /// Шаг выдержки между повторами. Повторы расходятся во времени кратно
  /// шагу — первый через шаг, второй через два: мгновенный повтор упирается
  /// в тот же отказ платформы, что и первое обращение.
  public static readonly TimeSpan RetryStep = TimeSpan.FromSeconds(1);

  /// Окно, в котором считается число удалений. Названо платформой в
  /// требовании R-081 («не более двух сообщений в секунду»).
  private static readonly TimeSpan DeletionWindow = TimeSpan.FromSeconds(1);

  /// Удалить назначенные сообщения, не выходя за предел платформы (R-081).
  ///
  /// Удаляется ровно то и в том порядке, что назначила политика переписки:
  /// вычислять идентификаторы доставке нечем и незачем (AC-078b).
  public static async Task DeleteAllAsync(
      IMaxMessages messages,
      IReadOnlyList<string> messageIds,
      int perSecond,
      Func<TimeSpan, CancellationToken, Task> wait,
      CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(messages);
    ArgumentNullException.ThrowIfNull(messageIds);
    ArgumentNullException.ThrowIfNull(wait);
    ArgumentOutOfRangeException.ThrowIfLessThan(perSecond, 1);

    for (var index = 0; index < messageIds.Count; index++)
    {
      // Очередная порция размером в предел уходит без выдержки, а перед
      // следующей проходит полное окно: так в любую секунду попадает не
      // больше `perSecond` удалений (AC-081a).
      if (index > 0 && index % perSecond == 0)
      {
        await wait(DeletionWindow, cancellationToken).ConfigureAwait(false);
      }

      await messages.DeleteAsync(messageIds[index], cancellationToken).ConfigureAwait(false);
    }
  }

  /// Отправить сообщение, повторив отклонённое обращение ограниченное число
  /// раз (R-082).
  ///
  /// Повторяется только объявленный портом отказ платформы: прочая поломка —
  /// не «попробуй ещё раз», и повтор её маскирует.
  ///
  /// Исчерпав повторы, доставка называет отказ и передаёт его вызывающему:
  /// решение о том, продолжать ли работу, принимает служба, а не доставка
  /// (AC-082b).
  public static async Task<string> SendAsync(
      IMaxMessages messages,
      long chatId,
      OutgoingMessage message,
      int maxRetries,
      Func<TimeSpan, CancellationToken, Task> wait,
      CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(messages);
    ArgumentNullException.ThrowIfNull(message);
    ArgumentNullException.ThrowIfNull(wait);
    ArgumentOutOfRangeException.ThrowIfNegative(maxRetries);

    MaxRefusedException? refusal = null;

    for (var attempt = 0; attempt <= maxRetries; attempt++)
    {
      if (attempt > 0)
      {
        await wait(RetryStep * attempt, cancellationToken).ConfigureAwait(false);
      }

      try
      {
        return await messages.SendAsync(chatId, message, cancellationToken).ConfigureAwait(false);
      }
      catch (MaxRefusedException refused)
      {
        refusal = refused;
      }
    }

    throw new MaxRefusedException(
        string.Format(
            CultureInfo.InvariantCulture,
            "платформа MAX отклонила отправку в переписку {0}: обращений {1}, повторы исчерпаны",
            chatId,
            maxRetries + 1),
        refusal);
  }
}
