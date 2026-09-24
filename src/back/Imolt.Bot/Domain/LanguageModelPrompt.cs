using System.Text;
using Imolt.Bot.Ports;

namespace Imolt.Bot.Domain;

/// Обращение к языковой модели (R-076).
///
/// В обращение попадает ровно три вещи: указание, вопрос участника и факты
/// справочника сервиса. Ничего больше — ни ключа доступа, ни настроек, ни
/// прежней переписки (AC-076a). Ключ живёт у переходника и в текст не
/// подставляется: текст уходит наружу, а ключ наружу уходить не должен
/// (R-056, риск AR-006).
///
/// Модель здесь — пересказчик найденного, а не источник значений: выдать её
/// предположение за официальный ответ прямо запрещает риск AR-014.
///
/// @req: R-076
/// @adr: ADR-0009
public static class LanguageModelPrompt
{
  /// Указание модели. Стоит первым и не меняется от вопроса к вопросу:
  /// ответ, собранный по другому указанию, воспроизвести нечем.
  public const string Instruction =
      "Отвечай только фактами из перечня ниже. Не добавляй значений, которых в перечне нет,"
      + " и не округляй названные. Если фактов не хватает, ответь, что данных у сервиса нет.";

  /// Заголовок вопроса участника в тексте обращения.
  public const string QuestionHeading = "Вопрос участника:";

  /// Заголовок перечня фактов справочника в тексте обращения.
  public const string FactsHeading = "Данные справочника сервиса:";

  /// Знак строки перечня фактов.
  public const string FactBullet = "— ";

  public static string Compose(string question, IReadOnlyList<string> facts)
  {
    ArgumentException.ThrowIfNullOrWhiteSpace(question);
    ArgumentNullException.ThrowIfNull(facts);

    var text = new StringBuilder();
    text.AppendLine(Instruction);
    text.AppendLine();
    text.AppendLine(QuestionHeading);
    text.AppendLine(question.Trim());
    text.AppendLine();
    text.AppendLine(FactsHeading);

    foreach (var fact in facts)
    {
      text.Append(FactBullet).AppendLine(fact);
    }

    return text.ToString().TrimEnd();
  }

  /// Факты найденного полигона строками — тот же состав, что и в прямом
  /// справочном ответе. Второе место сборки значений разошлось бы с первым.
  public static IReadOnlyList<string> Facts(LandfillTariffs found)
  {
    ArgumentNullException.ThrowIfNull(found);

    return found.Tariffs
        .Select(tariff =>
            "полигон " + found.LandfillName
            + ", группа отходов " + tariff.WasteGroupName
            + ", тариф утилизации " + BotFormats.Money(tariff.PricePerTon, tariff.Currency)
            + " за тонну, данные на " + BotFormats.Date(tariff.UpdatedAt))
        .ToList();
  }

  /// Факт найденной группы отходов строкой.
  public static IReadOnlyList<string> Facts(DensityFact fact)
  {
    ArgumentNullException.ThrowIfNull(fact);

    return
    [
      "группа отходов " + fact.WasteGroupName
      + ", коэффициент плотности " + BotFormats.Number(fact.TonsPerCubicMeter)
      + " тонны на кубический метр, данные на " + BotFormats.Date(fact.UpdatedAt),
    ];
  }
}
