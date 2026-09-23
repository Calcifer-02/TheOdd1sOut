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

  /// Сколько предложений уже выпущено сегодня — из этого складывается
  /// порядковый номер дня (R-036).
  Task<int> IssuedOnAsync(DateOnly day, CancellationToken cancellationToken);
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

/// Срок действия цены предложения (R-038). Длительность заказчиком не названа
/// (Q-010) и берётся настройкой службы — одним местом на ответ и на документ.
///
/// @supports: R-038
public interface IPriceValidity
{
  DateOnly UntilFrom(DateTimeOffset issuedAt);
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
