using Dapper;
using Imolt.References.Contracts;
using Imolt.References.Ports;
using Imolt.Shared;
using Npgsql;

namespace Imolt.References.Adapters;

/// Дата актуальности справочных данных (R-048). Ценность сервиса — свежесть
/// данных, и пользователь должен видеть, на какой день посчитан результат, не
/// догадываясь об этом.
///
/// @req: R-048
/// @adr: ADR-0005
public sealed class DataFreshnessSource(NpgsqlDataSource dataSource, IClock clock) : IDataFreshnessSource
{
  /// Через сколько дней сведения о полигоне считаются устаревшими. Регламент
  /// актуализации заказчиком не утверждён — открытый вопрос Q-001, поэтому
  /// порог объявлен здесь явно и один раз, а не рассыпан по запросам.
  private const int StaleAfterDays = 7;

  public async Task<DataFreshness> ReadAsync(CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    // Берётся наибольшая дата: сводка отвечает «данные не старше этого дня».
    // Наименьшая говорила бы о самой запущенной записи, а не о справочнике.
    var row = await connection.QuerySingleAsync<FreshnessRow>(new CommandDefinition(
        """
        select
          (select max(updated_at) from waste_group)              as prices_updated_at,
          (select max(status_updated_at) from landfill)          as statuses_updated_at,
          (select count(*) from landfill where status_updated_at < @stale) as stale_landfills
        """,
        new { stale = clock.Today.AddDays(-StaleAfterDays) },
        cancellationToken: cancellationToken));

    // Пустой справочник — не отказ: служба честно отвечает, что данных нет,
    // и датой считается сегодняшний день.
    return new DataFreshness(
        row.PricesUpdatedAt ?? clock.Today,
        row.StatusesUpdatedAt ?? clock.Today,
        row.StaleLandfills);
  }

  private sealed class FreshnessRow
  {
    public DateOnly? PricesUpdatedAt { get; set; }

    public DateOnly? StatusesUpdatedAt { get; set; }

    public int StaleLandfills { get; set; }
  }
}
