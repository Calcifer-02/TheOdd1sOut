using System.Net;
using System.Text;
using Imolt.Bot.Adapters;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Imolt.Bot.Tests;

/// Способ передачи токена доступа платформе MAX (R-069, решение ADR-0009).
///
/// Платформа объявила параметр запроса `access_token` устаревшим и отвечает на
/// него кодом 401 `verify.token`: на стенде 25.09.2026 каждый опрос обновлений
/// получал этот отказ, и переписки не начинались вовсе. Проверка закрепляет
/// рабочий способ — заголовок `Authorization` с самим токеном, без схемы
/// доступа перед ним.
///
/// Платформы здесь нет: обращение перехватывает двойник исполнителя запросов.
/// Ни сети, ни настоящего токена проверка не требует.
///
///   dotnet test tests/unit/Imolt.Bot.Tests
///
/// @supports: R-069
/// @adr: ADR-0009
public sealed class MaxAccessTransferTests
{
  /// Значение вымышленное: настоящий токен выдают организаторы, и в
  /// репозиторий он не попадает (условия трека, разд. 4 п. 9).
  private const string Token = "token-for-check-42";

  [Fact(DisplayName = "Токен доступа уходит заголовком Authorization без схемы")]
  public async Task TokenIsSentInAuthorizationHeaderWithoutScheme()
  {
    var handler = new RecordingHandler();

    await WhoAmIAsync(handler);

    var carried = handler.Request!.Headers.TryGetValues("Authorization", out var values);
    Assert.True(carried, "без заголовка Authorization платформа отвечает 401 verify.token");
    Assert.True(
        values!.SingleOrDefault() == Token,
        "платформа принимает сам токен: значение заголовка должно совпадать с ним и не нести схему доступа");
  }

  [Fact(DisplayName = "Адрес обращения токена доступа не несёт")]
  public async Task TokenIsAbsentFromRequestAddress()
  {
    var handler = new RecordingHandler();

    await WhoAmIAsync(handler);

    var address = handler.Request!.RequestUri!.ToString();
    Assert.True(
        !address.Contains("access_token", StringComparison.Ordinal) && !address.Contains(Token, StringComparison.Ordinal),
        "устаревший параметр запроса даёт отказ 401 verify.token: токена в адресе быть не должно, адрес был " + address);
  }

  private static async Task WhoAmIAsync(RecordingHandler handler)
  {
    using var client = new HttpClient(handler) { BaseAddress = new Uri("https://platform-api.max.test/") };
    var messages = new MaxMessages(client, new MaxAccess(Token), NullLogger<MaxMessages>.Instance);

    await messages.WhoAmIAsync(CancellationToken.None);
  }

  /// Двойник исполнителя запросов: запоминает обращение и отвечает учётной
  /// записью бота в том составе, который разбирает переходник.
  private sealed class RecordingHandler : HttpMessageHandler
  {
    public HttpRequestMessage? Request { get; private set; }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
      Request = request;

      return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
      {
        Content = new StringContent(
            """{"user_id":42,"username":"imolt_bot"}""",
            Encoding.UTF8,
            "application/json"),
      });
    }
  }
}
