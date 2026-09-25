using Imolt.Calculations.Ports;
using Imolt.References.Ports;
using ReferenceModels = Imolt.References.Contracts;

namespace Imolt.Api;

/// Переходник между областями: расчёт спрашивает справочные данные, область
/// «справочники» отвечает.
///
/// Живёт в составе изделия, а не внутри областей: области друг на друга не
/// ссылаются, и связь между ними собирается здесь (ADR-0001, ADR-0005).
/// Перевод формы к форме — единственное, что здесь происходит; предметных
/// правил нет.
///
/// @supports: R-016, R-017, R-018, R-019, R-048
/// @adr: ADR-0005
public sealed class CalculationReferences(
    IWasteGroupCatalog catalog,
    ILandfillRegistry registry,
    IDataFreshnessSource freshness,
    IAddressDirectory addresses) : IReferenceData
{
  public async Task<string?> PickupAreaAsync(
      string? suggestionId,
      string? value,
      CancellationToken cancellationToken)
  {
    var address = await addresses.FindAsync(suggestionId, value, cancellationToken);

    return address?.Area;
  }

  public async Task<WasteGroupPricing?> WasteGroupAsync(
      string wasteGroupId,
      CancellationToken cancellationToken)
  {
    var group = await catalog.FindAsync(wasteGroupId, cancellationToken);

    return group is null
        ? null
        : new WasteGroupPricing(
            group.Id,
            group.Name,
            group.TransportPricePerTonKm,
            (decimal)group.DensityTonPerCubicMeter);
  }

  public async Task<IReadOnlyList<LandfillOffer>> OffersAsync(
      string wasteGroupId,
      CancellationToken cancellationToken)
  {
    var landfills = await registry.AcceptingAsync(wasteGroupId, cancellationToken);

    return [.. landfills
        .Select(landfill => Offer(landfill, wasteGroupId))
        .OfType<LandfillOffer>()];
  }

  public async Task<Imolt.Calculations.Contracts.DataFreshness> FreshnessAsync(
      CancellationToken cancellationToken)
  {
    var current = await freshness.ReadAsync(cancellationToken);

    return new Imolt.Calculations.Contracts.DataFreshness(
        current.PricesUpdatedAt,
        current.StatusesUpdatedAt,
        current.LandfillsWithStaleData);
  }

  // Полигон без тарифа по этой группе в подбор не попадает: стоимость
  // утилизации взять неоткуда, а считать её нулём значило бы объявить приём
  // бесплатным (R-019).
  private static LandfillOffer? Offer(ReferenceModels.Landfill landfill, string wasteGroupId)
  {
    var tariff = landfill.Tariffs.FirstOrDefault(own => own.WasteGroupId == wasteGroupId);

    return tariff is null
        ? null
        : new LandfillOffer(
            landfill.Id,
            landfill.Name,
            landfill.Address,
            // Координаты области «справочники» переносятся в свой тип области
            // «расчёт»: общий тип связал бы две области напрямую (ADR-0001).
            new Imolt.Calculations.Contracts.Coordinates(
                landfill.Coordinates.Latitude,
                landfill.Coordinates.Longitude),
            landfill.Status,
            landfill.StatusUpdatedAt,
            tariff.DisposalPricePerTon);
  }
}
