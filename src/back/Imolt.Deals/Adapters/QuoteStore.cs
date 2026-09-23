using Dapper;
using Imolt.Deals.Application;
using Imolt.Deals.Contracts;
using Imolt.Deals.Ports;
using Imolt.Shared;
using Npgsql;

namespace Imolt.Deals.Adapters;

/// Хранение выпущенных предложений и снимка цен (СУЩ-08).
///
/// Снимок обязателен: справочник и тарифы потом изменятся, а выпущенный
/// документ обязан остаться прежним — на него ссылаются в переписке
/// (R-036, R-037).
///
/// @req: R-036, R-037
/// @adr: ADR-0005
public sealed class QuoteStore(NpgsqlDataSource dataSource) : IQuoteStore
{
  public async Task<Quote?> FindByCalculationAsync(string calculationId, CancellationToken cancellationToken)
  {
    if (!Guid.TryParse(calculationId, out var key))
    {
      return null;
    }

    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    var row = await connection.QuerySingleOrDefaultAsync<QuoteRow>(new CommandDefinition(
        """
        select id, number, issued_at, valid_until, total
          from quote
         where calculation_id = @key
         order by issued_at
         limit 1
        """,
        new { key },
        cancellationToken: cancellationToken));

    return row is null ? null : Quote(row);
  }

  public async Task<QuoteDocumentModel?> FindDocumentAsync(string quoteId, CancellationToken cancellationToken)
  {
    if (!Guid.TryParse(quoteId, out var key))
    {
      return null;
    }

    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    var row = await connection.QuerySingleOrDefaultAsync<DocumentRow>(new CommandDefinition(
        """
        select q.number, q.issued_at, q.valid_until, q.total, q.customer_name,
               c.created_at as calculated_at, c.pickup_value as pickup_address
          from quote q
          join calculation c on c.id = q.calculation_id
         where q.id = @key
        """,
        new { key },
        cancellationToken: cancellationToken));

    if (row is null)
    {
      return null;
    }

    var lines = await connection.QueryAsync<LineRow>(new CommandDefinition(
        """
        select landfill_id, landfill_name, waste_group_id, waste_group_name,
               tons, unit, input_value, transport_cost, disposal_cost, total_cost
          from quote_line
         where quote_id = @key
         order by landfill_id, waste_group_id
        """,
        new { key },
        cancellationToken: cancellationToken));

    return new QuoteDocumentModel(
        row.Number,
        row.IssuedAt.ToLocalTime(),
        row.ValidUntil,
        row.CalculatedAt.ToLocalTime(),
        row.PickupAddress,
        row.CustomerName,
        [.. lines.Select(line => new QuoteLine(
            line.LandfillId,
            line.LandfillName,
            line.WasteGroupId,
            line.WasteGroupName,
            line.Tons,
            line.Unit,
            line.InputValue,
            Money.Rubles(line.TransportCost),
            line.DisposalCost is { } disposal ? Money.Rubles(disposal) : null,
            Money.Rubles(line.TotalCost)))],
        Money.Rubles(row.Total));
  }

  public async Task SaveAsync(
      Quote quote,
      string calculationId,
      QuoteDocumentModel document,
      CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
    await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

    var key = Guid.Parse(quote.Id);

    await connection.ExecuteAsync(new CommandDefinition(
        """
        insert into quote (id, calculation_id, number, issued_at, valid_until, total, customer_name)
        values (@key, @calculationId, @number, @issuedAt, @validUntil, @total, @customerName)
        """,
        new
        {
          key,
          calculationId = Guid.Parse(calculationId),
          number = quote.Number,
          // Столбец timestamptz принимает только нулевое смещение; наружу
          // момент возвращается в местном времени.
          issuedAt = quote.IssuedAt.ToUniversalTime(),
          validUntil = quote.ValidUntil,
          total = quote.Total.Amount,
          customerName = document.CustomerName,
        },
        transaction,
        cancellationToken: cancellationToken));

    foreach (var line in document.Lines)
    {
      await connection.ExecuteAsync(new CommandDefinition(
          """
          insert into quote_line (
              quote_id, landfill_id, landfill_name, waste_group_id, waste_group_name,
              tons, unit, input_value, transport_cost, disposal_cost, total_cost
          ) values (
              @key, @landfillId, @landfillName, @wasteGroupId, @wasteGroupName,
              @tons, @unit, @inputValue, @transportCost, @disposalCost, @totalCost
          )
          """,
          new
          {
            key,
            landfillId = line.LandfillId,
            landfillName = line.LandfillName,
            wasteGroupId = line.WasteGroupId,
            wasteGroupName = line.WasteGroupName,
            tons = line.Tons,
            unit = line.Unit,
            inputValue = line.InputValue,
            transportCost = line.TransportCost.Amount,
            disposalCost = line.DisposalCost?.Amount,
            totalCost = line.TotalCost.Amount,
          },
          transaction,
          cancellationToken: cancellationToken));
    }

    await transaction.CommitAsync(cancellationToken);
  }

  public async Task<int> IssuedOnAsync(DateOnly day, CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    return await connection.ExecuteScalarAsync<int>(new CommandDefinition(
        "select count(*) from quote where (issued_at at time zone 'UTC')::date = @day",
        new { day },
        cancellationToken: cancellationToken));
  }

  private static Quote Quote(QuoteRow row) => new(
      row.Id.ToString(),
      row.Number,
      row.IssuedAt.ToLocalTime(),
      row.ValidUntil,
      Money.Rubles(row.Total),
      true,
      DealScenarios.DocumentPathOf(row.Id.ToString()));

  // Средство доступа к данным собирает строки через открытые свойства, а
  // позиционные записи собрать не умеет.
  private sealed class QuoteRow
  {
    public Guid Id { get; set; }

    public string Number { get; set; } = string.Empty;

    public DateTimeOffset IssuedAt { get; set; }

    public DateOnly ValidUntil { get; set; }

    public decimal Total { get; set; }
  }

  private sealed class DocumentRow
  {
    public string Number { get; set; } = string.Empty;

    public DateTimeOffset IssuedAt { get; set; }

    public DateOnly ValidUntil { get; set; }

    public decimal Total { get; set; }

    public string? CustomerName { get; set; }

    public DateTimeOffset CalculatedAt { get; set; }

    public string PickupAddress { get; set; } = string.Empty;
  }

  private sealed class LineRow
  {
    public string LandfillId { get; set; } = string.Empty;

    public string LandfillName { get; set; } = string.Empty;

    public string WasteGroupId { get; set; } = string.Empty;

    public string WasteGroupName { get; set; } = string.Empty;

    public decimal Tons { get; set; }

    public string Unit { get; set; } = string.Empty;

    public decimal InputValue { get; set; }

    public decimal TransportCost { get; set; }

    public decimal? DisposalCost { get; set; }

    public decimal TotalCost { get; set; }
  }
}
