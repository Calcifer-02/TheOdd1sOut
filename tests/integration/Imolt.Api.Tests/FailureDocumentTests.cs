using System.Net;
using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Документ об отказе при необработанной поломке службы. Поле type у такого
/// отказа — «about:blank»: кода причины клиент не знает, и выдумывать его
/// нельзя (RFC 9457), но форма ответа обязана быть той же, что у объявленных
/// отказов, иначе разбор ошибки рассыпается именно в тот момент, когда к
/// нему прибегают.
///
/// Отловлен отказ так: строка подключения заведомо негодна — служба падает
/// на настоящем пути, а не на подставленном внутреннем исключении. Проверка
/// фальсифицируема: убрать UseExceptionHandler — и придёт не документ,
/// а пустое тело или страница development exception.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-011e
public sealed class FailureDocumentTests : IAsyncLifetime
{
  // Команда разбора строки подключения бросает ArgumentException — не
  // NpgsqlException, — и готовность не успевает превратить его в 503:
  // исключение доходит до обработчика отказов службы.
  private readonly ImoltApiFactory service = new("Host=stand;CommandTimeout=не-число");

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

  [Fact(DisplayName = "необработанная поломка отвечает документом RFC 9457 с кодом 500")]
  public async Task UnhandledFailureAnswersProblemDocument()
  {
    var response = await client.GetAsync("/ready");

    Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
    Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

    var body = await response.Content.ReadAsStringAsync();

    using var document = JsonDocument.Parse(body);
    var root = document.RootElement;

    Assert.Equal("about:blank", root.GetProperty("type").GetString());
    Assert.Equal("Внутренняя ошибка службы", root.GetProperty("title").GetString());
    Assert.Equal(500, root.GetProperty("status").GetInt32());
    Assert.Equal("/ready", root.GetProperty("instance").GetString());

    var violations = ContractOracle.FromContract().ViolationsAgainstSchema("Problem", body);
    Assert.True(
        violations.Count == 0,
        $"документ об отказе разошёлся со схемой Problem: {string.Join("; ", violations)}");
  }
}
