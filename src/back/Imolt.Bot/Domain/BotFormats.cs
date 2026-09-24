using System.Globalization;

namespace Imolt.Bot.Domain;

/// Представление чисел и дат в сообщениях чат-бота.
///
/// Переписка — такой же интерфейс сервиса, как экран, поэтому числа в ней
/// показываются локалью `ru-RU` (правила проекта, «Язык и термины», R-061).
/// Место одно: формат, повторённый в каждом тексте, расходится.
///
/// Значения здесь только показываются. Пересчёта и округления сверх
/// объявленной договором точности не происходит: тариф справочника участник
/// обязан увидеть таким, каким его хранит сервис (AC-073a).
///
/// @supports: R-061, R-073, R-074
public static class BotFormats
{
  /// Локаль сообщений чат-бота.
  public static CultureInfo Culture { get; } = CultureInfo.GetCultureInfo("ru-RU");

  /// Код валюты договора расчётной части. Иная валюта показывается кодом, а
  /// не подставляется чужим знаком: знак валюты — не то, что можно угадать.
  private const string Rouble = "RUB";

  /// Денежная сумма. Договор передаёт её строкой с двумя знаками после
  /// точки, поэтому показ с двумя знаками ничего не округляет.
  public static string Money(decimal amount, string currency) =>
      string.Equals(currency, Rouble, StringComparison.Ordinal)
          ? amount.ToString("C2", Culture)
          : amount.ToString("N2", Culture) + " " + currency;

  /// Коэффициент или объём: незначащие нули не показываются, значащие знаки
  /// сохраняются.
  public static string Number(decimal value) => value.ToString("0.####", Culture);

  /// Дата актуальности данных (R-074).
  public static string Date(DateOnly date) => date.ToString("dd.MM.yyyy", Culture);
}
