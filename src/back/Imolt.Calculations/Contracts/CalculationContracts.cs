using Imolt.Shared;

namespace Imolt.Calculations.Contracts;

/// Формы передаваемых данных области «расчёт» — ровно те, что объявляет
/// договор API. Поведения здесь нет: зона объявляет форму, а не правила.
///
/// Область не берёт формы у соседей: у справочников своя запись координат и
/// своя дата актуальности. Общий тип связал бы две области напрямую, а связь
/// между ними идёт только через порт (ADR-0001).
///
/// @shared: imolt-calculations
/// @adr: ADR-0005
public sealed record Coordinates(double Latitude, double Longitude);

/// Адрес вывоза. Расчёт опирается на координаты, а не на набранную строку
/// (R-012): без координат считать плечо перевозки нечем.
public sealed record PickupAddress(
    string Value,
    Coordinates Coordinates,
    string? Area,
    string? SuggestionId);

/// Объём в объявленной мере: тонны либо кубометры (R-014).
public sealed record Quantity(decimal Value, string Unit);

/// Отбор по плечу перевозки: «не далее» либо «не менее» стольких километров
/// (R-025). По умолчанию — не далее пятидесяти (R-026).
public sealed record DistanceFilter(string Mode, int Km)
{
  public const string AtMost = "atMost";

  public const string AtLeast = "atLeast";

  public const int DefaultKm = 50;
}

public sealed record CalculationItemInput(string WasteGroupId, Quantity Quantity);

public sealed record CalculationRequest(
    PickupAddress PickupAddress,
    IReadOnlyList<CalculationItemInput> Items,
    bool DisposalRequired,
    DistanceFilter? DistanceFilter);

/// Позиция расчёта: введённый объём, объём в мере расчёта и масса, по которой
/// считается стоимость. Мера расчёта берётся у зоны адреса вывоза (R-016), и
/// объём в ней совпадает с введённым только тогда, когда меры совпали.
public sealed record CalculationItem(
    string WasteGroupId,
    string WasteGroupName,
    Quantity Input,
    Quantity Calculated,
    decimal Tons);

/// Строка результата: один полигон для одной группы отходов (R-023).
public sealed record PlacementOption(
    string LandfillId,
    string LandfillName,
    string Address,
    double DistanceKm,
    Money TransportCost,
    Money? DisposalCost,
    Money TotalCost,
    string Status,
    DateOnly StatusUpdatedAt);

/// Страница вариантов размещения. Пустой список ошибкой не является —
/// у пустоты названа причина (R-029).
public sealed record PlacementOptionPage(
    int Total,
    int Limit,
    int Offset,
    IReadOnlyList<PlacementOption> Items,
    string? EmptyReason)
{
  public const string NoLandfillsForWasteGroup = "noLandfillsForWasteGroup";

  public const string FilteredOutByDistance = "filteredOutByDistance";
}

/// Вкладка результата: по одной на каждую группу отходов расчёта.
public sealed record WasteGroupResult(string WasteGroupId, PlacementOptionPage Options);

public sealed record SelectionEntry(string WasteGroupId, string LandfillId);

/// Выбор задаётся целиком: пустой список снимает выбор (R-027).
public sealed record SelectionRequest(IReadOnlyList<SelectionEntry> Entries);

/// Предупреждение выбора: выбор не отменяется, но пользователь узнаёт, что
/// полигон заблокирован или данные о нём устарели (R-028).
public sealed record SelectionWarning(string Code, string LandfillId, string Message)
{
  public const string LandfillBlocked = "landfillBlocked";

  public const string LandfillDataStale = "landfillDataStale";
}

public sealed record SelectionState(
    IReadOnlyList<SelectionEntry> Entries,
    int SelectedLandfills,
    Money Total,
    IReadOnlyList<SelectionWarning> Warnings);

public sealed record AllocationEntry(string WasteGroupId, string LandfillId, Quantity Quantity);

/// Распределение задаётся целиком и применяется целиком (R-030).
public sealed record AllocationRequest(IReadOnlyList<AllocationEntry> Entries);

/// Часть распределения вместе с ценой этой части (R-030).
public sealed record AllocationPricedEntry(
    string WasteGroupId,
    string LandfillId,
    Quantity Quantity,
    Money TransportCost,
    Money? DisposalCost,
    Money TotalCost);

public sealed record AllocationState(IReadOnlyList<AllocationPricedEntry> Entries, Money Total);

/// Дата актуальности данных, на которых посчитан расчёт (R-048). Закрепляется
/// в момент расчёта: иначе старый расчёт молча меняет смысл.
public sealed record DataFreshness(
    DateOnly PricesUpdatedAt,
    DateOnly StatusesUpdatedAt,
    int LandfillsWithStaleData);

/// Расчёт целиком. Признак предварительности истинен всегда: это состояние
/// объявлено полем, а не примечанием в макете (R-059).
public sealed record Calculation(
    string Id,
    DateTimeOffset CreatedAt,
    bool Preliminary,
    PickupAddress PickupAddress,
    string Measure,
    bool DisposalRequired,
    DistanceFilter DistanceFilter,
    IReadOnlyList<CalculationItem> Items,
    IReadOnlyList<WasteGroupResult> Results,
    SelectionState? Selection,
    AllocationState? Allocation,
    DataFreshness DataFreshness);

public sealed record AmountConversionItem(string WasteGroupId, Quantity Quantity);

public sealed record AmountConversionRequest(IReadOnlyList<AmountConversionItem> Items);

/// Пересчёт возвращает обе меры и сам меру расчёта не выбирает: заказчик не
/// решил, считать ли по адресу вывоза или по полигону (Q-009).
public sealed record AmountConversionResultItem(
    string WasteGroupId,
    Quantity Input,
    decimal Tons,
    decimal CubicMeters,
    decimal DensityTonPerCubicMeter);

public sealed record AmountConversionResult(IReadOnlyList<AmountConversionResultItem> Items);

/// Строка кабинета: расчёт, каким его видит владелец (R-008, R-049).
/// Итог — сумма выбранных полигонов; у расчёта без выбора он равен нулю, как
/// и у пустой сводки выбора: ноль рублей и отсутствие итога клиент читает
/// по-разному.
public sealed record CalculationSummary(
    string Id,
    DateTimeOffset CreatedAt,
    string PickupAddress,
    Money Total);

/// Строка выбора с закреплённой ценой: то, что коммерческое предложение
/// переносит в свой снимок (R-036, R-037). Справочник потом изменится, а
/// выпущенный документ обязан остаться прежним.
public sealed record PricedSelection(
    string LandfillId,
    string LandfillName,
    string WasteGroupId,
    string WasteGroupName,
    decimal Tons,
    Quantity Input,
    Money TransportCost,
    Money? DisposalCost,
    Money TotalCost);

/// Отбор вариантов размещения при чтении страницы (R-024, R-025).
public sealed record PlacementQuery(
    string WasteGroupId,
    string Sort,
    string Order,
    DistanceFilter Distance)
{
  public const string ByTotal = "total";

  public const string ByTransport = "transport";

  public const string ByDisposal = "disposal";

  public const string ByDistance = "distance";

  public const string Ascending = "asc";

  public const string Descending = "desc";
}
