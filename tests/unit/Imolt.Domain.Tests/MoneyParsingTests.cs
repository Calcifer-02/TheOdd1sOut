using System.Globalization;
using System.Text.Json;
using Imolt.Shared;
using Xunit;

namespace Imolt.Domain.Tests;

/// Разбор денежной суммы на входе службы. Сумма приходит строкой с точкой по
/// образцу договора; служба глобально выставляет культуру ru-RU, поэтому
/// парсер обязан держать инвариантную культуру явно — иначе граница начнёт
/// принимать то, что договор запрещает, или отвергать канонический пример.
///
/// Проверка фальсифицируема: она падает, если разбор перейдёт на текущую
/// культуру (под ru-RU точка перестаёт быть десятичным разделителем), если
/// валюта вне рубля станет допустимой или если сумма без поля amount
/// разбирается в ноль вместо отказа.
///
///   dotnet test tests/unit/Imolt.Domain.Tests
///
public sealed class MoneyParsingTests
{
  [Theory(DisplayName = "строка суммы из договора разбирается при любой текущей культуре")]
  [InlineData("en-US")]
  [InlineData("ru-RU")]
  public void CanonicalStringParsesUnderAnyCurrentCulture(string cultureName)
  {
    var previous = CultureInfo.CurrentCulture;
    CultureInfo.CurrentCulture = new CultureInfo(cultureName);

    try
    {
      var money = JsonSerializer.Deserialize<Money>(
          """{"amount":"19800.50","currency":"RUB"}""", ImoltJson.Options);

      Assert.Equal(19800.50m, money.Amount);
      Assert.Equal(Money.RubleCode, money.Currency);
    }
    finally
    {
      CultureInfo.CurrentCulture = previous;
    }
  }

  [Theory(DisplayName = "разбор отвергает сумму в форме, которой нет в договоре")]
  [InlineData(@"""10800.00""")]
  [InlineData(@"{""amount"":""10800,00"",""currency"":""RUB""}")]
  [InlineData(@"{""amount"":""10800.0"",""currency"":""RUB""}")]
  [InlineData(@"{""amount"":""1E4"",""currency"":""RUB""}")]
  [InlineData(@"{""amount"":""1 080 000.00"",""currency"":""RUB""}")]
  [InlineData(@"{""amount"":""10800.00"",""currency"":""USD""}")]
  [InlineData(@"{""currency"":""RUB""}")]
  [InlineData(@"{""amount"":""не число"",""currency"":""RUB""}")]
  public void MalformedMoneyIsRejected(string json)
  {
    Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<Money>(json, ImoltJson.Options));
  }

  [Fact(DisplayName = "сумма, отданная службой, читается обратно без потери значения")]
  public void SerializedMoneyReadsBackUnchanged()
  {
    var original = Money.Rubles(-19800.42m);

    var roundTrip = JsonSerializer.Deserialize<Money>(
        JsonSerializer.Serialize(original, ImoltJson.Options), ImoltJson.Options);

    Assert.Equal(original, roundTrip);
  }
}
