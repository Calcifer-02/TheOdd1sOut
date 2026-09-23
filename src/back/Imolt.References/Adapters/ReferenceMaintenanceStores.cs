using System.Text.Json;
using Dapper;
using Imolt.References.Contracts;
using Imolt.References.Domain;
using Imolt.References.Ports;
using Imolt.Shared;
using Npgsql;

namespace Imolt.References.Adapters;

/// Редактор справочников поверх PostgreSQL (СУЩ-01, СУЩ-02, СУЩ-03).
///
/// Всякая правка двигает дату актуальности: ценность сервиса — свежесть
/// данных, и запись без отметки о дне правки неотличима от лежалой (R-048).
///
/// @req: R-042, R-043, R-044
/// @adr: ADR-0005
public sealed class ReferenceEditor(NpgsqlDataSource dataSource, IClock clock) : IReferenceEditor
{
  public async Task<WasteGroup?> UpdateWasteGroupAsync(
      string wasteGroupId,
      WasteGroupUpdate update,
      CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
    await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

    // coalesce оставляет непереданное поле прежним: договор объявляет правку
    // частичной, и пустота означает «не трогать», а не «стереть».
    var changed = await connection.ExecuteAsync(new CommandDefinition(
        """
        update waste_group
           set name = coalesce(@name, name),
               transport_price_per_ton_km = coalesce(@price, transport_price_per_ton_km),
               density_ton_per_m3 = coalesce(@density, density_ton_per_m3),
               updated_at = @today
         where id = @id
        """,
        new
        {
          id = wasteGroupId,
          name = update.Name,
          price = update.TransportPricePerTonKm?.Amount,
          density = update.DensityTonPerCubicMeter,
          today = clock.Today,
        },
        transaction,
        cancellationToken: cancellationToken));

    if (changed == 0)
    {
      return null;
    }

    // Коды переписываются целиком, а не дополняются: переданный список — это
    // состав кодов группы, и добавление к прежнему сделало бы удаление кода
    // невозможным.
    if (update.FkkoCodes is { } codes)
    {
      await connection.ExecuteAsync(new CommandDefinition(
          "delete from waste_group_fkko_code where waste_group_id = @id",
          new { id = wasteGroupId },
          transaction,
          cancellationToken: cancellationToken));

      foreach (var code in codes.Distinct(StringComparer.Ordinal))
      {
        await connection.ExecuteAsync(new CommandDefinition(
            "insert into waste_group_fkko_code (waste_group_id, code) values (@id, @code)",
            new { id = wasteGroupId, code },
            transaction,
            cancellationToken: cancellationToken));
      }
    }

    await transaction.CommitAsync(cancellationToken);

    return await ReadWasteGroupAsync(wasteGroupId, cancellationToken);
  }

  public async Task<LandfillTariff?> SetTariffAsync(
      string landfillId,
      string wasteGroupId,
      Money disposalPricePerTon,
      CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    // Обе стороны ячейки проверяются до записи: внешний ключ отказал бы тем же
    // самым, но ошибкой базы, а договор объявляет здесь 404 с именем записи.
    var known = await connection.ExecuteScalarAsync<bool>(new CommandDefinition(
        """
        select exists (select 1 from landfill where id = @landfillId)
           and exists (select 1 from waste_group where id = @wasteGroupId)
        """,
        new { landfillId, wasteGroupId },
        cancellationToken: cancellationToken));

    if (!known)
    {
      return null;
    }

    await connection.ExecuteAsync(new CommandDefinition(
        """
        insert into landfill_tariff (landfill_id, waste_group_id, disposal_price_per_ton, updated_at)
        values (@landfillId, @wasteGroupId, @price, @today)
        on conflict (landfill_id, waste_group_id)
        do update set disposal_price_per_ton = excluded.disposal_price_per_ton,
                      updated_at = excluded.updated_at
        """,
        new
        {
          landfillId,
          wasteGroupId,
          price = disposalPricePerTon.Amount,
          today = clock.Today,
        },
        cancellationToken: cancellationToken));

    return new LandfillTariff(wasteGroupId, disposalPricePerTon, clock.Today);
  }

  public async Task<LandfillStatusState?> SetStatusAsync(
      string landfillId,
      string status,
      string? reason,
      CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    // Источник записывается ручным: иначе позже не отличить подтверждённое
    // человеком от полученного из канала сообщений, а отличать придётся —
    // ручной ввод и есть запасной путь при недоступном источнике (R-044).
    var row = await connection.QuerySingleOrDefaultAsync<StatusRow>(new CommandDefinition(
        """
        update landfill
           set status = @status,
               status_reason = @reason,
               status_source = 'manual',
               status_updated_at = @today
         where id = @landfillId
        returning id, status, status_updated_at, status_source, status_reason
        """,
        new { landfillId, status, reason, today = clock.Today },
        cancellationToken: cancellationToken));

    return row is null
        ? null
        : new LandfillStatusState(row.Id, row.Status, row.StatusUpdatedAt, row.StatusSource, row.StatusReason);
  }

  private async Task<WasteGroup?> ReadWasteGroupAsync(string id, CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    var row = await connection.QuerySingleOrDefaultAsync<WasteGroupRow>(new CommandDefinition(
        """
        select g.id,
               g.name,
               g.transport_price_per_ton_km,
               g.density_ton_per_m3,
               g.updated_at,
               coalesce(
                 (select array_agg(c.code order by c.code)
                    from waste_group_fkko_code c
                   where c.waste_group_id = g.id),
                 '{}') as fkko_codes
          from waste_group g
         where g.id = @id
        """,
        new { id },
        cancellationToken: cancellationToken));

    return row is null
        ? null
        : new WasteGroup(
            row.Id,
            row.Name,
            row.FkkoCodes,
            Money.Rubles(row.TransportPricePerTonKm),
            row.DensityTonPerM3,
            row.UpdatedAt);
  }

  private sealed class StatusRow
  {
    public string Id { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public DateOnly StatusUpdatedAt { get; set; }

    public string StatusSource { get; set; } = string.Empty;

    public string? StatusReason { get; set; }
  }

  private sealed class WasteGroupRow
  {
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public decimal TransportPricePerTonKm { get; set; }

    public double DensityTonPerM3 { get; set; }

    public DateOnly UpdatedAt { get; set; }

    public string[] FkkoCodes { get; set; } = [];
  }
}

/// Прогоны обновления справочных данных поверх PostgreSQL (СУЩ-12).
///
/// @req: R-044, R-048
/// @adr: ADR-0002
public sealed class SyncRunStore(NpgsqlDataSource dataSource) : ISyncRuns
{
  public async Task RecordAsync(SyncRun run, CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    await connection.ExecuteAsync(new CommandDefinition(
        """
        insert into sync_run (
            id, started_at, finished_at, source, outcome,
            recognized_messages, updated_landfills, failure_reason
        ) values (
            @id, @startedAt, @finishedAt, @source, @outcome,
            @recognizedMessages, @updatedLandfills, @failureReason
        )
        """,
        new
        {
          id = Guid.NewGuid(),
          startedAt = run.StartedAt.ToUniversalTime(),
          finishedAt = run.FinishedAt?.ToUniversalTime(),
          source = run.Source,
          outcome = run.Outcome,
          recognizedMessages = run.RecognizedMessages,
          updatedLandfills = run.UpdatedLandfills,
          failureReason = run.FailureReason,
        },
        cancellationToken: cancellationToken));
  }

  public async Task<SyncRun?> LatestAsync(CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    var row = await connection.QuerySingleOrDefaultAsync<SyncRunRow>(new CommandDefinition(
        """
        select started_at, finished_at, source, outcome,
               recognized_messages, updated_landfills, failure_reason
          from sync_run
         order by started_at desc
         limit 1
        """,
        cancellationToken: cancellationToken));

    return row is null
        ? null
        : new SyncRun(
            row.StartedAt.ToLocalTime(),
            row.FinishedAt?.ToLocalTime(),
            row.Source,
            row.Outcome,
            row.RecognizedMessages,
            row.UpdatedLandfills,
            row.FailureReason);
  }

  private sealed class SyncRunRow
  {
    public DateTimeOffset StartedAt { get; set; }

    public DateTimeOffset? FinishedAt { get; set; }

    public string Source { get; set; } = string.Empty;

    public string Outcome { get; set; } = string.Empty;

    public int RecognizedMessages { get; set; }

    public int UpdatedLandfills { get; set; }

    public string? FailureReason { get; set; }
  }
}
