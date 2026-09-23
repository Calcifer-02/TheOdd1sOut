using System.Globalization;
using System.Text.Json;
using Imolt.Shared;
using Xunit;

namespace Imolt.Domain.Tests;

/// Денежная сумма на границе службы. Договор передаёт её строкой с двумя
/// знаками после точки (схема Money, образец amount), потому что двоичная
/// дробь округляет рубли по дороге, а смета этого не прощает.
///
/// Проверка фальсифицируема: она падает, если сумма уедет в ответ числом,
/// потеряет незначащий ноль, возьмёт разделитель дробной части из текущей
/// культуры (служба ставит ru-RU глобально, и запятая порвёт договор),
/// потеряет знак минуса или обрастёт полями сверх объявленных договором.
///
///   dotnet test tests/unit/Imolt.Domain.Tests
///
public sealed class MoneyTests
{
  // Образец взят из договора: components/schemas/Money.properties.amount.pattern
  // (src/back/Imolt.Api/contracts/openapi.yaml). Сверку этой строки с самим
  // файлом договора ведёт интеграционный проект — модульный работает без
  // обращений к файловой системе.
  private const string ContractAmountPattern = @"^-?[0-9]+\.[0-9]{2}$";

  [Fact(DisplayName = "сумма сериализуется с точкой, даже когда текущая культура ru-RU")]
  public void MoneyKeepsDotSeparatorUnderRussianCulture()
  {
    // Служба выставляет ru-RU глобально (Program.cs, раздел о локали),
    // поэтому подмена культуры здесь воспроизводит боевое окружение,
    // а не выдумывает его.
    var previous = CultureInfo.CurrentCulture;
    CultureInfo.CurrentCulture = new CultureInfo("ru-RU");

    try
    {
      var json = JsonSerializer.Serialize(Money.Rubles(10800m), ImoltJson.Options);

      Assert.Equal("{\"amount\":\"10800.00\",\"currency\":\"RUB\"}", json);
    }
    finally
    {
      CultureInfo.CurrentCulture = previous;
    }
  }

  [Theory(DisplayName = "сумма сериализуется ровно с двумя знаками после точки")]
  [InlineData(10800, "10800.00")]
  [InlineData(19800.5, "19800.50")]
  public void MoneyAlwaysCarriesTwoFractionDigits(decimal amount, string expected)
  {
    Assert.Equal(expected, SerializedAmount(Money.Rubles(amount)));
  }

  [Fact(DisplayName = "сериализованная сумма совпадает с образцом договора")]
  public void SerializedAmountMatchesContractPattern()
  {
    var serialized = SerializedAmount(Money.Rubles(19800m));

    Assert.Matches(ContractAmountPattern, serialized);
  }

  [Fact(DisplayName = "отрицательная сумма сериализуется со знаком и проходит образец договора")]
  public void NegativeAmountKeepsSignAndMatchesContractPattern()
  {
    var serialized = SerializedAmount(Money.Rubles(-19800m));

    Assert.Equal("-19800.00", serialized);
    Assert.Matches(ContractAmountPattern, serialized);
  }

  // Сумма достаётся из готового документа, а не из свойства объекта:
  // договор нарушает именно то представление, которое уходит по сети.
  private static string SerializedAmount(Money money)
  {
    using var document = JsonDocument.Parse(JsonSerializer.Serialize(money, ImoltJson.Options));
    var amount = document.RootElement.GetProperty("amount");

    Assert.Equal(JsonValueKind.String, amount.ValueKind);
    return amount.GetString()!;
  }
}
