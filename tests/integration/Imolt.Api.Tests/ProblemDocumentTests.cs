using System.Net;
using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Ошибка приходит документом RFC 9457. Интерфейс ветвится по полю type, а не
/// по тексту заголовка, поэтому пустое тело с одним лишь кодом состояния
/// оставляет клиента без разбора причины.
///
/// Проверка фальсифицируема: она падает, если служба отдаст на неизвестный
/// путь пустое тело либо обычный application/json, а также если в документе
/// не окажется обязательных по договору полей type, title и status.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
[Collection(ImoltApiCollection.Name)]
public sealed class ProblemDocumentTests(ImoltApiStand stand)
{
  [Fact(DisplayName = "неизвестный путь отвечает документом об ошибке по RFC 9457")]
  public async Task UnknownPathAnswersWithProblemDocument()
  {
    var response = await stand.Client.GetAsync("/v1/nope");
    var body = await response.Content.ReadAsStringAsync();

    Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

    using var document = JsonDocument.Parse(body);

    string[] required = ["type", "title", "status"];

    foreach (var field in required)
    {
      Assert.True(
          document.RootElement.TryGetProperty(field, out _),
          $"в документе об ошибке нет обязательного по договору поля {field}: {body}");
    }
  }
}
