using Dapper;
using Imolt.References.Contracts;
using Imolt.References.Ports;
using Npgsql;

namespace Imolt.References.Adapters;

/// Справочник адресов Москвы и области (СУЩ-05) — та же таблица, из которой
/// берутся подсказки, но другой вопрос к ней: не «что похоже на набранное», а
/// «известен ли этот адрес и в какой он зоне».
///
/// От ответа зависит мера расчёта (R-016), поэтому поиск точный: по
/// идентификатору подсказки, а при его отсутствии — по полному совпадению
/// строки. Поиск по части строки здесь был бы опасен — «г Москва» пишут и в
/// адресах области, и расчёт ушёл бы в чужую меру.
///
/// @req: R-016
/// @adr: ADR-0005
public sealed class AddressDirectory(NpgsqlDataSource dataSource) : IAddressDirectory
{
  public async Task<AddressSuggestion?> FindAsync(
      string? id,
      string? value,
      CancellationToken cancellationToken)
  {
    if (string.IsNullOrWhiteSpace(id) && string.IsNullOrWhiteSpace(value))
    {
      return null;
    }

    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    // Идентификатор старше строки: он пришёл из подсказки, а строку клиент
    // мог поправить руками. Порядок задаётся явно, потому что обе записи
    // могут найтись и оказаться разными адресами.
    var row = await connection.QuerySingleOrDefaultAsync<DirectoryRow>(new CommandDefinition(
        """
        select id, value, latitude, longitude, area
          from address_directory
         where id = @id or value = @value
         order by case when id = @id then 0 else 1 end
         limit 1
        """,
        new { id, value = value?.Trim() },
        cancellationToken: cancellationToken));

    return row is null
        ? null
        : new AddressSuggestion(
            row.Id,
            row.Value,
            new Coordinates(row.Latitude, row.Longitude),
            row.Area);
  }

  // Средство доступа к данным собирает строку через открытые свойства.
  private sealed class DirectoryRow
  {
    public string Id { get; set; } = string.Empty;

    public string Value { get; set; } = string.Empty;

    public double Latitude { get; set; }

    public double Longitude { get; set; }

    public string Area { get; set; } = string.Empty;
  }
}
