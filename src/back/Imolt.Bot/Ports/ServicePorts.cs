namespace Imolt.Bot.Ports;

/// Тариф утилизации полигона по одной группе отходов — как его хранит
/// справочник сервиса.
///
/// Значение и его дата приходят вместе: цифра без даты актуальности не
/// проверяема (R-074).
///
/// @supports: R-073, R-074
public sealed record TariffFact(
    string WasteGroupName,
    decimal PricePerTon,
    string Currency,
    DateOnly UpdatedAt);

/// Полигон справочника и его тарифы утилизации.
///
/// @supports: R-073
public sealed record LandfillTariffs(string LandfillName, IReadOnlyList<TariffFact> Tariffs);

/// Коэффициент плотности группы отходов из справочника сервиса.
///
/// @supports: R-073, R-074
public sealed record DensityFact(
    string WasteGroupName,
    decimal TonsPerCubicMeter,
    DateOnly UpdatedAt);

/// Предварительная совокупная цена вывоза, посчитанная расчётной частью.
///
/// Цена приходит целиком: ни формула, ни коэффициенты боту не передаются и в
/// нём не применяются (ADR-0009, инвариант 4).
///
/// @supports: R-072
public sealed record PreliminaryPrice(
    string CalculationId,
    string WasteGroupName,
    string LandfillName,
    decimal Total,
    string Currency,
    DateOnly PricesUpdatedAt);

/// Запрос короткого расчёта: адрес вывоза, группа отходов и объём одной
/// группы — ровно то, что участник называет в переписке (R-072).
///
/// @supports: R-072
public sealed record QuickQuoteRequest(string Address, string WasteGroup, decimal Amount, string Unit);

/// Справочники и расчёт сервиса глазами чат-бота.
///
/// Бот — потребитель расчётной части, а не второй владелец предметной логики:
/// тарифы, коэффициенты и цены он спрашивает, а не считает (ADR-0009,
/// инвариант 4). Пустой ответ — рабочее состояние, а не отказ: его называют
/// участнику прямо (R-075).
///
/// @supports: R-072, R-073, R-074, R-075
public interface IReferenceCatalog
{
  /// Полигон, подходящий под название из вопроса, и его тарифы утилизации.
  /// Пусто — полигона с таким названием у сервиса нет.
  Task<LandfillTariffs?> FindLandfillTariffsAsync(string query, CancellationToken cancellationToken);

  /// Группа отходов, подходящая под название из вопроса, и её коэффициент
  /// плотности. Пусто — такой группы у сервиса нет.
  Task<DensityFact?> FindDensityAsync(string query, CancellationToken cancellationToken);

  /// Предварительная совокупная цена по адресу вывоза и объёму одной группы
  /// отходов. Пусто — расчёт не состоялся: адрес вне зоны обслуживания, такой
  /// группы нет либо её не принимает ни один полигон.
  Task<PreliminaryPrice?> QuoteAsync(QuickQuoteRequest request, CancellationToken cancellationToken);
}

/// Языковая модель — необязательный переходник (решение по Q-019).
///
/// Порт объявлен, потому что требования R-076 и R-077 описывают поведение
/// включённого обращения. Выключенное состояние — рабочее и молчаливое:
/// участник получает справочный ответ и об отсутствии возможности не узнаёт
/// (AC-077b).
///
/// @supports: R-076, R-077
public interface ILanguageModel
{
  /// Включено ли обращение к модели. Признак спрашивают, а не выводят из
  /// удачного ответа: выключенная модель отвечает пустотой так же, как
  /// включённая, но не нашедшая что сказать.
  bool Enabled { get; }

  /// Ответ модели на вопрос участника, собранный из переданных фактов
  /// справочника. Пусто — модель ответа не дала.
  Task<string?> AnswerAsync(string prompt, CancellationToken cancellationToken);
}
