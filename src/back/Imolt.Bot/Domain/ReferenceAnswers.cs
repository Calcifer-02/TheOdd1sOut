using System.Text;
using Imolt.Bot.Ports;

namespace Imolt.Bot.Domain;

/// Справочный ответ чат-бота: текст и признак того, что его собрала языковая
/// модель (R-073 — R-077).
///
/// @supports: R-073, R-077
public sealed record ReferenceAnswer(string Text, bool FromLanguageModel);

/// Сборка справочного ответа (R-073 — R-077).
///
/// Ответ собирается из значений справочника и сопровождается датой их
/// актуальности: цифра без даты не проверяема (R-074). Отсутствие данных
/// называется прямо — молчание и правдоподобный ответ вредны одинаково
/// (R-075, риск AR-014).
///
/// @req: R-073, R-074, R-075, R-077
/// @adr: ADR-0009
public static class ReferenceAnswers
{
  /// Пометка ответа, собранного языковой моделью (R-077). Без неё ответ
  /// модели читается как официальный ответ сервиса (условия трека,
  /// разд. 8.4 п. 3).
  public const string LanguageModelMark =
      "Ответ сформирован языковой моделью по данным справочника сервиса.";

  /// Напоминание о том, что значения показаны как есть. Стоит рядом с
  /// тарифом: участник должен отличать хранимое значение от посчитанного
  /// (AC-073a).
  public const string AsStoredMark = "Значения приведены из справочника сервиса без пересчёта.";

  /// Тарифы утилизации найденного полигона (R-073, R-074).
  public static ReferenceAnswer Tariffs(LandfillTariffs found)
  {
    ArgumentNullException.ThrowIfNull(found);

    if (found.Tariffs.Count == 0)
    {
      return new ReferenceAnswer(
          "Полигон: " + found.LandfillName + "." + Environment.NewLine
              + "Тарифов утилизации по этому полигону у сервиса нет.",
          FromLanguageModel: false);
    }

    var text = new StringBuilder();
    text.Append("Полигон: ").Append(found.LandfillName).AppendLine(".");
    text.AppendLine("Тариф утилизации по справочнику сервиса:");

    foreach (var tariff in found.Tariffs)
    {
      text.Append("— ")
          .Append(tariff.WasteGroupName)
          .Append(": ")
          .Append(BotFormats.Money(tariff.PricePerTon, tariff.Currency))
          .Append(" за тонну. Данные на ")
          .Append(BotFormats.Date(tariff.UpdatedAt))
          .AppendLine(".");
    }

    text.Append(AsStoredMark);

    return new ReferenceAnswer(text.ToString(), FromLanguageModel: false);
  }

  /// Коэффициент плотности найденной группы отходов (R-073, R-074).
  public static ReferenceAnswer Density(DensityFact fact)
  {
    ArgumentNullException.ThrowIfNull(fact);

    var text = new StringBuilder();
    text.Append("Группа отходов: ").Append(fact.WasteGroupName).AppendLine(".");
    text.Append("Коэффициент плотности — ")
        .Append(BotFormats.Number(fact.TonsPerCubicMeter))
        .Append(" тонны на кубический метр. Данные на ")
        .Append(BotFormats.Date(fact.UpdatedAt))
        .AppendLine(".");
    text.Append(AsStoredMark);

    return new ReferenceAnswer(text.ToString(), FromLanguageModel: false);
  }

  /// Данных нет (R-075). Ответ называет, чего именно не нашлось, и не
  /// предлагает значения — ни своего, ни похожего.
  public static ReferenceAnswer NoData(ReferenceQuestion question)
  {
    ArgumentNullException.ThrowIfNull(question);

    var subject = question.Topic switch
    {
      ReferenceTopic.LandfillTariff => "тарифе утилизации полигона",
      ReferenceTopic.WasteGroupDensity => "коэффициенте плотности группы отходов",
      _ => "предмете вопроса",
    };

    var named = string.IsNullOrWhiteSpace(question.Subject)
        ? string.Empty
        : " «" + question.Subject + "»";

    return new ReferenceAnswer(
        "В справочниках сервиса нет данных о " + subject + named + "."
            + Environment.NewLine
            + "Значение чат-бот не предполагает: сведений у сервиса нет.",
        FromLanguageModel: false);
  }

  /// Признак вопроса распознан, а предмет не назван. Отдельный ответ, потому
  /// что «данных нет» здесь было бы неправдой: сервис не искал.
  public static ReferenceAnswer SubjectMissing(ReferenceQuestion question)
  {
    ArgumentNullException.ThrowIfNull(question);

    var ask = question.Topic switch
    {
      ReferenceTopic.LandfillTariff => "Назовите полигон, о тарифе которого спрашиваете.",
      ReferenceTopic.WasteGroupDensity => "Назовите группу отходов, о плотности которой спрашиваете.",
      _ => "Назовите предмет вопроса.",
    };

    return new ReferenceAnswer(ask, FromLanguageModel: false);
  }

  /// Ответ языковой модели с обязательной пометкой (R-077).
  public static ReferenceAnswer Marked(string text)
  {
    ArgumentException.ThrowIfNullOrWhiteSpace(text);

    return new ReferenceAnswer(
        text.TrimEnd() + Environment.NewLine + Environment.NewLine + LanguageModelMark,
        FromLanguageModel: true);
  }
}
