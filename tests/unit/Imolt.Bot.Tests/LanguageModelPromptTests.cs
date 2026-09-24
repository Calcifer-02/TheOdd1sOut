using Imolt.Bot.Domain;
using Imolt.Bot.Ports;
using Xunit;

namespace Imolt.Bot.Tests;

/// Состав обращения к языковой модели (R-076, критерий AC-076a).
///
/// Языковая модель — пересказчик найденного, а не источник значений: выдать
/// её предположение за официальный ответ прямо запрещает риск AR-014.
/// Поэтому проверяется не «факты в обращении есть», а то, что в нём нет
/// ничего сверх них.
///
///   dotnet test tests/unit/Imolt.Bot.Tests
public sealed class LanguageModelPromptTests
{
  private static readonly DateOnly Actual = new(2026, 9, 17);

  /// Ключ доступа к внешней службе. В обращении его быть не может: текст
  /// обращения уходит наружу, а ключ наружу уходить не должен (R-056).
  private const string AccessKey = "sk-секрет-доступа-к-модели";

  /// Проверка падает, если в обращение попадёт строка, которой нет ни в
  /// вопросе участника, ни в перечне фактов справочника, — в том числе ключ
  /// доступа, прежняя переписка или настройка службы.
  ///
  /// @ac: AC-076a
  [Fact(DisplayName = "обращение к языковой модели несёт только вопрос участника и факты справочника")]
  public void LanguageModelRequestCarriesNothingBeyondTheQuestionAndCatalogueFacts()
  {
    const string Question = "Какой тариф на полигоне Восток?";

    var facts = LanguageModelPrompt.Facts(new LandfillTariffs(
        "Комплекс переработки «Восток»",
        [new TariffFact("Лом бетона и железобетона", 450m, "RUB", Actual)]));

    var prompt = LanguageModelPrompt.Compose(Question, facts);

    Assert.NotEmpty(facts);

    foreach (var fact in facts)
    {
      Assert.Contains(fact, prompt, StringComparison.Ordinal);
    }

    Assert.DoesNotContain(AccessKey, prompt, StringComparison.Ordinal);

    var allowed = new HashSet<string>(StringComparer.Ordinal)
    {
      LanguageModelPrompt.Instruction,
      LanguageModelPrompt.QuestionHeading,
      LanguageModelPrompt.FactsHeading,
      Question,
    };

    foreach (var fact in facts)
    {
      allowed.Add(LanguageModelPrompt.FactBullet + fact);
    }

    var carried = prompt
        .Split('\n')
        .Select(line => line.Trim())
        .Where(line => line.Length > 0);

    foreach (var line in carried)
    {
      Assert.True(
          allowed.Contains(line),
          $"в обращение к модели попала строка «{line}»: ни в вопросе участника, ни в фактах справочника её нет");
    }
  }

  /// Проверка падает, если факт справочника уйдёт в модель без даты
  /// актуальности: модель перескажет значение, и участник не узнает, на
  /// какой день оно верно (R-074).
  ///
  /// @ac: AC-076a
  [Fact(DisplayName = "факт справочника уходит в модель вместе с датой актуальности")]
  public void CatalogueFactGoesToTheModelWithItsDataDate()
  {
    var facts = LanguageModelPrompt.Facts(new DensityFact("Лом бетона и железобетона", 2m, Actual));

    var fact = Assert.Single(facts);

    Assert.Contains("Лом бетона и железобетона", fact, StringComparison.Ordinal);
    Assert.Contains("17.09.2026", fact, StringComparison.Ordinal);
  }
}
