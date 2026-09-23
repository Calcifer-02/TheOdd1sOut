using Imolt.Calculations.Application;
using Imolt.Deals.Contracts;
using Imolt.Deals.Ports;

namespace Imolt.Api;

/// Переходник между областями: сделка спрашивает расчёт, область «расчёт»
/// отдаёт закреплённые строки выбора.
///
/// Живёт в составе изделия, а не внутри областей: области друг на друга не
/// ссылаются, и связь между ними собирается здесь (ADR-0001, ADR-0005).
/// Цены не пересчитываются — они переносятся: сделка цен не считает.
///
/// @supports: R-036, R-037
/// @adr: ADR-0005
public sealed class CalculationSnapshot(CalculationScenarios calculations) : ICalculationSnapshot
{
  public async Task<QuotableCalculation?> FindAsync(
      string calculationId,
      CancellationToken cancellationToken)
  {
    var calculation = await calculations.FindAsync(calculationId, cancellationToken);

    if (calculation is null)
    {
      return null;
    }

    var lines = await calculations.PricedSelectionAsync(calculationId, cancellationToken);

    return new QuotableCalculation(
        calculation.Id,
        calculation.CreatedAt,
        calculation.PickupAddress.Value,
        [.. lines.Select(line => new QuoteLine(
            line.LandfillId,
            line.LandfillName,
            line.WasteGroupId,
            line.WasteGroupName,
            line.Tons,
            line.Input.Unit,
            line.Input.Value,
            line.TransportCost,
            line.DisposalCost,
            line.TotalCost))]);
  }
}
