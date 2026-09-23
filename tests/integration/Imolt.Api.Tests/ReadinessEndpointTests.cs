using System.Net;
using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Готовность службы. Точка подтверждает, что служба видит базу по строке
/// подключения из окружения, и именно она ловит разорванную связку api — db.
///
/// Проверка фальсифицируема: она падает, если готовность перестанет обращаться
/// к базе (тогда служба без строки подключения ответит 200 и оркестратор
/// направит на неё трафик), если ответ разойдётся со схемой ReadinessStatus
/// договора или если причина неготовности окажется пустой и в журнале не
/// останется, из-за чего служба не поднялась.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-068a, AC-068b
[Collection(ImoltApiCollection.Name)]
public sealed class ReadinessEndpointTests(ImoltApiStand stand)
{
  [Fact(DisplayName = "с достижимой базой служба отвечает о готовности по схеме договора")]
  public async Task ReadinessReportsReachableDatabase()
  {
    var response = await stand.Client.GetAsync("/ready");
    var body = await response.Content.ReadAsStringAsync();

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);

    var violations = ContractOracle.FromContract().Violations("getReadiness", 200, body);
    Assert.True(violations.Count == 0, "ответ /ready разошёлся с договором: " + string.Join("; ", violations));

    using var document = JsonDocument.Parse(body);
    Assert.Equal("ready", document.RootElement.GetProperty("status").GetString());
    Assert.Equal("reachable", document.RootElement.GetProperty("database").GetString());
  }

  [Fact(DisplayName = "без строки подключения служба отвечает о неготовности и называет причину")]
  public async Task ReadinessReportsMissingConnectionString()
  {
    // Отдельная служба без DATABASE_URL: база здесь не нужна вовсе —
    // проверяется поведение при незаданной настройке, а не при недоступной
    // базе.
    using var service = new ImoltApiFactory(connectionString: null);
    using var client = service.CreateClient();

    var response = await client.GetAsync("/ready");
    var body = await response.Content.ReadAsStringAsync();

    Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);

    var violations = ContractOracle.FromContract().Violations("getReadiness", 503, body);
    Assert.True(violations.Count == 0, "ответ /ready разошёлся с договором: " + string.Join("; ", violations));

    using var document = JsonDocument.Parse(body);
    Assert.Equal("not_ready", document.RootElement.GetProperty("status").GetString());

    var reason = document.RootElement.GetProperty("reason").GetString();
    Assert.False(string.IsNullOrWhiteSpace(reason), "причина неготовности пуста: по такому ответу разбирать нечего");
  }
}
