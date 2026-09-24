using System.Globalization;
using System.Text;
using Imolt.Bot.Ports;

namespace Imolt.Bot.Domain;

/// Короткий расчёт прямо в переписке (R-072).
///
/// В переписке проходит только короткое действие: адрес вывоза, одна группа
/// отходов и объём. Сравнение полигонов, распределение объёма и документы
/// остаются в мини-приложении (условия трека, разд. 8.1; решение по Q-021).
///
/// Цену считает расчётная часть: бот называет её, но не выводит (ADR-0009,
/// инвариант 4).
///
/// @req: R-072
/// @adr: ADR-0009
public static class QuickQuotes
{
  /// Пометка предварительности. Названа отдельно, потому что ответ без неё
  /// читается как окончательная цена (R-059, AC-072b).
  public const string PreliminaryMark =
      "Цена предварительная: сравнение полигонов и выбор — в мини-приложении.";

  /// Как назвать расчёт в переписке. Показывается, когда сообщение похоже на
  /// запрос расчёта, но разобрать его нечем.
  public const string Format =
      "Короткий расчёт: адрес вывоза; группа отходов; объём."
      + " Например: г Москва, ул Годовикова, д 9; лом бетона; 20 т.";

  /// Разделитель частей запроса. Точка с запятой, а не запятая: адрес сам
  /// состоит из частей через запятую.
  private const char Separator = ';';

  /// Меры объёма договора расчётной части. Слева — то, как участник пишет,
  /// справа — код меры договора; своих мер чат-бот не заводит.
  private static readonly (string Written, string Code)[] Units =
  [
    ("м3", "m3"),
    ("м³", "m3"),
    ("куб", "m3"),
    ("кубометр", "m3"),
    ("кубов", "m3"),
    ("т", "t"),
    ("тонн", "t"),
    ("тонна", "t"),
    ("тонны", "t"),
  ];

  /// Разобрать сообщение участника в запрос короткого расчёта. Пусто —
  /// сообщение не похоже на запрос расчёта.
  public static QuickQuoteRequest? Parse(string? text)
  {
    if (string.IsNullOrWhiteSpace(text))
    {
      return null;
    }

    var parts = text.Split(Separator, StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);

    if (parts.Length != 3)
    {
      return null;
    }

    var quantity = Quantity(parts[2]);

    return quantity is null
        ? null
        : new QuickQuoteRequest(parts[0], parts[1], quantity.Value.Amount, quantity.Value.Code);
  }

  /// Ответ с предварительной совокупной ценой (R-072).
  public static string Text(PreliminaryPrice price)
  {
    ArgumentNullException.ThrowIfNull(price);

    var text = new StringBuilder();
    text.Append("Предварительная совокупная цена: ")
        .Append(BotFormats.Money(price.Total, price.Currency))
        .AppendLine(".");
    text.Append("Группа отходов: ").Append(price.WasteGroupName).AppendLine(".");
    text.Append("Полигон: ").Append(price.LandfillName).AppendLine(".");
    text.Append("Цены справочника на ").Append(BotFormats.Date(price.PricesUpdatedAt)).AppendLine(".");
    text.Append(PreliminaryMark);

    return text.ToString();
  }

  /// Объём и мера из третьей части сообщения: «20 т», «15 м3», «15м³».
  private static (decimal Amount, string Code)? Quantity(string written)
  {
    var digits = new StringBuilder();
    var rest = written.Length;

    for (var index = 0; index < written.Length; index++)
    {
      var symbol = written[index];

      if (char.IsDigit(symbol) || symbol is '.' or ',' or ' ')
      {
        // Запятая и точка — один и тот же разделитель дробной части: в
        // переписке участник пишет как привык.
        if (symbol is not ' ')
        {
          digits.Append(symbol is ',' ? '.' : symbol);
        }

        continue;
      }

      rest = index;
      break;
    }

    if (!decimal.TryParse(
            digits.ToString(),
            NumberStyles.Number,
            CultureInfo.InvariantCulture,
            out var amount)
        || amount <= 0)
    {
      return null;
    }

    var unit = written[rest..].Trim().ToLowerInvariant().TrimEnd('.');

    foreach (var (name, code) in Units)
    {
      if (string.Equals(unit, name, StringComparison.Ordinal))
      {
        return (amount, code);
      }
    }

    return null;
  }
}
