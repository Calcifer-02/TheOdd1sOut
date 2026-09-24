using System.Globalization;
using Imolt.Bot.Domain;
using Imolt.Bot.Ports;
using Xunit;

namespace Imolt.Bot.Tests;

/// Справочный ответ чат-бота: значение справочника, дата его актуальности,
/// прямо названное отсутствие данных и пометка ответа языковой модели
/// (R-073 — R-075, R-077; критерии AC-073a, AC-073b, AC-074a, AC-075a,
/// AC-077a).
///
/// Проверки модульные: справочник подменяется готовым значением, обращений к
/// расчётной части и к платформе MAX в них нет.
///
///   dotnet test tests/unit/Imolt.Bot.Tests
public sealed class ReferenceAnswerTests
{
  /// Дата актуальности данных справочника. Записана числом, а не взята у
  /// системы: «сегодня» сделало бы прогон невоспроизводимым.
  private static readonly DateOnly Actual = new(2026, 9, 17);

  /// Локаль сообщений сервиса. Названа в проверке отдельно от кода, чтобы
  /// формат, собранный инвариантной культурой, её уронил (R-061).
  private static readonly CultureInfo Russian = CultureInfo.GetCultureInfo("ru-RU");

  /// Проверка падает, если ответ не назовёт полигон или группу отходов, если
  /// значение тарифа окажется пересчитанным либо округлённым и если число
  /// уйдёт не в русской локали.
  ///
  /// @ac: AC-073a
  [Fact(DisplayName = "вопрос о тарифе полигона получает значение справочника без пересчёта")]
  public void LandfillTariffAnswerNamesTheStoredValueUnchanged()
  {
    // Копейки в значении нарочно: округление до рублей их потеряет, и это
    // будет видно.
    const decimal PerTon = 450.55m;

    var found = new LandfillTariffs(
        "Комплекс переработки «Восток»",
        [new TariffFact("Лом бетона и железобетона", PerTon, "RUB", Actual)]);

    var answer = ReferenceAnswers.Tariffs(found);

    Assert.False(
        answer.FromLanguageModel,
        "ответ из справочника помечен как собранный языковой моделью");

    Assert.Contains("Комплекс переработки «Восток»", answer.Text, StringComparison.Ordinal);
    Assert.Contains("Лом бетона и железобетона", answer.Text, StringComparison.Ordinal);

    Assert.Contains(
        PerTon.ToString("C2", Russian),
        answer.Text,
        StringComparison.Ordinal);

    Assert.DoesNotContain("451", answer.Text, StringComparison.Ordinal);
  }

  /// Проверка падает, если ответ о плотности не назовёт группу отходов или
  /// коэффициент из справочника.
  ///
  /// @ac: AC-073b
  [Fact(DisplayName = "вопрос о плотности группы отходов получает коэффициент справочника")]
  public void DensityAnswerNamesTheCoefficientFromTheCatalogue()
  {
    var answer = ReferenceAnswers.Density(
        new DensityFact("Лом бетона и железобетона", 2.5m, Actual));

    Assert.Contains("Лом бетона и железобетона", answer.Text, StringComparison.Ordinal);
    Assert.Contains("2,5", answer.Text, StringComparison.Ordinal);
  }

  /// Проверка падает, если справочный ответ уйдёт без даты актуальности
  /// использованных данных: цифра без даты не проверяема.
  ///
  /// @ac: AC-074a
  [Theory(DisplayName = "справочный ответ называет дату актуальности использованных данных")]
  [InlineData(true)]
  [InlineData(false)]
  public void ReferenceAnswerAlwaysNamesTheDataDate(bool aboutTariff)
  {
    var answer = aboutTariff
        ? ReferenceAnswers.Tariffs(new LandfillTariffs(
            "Комплекс переработки «Восток»",
            [new TariffFact("Лом бетона и железобетона", 450m, "RUB", Actual)]))
        : ReferenceAnswers.Density(new DensityFact("Лом бетона и железобетона", 2m, Actual));

    Assert.Contains("17.09.2026", answer.Text, StringComparison.Ordinal);
  }

  /// Проверка падает, если отсутствие данных не будет названо прямо и если в
  /// ответе окажется хоть одна цифра: названное число участник прочитает как
  /// значение, которого у сервиса нет (риск AR-014).
  ///
  /// @ac: AC-075a
  [Fact(DisplayName = "вопрос о неизвестном сервису полигоне получает прямой ответ без значения")]
  public void MissingCatalogueEntryIsNamedWithoutAnyGuessedValue()
  {
    var question = new ReferenceQuestion(ReferenceTopic.LandfillTariff, "Северный");

    var answer = ReferenceAnswers.NoData(question);

    Assert.Contains("нет данных", answer.Text, StringComparison.Ordinal);
    Assert.Contains("Северный", answer.Text, StringComparison.Ordinal);

    Assert.False(
        answer.Text.Any(char.IsDigit),
        "в ответе об отсутствии данных названо число: участник прочитает его как значение сервиса");

    Assert.False(
        answer.FromLanguageModel,
        "отказ назвать значение помечен как ответ языковой модели");
  }

  /// Проверка падает, если ответ языковой модели уйдёт участнику без пометки
  /// или потеряет признак происхождения: без пометки он читается как
  /// официальный ответ сервиса.
  ///
  /// @ac: AC-077a
  [Fact(DisplayName = "ответ, собранный языковой моделью, уходит участнику с пометкой")]
  public void LanguageModelAnswerCarriesItsMark()
  {
    var answer = ReferenceAnswers.Marked("Тариф полигона — 450,00 ₽ за тонну.");

    Assert.True(answer.FromLanguageModel, "ответ модели не помечен признаком происхождения");

    Assert.Contains(
        ReferenceAnswers.LanguageModelMark,
        answer.Text,
        StringComparison.Ordinal);
  }

  /// Проверка падает, если разбор перестанет отличать вопрос о тарифе от
  /// вопроса о плотности и если название предмета потеряется в уточнениях.
  ///
  /// @ac: AC-073a
  [Theory(DisplayName = "вопрос участника разбирается в признак справочника и название предмета")]
  [InlineData("Сколько стоит приём на полигоне Восток?", ReferenceTopic.LandfillTariff, "Восток")]
  [InlineData("Какой тариф у полигона Тимохово", ReferenceTopic.LandfillTariff, "Тимохово")]
  [InlineData("Какая плотность у группы «Лом бетона и железобетона»?", ReferenceTopic.WasteGroupDensity, "Лом бетона и железобетона")]
  [InlineData("Добрый день", ReferenceTopic.Unknown, "")]
  public void QuestionIsSplitIntoTopicAndSubject(string text, ReferenceTopic topic, string subject)
  {
    var question = ReferenceQuestions.Parse(text);

    Assert.Equal(topic, question.Topic);
    Assert.Equal(subject, question.Subject);
  }
}
