using System.Net;
using Imolt.Shared;
using Xunit;

namespace Imolt.Api.Tests;

/// Подсказки адреса вывоза. Расчёт опирается на координаты, а не на набранную
/// строку, поэтому подсказка без координат бесполезна; зона обслуживания —
/// Москва и Московская область, и адрес вне её считать нечем. Обращение к
/// внешней службе идёт через сервер: ключ доступа остаётся на сервере
/// (риск AR-006).
///
/// Источник подсказок объявляется настройкой ADDRESS_SUGGESTIONS_URL: пока
/// она пуста, подсказки собираются из справочника адресов в базе; когда
/// объявлена — из внешней службы по этому адресу. Ключ доступа приходит
/// настройкой ADDRESS_SUGGESTIONS_API_KEY. Обе настройки — решение этих
/// проверок: договор объявляет только поведение точки, а не имена настроек,
/// и наружу они не видны.
///
/// Ограничение проверки AC-012b названо прямо: критерий приёмки предполагает
/// в справочнике адресов запись по Твери, а схема базы такую запись не
/// принимает — столбец area ограничен значениями moscow и moscowRegion
/// (0001_initial_schema.sql). Поэтому проверка наблюдает исход, а не
/// предусловие: запрос по населённому пункту вне зоны обслуживания обязан
/// вернуть пустой список, тогда как запрос по адресу внутри зоны —
/// непустой. Расхождение критерия со схемой передано аналитике.
///
/// Проверка фальсифицируема: она падает, если подсказка придёт без координат
/// или без зоны обслуживания, если адрес вне Москвы и области попадёт в
/// выдачу, если запрос короче трёх символов будет принят (либо отвергнут
/// окажется и допустимый запрос), если объявленная и молчащая внешняя служба
/// притворится успехом вместо кода 503 с заголовком Retry-After и если
/// значение ключа внешней службы просочится в тело или заголовки ответа.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-012a, AC-012b, AC-012c, AC-055a, AC-056a
/// @supports: R-012, R-055, R-056
[Collection(ImoltReferencesCollection.Name)]
public sealed class AddressSuggestionEndpointsTests(ImoltReferencesStand stand)
{
  [Fact(DisplayName = "подсказка адреса несёт координаты и зону обслуживания")]
  public async Task SuggestionCarriesCoordinatesAndServiceArea()
  {
    var response = await stand.Client.GetAsync(Suggestions("Годовикова"));
    using var document = await ReferenceChecks.OkAsync(response, "suggestAddresses");

    var items = document.RootElement.GetProperty("items").EnumerateArray().ToList();
    Assert.NotEmpty(items);

    foreach (var suggestion in items)
    {
      var area = suggestion.GetProperty("area").GetString();
      Assert.True(
          area is "moscow" or "moscowRegion",
          $"зона обслуживания подсказки равна «{area}»: договор объявляет "
          + "только moscow и moscowRegion (схема ServiceArea)");
    }

    // Адрес и координаты — из справочника адресов начального набора.
    var exact = items.Single(suggestion =>
        suggestion.GetProperty("value").GetString() == "г Москва, ул Годовикова, д 9");
    var coordinates = exact.GetProperty("coordinates");

    Assert.Equal("moscow", exact.GetProperty("area").GetString());
    Assert.Equal(55.8055, coordinates.GetProperty("latitude").GetDouble(), 4);
    Assert.Equal(37.6206, coordinates.GetProperty("longitude").GetDouble(), 4);
  }

  [Fact(DisplayName = "адрес вне Москвы и области в подсказках не появляется")]
  public async Task AddressOutsideTheServiceAreaIsNotSuggested()
  {
    var outside = await stand.Client.GetAsync(Suggestions("Тверь"));
    using var outsideDocument = await ReferenceChecks.OkAsync(outside, "suggestAddresses");
    var outsidePage = outsideDocument.RootElement;

    Assert.Empty(outsidePage.GetProperty("items").EnumerateArray());
    Assert.Equal(0, outsidePage.GetProperty("total").GetInt32());

    // Без этого утверждения проверку прошла бы и точка, которая всегда
    // отдаёт пустой список: тогда «вне зоны не предлагается» ничего не
    // означало бы. «Балашиха» лежит в справочнике с зоной moscowRegion.
    var inside = await stand.Client.GetAsync(Suggestions("Балашиха"));
    using var insideDocument = await ReferenceChecks.OkAsync(inside, "suggestAddresses");

    var insideItems = insideDocument.RootElement.GetProperty("items").EnumerateArray().ToList();
    Assert.NotEmpty(insideItems);
    Assert.Equal("moscowRegion", insideItems[0].GetProperty("area").GetString());
  }

  [Fact(DisplayName = "запрос подсказок короче трёх символов отклоняется кодом 400")]
  public async Task TooShortQueryIsRejected()
  {
    // Три символа — нижняя граница договора (suggestAddresses, minLength:
    // 3). Без утверждения о принятом «Год» отказ на «Го» дала бы и точка,
    // отвергающая любой запрос.
    var accepted = await stand.Client.GetAsync(Suggestions("Год"));
    Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);

    var response = await stand.Client.GetAsync(Suggestions("Го"));
    using var document = await ReferenceChecks.ProblemAsync(
        response, HttpStatusCode.BadRequest, Problems.Validation);

    var title = document.RootElement.GetProperty("title").GetString();
    Assert.False(string.IsNullOrWhiteSpace(title), "заголовок отказа пуст: показывать пользователю нечего");
  }

  [Fact(DisplayName = "объявленная и не отвечающая служба подсказок даёт 503 с заголовком Retry-After")]
  public async Task DeclaredButSilentSuggestionServiceAnswersWithUnavailable()
  {
    // Отдельная служба: настройка стенда общая на все проверки области, и
    // объявлять недоступный источник на весь стенд нельзя. Адрес ведёт на
    // порт 1 замыкания на себя — там никто не слушает, соединение не
    // устанавливается, и это и есть «источник объявлен, но не отвечает».
    using var service = new ImoltApiFactory(stand.ConnectionString, new Dictionary<string, string?>
    {
      [ImoltReferencesStand.SuggestionsUrlSetting] = "http://127.0.0.1:1/",
      [ImoltReferencesStand.SuggestionsApiKeySetting] = ImoltReferencesStand.SuggestionsApiKey,
    });
    using var client = service.CreateClient();

    var response = await client.GetAsync(Suggestions("Годовикова"));
    using var document = await ReferenceChecks.ProblemAsync(
        response, HttpStatusCode.ServiceUnavailable, Problems.DistanceServiceUnavailable);

    Assert.True(
        response.Headers.RetryAfter is not null,
        "в ответе нет заголовка Retry-After: клиенту нечем узнать, когда повторять");

    // Отказ источника не должен унести с собой ключ доступа: сообщение об
    // ошибке — самое частое место, где ключ утекает вместе с текстом
    // исключения.
    var body = await response.Content.ReadAsStringAsync();
    Assert.DoesNotContain(ImoltReferencesStand.SuggestionsApiKey, body, StringComparison.Ordinal);

    Assert.False(
        document.RootElement.TryGetProperty("detail", out var detail)
        && (detail.GetString() ?? string.Empty).Contains(
            ImoltReferencesStand.SuggestionsApiKey, StringComparison.Ordinal),
        "пояснение к отказу содержит ключ внешней службы");
  }

  [Fact(DisplayName = "ответ подсказок не содержит значения ключа внешней службы")]
  public async Task SuggestionResponseNeverCarriesTheUpstreamKey()
  {
    var response = await stand.Client.GetAsync(Suggestions("Годовикова"));
    var body = await response.Content.ReadAsStringAsync();

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    Assert.DoesNotContain(ImoltReferencesStand.SuggestionsApiKey, body, StringComparison.Ordinal);

    var headers = response.Headers
        .Concat(response.Content.Headers)
        .SelectMany(header => header.Value.Select(value => $"{header.Key}: {value}"));

    foreach (var header in headers)
    {
      Assert.DoesNotContain(ImoltReferencesStand.SuggestionsApiKey, header, StringComparison.Ordinal);
    }
  }

  private static string Suggestions(string query)
      => "/v1/address-suggestions?query=" + Uri.EscapeDataString(query);
}
