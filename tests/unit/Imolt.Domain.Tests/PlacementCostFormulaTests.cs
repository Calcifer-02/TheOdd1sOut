using Imolt.Calculations.Domain;
using Imolt.Shared;
using Xunit;

namespace Imolt.Domain.Tests;

/// Формула стоимости размещения: перевозка — объём в тоннах, помноженный на
/// цену группы за тонна-километр, плечо перевозки и коэффициент перевозки;
/// утилизация — объём в тоннах, помноженный на тариф полигона по этой группе;
/// совокупная цена — их сумма (R-017, R-018, R-019).
///
/// Проверка модульная намеренно. ADR-0001 («Результат проверки») требует,
/// чтобы формула считалась без поднятой базы данных и без обращений к сети:
/// расстояние, тариф и коэффициент приходят в домен параметрами. Если для
/// запуска этой проверки понадобится окружение, допущение о чистом домене
/// нарушено, и это видно из самой проверки, а не из обзора кода.
///
/// Числа — из канонического примера договора
/// (src/back/Imolt.Api/contracts/openapi.yaml, components/examples/
/// ConcreteCalculation) и начального набора данных
/// (src/back/Imolt.Database/Migrations/0002_demo_dataset.sql): 20 тонн лома
/// бетона, цена перевозки 12,00 ₽ за тонна-километр, плечи 45 и 52 км, тарифы
/// утилизации 450,00 и 380,00 ₽ за тонну.
///
/// Проверка фальсифицируема: она падает, если перевозка перестанет умножаться
/// на плечо перевозки или на цену группы, если утилизация возьмёт цену
/// перевозки вместо тарифа полигона, если совокупная цена перестанет быть
/// суммой составляющих, если выключенная утилизация всё равно попадёт в итог
/// и если коэффициент перевозки начнёт применяться к утилизации.
///
///   dotnet test tests/unit/Imolt.Domain.Tests
///
/// @ac: AC-017a, AC-018a, AC-018b, AC-018c, AC-019a, AC-021a, AC-022a
public sealed class PlacementCostFormulaTests
{
  /// Коэффициент перевозки, который ничего не меняет. Отдельное имя, потому
  /// что единица в перечне аргументов читается как случайное число.
  private const decimal NoTransportCoefficient = 1m;

  /// Цена перевозки группы «beton-lom» за тонна-километр (начальный набор).
  private const decimal ConcreteTransportPrice = 12.00m;

  /// Цена перевозки группы «drevesina» там же: другая группа — другая цена.
  private const decimal WoodTransportPrice = 16.00m;

  /// Объём примера договора: 20 тонн лома бетона.
  private const decimal ConcreteTons = 20m;

  [Fact(DisplayName = "перевозка равна тоннам, помноженным на цену группы и плечо перевозки")]
  public void TransportCostMultipliesTonsByGroupPriceAndRoadDistance()
  {
    var cost = VostokCost(NoTransportCoefficient);

    // 20 т x 12,00 ₽ за тонна-километр x 45 км = 10 800,00 ₽ (AC-018a).
    Assert.Equal(Money.Rubles(10800.00m), cost.TransportCost);
  }

  [Fact(DisplayName = "утилизация равна тоннам, помноженным на тариф полигона по этой группе")]
  public void DisposalCostMultipliesTonsByLandfillTariff()
  {
    var cost = VostokCost(NoTransportCoefficient);

    // 20 т x 450,00 ₽ за тонну = 9 000,00 ₽ (AC-018b). Тариф — свойство пары
    // «полигон и группа отходов», а не группы: у «Икши» по тому же лому
    // бетона он другой, и проверка ниже это показывает.
    Assert.Equal(Money.Rubles(9000.00m), cost.DisposalCost);
  }

  [Fact(DisplayName = "совокупная цена сходится с примером договора по обоим полигонам")]
  public void TotalCostMatchesTheContractExampleForBothLandfills()
  {
    var vostok = VostokCost(NoTransportCoefficient);
    var iksha = IkshaCost(NoTransportCoefficient);

    // AC-018c: «Восток» — 19 800,00 ₽, «Икша» — 20 080,00 ₽. Второй полигон
    // здесь обязателен: на одном ближний тариф и ближнее плечо неотличимы
    // от жёстко записанного результата.
    Assert.Equal(Money.Rubles(19800.00m), vostok.TotalCost);

    Assert.Equal(Money.Rubles(12480.00m), iksha.TransportCost);
    Assert.Equal(Money.Rubles(7600.00m), iksha.DisposalCost);
    Assert.Equal(Money.Rubles(20080.00m), iksha.TotalCost);
  }

  [Fact(DisplayName = "совокупная цена равна сумме названных перевозки и утилизации")]
  public void TotalCostAlwaysEqualsNamedTransportPlusNamedDisposal()
  {
    // AC-019a требует, чтобы составляющие были названы раздельно и итог
    // сходился именно с ними: совпадение итога с ожидаемым числом при
    // разошедшихся составляющих — та же ошибка, только незаметная.
    foreach (var cost in new[] { VostokCost(NoTransportCoefficient), IkshaCost(NoTransportCoefficient) })
    {
      Assert.NotNull(cost.DisposalCost);
      Assert.Equal(cost.TransportCost + cost.DisposalCost!.Value, cost.TotalCost);
    }
  }

  [Fact(DisplayName = "без утилизации совокупная цена состоит из одной перевозки")]
  public void DisposalStaysAbsentWhenDisposalIsNotRequired()
  {
    var cost = PlacementCost.Of(
        tons: ConcreteTons,
        transportPricePerTonKm: Money.Rubles(ConcreteTransportPrice),
        distanceKm: 45m,
        disposalPricePerTon: null,
        transportCoefficient: NoTransportCoefficient);

    // AC-021a: утилизации нет вовсе, а не «утилизация ноль». Ноль означал бы
    // бесплатный приём на полигоне, а флажок снят потому, что приёма нет.
    Assert.Null(cost.DisposalCost);
    Assert.Equal(Money.Rubles(10800.00m), cost.TransportCost);
    Assert.Equal(cost.TransportCost, cost.TotalCost);
  }

  [Fact(DisplayName = "коэффициент перевозки меняет перевозку и не трогает утилизацию")]
  public void TransportCoefficientMovesTransportAndLeavesDisposalIntact()
  {
    const decimal seasonal = 1.15m;

    var cost = VostokCost(seasonal);

    // AC-022a, R-022: коэффициент применяется к цене перевозки.
    // 20 т x 12,00 ₽ x 45 км x 1,15 = 12 420,00 ₽.
    Assert.Equal(Money.Rubles(12420.00m), cost.TransportCost);
    Assert.NotEqual(Money.Rubles(10800.00m), cost.TransportCost);

    // Утилизация остаётся прежней: коэффициент перевозки на тариф полигона
    // не распространяется, иначе R-022 молча переписал бы R-018.
    Assert.Equal(Money.Rubles(9000.00m), cost.DisposalCost);
    Assert.Equal(Money.Rubles(21420.00m), cost.TotalCost);
  }

  [Fact(DisplayName = "цена перевозки берётся у группы отходов и между группами различается")]
  public void TransportPriceComesFromWasteGroupAndDiffersBetweenGroups()
  {
    // Один вес, одно плечо, один полигон — разные только группы. Разница
    // в перевозке может взяться только из цены группы (R-017, AC-017a).
    var concrete = PlacementCost.Of(
        tons: ConcreteTons,
        transportPricePerTonKm: Money.Rubles(ConcreteTransportPrice),
        distanceKm: 45m,
        disposalPricePerTon: Money.Rubles(450.00m),
        transportCoefficient: NoTransportCoefficient);

    var wood = PlacementCost.Of(
        tons: ConcreteTons,
        transportPricePerTonKm: Money.Rubles(WoodTransportPrice),
        distanceKm: 45m,
        disposalPricePerTon: Money.Rubles(450.00m),
        transportCoefficient: NoTransportCoefficient);

    // 20 т x 12,00 ₽ x 45 км = 10 800,00 ₽; 20 т x 16,00 ₽ x 45 км = 14 400,00 ₽.
    Assert.Equal(Money.Rubles(10800.00m), concrete.TransportCost);
    Assert.Equal(Money.Rubles(14400.00m), wood.TransportCost);
    Assert.NotEqual(concrete.TransportCost, wood.TransportCost);

    // Утилизация не тронута: цена группы относится к перевозке, а тариф —
    // свойство пары «полигон и группа» (R-018).
    Assert.Equal(concrete.DisposalCost, wood.DisposalCost);
  }

  private static PlacementCost VostokCost(decimal transportCoefficient) => PlacementCost.Of(
      tons: ConcreteTons,
      transportPricePerTonKm: Money.Rubles(ConcreteTransportPrice),
      distanceKm: 45m,
      disposalPricePerTon: Money.Rubles(450.00m),
      transportCoefficient: transportCoefficient);

  private static PlacementCost IkshaCost(decimal transportCoefficient) => PlacementCost.Of(
      tons: ConcreteTons,
      transportPricePerTonKm: Money.Rubles(ConcreteTransportPrice),
      distanceKm: 52m,
      disposalPricePerTon: Money.Rubles(380.00m),
      transportCoefficient: transportCoefficient);
}
