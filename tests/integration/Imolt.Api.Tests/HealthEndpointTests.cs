using System.Net;
using System.Text.Json;
using Testcontainers.PostgreSql;
using Xunit;

namespace Imolt.Api.Tests;

/// Живость службы не зависит от базы данных: иначе перезапуск базы выглядел бы
/// как отказ самой службы, и оркестратор перезапускал бы здоровый процесс.
///
/// Стенд здесь собственный, а не общий: проверка останавливает базу, и общий
/// контейнер после этого не годился бы остальным проверкам.
///
/// Проверка фальсифицируема: она падает, если /health начнёт обращаться к базе
/// (тогда с остановленной базой ответ перестанет быть 200 «ok») и если
/// остановка контейнера окажется мнимой — тогда /ready продолжит отвечать 200
/// и утверждение о живости без базы ничего не доказывало бы.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-067a
/// @supports: R-067
public sealed class HealthEndpointTests : IAsyncLifetime
{
  private readonly PostgreSqlContainer database = new PostgreSqlBuilder("postgres:17-alpine")
      .WithDatabase("imolt")
      .WithUsername("imolt")
      .WithPassword("imolt")
      .Build();

  private ImoltApiFactory? service;

  private HttpClient client = null!;

  public async Task InitializeAsync()
  {
    await database.StartAsync();

    service = new ImoltApiFactory(database.GetConnectionString());
    client = service.CreateClient();
  }

  public async Task DisposeAsync()
  {
    client?.Dispose();
    service?.Dispose();
    await database.DisposeAsync();
  }

  [Fact(DisplayName = "с остановленной базой служба остаётся живой, но перестаёт быть готовой")]
  public async Task HealthSurvivesTheDatabaseOutage()
  {
    var beforeOutage = await client.GetAsync("/ready");
    Assert.Equal(HttpStatusCode.OK, beforeOutage.StatusCode);

    await database.StopAsync();

    var health = await client.GetAsync("/health");
    var body = await health.Content.ReadAsStringAsync();

    Assert.Equal(HttpStatusCode.OK, health.StatusCode);

    var violations = ContractOracle.FromContract().Violations("getHealth", 200, body);
    Assert.True(violations.Count == 0, "ответ /health разошёлся с договором: " + string.Join("; ", violations));

    using var document = JsonDocument.Parse(body);
    Assert.Equal("ok", document.RootElement.GetProperty("status").GetString());

    // Без этого утверждения проверка прошла бы и при неостановленной базе:
    // тогда «живость не зависит от базы» ничем не подтверждалось бы.
    var readiness = await client.GetAsync("/ready");
    Assert.Equal(HttpStatusCode.ServiceUnavailable, readiness.StatusCode);
  }
}
