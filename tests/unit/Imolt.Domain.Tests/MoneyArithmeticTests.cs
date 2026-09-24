using Imolt.Shared;
using Xunit;

namespace Imolt.Domain.Tests;

/// Арифметика денежной суммы: точность копейки — основание расчёта (R-018)
/// и итоговых цен перевозки и утилизации (R-019). Сумма округляется в момент
/// создания, а не при выводе, иначе два одинаковых на вид значения дают разную
/// сумму при сложении.
///
/// Проверка фальсифицируема: она падает, если округление уйдёт в half-to-even
/// (половина копейки начнёт исчезать), если операторы перестанут округлять
/// результат (промежуточная копейка 10,7975 доедет до ответа) или если
/// результат операции потеряет валюту сервиса.
///
///   dotnet test tests/unit/Imolt.Domain.Tests
///
public sealed class MoneyArithmeticTests
{
  [Theory(DisplayName = "половина копейки при создании суммы уходит вверх, а не исчезает")]
  [InlineData(0.005, 0.01)]
  [InlineData(19800.004, 19800.00)]
  [InlineData(19800.005, 19800.01)]
  [InlineData(-0.005, -0.01)]
  public void CreationRoundsHalfUpToKopeck(decimal amount, decimal expected)
  {
    Assert.Equal(expected, Money.Rubles(amount).Amount);
  }

  [Fact(DisplayName = "перевозка и утилизация из примера договора складываются в совокупную цену")]
  public void TransportAndDisposalOfCanonicalExampleAddUpToTotal()
  {
    // 10 800,00 ₽ перевозки и 9 000,00 ₽ утилизации — канонический пример
    // договора (ConcreteCalculation), он же в демо-наборе базы данных.
    var transport = Money.Rubles(10800.00m);
    var disposal = Money.Rubles(9000.00m);

    var total = transport + disposal;

    Assert.Equal(19800.00m, total.Amount);
    Assert.Equal(Money.RubleCode, total.Currency);
  }

  [Fact(DisplayName = "умножение суммы на коэффициент округляет результат до копейки")]
  public void MultiplicationRoundsResultToKopeck()
  {
    // 12,34 × 0,875 = 10,7975 — ровно тот случай, когда результат длиннее
    // копейки: без округления при создании лишние разряды уехали бы в
    // следующую операцию.
    var scaled = Money.Rubles(12.34m) * 0.875m;

    Assert.Equal(10.80m, scaled.Amount);
    Assert.Equal(Money.RubleCode, scaled.Currency);
  }
}
