using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using Imolt.Bot.Ports;

namespace Imolt.Bot.Adapters;

/// Справочники и расчёт сервиса по договору расчётной части.
///
/// Чат-бот — потребитель договора, а не второй владелец предметной логики:
/// тарифы, коэффициенты и цены он спрашивает у расчётной части и показывает
/// как есть (ADR-0009, инвариант 4). Ни одной величины расчёта здесь не
/// назначается и не пересчитывается.
///
/// Ответ читается по именам полей договора (`src/back/Imolt.Api/contracts/openapi.yaml`),
/// а не через общие с расчётной частью типы: общий тип связал бы две службы
/// внутренностями вместо договора (ADR-0003).
///
/// @supports: R-072, R-073, R-074, R-075
/// @adr: ADR-0009
public sealed class ImoltReferenceCatalog(HttpClient client) : IReferenceCatalog
{
  /// Сколько групп отходов читать, чтобы назвать их по имени в тарифах
  /// полигона. Справочник групп короткий, и договор отдаёт его страницами;
  /// предел страницы объявлен договором.
  private const int WasteGroupPage = 100;

  public async Task<LandfillTariffs?> FindLandfillTariffsAsync(
      string query,
      CancellationToken cancellationToken)
  {
    using var answer = await ReadAsync(
        "v1/landfills?limit=1&query=" + Uri.EscapeDataString(query),
        cancellationToken).ConfigureAwait(false);

    if (First(answer.RootElement) is not { } landfill)
    {
      return null;
    }

    var names = await WasteGroupNamesAsync(cancellationToken).ConfigureAwait(false);
    var tariffs = new List<TariffFact>();

    if (landfill.TryGetProperty("tariffs", out var listed) && listed.ValueKind == JsonValueKind.Array)
    {
      foreach (var tariff in listed.EnumerateArray())
      {
        var wasteGroupId = tariff.GetProperty("wasteGroupId").GetString() ?? string.Empty;
        var price = tariff.GetProperty("disposalPricePerTon");

        tariffs.Add(new TariffFact(
            names.TryGetValue(wasteGroupId, out var name) ? name : wasteGroupId,
            Amount(price),
            price.GetProperty("currency").GetString() ?? string.Empty,
            Date(tariff, "updatedAt")));
      }
    }

    return new LandfillTariffs(landfill.GetProperty("name").GetString() ?? query, tariffs);
  }

  public async Task<DensityFact?> FindDensityAsync(string query, CancellationToken cancellationToken)
  {
    using var answer = await ReadAsync(
        "v1/waste-groups?limit=1&query=" + Uri.EscapeDataString(query),
        cancellationToken).ConfigureAwait(false);

    if (First(answer.RootElement) is not { } group)
    {
      return null;
    }

    return new DensityFact(
        group.GetProperty("name").GetString() ?? query,
        group.GetProperty("densityTonPerCubicMeter").GetDecimal(),
        Date(group, "updatedAt"));
  }

  public async Task<PreliminaryPrice?> QuoteAsync(
      QuickQuoteRequest request,
      CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    // Адрес принимается только выбранный из подсказок: расчёт опирается на
    // координаты, а не на набранную участником строку (договор,
    // `suggestAddresses`). В переписке выбирать не из чего, поэтому берётся
    // первая подсказка, а её текст показывается участнику ответом.
    using var addresses = await ReadAsync(
        "v1/address-suggestions?limit=1&query=" + Uri.EscapeDataString(request.Address),
        cancellationToken).ConfigureAwait(false);

    if (First(addresses.RootElement) is not { } address)
    {
      return null;
    }

    using var groups = await ReadAsync(
        "v1/waste-groups?limit=1&query=" + Uri.EscapeDataString(request.WasteGroup),
        cancellationToken).ConfigureAwait(false);

    if (First(groups.RootElement) is not { } group)
    {
      return null;
    }

    var payload = new
    {
      pickupAddress = new
      {
        suggestionId = address.GetProperty("id").GetString(),
        value = address.GetProperty("value").GetString(),
        coordinates = new
        {
          latitude = address.GetProperty("coordinates").GetProperty("latitude").GetDouble(),
          longitude = address.GetProperty("coordinates").GetProperty("longitude").GetDouble(),
        },
      },
      items = new[]
      {
        new
        {
          wasteGroupId = group.GetProperty("id").GetString(),
          quantity = new { value = request.Amount, unit = request.Unit },
        },
      },
    };

    using var content = JsonContent.Create(payload);
    using var answer = await client.PostAsync(
        new Uri("v1/calculations", UriKind.Relative),
        content,
        cancellationToken).ConfigureAwait(false);

    if (!answer.IsSuccessStatusCode)
    {
      // Отказ расчётной части — не «данных нет»: сервис не отвечал, а не
      // искал и не нашёл. Различие важно для R-075.
      return null;
    }

    using var calculation = JsonDocument.Parse(
        await answer.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));

    return Price(calculation.RootElement, group.GetProperty("name").GetString() ?? request.WasteGroup);
  }

  /// Самый дешёвый вариант размещения по единственной группе расчёта.
  /// Порядок вариантов назначает расчётная часть; бот берёт первый и ничего
  /// не сортирует заново.
  private static PreliminaryPrice? Price(JsonElement calculation, string wasteGroupName)
  {
    if (!calculation.TryGetProperty("results", out var results)
        || results.ValueKind != JsonValueKind.Array
        || results.GetArrayLength() == 0)
    {
      return null;
    }

    var options = results[0].GetProperty("options");

    if (!options.TryGetProperty("items", out var items)
        || items.ValueKind != JsonValueKind.Array
        || items.GetArrayLength() == 0)
    {
      return null;
    }

    var option = items[0];
    var total = option.GetProperty("totalCost");

    return new PreliminaryPrice(
        calculation.GetProperty("id").GetString() ?? string.Empty,
        wasteGroupName,
        option.GetProperty("landfillName").GetString() ?? string.Empty,
        Amount(total),
        total.GetProperty("currency").GetString() ?? string.Empty,
        Date(calculation.GetProperty("dataFreshness"), "pricesUpdatedAt"));
  }

  private async Task<Dictionary<string, string>> WasteGroupNamesAsync(CancellationToken cancellationToken)
  {
    using var answer = await ReadAsync(
        "v1/waste-groups?limit=" + WasteGroupPage.ToString(CultureInfo.InvariantCulture),
        cancellationToken).ConfigureAwait(false);

    var names = new Dictionary<string, string>(StringComparer.Ordinal);

    if (answer.RootElement.TryGetProperty("items", out var items)
        && items.ValueKind == JsonValueKind.Array)
    {
      foreach (var group in items.EnumerateArray())
      {
        names[group.GetProperty("id").GetString() ?? string.Empty] =
            group.GetProperty("name").GetString() ?? string.Empty;
      }
    }

    return names;
  }

  private async Task<JsonDocument> ReadAsync(string address, CancellationToken cancellationToken)
  {
    var body = await client
        .GetStringAsync(new Uri(address, UriKind.Relative), cancellationToken)
        .ConfigureAwait(false);

    return JsonDocument.Parse(body);
  }

  /// Первая запись страницы договора либо пусто, если страница пуста.
  private static JsonElement? First(JsonElement page) =>
      page.TryGetProperty("items", out var items)
          && items.ValueKind == JsonValueKind.Array
          && items.GetArrayLength() > 0
              ? items[0]
              : null;

  /// Денежная сумма договора приходит строкой с двумя знаками после точки:
  /// двоичная дробь округляет рубли по дороге. Разбирается без потери знаков
  /// и без пересчёта (AC-073a).
  private static decimal Amount(JsonElement money) =>
      decimal.Parse(
          money.GetProperty("amount").GetString() ?? "0",
          NumberStyles.Number,
          CultureInfo.InvariantCulture);

  private static DateOnly Date(JsonElement element, string name) =>
      DateOnly.ParseExact(
          element.GetProperty(name).GetString() ?? string.Empty,
          "yyyy-MM-dd",
          CultureInfo.InvariantCulture);
}
