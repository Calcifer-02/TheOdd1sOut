using System.Text.Json;
using Dapper;
using Imolt.References.Contracts;
using Imolt.References.Domain;
using Imolt.References.Ports;
using Imolt.Shared;
using Npgsql;

namespace Imolt.References.Adapters;

/// Импорт справочника поверх PostgreSQL (СУЩ-14).
///
/// Предпросмотр хранится целиком разобранным ответом, а не исходным файлом:
/// файл менеджера данных — рабочая книга с посторонними столбцами и
/// примечаниями, и хранить её означало бы держать у себя чужие сведения без
/// нужды. Применяется же в любом случае показанный список расхождений, а не
/// разобранный заново файл.
///
/// @req: R-045, R-046
/// @adr: ADR-0005
public sealed class ReferenceImportStore(NpgsqlDataSource dataSource, IClock clock) : IReferenceImports
{
  /// Имена полей предпросмотра совпадают с именами договора, поэтому в
  /// хранимом виде они тоже записываются с малой буквы: сохранённый
  /// предпросмотр читается теми же глазами, что и ответ службы.
  private static readonly JsonSerializerOptions Stored = new(JsonSerializerDefaults.Web);

  public async Task<IReadOnlyList<ImportedValue>> CurrentAsync(
      string kind,
      IReadOnlyCollection<string> entityIds,
      CancellationToken cancellationToken)
  {
    if (entityIds.Count == 0)
    {
      return [];
    }

    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
    var ids = entityIds.ToArray();

    return kind switch
    {
      ReferenceImportKind.WasteGroups => await WasteGroupValuesAsync(connection, ids, cancellationToken),
      ReferenceImportKind.Landfills => await LandfillValuesAsync(connection, ids, cancellationToken),
      ReferenceImportKind.Tariffs => await TariffValuesAsync(connection, ids, cancellationToken),
      _ => [],
    };
  }

  public async Task<ImportApplied> ApplyAsync(
      string kind,
      IReadOnlyList<ReferenceImportChange> changes,
      IReadOnlyCollection<string> additions,
      CancellationToken cancellationToken)
  {
    if (changes.Count == 0)
    {
      return new ImportApplied(0, 0);
    }

    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
    await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

    var applied = 0;
    var added = 0;

    // Заводимые записи создаются до правок: правка ищет запись по ключу, и
    // без неё применять значения некуда. Значения берутся из тех же
    // расхождений — второго источника у них нет (R-046).
    foreach (var entityId in additions)
    {
      added += await AddAsync(
          connection,
          transaction,
          kind,
          entityId,
          changes.Where(change => string.Equals(change.EntityId, entityId, StringComparison.Ordinal)).ToList(),
          cancellationToken);
    }

    // Одной транзакцией: половина применённой книги хуже неприменённой — по
    // ней не видно, что именно уже записано, и повторить её нечем.
    foreach (var change in changes)
    {
      applied += kind switch
      {
        ReferenceImportKind.WasteGroups => await ApplyWasteGroupAsync(connection, transaction, change, cancellationToken),
        ReferenceImportKind.Landfills => await ApplyLandfillAsync(connection, transaction, change, cancellationToken),
        ReferenceImportKind.Tariffs => await ApplyTariffAsync(connection, transaction, change, cancellationToken),
        _ => 0,
      };
    }

    await transaction.CommitAsync(cancellationToken);

    return new ImportApplied(applied, added);
  }

  /// Заведение записи справочника книгой. Новых видов, кроме полигонов, не
  /// заводится: у групп отходов и тарифов нет обязательного состава, который
  /// книга могла бы принести целиком (R-046).
  ///
  /// Статус новой записи — «не подтверждён», источник статуса — «реестр»:
  /// официальный перечень говорит, что объект существует, а не что он
  /// принимает отходы сегодня. Объявить его активным значило бы подставить
  /// полигон в подбор без единого подтверждения (R-044, R-046).
  private async Task<int> AddAsync(
      NpgsqlConnection connection,
      System.Data.Common.DbTransaction transaction,
      string kind,
      string entityId,
      IReadOnlyList<ReferenceImportChange> values,
      CancellationToken cancellationToken)
  {
    if (kind != ReferenceImportKind.Landfills)
    {
      return 0;
    }

    string? Value(string field) => values
        .FirstOrDefault(change => string.Equals(change.Field, field, StringComparison.Ordinal))
        ?.FileValue;

    return await connection.ExecuteAsync(new CommandDefinition(
        """
        insert into landfill (
            id, name, legal_entity, address, latitude, longitude,
            status, status_source, status_updated_at
        ) values (
            @id, @name, @legalEntity, @address,
            cast(@latitude as double precision), cast(@longitude as double precision),
            'unconfirmed', 'registry', @today
        )
        on conflict (id) do nothing
        """,
        new
        {
          id = entityId,
          name = Value("name"),
          legalEntity = Value("legalEntity"),
          address = Value("address"),
          latitude = Value("latitude"),
          longitude = Value("longitude"),
          today = clock.Today,
        },
        transaction,
        cancellationToken: cancellationToken));
  }

  public async Task SaveAsync(
      ReferenceImportPreview preview,
      string snapshotHash,
      CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    await connection.ExecuteAsync(new CommandDefinition(
        """
        insert into reference_import (id, kind, uploaded_at, preview, source_snapshot_hash)
        values (@id, @kind, @uploadedAt, @preview::jsonb, @hash)
        """,
        new
        {
          id = Guid.Parse(preview.Id),
          kind = preview.Kind,
          uploadedAt = clock.Now.ToUniversalTime(),
          preview = JsonSerializer.Serialize(preview, Stored),
          hash = snapshotHash,
        },
        cancellationToken: cancellationToken));
  }

  public async Task<StoredImport?> FindAsync(string importId, CancellationToken cancellationToken)
  {
    if (!Guid.TryParse(importId, out var key))
    {
      return null;
    }

    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    var row = await connection.QuerySingleOrDefaultAsync<ImportRow>(new CommandDefinition(
        """
        select id, kind, preview, source_snapshot_hash, applied_at
          from reference_import
         where id = @key
        """,
        new { key },
        cancellationToken: cancellationToken));

    if (row is null)
    {
      return null;
    }

    var preview = JsonSerializer.Deserialize<ReferenceImportPreview>(row.Preview, Stored);

    return preview is null
        ? null
        : new StoredImport(
            row.Id.ToString(),
            row.Kind,
            preview.Changes,
            // Предпросмотры, сохранённые до появления заведения записей, поля
            // не несут: пустой состав читается как «заводить нечего».
            preview.Additions ?? [],
            row.SourceSnapshotHash,
            row.AppliedAt is not null);
  }

  public async Task MarkAppliedAsync(
      string importId,
      int appliedChanges,
      DateTimeOffset appliedAt,
      CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    await connection.ExecuteAsync(new CommandDefinition(
        """
        update reference_import
           set applied_at = @appliedAt, applied_changes = @appliedChanges
         where id = @key
        """,
        new { key = Guid.Parse(importId), appliedAt = appliedAt.ToUniversalTime(), appliedChanges },
        cancellationToken: cancellationToken));
  }

  private static async Task<IReadOnlyList<ImportedValue>> WasteGroupValuesAsync(
      NpgsqlConnection connection,
      string[] ids,
      CancellationToken cancellationToken)
  {
    var rows = await connection.QueryAsync<WasteGroupValues>(new CommandDefinition(
        """
        select id, name, transport_price_per_ton_km, density_ton_per_m3
          from waste_group
         where id = any(@ids)
        """,
        new { ids },
        cancellationToken: cancellationToken));

    return rows.SelectMany(row => new[]
    {
      new ImportedValue(row.Id, "name", row.Name),
      new ImportedValue(row.Id, "transportPricePerTonKm", ImportValues.Text(row.TransportPricePerTonKm)),
      new ImportedValue(row.Id, "densityTonPerCubicMeter", ImportValues.Text((decimal)row.DensityTonPerM3)),
    }).ToList();
  }

  private static async Task<IReadOnlyList<ImportedValue>> LandfillValuesAsync(
      NpgsqlConnection connection,
      string[] ids,
      CancellationToken cancellationToken)
  {
    var rows = await connection.QueryAsync<LandfillValues>(new CommandDefinition(
        "select id, name, legal_entity, address from landfill where id = any(@ids)",
        new { ids },
        cancellationToken: cancellationToken));

    return rows.SelectMany(row => new[]
    {
      new ImportedValue(row.Id, "name", row.Name),
      new ImportedValue(row.Id, "legalEntity", row.LegalEntity),
      new ImportedValue(row.Id, "address", row.Address),
    }).ToList();
  }

  private static async Task<IReadOnlyList<ImportedValue>> TariffValuesAsync(
      NpgsqlConnection connection,
      string[] ids,
      CancellationToken cancellationToken)
  {
    // Ключ тарифа — пара, и склейка её именно здесь, в запросе, держит вид
    // идентификатора в одном месте со схемой книги.
    var rows = await connection.QueryAsync<TariffValues>(new CommandDefinition(
        """
        select landfill_id || '/' || waste_group_id as entity_id, disposal_price_per_ton
          from landfill_tariff
         where landfill_id || '/' || waste_group_id = any(@ids)
        """,
        new { ids },
        cancellationToken: cancellationToken));

    return rows
        .Select(row => new ImportedValue(
            row.EntityId, "disposalPricePerTon", ImportValues.Text(row.DisposalPricePerTon)))
        .ToList();
  }

  private async Task<int> ApplyWasteGroupAsync(
      NpgsqlConnection connection,
      System.Data.Common.DbTransaction transaction,
      ReferenceImportChange change,
      CancellationToken cancellationToken)
  {
    var column = change.Field switch
    {
      "name" => "name = @value",
      "transportPricePerTonKm" => "transport_price_per_ton_km = cast(@value as numeric)",
      "densityTonPerCubicMeter" => "density_ton_per_m3 = cast(@value as numeric)",
      _ => null,
    };

    return column is null
        ? 0
        : await connection.ExecuteAsync(new CommandDefinition(
            $"update waste_group set {column}, updated_at = @today where id = @id",
            new { id = change.EntityId, value = change.FileValue, today = clock.Today },
            transaction,
            cancellationToken: cancellationToken));
  }

  private static async Task<int> ApplyLandfillAsync(
      NpgsqlConnection connection,
      System.Data.Common.DbTransaction transaction,
      ReferenceImportChange change,
      CancellationToken cancellationToken)
  {
    var column = change.Field switch
    {
      "name" => "name = @value",
      "legalEntity" => "legal_entity = @value",
      "address" => "address = @value",
      // Координаты приходят строкой инвариантной записи: приведение делает
      // база, а не разбор, — иначе культура машины попала бы в число (R-046).
      "latitude" => "latitude = cast(@value as double precision)",
      "longitude" => "longitude = cast(@value as double precision)",
      _ => null,
    };

    return column is null
        ? 0
        : await connection.ExecuteAsync(new CommandDefinition(
            $"update landfill set {column} where id = @id",
            new { id = change.EntityId, value = change.FileValue },
            transaction,
            cancellationToken: cancellationToken));
  }

  private async Task<int> ApplyTariffAsync(
      NpgsqlConnection connection,
      System.Data.Common.DbTransaction transaction,
      ReferenceImportChange change,
      CancellationToken cancellationToken)
  {
    if (change.Field != "disposalPricePerTon")
    {
      return 0;
    }

    var parts = change.EntityId.Split('/');

    return parts.Length != 2
        ? 0
        : await connection.ExecuteAsync(new CommandDefinition(
            """
            update landfill_tariff
               set disposal_price_per_ton = cast(@value as numeric), updated_at = @today
             where landfill_id = @landfillId and waste_group_id = @wasteGroupId
            """,
            new
            {
              landfillId = parts[0],
              wasteGroupId = parts[1],
              value = change.FileValue,
              today = clock.Today,
            },
            transaction,
            cancellationToken: cancellationToken));
  }

  private sealed class ImportRow
  {
    public Guid Id { get; set; }

    public string Kind { get; set; } = string.Empty;

    public string Preview { get; set; } = string.Empty;

    public string SourceSnapshotHash { get; set; } = string.Empty;

    public DateTimeOffset? AppliedAt { get; set; }
  }

  private sealed class WasteGroupValues
  {
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public decimal TransportPricePerTonKm { get; set; }

    public double DensityTonPerM3 { get; set; }
  }

  private sealed class LandfillValues
  {
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? LegalEntity { get; set; }

    public string Address { get; set; } = string.Empty;
  }

  private sealed class TariffValues
  {
    public string EntityId { get; set; } = string.Empty;

    public decimal DisposalPricePerTon { get; set; }
  }
}
