using Imolt.Shared;

namespace Imolt.References.Contracts;

/// Формы передаваемых данных области «справочники» — ровно те, что объявляет
/// договор API. Поведения здесь нет: зона объявляет форму, а не правила
/// (ADR-0005, роль зоны «контракт данных»).
///
/// @shared: imolt-references
/// @adr: ADR-0005
public sealed record Coordinates(double Latitude, double Longitude);

/// Группа отходов: единица справочника с общей ценой перевозки за
/// тонна-километр и общим коэффициентом плотности (R-039).
public sealed record WasteGroup(
    string Id,
    string Name,
    IReadOnlyList<string> FkkoCodes,
    Money TransportPricePerTonKm,
    double DensityTonPerCubicMeter,
    DateOnly UpdatedAt);

/// Тариф утилизации: ячейка таблицы «полигон и группа отходов» (R-019).
public sealed record LandfillTariff(
    string WasteGroupId,
    Money DisposalPricePerTon,
    DateOnly UpdatedAt);

/// Полигон в списке реестра (R-040).
public sealed record Landfill(
    string Id,
    string Name,
    string? LegalEntity,
    string Address,
    Coordinates Coordinates,
    string Status,
    DateOnly StatusUpdatedAt,
    IReadOnlyList<LandfillTariff> Tariffs);

/// Период владения полигоном одним юрлицом. Открытый период — тот, у которого
/// нет даты окончания (R-041).
public sealed record LegalEntityPeriod(
    string LegalEntity,
    DateOnly Since,
    DateOnly? Until);

/// Карточка полигона: список плюс история смены юрлица. История отдаётся
/// только карточкой — в списке она была бы шумом (R-041).
public sealed record LandfillCard(
    string Id,
    string Name,
    string? LegalEntity,
    string Address,
    Coordinates Coordinates,
    string Status,
    DateOnly StatusUpdatedAt,
    IReadOnlyList<LandfillTariff> Tariffs,
    IReadOnlyList<LegalEntityPeriod> LegalEntityHistory);

/// Оценка достоверности сведений о полигоне (R-031).
public sealed record LandfillReview(
    string Id,
    string LandfillId,
    int Rating,
    string? Text,
    DateTimeOffset CreatedAt);

/// Подсказка адреса вывоза: расчёт опирается на координаты, а не на набранную
/// строку (R-012).
public sealed record AddressSuggestion(
    string Id,
    string Value,
    Coordinates Coordinates,
    string Area);

/// Дата актуальности цен и статусов (R-048).
public sealed record DataFreshness(
    DateOnly PricesUpdatedAt,
    DateOnly StatusesUpdatedAt,
    int LandfillsWithStaleData);

/// Отбор реестра полигонов: поиск по названию, принимаемая группа отходов,
/// статус (R-004, R-028, R-040).
public sealed record LandfillFilter(
    string? Query,
    string? WasteGroupId,
    string? Status);

/// Оценка полигона, как её присылает участник (R-031). Текст необязателен:
/// оценка без слов — тоже сигнал о достоверности сведений.
public sealed record LandfillReviewInput(int Rating, string? Text);
