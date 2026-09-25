using System.Text.Json.Serialization;
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

/// Поле порядка реестра полигонов (R-088).
///
/// Порядок считает служба, а не экран: выдача постраничная, и список,
/// упорядоченный на клиенте, переставил бы только показанную страницу.
public enum LandfillSort
{
  /// по названию полигона
  Name,

  /// по статусу приёма
  Status,

  /// по дате, на которую статус известен
  UpdatedAt,

  /// по тарифу утилизации
  Tariff,
}

/// Отбор реестра полигонов: поиск по названию, принимаемая группа отходов,
/// статус и порядок списка (R-004, R-028, R-040, R-088).
///
/// Порядок и его направление стоят здесь со значениями по умолчанию: вызовы,
/// которым порядок безразличен, остаются прежними.
public sealed record LandfillFilter(
    string? Query,
    string? WasteGroupId,
    string? Status,
    LandfillSort Sort = LandfillSort.Name,
    bool Descending = false);

/// Оценка полигона, как её присылает участник (R-031). Текст необязателен:
/// оценка без слов — тоже сигнал о достоверности сведений.
public sealed record LandfillReviewInput(int Rating, string? Text);

/// Правка группы отходов: меняется переданное, непереданное остаётся прежним
/// (R-042, R-043). Все поля необязательны, поэтому каждое допускает пустоту —
/// пустота здесь означает «не трогать», а не «стереть».
public sealed record WasteGroupUpdate(
    string? Name,
    IReadOnlyList<string>? FkkoCodes,
    Money? TransportPricePerTonKm,
    double? DensityTonPerCubicMeter);

/// Правка тарифа утилизации: ячейка таблицы «полигон и группа отходов»
/// (R-042).
public sealed record LandfillTariffUpdate(Money DisposalPricePerTon);

/// Ручная установка статуса полигона (R-044). Основание необязательно, но
/// именно оно отличает подтверждённый статус от проставленного наугад.
public sealed record LandfillStatusUpdate(string Status, string? Reason);

/// Состояние статуса полигона вместе с источником: ручной ввод отличим от
/// полученного из канала сообщений (R-028, R-044).
public sealed record LandfillStatusState(
    string LandfillId,
    string Status,
    DateOnly StatusUpdatedAt,
    string Source,
    string? Reason);

/// Итог прогона обновления справочных данных (R-044, R-046, R-048).
public sealed record SyncRun(
    DateTimeOffset StartedAt,
    DateTimeOffset? FinishedAt,
    string Source,
    string Outcome,
    int RecognizedMessages,
    int UpdatedLandfills,
    string? FailureReason);

/// Одно расхождение между справочником и книгой (R-045). Текущее значение
/// отдаётся всегда, в том числе пустым: его отсутствие в ответе читалось бы
/// как «поле не участвует», а не как «в справочнике пусто».
public sealed record ReferenceImportChange(
    string EntityId,
    string Field,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] string? CurrentValue,
    string FileValue);

/// Строка книги, которую разобрать не удалось (R-045). Номер строки
/// обязателен: без него менеджер данных не найдёт её в файле.
public sealed record ReferenceImportRejectedRow(int Row, string Reason);

/// Разобранная книга до применения: расхождения видны до записи (R-045).
public sealed record ReferenceImportPreview(
    string Id,
    string Kind,
    IReadOnlyList<ReferenceImportChange> Changes,
    IReadOnlyList<ReferenceImportRejectedRow> RejectedRows);

/// Итог применения разобранной книги (R-045).
public sealed record ReferenceImportResult(
    string Id,
    int AppliedChanges,
    DateTimeOffset UpdatedAt);
