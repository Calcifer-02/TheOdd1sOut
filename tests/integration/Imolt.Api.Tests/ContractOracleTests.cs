using Xunit;

namespace Imolt.Api.Tests;

/// Самопроверка договорного оракула. Оракулом будут проверяться все точки
/// договора, поэтому он сам обязан ловить расхождения, а не молчать: оракул,
/// принимающий любое тело, превращает все проверки договора в подтверждающие.
///
/// Проверка фальсифицируема: она падает, если оракул перестанет замечать
/// отсутствие обязательного поля, значение вне перечня, несовпадение с
/// образцом или поле сверх объявленных, а также если он начнёт отвергать
/// тело, которое договор допускает.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @supports: R-011
public sealed class ContractOracleTests
{
  private static readonly ContractOracle Oracle = ContractOracle.FromContract();

  [Fact(DisplayName = "оракул принимает ответ, совпадающий с договором")]
  public void MatchingBodyPassesWithoutViolations()
  {
    var violations = Oracle.Violations("getHealth", 200, """{"service":"api","status":"ok"}""");

    Assert.Empty(violations);
  }

  [Fact(DisplayName = "оракул называет отсутствующее обязательное поле")]
  public void MissingRequiredFieldIsNamed()
  {
    var violations = Oracle.Violations("getHealth", 200, """{"service":"api"}""");

    Assert.Contains(violations, violation => violation.Contains("status") && violation.Contains("обязательно"));
  }

  [Fact(DisplayName = "оракул называет значение вне перечня договора")]
  public void ValueOutsideEnumerationIsNamed()
  {
    var violations = Oracle.Violations("getHealth", 200, """{"service":"api","status":"okay"}""");

    Assert.Contains(violations, violation => violation.Contains("okay") && violation.Contains("перечень"));
  }

  [Fact(DisplayName = "оракул называет несовпадение с образцом суммы")]
  public void ValueOutsidePatternIsNamed()
  {
    // Запятая вместо точки — самая вероятная поломка: служба работает в
    // локали ru-RU, и число, отданное текущей культурой, выглядит так.
    var violations = Oracle.ViolationsAgainstSchema("Money", """{"amount":"10800,00","currency":"RUB"}""");

    Assert.Contains(violations, violation => violation.Contains("10800,00") && violation.Contains("образц"));
  }

  [Fact(DisplayName = "оракул называет поле сверх объявленных договором")]
  public void UndeclaredFieldIsNamed()
  {
    var violations = Oracle.ViolationsAgainstSchema(
        "Money", """{"amount":"10800.00","currency":"RUB","note":"лишнее"}""");

    Assert.Contains(violations, violation => violation.Contains("note") && violation.Contains("не объявлено"));
  }
}
