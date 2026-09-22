using Dapper;
using Imolt.Calculations.Contracts;
using Imolt.Calculations.Ports;
using Npgsql;

namespace Imolt.Calculations.Adapters;

/// Хранение расчёта поверх PostgreSQL (СУЩ-07).
///
/// Записывается только то, что задал пользователь, и дата актуальности данных
/// (R-048). Варианты размещения не хранятся: цена группы и тариф полигона —
/// данные справочников, и снимок цен делается один раз, при выпуске
/// коммерческого предложения (R-036).
///
/// @req: R-002, R-027, R-030, R-048
/// @adr: ADR-0005
public sealed class CalculationStore(NpgsqlDataSource dataSource) : ICalculationStore
{
  public async Task SaveAsync(StoredCalculation calculation, CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
    await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

    await connection.ExecuteAsync(new CommandDefinition(
        """
        insert into calculation (
            id, created_at, pickup_value, pickup_latitude, pickup_longitude, pickup_area,
            pickup_suggestion_id, disposal_required, distance_mode, distance_km,
            prices_updated_at, statuses_updated_at
        ) values (
            @id, @createdAt, @value, @latitude, @longitude, @area,
            @suggestionId, @disposalRequired, @distanceMode, @distanceKm,
            @pricesUpdatedAt, @statusesUpdatedAt
        )
        """,
        new
        {
          id = Guid.Parse(calculation.Id),
          // База хранит момент в UTC — иного смещения столбец timestamptz не
          // принимает. Наружу момент возвращается в местном времени: часовой
          // пояс — забота границы, а не сценария.
          createdAt = calculation.CreatedAt.ToUniversalTime(),
          value = calculation.PickupAddress.Value,
          latitude = calculation.PickupAddress.Coordinates.Latitude,
          longitude = calculation.PickupAddress.Coordinates.Longitude,
          area = calculation.PickupAddress.Area,
          suggestionId = calculation.PickupAddress.SuggestionId,
          disposalRequired = calculation.DisposalRequired,
          distanceMode = calculation.DistanceFilter.Mode,
          distanceKm = calculation.DistanceFilter.Km,
          pricesUpdatedAt = calculation.PricesUpdatedAt,
          statusesUpdatedAt = calculation.StatusesUpdatedAt,
        },
        transaction,
        cancellationToken: cancellationToken));

    foreach (var item in calculation.Items)
    {
      await connection.ExecuteAsync(new CommandDefinition(
          """
          insert into calculation_item (calculation_id, waste_group_id, input_value, input_unit, tons)
          values (@calculationId, @wasteGroupId, @value, @unit, @tons)
          """,
          new
          {
            calculationId = Guid.Parse(calculation.Id),
            wasteGroupId = item.WasteGroupId,
            value = item.Input.Value,
            unit = item.Input.Unit,
            tons = item.Tons,
          },
          transaction,
          cancellationToken: cancellationToken));
    }

    await transaction.CommitAsync(cancellationToken);
  }

  public async Task<StoredCalculation?> FindAsync(string id, CancellationToken cancellationToken)
  {
    // Идентификатор произвольной формы — это «такого расчёта нет», а не сбой
    // службы: иначе опечатка в ссылке отвечала бы кодом 500.
    if (!Guid.TryParse(id, out var key))
    {
      return null;
    }

    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    var row = await connection.QuerySingleOrDefaultAsync<CalculationRow>(new CommandDefinition(
        """
        select id, created_at, pickup_value, pickup_latitude, pickup_longitude, pickup_area,
               pickup_suggestion_id, disposal_required, distance_mode, distance_km,
               prices_updated_at, statuses_updated_at
          from calculation
         where id = @key
        """,
        new { key },
        cancellationToken: cancellationToken));

    if (row is null)
    {
      return null;
    }

    var items = await connection.QueryAsync<ItemRow>(new CommandDefinition(
        """
        select waste_group_id, input_value, input_unit, tons
          from calculation_item
         where calculation_id = @key
         order by waste_group_id
        """,
        new { key },
        cancellationToken: cancellationToken));

    var selection = await connection.QueryAsync<SelectionRow>(new CommandDefinition(
        """
        select waste_group_id, landfill_id
          from calculation_selection
         where calculation_id = @key
         order by waste_group_id, landfill_id
        """,
        new { key },
        cancellationToken: cancellationToken));

    var allocation = await connection.QueryAsync<AllocationRow>(new CommandDefinition(
        """
        select waste_group_id, landfill_id, value, unit
          from calculation_allocation
         where calculation_id = @key
         order by waste_group_id, landfill_id
        """,
        new { key },
        cancellationToken: cancellationToken));

    return new StoredCalculation(
        row.Id.ToString(),
        row.CreatedAt.ToLocalTime(),
        new PickupAddress(
            row.PickupValue,
            new Coordinates(row.PickupLatitude, row.PickupLongitude),
            row.PickupArea,
            row.PickupSuggestionId),
        row.DisposalRequired,
        new DistanceFilter(row.DistanceMode, row.DistanceKm),
        row.PricesUpdatedAt,
        row.StatusesUpdatedAt,
        [.. items.Select(item => new StoredItem(
            item.WasteGroupId, new Quantity(item.InputValue, item.InputUnit), item.Tons))],
        [.. selection.Select(entry => new SelectionEntry(entry.WasteGroupId, entry.LandfillId))],
        [.. allocation.Select(entry => new AllocationEntry(
            entry.WasteGroupId, entry.LandfillId, new Quantity(entry.Value, entry.Unit)))]);
  }

  public Task SaveSelectionAsync(
      string calculationId,
      IReadOnlyList<SelectionEntry> entries,
      CancellationToken cancellationToken)
      => ReplaceAsync(
          calculationId,
          "delete from calculation_selection where calculation_id = @key",
          """
          insert into calculation_selection (calculation_id, waste_group_id, landfill_id)
          values (@key, @wasteGroupId, @landfillId)
          """,
          [.. entries.Select(entry => (object)new
          {
            wasteGroupId = entry.WasteGroupId,
            landfillId = entry.LandfillId,
          })],
          cancellationToken);

  public Task SaveAllocationAsync(
      string calculationId,
      IReadOnlyList<AllocationEntry> entries,
      CancellationToken cancellationToken)
      => ReplaceAsync(
          calculationId,
          "delete from calculation_allocation where calculation_id = @key",
          """
          insert into calculation_allocation (calculation_id, waste_group_id, landfill_id, value, unit)
          values (@key, @wasteGroupId, @landfillId, @value, @unit)
          """,
          [.. entries.Select(entry => (object)new
          {
            wasteGroupId = entry.WasteGroupId,
            landfillId = entry.LandfillId,
            value = entry.Quantity.Value,
            unit = entry.Quantity.Unit,
          })],
          cancellationToken);

  // Набор задаётся целиком: прежние строки снимаются и новые пишутся одной
  // единицей работы. Частичное применение оставило бы расчёт в состоянии,
  // которого пользователь не задавал (R-027, R-030).
  private async Task ReplaceAsync(
      string calculationId,
      string removal,
      string insertion,
      IReadOnlyList<object> rows,
      CancellationToken cancellationToken)
  {
    var key = Guid.Parse(calculationId);

    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
    await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

    await connection.ExecuteAsync(new CommandDefinition(
        removal, new { key }, transaction, cancellationToken: cancellationToken));

    foreach (var row in rows)
    {
      var parameters = new DynamicParameters(row);
      parameters.Add("key", key);

      await connection.ExecuteAsync(new CommandDefinition(
          insertion, parameters, transaction, cancellationToken: cancellationToken));
    }

    await transaction.CommitAsync(cancellationToken);
  }

  // Средство доступа к данным собирает строки через открытые свойства, а
  // позиционные записи собрать не умеет.
  private sealed class CalculationRow
  {
    public Guid Id { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public string PickupValue { get; set; } = string.Empty;

    public double PickupLatitude { get; set; }

    public double PickupLongitude { get; set; }

    public string? PickupArea { get; set; }

    public string? PickupSuggestionId { get; set; }

    public bool DisposalRequired { get; set; }

    public string DistanceMode { get; set; } = string.Empty;

    public int DistanceKm { get; set; }

    public DateOnly PricesUpdatedAt { get; set; }

    public DateOnly StatusesUpdatedAt { get; set; }
  }

  private sealed class ItemRow
  {
    public string WasteGroupId { get; set; } = string.Empty;

    public decimal InputValue { get; set; }

    public string InputUnit { get; set; } = string.Empty;

    public decimal Tons { get; set; }
  }

  private sealed class SelectionRow
  {
    public string WasteGroupId { get; set; } = string.Empty;

    public string LandfillId { get; set; } = string.Empty;
  }

  private sealed class AllocationRow
  {
    public string WasteGroupId { get; set; } = string.Empty;

    public string LandfillId { get; set; } = string.Empty;

    public decimal Value { get; set; }

    public string Unit { get; set; } = string.Empty;
  }
}
