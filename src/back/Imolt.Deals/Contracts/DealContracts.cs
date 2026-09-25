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
///
/// Допустимое отклонение хранится вместе со снимком цен, а не берётся
/// настройкой при скачивании: это условие, на котором предложение выпущено, и
/// документ, пересчитанный по сегодняшней настройке, назвал бы клиенту другое
/// (R-059). У предложений, выпущенных до решения по Q-010, его нет — тогда
/// отметка о предварительности печатается без числа.
public sealed record QuoteDocumentModel(
    string Number,
    DateTimeOffset IssuedAt,
    DateOnly ValidUntil,
    DateTimeOffset CalculatedAt,
    string PickupAddress,
    string? CustomerName,
    IReadOnlyList<QuoteLine> Lines,
    Money Total,
    decimal? PriceTolerancePercent = null);

/// Исполнитель, от чьего имени выпущено предложение (R-037, решение по Q-012).
///
/// Реквизиты — настройка службы, а не запись в коде: то же решение в другом
/// развёртывании назовёт другую компанию. Логотипа, подписи и печати здесь
/// нет намеренно — прав на них никто не передавал, а подпись в автоматическом
/// документе была бы обязательством, которого никто не брал.
public sealed record QuoteIssuer(string Name, string Phone, string Email, string City);

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

/// Строка стартовых параметров мини-приложения как есть, без разбора на
/// стороне клиента: проверять подпись можно только по исходной строке
/// (ADR-0006).
public sealed record SessionRequest(string InitData, bool PersonalDataConsent);

/// Состояние подписки (R-008, R-049). «pending» — нормальный исход, а не
/// ошибка: оплата идёт вне сервиса.
public sealed record SubscriptionState(string State, DateOnly? ActiveUntil)
{
  public const string None = "none";

  public const string Pending = "pending";

  public const string Active = "active";
}

/// Профиль участника. Учётная запись платформы названа обязательно: по ней
/// пользователь опознан, и без неё профиль ничей (R-049, R-051).
public sealed record Profile(
    string Id,
    string MaxUserId,
    string? DisplayName,
    string? Role,
    string? CompanyName,
    string? Inn,
    string? Phone,
    bool? RegisteredInAisOssig,
    bool? HasTransportLicense,
    bool? HasSanitaryConclusion,
    SubscriptionState Subscription);

/// Сессия участника. Срок жизни маркера объявлен полем: клиент не угадывает
/// его по опыту.
public sealed record Session(string AccessToken, int ExpiresIn, Profile Profile);

/// Что участник сообщает о себе, подавая заявку (R-051). Признаки допускают
/// пустое значение и после правки остаются пустыми: «не сообщил» и «сообщил,
/// что документа нет» — разные ответы, и по второму перевозчику откажут.
public sealed record SubscriptionRequestInput(
    string Role,
    string CompanyName,
    string Inn,
    string? Phone,
    bool? RegisteredInAisOssig,
    bool? HasTransportLicense,
    bool? HasSanitaryConclusion);

public sealed record SubscriptionRequest(
    string Id,
    DateTimeOffset CreatedAt,
    SubscriptionState Subscription,
    string Message);

public sealed record DocumentServiceOrderInput(
    string ServiceId,
    string ObjectAddress,
    string? Comment,
    bool PersonalDataConsent);

public sealed record DocumentServiceOrder(
    string Id,
    string ServiceId,
    DateTimeOffset CreatedAt,
    string State,
    string Message)
{
  public const string Accepted = "accepted";
}

/// Участник, опознанный по маркеру доступа. Роли областей о нём не знают —
/// они получают идентификатор доводом (ADR-0001).
public sealed record Participant(string Id, string MaxUserId);
