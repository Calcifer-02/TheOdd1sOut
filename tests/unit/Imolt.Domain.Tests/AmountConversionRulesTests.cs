using Imolt.Calculations.Domain;
using Xunit;

namespace Imolt.Domain.Tests;

/// Пересчёт объёма между тоннами и кубометрами по коэффициенту плотности
/// группы отходов (R-014, R-015). Коэффициент — свойство группы, пользователь
/// его не вводит и не видит.
///
/// Проверка модульная намеренно: ADR-0001 («Результат проверки») называет
/// конвертацию по коэффициенту плотности вторым местом, которое обязано
/// считаться без поднятой базы данных и без сети.
///
/// Числа — из начального набора данных
/// (src/back/Imolt.Database/Migrations/0002_demo_dataset.sql) и примера
/// договора: у «drevesina» плотность 0,5 т/м³, у «beton-lom» — 2,0 т/м³.
///
/// Проверка фальсифицируема: она падает, если пересчёт поделит там, где
/// обязан умножить (15 м³ при плотности 0,5 дали бы 30 т вместо 7,5 т), если
/// введённая мера потеряется при обратном пересчёте и если мера расчёта
/// начнёт выбираться самим пересчётом вместо того, чтобы отдавать обе.
///
///   dotnet test tests/unit/Imolt.Domain.Tests
///
/// @ac: AC-015a, AC-015b
public sealed class AmountConversionRulesTests
{
  /// Коэффициент плотности группы «drevesina»: 0,5 тонны в кубометре.
  private const decimal TimberDensity = 0.5m;

  /// Коэффициент плотности группы «beton-lom»: 2,0 тонны в кубометре.
  private const decimal ConcreteDensity = 2.0m;

  [Fact(DisplayName = "кубометры пересчитываются в тонны по коэффициенту плотности группы")]
  public void CubicMetersBecomeTonsByGroupDensity()
  {
    // AC-015a: 15 м³ древесины при плотности 0,5 — это 7,5 тонны.
    Assert.Equal(
        7.5m,
        AmountConversion.ToTons(15m, AmountUnit.CubicMeter, densityTonPerCubicMeter: TimberDensity));

    // Введённая мера остаётся собой: пересчёт возвращает обе меры, а не
    // подменяет исходную (R-015).
    Assert.Equal(
        15m,
        AmountConversion.ToCubicMeters(15m, AmountUnit.CubicMeter, densityTonPerCubicMeter: TimberDensity));
  }

  [Fact(DisplayName = "тонны пересчитываются в кубометры по тому же коэффициенту плотности")]
  public void TonsGainCubicMetersByGroupDensity()
  {
    // AC-015b: 20 тонн лома бетона при плотности 2,0 — это 10 м³.
    Assert.Equal(
        10m,
        AmountConversion.ToCubicMeters(20m, AmountUnit.Ton, densityTonPerCubicMeter: ConcreteDensity));

    Assert.Equal(
        20m,
        AmountConversion.ToTons(20m, AmountUnit.Ton, densityTonPerCubicMeter: ConcreteDensity));
  }
}
