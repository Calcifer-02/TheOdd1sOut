using Dapper;
using Imolt.References.Contracts;
using Imolt.References.Ports;
using Npgsql;

namespace Imolt.References.Adapters;

/// Подсказки адреса вывоза по собственному справочнику (СУЩ-05).
///
/// Целевая служба подсказок заказчиком не назначена — открытый вопрос Q-014,
/// поэтому источником служит справочник проекта. Обращение наружу, когда
/// служба будет названа, добавляется соседним переходником за тем же портом:
/// выбор источника — настройка, а не правка кода области.
///
/// @req: R-012
/// @adr: ADR-0001
public sealed class AddressDirectorySuggestions(NpgsqlDataSource dataSource) : IAddressSuggestions
{
  public async Task<IReadOnlyList<AddressSuggestion>> SuggestAsync(
      string query,
      int limit,
      CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    // Отбор по зоне обслуживания не нужен: в справочник не попадает ничего,
    // кроме Москвы и области — это держит ограничение схемы (R-012).
    var rows = await connection.QueryAsync<SuggestionRow>(new CommandDefinition(
        """
        select id, value, latitude, longitude, area
          from address_directory
         where value ilike '%' || @query || '%'
         order by value
         limit @limit
        """,
        new { query = query.Trim(), limit },
        cancellationToken: cancellationToken));

    return rows
        .Select(row => new AddressSuggestion(
            row.Id,
            row.Value,
            new Coordinates(row.Latitude, row.Longitude),
            row.Area))
        .ToList();
  }

  private sealed class SuggestionRow
  {
    public string Id { get; set; } = string.Empty;

    public string Value { get; set; } = string.Empty;

    public double Latitude { get; set; }

    public double Longitude { get; set; }

    public string Area { get; set; } = string.Empty;
  }
}

/// Подсказки адреса внешней службой. Ключ читается сервером и наружу не
/// уходит (R-056, риск AR-006); отказ источника отличается от отказа
/// обслуживания и приходит объявленным договором кодом 503.
///
/// @req: R-055, R-056
/// @adr: ADR-0002
public sealed class UpstreamAddressSuggestions(
    HttpClient client,
    AddressDirectorySuggestions directory) : IAddressSuggestions
{
  /// Через сколько секунд повторять. Значение объявлено здесь, а не взято у
  /// источника: своего ответа он не дал, иначе бы не было отказа.
  private const int RetryAfterSeconds = 30;

  /// Адрес службы задаётся составом изделия, а не самой областью: какая
  /// служба стоит за портом — решение состава, и оно читается из настройки в
  /// момент разрешения зависимости (Q-014).
  public void Use(Uri address) => client.BaseAddress = address;

  public async Task<IReadOnlyList<AddressSuggestion>> SuggestAsync(
      string query,
      int limit,
      CancellationToken cancellationToken)
  {
    try
    {
      using var response = await client.GetAsync(
          $"?query={Uri.EscapeDataString(query)}&limit={limit}",
          cancellationToken);

      if (!response.IsSuccessStatusCode)
      {
        // Текст ответа источника наружу не переносится: в нём может оказаться
        // ключ, который сервер обязан удержать у себя (R-056).
        throw new UpstreamUnavailableException(
            $"служба подсказок ответила кодом {(int)response.StatusCode}",
            RetryAfterSeconds);
      }
    }
    catch (HttpRequestException exception)
    {
      throw new UpstreamUnavailableException(
          "служба подсказок недоступна: " + exception.GetType().Name,
          RetryAfterSeconds);
    }
    catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
    {
      throw new UpstreamUnavailableException(
          "служба подсказок не ответила за отведённое время",
          RetryAfterSeconds);
    }

    // Разбор ответа появится вместе с названной службой (Q-014): пока
    // источник объявлен, но не выбран, разбирать нечего.
    return await directory.SuggestAsync(query, limit, cancellationToken);
  }
}
