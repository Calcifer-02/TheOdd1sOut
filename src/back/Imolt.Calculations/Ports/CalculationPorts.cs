using Imolt.Calculations.Contracts;
using Imolt.Shared;

namespace Imolt.Calculations.Ports;

/// Что области «расчёт» нужно от среды и что она открывает наружу.
/// Единственная зона области, видимая другим сборкам (ADR-0001, ADR-0005).

/// Группа отходов глазами расчёта: только то, что нужно формуле. Расчёт не
/// знает ни о кодах каталога, ни о дате правки справочника — знание сверх
/// нужного связало бы области крепче, чем требуется.
///
/// @supports: R-017, R-018
public sealed record WasteGroupPricing(
    string Id,
    string Name,
    Money TransportPricePerTonKm,
    decimal DensityTonPerCubicMeter);

/// Полигон, принимающий заданную группу, вместе с тарифом по ней (R-019).
/// Плечо перевозки сюда не входит: расстояния — не справочные данные, у них
/// свой источник и свой порт.
///
/// @supports: R-019, R-028
public sealed record LandfillOffer(
    string Id,
    string Name,
    string Address,
    string Status,
    DateOnly StatusUpdatedAt,
    Money DisposalPricePerTon);

/// Справочные данные для расчёта. Порт объявлен здесь, а переходник к области
/// «справочники» живёт в составе изделия: области друг на друга не ссылаются
/// (ADR-0001, инвариант о зоне портов).
///
/// @supports: R-017, R-018, R-019, R-048
public interface IReferenceData
{
  Task<WasteGroupPricing?> WasteGroupAsync(string wasteGroupId, CancellationToken cancellationToken);

  /// Полигоны, принимающие группу. Отбор по расстоянию здесь не делается:
  /// «группу никто не принимает» и «все отсеяны фильтром» — разные исходы,
  /// и различает их сценарий (R-029).
  Task<IReadOnlyList<LandfillOffer>> OffersAsync(string wasteGroupId, CancellationToken cancellationToken);

  Task<DataFreshness> FreshnessAsync(CancellationToken cancellationToken);
}

/// Плечи перевозки от точки вывоза до полигонов по дорожной сети (R-020).
/// Полигона нет в ответе — сохранённого расстояния для него нет; расстояние
/// по прямой не подставляется, потому что оно занижает смету.
///
/// @supports: R-020
public interface IRoadDistances
{
  Task<IReadOnlyDictionary<string, double>> FromAsync(
      Coordinates pickup,
      CancellationToken cancellationToken);
}

/// Множитель цены перевозки, действующий на дату расчёта (R-022). Единица
/// означает, что ни сезонный, ни суточный коэффициент сейчас не действует.
/// Наружу коэффициент не отдаётся (R-058) — только его влияние на стоимость.
///
/// @supports: R-022, R-058
public interface ITransportCoefficients
{
  Task<decimal> EffectiveAsync(CancellationToken cancellationToken);
}

/// Позиция сохранённого расчёта: что ввёл пользователь и сколько это тонн.
public sealed record StoredItem(string WasteGroupId, Quantity Input, decimal Tons);

/// Расчёт, как он лежит в хранилище: исходные данные, позиции, выбор и
/// распределение. Варианты размещения сюда не кладутся — они считаются из
/// справочников при каждом чтении, и снимок цен делается только при выпуске
/// коммерческого предложения (R-036).
///
/// @supports: R-002, R-027, R-030, R-048
public sealed record StoredCalculation(
    string Id,
    DateTimeOffset CreatedAt,
    PickupAddress PickupAddress,
    bool DisposalRequired,
    DistanceFilter DistanceFilter,
    DateOnly PricesUpdatedAt,
    DateOnly StatusesUpdatedAt,
    IReadOnlyList<StoredItem> Items,
    IReadOnlyList<SelectionEntry> Selection,
    IReadOnlyList<AllocationEntry> Allocation);

/// Хранение расчёта. Расчёт живёт дольше запроса: по его идентификатору потом
/// читают варианты размещения, задают выбор, распределяют объём и выпускают
/// коммерческое предложение.
///
/// @supports: R-002, R-027, R-030
public interface ICalculationStore
{
  Task SaveAsync(StoredCalculation calculation, CancellationToken cancellationToken);

  Task<StoredCalculation?> FindAsync(string id, CancellationToken cancellationToken);

  /// Выбор задаётся целиком: прежний набор снимается, новый записывается
  /// одной единицей работы (R-027).
  Task SaveSelectionAsync(
      string calculationId,
      IReadOnlyList<SelectionEntry> entries,
      CancellationToken cancellationToken);

  /// Распределение применяется целиком или не применяется вовсе (R-030),
  /// поэтому замена набора идёт одной единицей работы.
  Task SaveAllocationAsync(
      string calculationId,
      IReadOnlyList<AllocationEntry> entries,
      CancellationToken cancellationToken);
}

/// Расстояний по дорожной сети для адреса вывоза нет. Отказ объявлен
/// договором кодом 503: подставить расстояние по прямой значило бы занизить
/// смету молча (R-020).
///
/// @supports: R-020
public sealed class RoadDistanceUnavailableException(string message) : Exception(message);

/// Распределение объёма не сходится с объёмом группы. Применяется целиком или
/// не применяется вовсе: частичное применение оставило бы расчёт в состоянии,
/// которого пользователь не задавал (R-030).
///
/// @supports: R-030
public sealed class AllocationMismatchException(string message) : Exception(message);

/// Запись справочника, на которую ссылается запрос, не заведена. Нулевой
/// результат был бы хуже отказа: по нему клиент решил бы, что отходов нет.
///
/// @supports: R-014
public sealed class ReferenceMissingException(string message) : Exception(message);

/// Полигон не годится для этой строки расчёта: он не принимает группу отходов
/// либо до него не сохранено плечо перевозки. Договор объявляет такой исход
/// кодом 422 — запрос разобран, но нарушает правило предметной области.
///
/// @supports: R-027, R-030
public sealed class PlacementUnavailableException(string message) : Exception(message);
