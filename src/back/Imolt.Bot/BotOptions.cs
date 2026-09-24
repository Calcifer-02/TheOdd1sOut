using System.ComponentModel.DataAnnotations;
using Imolt.Bot.Application;
using Imolt.Bot.Domain;

namespace Imolt.Bot;

/// Настройки чат-бота (R-078, R-081, R-082).
///
/// Пределы переписки и обращений к платформе — настройка службы, а не
/// константы в коде: требования R-078 и R-082 называют это прямо. Значения по
/// умолчанию взяты из тех же объявленных мест, что и раньше, — второго числа
/// в проекте не появляется.
///
/// Источник — раздел `Bot` конфигурации службы; в окружении те же ключи
/// пишутся с двойным подчёркиванием: `Bot__DialogDepth`,
/// `Bot__DeletionsPerSecond`, `Bot__SendRetries`, `Bot__UpdatesTimeoutSeconds`,
/// `Bot__WebhookEnabled`. Раздела нет — действуют значения по умолчанию.
///
/// @req: R-078, R-081, R-082
/// @adr: ADR-0009
public sealed class BotOptions
{
  /// Имя раздела конфигурации.
  public const string Section = "Bot";

  /// Сколько своих последних сообщений чат-бот держит в переписке (R-078).
  /// Решение по Q-020 от 23.09.2026 — десять.
  [Range(1, 100)]
  public int DialogDepth { get; set; } = DialogPolicy.DefaultDepth;

  /// Сколько удалений в секунду допускает платформа (R-081).
  [Range(1, 60)]
  public int DeletionsPerSecond { get; set; } = MaxDelivery.DefaultDeletionsPerSecond;

  /// Сколько раз повторяется отклонённая платформой отправка (R-082).
  [Range(0, 10)]
  public int SendRetries { get; set; } = MaxDelivery.DefaultSendRetries;

  /// Сколько секунд длинный опрос ждёт очередной порции обновлений
  /// (ADR-0009, «Обновления»). Ноль означал бы непрерывный опрос вхолостую.
  [Range(1, 120)]
  public int UpdatesTimeoutSeconds { get; set; } = 30;

  /// Принимать ли обновления вебхуком. Выключено по умолчанию: решение
  /// ADR-0009 объявляет длинный опрос рабочим путём, а вебхук —
  /// возможностью настройки, которой нужен публичный адрес.
  public bool WebhookEnabled { get; set; }
}
