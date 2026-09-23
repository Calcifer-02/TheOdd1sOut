using System.Text.Json.Serialization;
using Imolt.Shared;

namespace Imolt.Deals.Contracts;

/// Формы передаваемых данных области «сделка» — ровно те, что объявляет
/// договор API. Поведения здесь нет: зона объявляет форму, а не правила.
///
/// Область не берёт формы у соседей: расчёт отдаёт ей закреплённые строки
/// портом, и общий тип связал бы две области напрямую (ADR-0001).
///
/// @shared: imolt-deals
/// @adr: ADR-0005
public sealed record QuoteRequest(string? CustomerName, string? Comment);

/// Строка снимка предложения: цена, закреплённая на момент выпуска (R-036).
public sealed record QuoteLine(
    string LandfillId,
    string LandfillName,
    string WasteGroupId,
    string WasteGroupName,
    decimal Tons,
    string Unit,
    decimal InputValue,
    Money TransportCost,
    Money? DisposalCost,
    Money TotalCost);

/// Коммерческое предложение. Выпуск и скачивание разделены намеренно:
/// повторное скачивание не выпускает второго номера (R-036).
public sealed record Quote(
    string Id,
    string Number,
    DateTimeOffset IssuedAt,
    DateOnly ValidUntil,
    Money Total,
    bool Preliminary,
    string DocumentUrl);

/// Всё, что нужно напечатать в документе. Отдельно от ответа операции: ответ
/// объявлен договором, а состав документа — требованием R-037.
public sealed record QuoteDocumentModel(
    string Number,
    DateTimeOffset IssuedAt,
    DateOnly ValidUntil,
    DateTimeOffset CalculatedAt,
    string PickupAddress,
    string? CustomerName,
    IReadOnlyList<QuoteLine> Lines,
    Money Total);

public sealed record PickupRequestInput(
    string? CalculationId,
    string? LandfillId,
    string ContactName,
    string Phone,
    bool PersonalDataConsent);

public sealed record PickupRequest(
    string Id,
    DateTimeOffset CreatedAt,
    string State,
    string Message)
{
  public const string Accepted = "accepted";
}

/// Услуга каталога по документации (R-052). Цена названа «от» либо не названа
/// вовсе — тогда услуга считается по запросу. Оба состояния сразу карточке
/// запрещены: она перестаёт что-либо сообщать клиенту.
public sealed record DocumentService(
    string Id,
    string Name,
    // Пустая цена уходит наружу полем со значением «ничего», а не молчанием:
    // договор объявляет priceFrom обнуляемым, и его отсутствие клиент отличить
    // от «цена не названа» не может. Служба иначе опускает пустые поля.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] Money? PriceFrom,
    bool PriceOnRequest);
