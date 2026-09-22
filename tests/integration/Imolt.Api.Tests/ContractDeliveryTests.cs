using System.Net;
using Imolt.Shared;
using Xunit;
using YamlDotNet.Serialization;

namespace Imolt.Api.Tests;

/// Отдача договора самой службой: файл по /v1/openapi.yaml, страница просмотра
/// и совпадение образца денежной суммы с тем, что разбирает конвертер.
///
/// Договор — источник, а не производная кода (ADR-0003), поэтому проверка
/// сверяет ответ с файлом в репозитории байт в байт: пересобранный или
/// подправленный по дороге ответ перестал бы быть тем договором, по которому
/// клиент пишет код. Образец суммы сверяется отдельно: разбор и договор
/// живут в разных единицах и могут разойтись молча.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-011d
/// @supports: R-002, R-011
/// @adr: ADR-0003
public sealed class ContractDeliveryTests : IAsyncLifetime
{
  // База здесь не нужна: договор и страница просмотра от неё не зависят,
  // а пустая строка подключения гарантирует, что проверка ничего в ней не читает.
  private readonly ImoltApiFactory service = new(connectionString: null);

  private HttpClient client = null!;

  public Task InitializeAsync()
  {
    client = service.CreateClient();
    return Task.CompletedTask;
  }

  public Task DisposeAsync()
  {
    client.Dispose();
    service.Dispose();
    return Task.CompletedTask;
  }

  [Fact(DisplayName = "служба отдаёт договор из репозитория байт в байт")]
  public async Task ContractIsServedByteForByte()
  {
    var response = await client.GetAsync("/v1/openapi.yaml");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    Assert.Equal("application/yaml", response.Content.Headers.ContentType?.MediaType);

    var served = await response.Content.ReadAsByteArrayAsync();
    var source = await File.ReadAllBytesAsync(ContractOracle.ContractPath);

    Assert.True(
        served.SequenceEqual(source),
        "ответ /v1/openapi.yaml отличается от файла договора в репозитории: "
        + "служба отдаёт производную, а не источник");
  }

  [Fact(DisplayName = "страница просмотра договора обращается к этой же службе")]
  public async Task SwaggerPagePointsToServedContract()
  {
    // Адрес договора попадает на страницу через генерируемый index.js:
    // html-шаблон и статический инициализатор из пакета его не содержат,
    // и проверка по ним утверждала бы что-то о нераскрашенном скелете.
    var response = await client.GetAsync("swagger/index.js");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);

    var config = await response.Content.ReadAsStringAsync();

    // Адрес задан относительно страницы: абсолютный путь за префиксом /api
    // ушёл бы мимо службы, и просмотрщик получил бы разметку вместо договора.
    Assert.Contains("\"url\":\"../v1/openapi.yaml\"", config, StringComparison.Ordinal);
  }

  [Fact(DisplayName = "образец суммы в отдаваемом договоре совпадает с образцом разбора")]
  public async Task ServedMoneyPatternMatchesParsingPattern()
  {
    var response = await client.GetAsync("/v1/openapi.yaml");
    var body = await response.Content.ReadAsStringAsync();

    var document = new DeserializerBuilder().Build().Deserialize<Dictionary<object, object>>(body);

    var schemas = Child(Child(Child(document, "components"), "schemas"), "Money");
    var amount = Child(Child(schemas, "properties"), "amount");

    // «pattern» — скаляр, а не узел дерева: обрывать обход нужно на словаре
    // «amount», иначе приведение строки к словарю даст InvalidCastException.
    Assert.Equal(Money.AmountPattern, (string)amount["pattern"]);
  }

  private static IDictionary<object, object> Child(IDictionary<object, object> map, string key)
      => (IDictionary<object, object>)map[key];
}
