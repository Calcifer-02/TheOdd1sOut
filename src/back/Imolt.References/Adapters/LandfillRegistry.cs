using Dapper;
using Imolt.References.Contracts;
using Imolt.References.Ports;
using Imolt.Shared;
using Npgsql;

namespace Imolt.References.Adapters;

/// Реестр полигонов и отзывы о них поверх PostgreSQL (СУЩ-02, СУЩ-03, СУЩ-04).
///
/// @req: R-031, R-040, R-041
/// @adr: ADR-0005
public sealed class LandfillRegistry(NpgsqlDataSource dataSource) : ILandfillRegistry
{
  private const string Filter = """
    where (@query is null or l.name ilike '%' || @query || '%')
      and (@status is null or l.status = @status)
      and (@wasteGroupId is null
           or exists (select 1
                        from landfill_tariff t
                       where t.landfill_id = l.id
                         and t.waste_group_id = @wasteGroupId))
    """;

  private const string Columns = """
    select l.id, l.name, l.legal_entity, l.address, l.latitude, l.longitude,
           l.status, l.status_updated_at
      from landfill l
    """;

  public async Task<Page<Landfill>> SearchAsync(
      LandfillFilter filter,
      PageRequest page,
      CancellationToken cancellationToken)
  {
    var parameters = new
    {
      query = Normalize(filter.Query),
      status = Normalize(filter.Status),
      wasteGroupId = Normalize(filter.WasteGroupId),
      limit = page.Limit,
      offset = page.Offset,
    };

    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    var total = await connection.ExecuteScalarAsync<int>(new CommandDefinition(
        $"select count(*) from landfill l {Filter}",
        parameters,
        cancellationToken: cancellationToken));

    var rows = await connection.QueryAsync<LandfillRow>(new CommandDefinition(
        $"{Columns} {Filter} order by l.id limit @limit offset @offset",
        parameters,
        cancellationToken: cancellationToken));

    var landfills = rows.ToList();
    var tariffs = await TariffsAsync(connection, landfills.Select(row => row.Id).ToArray(), cancellationToken);

    var items = landfills
        .Select(row => new Landfill(
            row.Id,
            row.Name,
            row.LegalEntity,
            row.Address,
            new Coordinates(row.Latitude, row.Longitude),
            row.Status,
            row.StatusUpdatedAt,
            tariffs.TryGetValue(row.Id, out var own) ? own : []))
        .ToList();

    return Pages.Of(items, total, page);
  }

  public async Task<LandfillCard?> FindAsync(string id, CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    var row = await connection.QuerySingleOrDefaultAsync<LandfillRow>(new CommandDefinition(
        $"{Columns} where l.id = @id",
        new { id },
        cancellationToken: cancellationToken));

    if (row is null)
    {
      return null;
    }

    var tariffs = await TariffsAsync(connection, [row.Id], cancellationToken);

    // История упорядочена от старого к новому: открытый период идёт последним,
    // и читателю не нужно сортировать её самому (R-041).
    var history = await connection.QueryAsync<LegalEntityRow>(new CommandDefinition(
        """
        select legal_entity, since, until
          from landfill_legal_entity_history
         where landfill_id = @id
         order by since
        """,
        new { id },
        cancellationToken: cancellationToken));

    return new LandfillCard(
        row.Id,
        row.Name,
        row.LegalEntity,
        row.Address,
        new Coordinates(row.Latitude, row.Longitude),
        row.Status,
        row.StatusUpdatedAt,
        tariffs.TryGetValue(row.Id, out var own) ? own : [],
        history.Select(period => new LegalEntityPeriod(period.LegalEntity, period.Since, period.Until)).ToList());
  }

  public async Task<bool> ExistsAsync(string id, CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    return await connection.ExecuteScalarAsync<bool>(new CommandDefinition(
        "select exists (select 1 from landfill where id = @id)",
        new { id },
        cancellationToken: cancellationToken));
  }

  public async Task<(Page<LandfillReview> Reviews, double? AverageRating)> ReviewsAsync(
      string landfillId,
      PageRequest page,
      CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    // Средняя оценка считается по всем отзывам полигона, а не по странице:
    // иначе она менялась бы от перелистывания (R-031).
    var summary = await connection.QuerySingleAsync<ReviewSummaryRow>(new CommandDefinition(
        "select count(*) as total, avg(rating) as average from landfill_review where landfill_id = @landfillId",
        new { landfillId },
        cancellationToken: cancellationToken));

    var rows = await connection.QueryAsync<ReviewRow>(new CommandDefinition(
        """
        select id, landfill_id, rating, text, created_at
          from landfill_review
         where landfill_id = @landfillId
         order by created_at desc, id
         limit @limit offset @offset
        """,
        new { landfillId, limit = page.Limit, offset = page.Offset },
        cancellationToken: cancellationToken));

    var items = rows
        .Select(row => new LandfillReview(
            row.Id.ToString(),
            row.LandfillId,
            row.Rating,
            row.Text,
            row.CreatedAt))
        .ToList();

    return (Pages.Of(items, summary.Total, page), summary.Average is null ? null : (double)summary.Average);
  }

  // Тарифы собираются одним запросом на всю страницу: обращение на каждую
  // запись превратило бы страницу в сотню запросов.
  private static async Task<Dictionary<string, List<LandfillTariff>>> TariffsAsync(
      NpgsqlConnection connection,
      string[] landfillIds,
      CancellationToken cancellationToken)
  {
    if (landfillIds.Length == 0)
    {
      return [];
    }

    var rows = await connection.QueryAsync<TariffRow>(new CommandDefinition(
        """
        select landfill_id, waste_group_id, disposal_price_per_ton, updated_at
          from landfill_tariff
         where landfill_id = any(@landfillIds)
         order by waste_group_id
        """,
        new { landfillIds },
        cancellationToken: cancellationToken));

    return rows
        .GroupBy(row => row.LandfillId, StringComparer.Ordinal)
        .ToDictionary(
            group => group.Key,
            group => group
                .Select(row => new LandfillTariff(
                    row.WasteGroupId,
                    Money.Rubles(row.DisposalPricePerTon),
                    row.UpdatedAt))
                .ToList(),
            StringComparer.Ordinal);
  }

  private static string? Normalize(string? value)
      => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

  // Строки выборки: средство доступа к данным заполняет их свойствами, а не
  // доводами конструктора, поэтому это классы, а не записи.
  private sealed class LandfillRow
  {
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? LegalEntity { get; set; }

    public string Address { get; set; } = string.Empty;

    public double Latitude { get; set; }

    public double Longitude { get; set; }

    public string Status { get; set; } = string.Empty;

    public DateOnly StatusUpdatedAt { get; set; }
  }

  private sealed class LegalEntityRow
  {
    public string LegalEntity { get; set; } = string.Empty;

    public DateOnly Since { get; set; }

    public DateOnly? Until { get; set; }
  }

  private sealed class TariffRow
  {
    public string LandfillId { get; set; } = string.Empty;

    public string WasteGroupId { get; set; } = string.Empty;

    public decimal DisposalPricePerTon { get; set; }

    public DateOnly UpdatedAt { get; set; }
  }

  private sealed class ReviewRow
  {
    public Guid Id { get; set; }

    public string LandfillId { get; set; } = string.Empty;

    public int Rating { get; set; }

    public string? Text { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
  }

  private sealed class ReviewSummaryRow
  {
    public int Total { get; set; }

    public decimal? Average { get; set; }
  }
}
