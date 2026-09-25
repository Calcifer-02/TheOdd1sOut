using Imolt.Deals.Contracts;
using Imolt.Shared;

namespace Imolt.Deals.Ports;

/// Что области «сделка» нужно от среды и что она открывает наружу.
/// Единственная зона области, видимая другим сборкам (ADR-0001, ADR-0005).

/// Расчёт глазами сделки: адрес вывоза, момент расчёта и строки выбора с уже
/// посчитанными ценами. Ни формулы, ни справочников область не знает — она
/// переносит готовые цены в снимок (R-036).
///
/// @supports: R-036, R-037
public sealed record QuotableCalculation(
    string Id,
    DateTimeOffset CreatedAt,
    string PickupAddress,
    IReadOnlyList<QuoteLine> Lines);

/// Данные расчёта для сделки. Порт объявлен здесь, а переходник к области
/// «расчёт» живёт в составе изделия: области друг на друга не ссылаются
/// (ADR-0001).
///
/// @supports: R-036
public interface ICalculationSnapshot
{
  Task<QuotableCalculation?> FindAsync(string calculationId, CancellationToken cancellationToken);
}

/// Хранение выпущенных предложений вместе со снимком цен. Снимок обязателен:
/// справочник потом изменится, а выпущенный документ обязан остаться прежним
/// (R-036, R-037).
///
/// @supports: R-036, R-037
public interface IQuoteStore
{
  /// Уже выпущенное по расчёту предложение. Повторный выпуск не заводит
  /// второго номера — на предложение ссылаются в переписке.
  Task<Quote?> FindByCalculationAsync(string calculationId, CancellationToken cancellationToken);

  Task<QuoteDocumentModel?> FindDocumentAsync(string quoteId, CancellationToken cancellationToken);

  Task SaveAsync(
      Quote quote,
      string calculationId,
      QuoteDocumentModel document,
      CancellationToken cancellationToken);

  /// Сколько предложений уже выпущено за сутки — из этого складывается
  /// порядковый номер дня (R-036). Границы суток приходят готовыми, а не
  /// считаются в запросе: календарь дня принадлежит часам службы, и второе
  /// место его вычисления неизбежно разойдётся с первым.
  Task<int> IssuedBetweenAsync(
      DateTimeOffset from,
      DateTimeOffset to,
      CancellationToken cancellationToken);
}

/// Заявки на вывоз. Заявка обязана дойти до хранилища, а не остаться ответом:
/// именно этого разрыва касается риск AR-008 (R-053).
///
/// @supports: R-053, R-054
public interface IPickupRequestStore
{
  Task SaveAsync(
      PickupRequest request,
      PickupRequestInput input,
      CancellationToken cancellationToken);
}

/// Каталог услуг по документации (R-052). Состав каталога — данные, а не
/// перечень в коде: заказчик его не подтвердил (Q-005).
///
/// @supports: R-052
public interface IDocumentServiceCatalog
{
  Task<Page<DocumentService>> ListAsync(PageRequest page, CancellationToken cancellationToken);
}

/// Печать документа предложения. Формат объявлен договором — PDF (R-036).
///
/// @supports: R-036, R-037, R-061
public interface IQuoteDocumentWriter
{
  byte[] Render(QuoteDocumentModel model);
}

/// Срок действия цены предложения (R-038). Длительность объявлена решением
/// команды по Q-010 — четырнадцать дней — и берётся настройкой службы, одним
/// местом на ответ и на документ.
///
/// @supports: R-038
public interface IPriceValidity
{
  DateOnly UntilFrom(DateTimeOffset issuedAt);
}

/// Допустимое отклонение окончательной цены от предварительной (R-059).
///
/// Объявлено тем же решением по Q-010 — десять процентов — и живёт настройкой
/// службы: ответ заказчика заменит число, а не устройство. Порт отдельный от
/// срока действия: величины разные, и связывать их одним типом значило бы
/// обещать, что они меняются вместе.
///
/// @supports: R-059
public interface IPriceTolerance
{
  decimal Percent { get; }
}

/// Выпускать нечего: в расчёте не выбран ни один полигон, и закреплять в
/// предложении нечего. Договор объявляет такой исход кодом 422 — запрос
/// разобран, но нарушает правило предметной области.
///
/// @supports: R-036
public sealed class NothingToQuoteException(string message) : Exception(message)
{
}

/// Согласие на обработку персональных данных не дано. Принять данные и
/// отказать — худший из исходов: снаружи он неотличим от честного отказа
/// (R-054).
///
/// @supports: R-054
public sealed class ConsentMissingException(string message) : Exception(message)
{
}

/// Учётные записи участников, опознанных платформой (СУЩ-13).
///
/// Запись заводится только при сошедшейся подписи и данном согласии: отказ,
/// оставивший учётную запись, снаружи неотличим от честного (R-049, R-054).
///
/// @supports: R-049, R-051
public interface ISubscriberStore
{
  /// Заводит учётную запись или возвращает прежнюю по учётной записи
  /// платформы. Повторный вход не создаёт второго участника.
  Task<Profile> EnrolAsync(string maxUserId, string? displayName, CancellationToken cancellationToken);

  Task<Profile?> FindAsync(string subscriberId, CancellationToken cancellationToken);

  /// Заявка на подписку переводит её в состояние «ожидает»: оплата идёт вне
  /// сервиса, и подтвердить её сервер не может (R-008, R-049).
  Task<SubscriptionRequest> RequestSubscriptionAsync(
      string subscriberId,
      SubscriptionRequestInput input,
      CancellationToken cancellationToken);
}

/// Права участника: что ему разрешено в сервисе (ADR-0007).
///
/// Порт объявлен отдельно от ISubscriberStore намеренно. Учётная запись
/// отвечает на вопрос «кто этот участник в обороте отходов», права — на
/// вопрос «что ему здесь можно», и смешивать их в одном порте значит звать на
/// проверку права то, что к ней отношения не имеет.
///
/// Проверка права ничего не знает о поставщике личности: в ней нет ни
/// платформы, ни стартовых параметров, ни ключа бота. Это инвариант 3
/// решения ADR-0007, и собственный вход по R-066 не должен его трогать.
///
/// @supports: R-042, R-045
/// @adr: ADR-0007
public interface IParticipantPermissions
{
  Task<bool> HasAsync(string subscriberId, string permission, CancellationToken cancellationToken);

  /// Приводит набор прав участника к заданному. Применяется при входе по
  /// составу, объявленному развёртыванием: право, снятое из состава, должно
  /// сниматься и у участника, иначе список перестаёт быть источником истины.
  Task SetAsync(
      string subscriberId,
      IReadOnlyCollection<string> permissions,
      CancellationToken cancellationToken);
}

/// Права, объявленные проектом. В версии 1 оно одно: перечень растёт вместе с
/// операциями, которые кому-то закрыты.
///
/// @supports: R-042
/// @adr: ADR-0007
public static class Permissions
{
  public const string ManageReferences = "manageReferences";
}

/// Заказы услуг по документации (СУЩ-10).
///
/// @supports: R-052, R-054
public interface IDocumentServiceOrderStore
{
  Task<bool> ServiceExistsAsync(string serviceId, CancellationToken cancellationToken);

  Task SaveAsync(
      DocumentServiceOrder order,
      string subscriberId,
      DocumentServiceOrderInput input,
      CancellationToken cancellationToken);
}

/// Маркер доступа. Договор объявляет его JWT; срок жизни называется вместе с
/// маркером, чтобы клиент не угадывал его по опыту.
///
/// @supports: R-049, R-050
public interface IAccessTokens
{
  (string Token, int ExpiresIn) Issue(Participant participant);

  /// Участник по маркеру. Пусто означает «маркера нет или он негоден» —
  /// различать это клиенту незачем, и обе причины дают один отказ.
  Participant? Resolve(string? token);
}

/// Подпись стартовых параметров не сошлась либо они устарели. Договор
/// объявляет такой исход кодом 401 (ADR-0006).
///
/// @supports: R-049
public sealed class IdentityRefusedException(string message) : Exception(message)
{
}
