using Imolt.References.Contracts;
using Imolt.Shared;

namespace Imolt.References.Ports;

/// Что области «справочники» нужно от среды и что она открывает наружу.
/// Единственная зона области, видимая другим сборкам (ADR-0001, ADR-0005).
///
/// @supports: R-013, R-039
/// @adr: ADR-0001
public interface IWasteGroupCatalog
{
  /// Поиск идёт и по названию, и по коду каталога ФККО: пользователь
  /// приходит то с одним, то с другим (R-013).
  Task<Page<WasteGroup>> SearchAsync(string? query, PageRequest page, CancellationToken cancellationToken);

  Task<WasteGroup?> FindAsync(string id, CancellationToken cancellationToken);
}

/// Реестр полигонов и отзывы о них.
///
/// @supports: R-031, R-040, R-041
/// @adr: ADR-0001
public interface ILandfillRegistry
{
  Task<Page<Landfill>> SearchAsync(LandfillFilter filter, PageRequest page, CancellationToken cancellationToken);

  Task<LandfillCard?> FindAsync(string id, CancellationToken cancellationToken);

  Task<bool> ExistsAsync(string id, CancellationToken cancellationToken);

  /// Все полигоны, принимающие заданную группу отходов, — без страниц.
  /// Подбор вариантов размещения обязан видеть список целиком: полигон,
  /// не поместившийся на страницу, молча выпал бы из расчёта (R-004, R-040).
  Task<IReadOnlyList<Landfill>> AcceptingAsync(string wasteGroupId, CancellationToken cancellationToken);

  /// Средняя оценка пуста, когда отзывов нет: ноль означал бы «оценили на
  /// ноль», а такой оценки в договоре нет (R-031).
  /// Оценка полигона от участника с сессией (R-031). Автор обязателен:
  /// анонимная оценка достоверности сведений ничего не говорит о доверии к
  /// ней самой.
  Task<LandfillReview?> AddReviewAsync(
      string landfillId,
      string subscriberId,
      int rating,
      string? text,
      CancellationToken cancellationToken);

  Task<(Page<LandfillReview> Reviews, double? AverageRating)> ReviewsAsync(
      string landfillId,
      PageRequest page,
      CancellationToken cancellationToken);
}

/// Подсказки адреса вывоза. Обращение наружу идёт только отсюда: ключ внешней
/// службы не покидает сервер (R-056, риск AR-006).
///
/// @supports: R-012, R-055, R-056
/// @adr: ADR-0001
public interface IAddressSuggestions
{
  Task<IReadOnlyList<AddressSuggestion>> SuggestAsync(
      string query,
      int limit,
      CancellationToken cancellationToken);
}

/// Дата актуальности справочных данных (R-048).
///
/// @supports: R-048
/// @adr: ADR-0001
public interface IDataFreshnessSource
{
  Task<DataFreshness> ReadAsync(CancellationToken cancellationToken);
}

/// Отказ внешнего источника. Отличается от прочих ошибок тем, что сохранённые
/// данные при этом остаются доступны: отказ источника не равен отказу
/// обслуживания (ADR-0002, инвариант 5).
///
/// @supports: R-055
/// @adr: ADR-0002
public sealed class UpstreamUnavailableException(string message, int retryAfterSeconds)
  : Exception(message)
{
  public int RetryAfterSeconds { get; } = retryAfterSeconds;
}
