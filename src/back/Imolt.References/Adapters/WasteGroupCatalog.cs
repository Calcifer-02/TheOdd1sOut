using Dapper;
using Imolt.References.Contracts;
using Imolt.References.Ports;
using Imolt.Shared;
using Npgsql;

namespace Imolt.References.Adapters;

/// Справочник групп отходов поверх PostgreSQL (СУЩ-01).
///
/// @req: R-013, R-039
/// @adr: ADR-0005
public sealed class WasteGroupCatalog(NpgsqlDataSource dataSource) : IWasteGroupCatalog
{
  // Коды каталога собираются подзапросом, а не вторым обращением к базе:
  // страница на сто записей превратилась бы в сто один запрос.
  private const string Selection = """
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
    """;

  public async Task<Page<WasteGroup>> SearchAsync(
      string? query,
      PageRequest page,
      CancellationToken cancellationToken)
  {
    // Поиск идёт и по названию, и по коду каталога: пользователь приходит то
    // с одним, то с другим (R-013). Сравнение без учёта регистра — набирают
    // как придётся.
    const string filter = """
      where @query is null
         or g.name ilike '%' || @query || '%'
         or exists (select 1
                      from waste_group_fkko_code c
                     where c.waste_group_id = g.id
                       and c.code like @query || '%')
      """;

    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    var total = await connection.ExecuteScalarAsync<int>(new CommandDefinition(
        $"select count(*) from waste_group g {filter}",
        new { query = Normalize(query) },
        cancellationToken: cancellationToken));

    var rows = await connection.QueryAsync<WasteGroupRow>(new CommandDefinition(
        $"{Selection} {filter} order by g.id limit @limit offset @offset",
        new { query = Normalize(query), limit = page.Limit, offset = page.Offset },
        cancellationToken: cancellationToken));

    return Pages.Of(rows.Select(ToContract).ToList(), total, page);
  }

  public async Task<WasteGroup?> FindAsync(string id, CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    var row = await connection.QuerySingleOrDefaultAsync<WasteGroupRow>(new CommandDefinition(
        $"{Selection} where g.id = @id",
        new { id },
        cancellationToken: cancellationToken));

    return row is null ? null : ToContract(row);
  }

  // Пустая строка поиска — это «искать всё», а не «искать пустоту»:
  // иначе очистка поля даёт пустой список вместо справочника.
  private static string? Normalize(string? query)
      => string.IsNullOrWhiteSpace(query) ? null : query.Trim();

  private static WasteGroup ToContract(WasteGroupRow row) => new(
      row.Id,
      row.Name,
      row.FkkoCodes,
      Money.Rubles(row.TransportPricePerTonKm),
      (double)row.DensityTonPerM3,
      row.UpdatedAt);

  // Строка выборки: средство доступа к данным заполняет её свойствами, а
  // не доводами конструктора, поэтому это класс, а не запись.
  private sealed class WasteGroupRow
  {
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public decimal TransportPricePerTonKm { get; set; }

    public decimal DensityTonPerM3 { get; set; }

    public DateOnly UpdatedAt { get; set; }

    public string[] FkkoCodes { get; set; } = [];
  }
}
