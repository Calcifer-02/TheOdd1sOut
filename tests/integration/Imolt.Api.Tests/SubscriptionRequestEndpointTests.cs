using System.Net;
using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Заявка на подписку и профиль участника (R-008, R-049, R-051). Оплата идёт
/// вне сервиса, поэтому операция фиксирует намерение и переводит подписку в
/// состояние «ожидает подтверждения»; «pending» здесь — нормальный исход, а не
/// ошибка.
///
/// Проверяется форма, а не политика доступа: что именно открывает подписка,
/// заказчиком не установлено (Q-011), и проверка не вправе решать это за него.
/// Наблюдаемое — состояние подписки, состав профиля и отказ на ИНН не по
/// образцу договора.
///
/// Проверка фальсифицируема: она падает, если заявка перестанет переводить
/// подписку в «pending»; если ответ перестанет называть, что оплата идёт вне
/// сервиса; если ИНН не по образцу договора будет принят или отвергнут другим
/// кодом; и если профиль перестанет называть роль, компанию или признак
/// регистрации в АИС ОССиГ, поданные заявкой.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-049d, AC-051a, AC-051b
[Collection(ImoltAccessCollection.Name)]
public sealed class SubscriptionRequestEndpointTests(ImoltAccessStand stand)
{
  /// ИНН по образцу договора (схема SubscriptionRequestInput,
  /// `^[0-9]{10}$|^[0-9]{12}$`).
  private const string ValidInn = "7701234567";

  /// ИНН, названный критерием AC-051b: коротких разрядов не хватает ни под
  /// десятизначную запись юридического лица, ни под двенадцатизначную.
  private const string MalformedInn = "12345";

  private const string CompanyName = "ООО «Перевозчик»";

  [Fact(DisplayName = "заявка на подписку переводит её в состояние «ожидает»")]
  public async Task SubscriptionRequestMovesSubscriptionToPending()
  {
    const long maxUserId = 851001;
    var token = await AccessChecks.TokenAsync(stand.Client, maxUserId);

    // Предусловие критерия наблюдается, а не предполагается: участник до
    // заявки подписки не имеет, и «pending» после неё — сдвиг, а не исходное
    // состояние.
    using (var before = await AccessChecks.ProfileAsync(stand.Client, token))
    {
      Assert.Equal("none", SubscriptionState(before.RootElement));
    }

    var response = await Send(token, "carrier", CompanyName, ValidInn, registeredInAisOssig: true);
    using var accepted = await ReferenceChecks.SuccessAsync(
        response, "createSubscriptionRequest", HttpStatusCode.Created);

    // AC-051a: состояние названо перечнем договора, а не текстом. Интерфейс
    // показывает пометку «Подписка ожидает подтверждения» по нему.
    Assert.Equal("pending", SubscriptionState(accepted.RootElement));

    // Ответ называет, что оплата идёт вне сервиса: иначе участник ждёт
    // платёжной формы, которой в версии 1 нет и не будет (R-064).
    var message = accepted.RootElement.TryGetProperty("message", out var value) ? value.GetString() : null;
    Assert.True(
        message is not null && message.Contains("оплат", StringComparison.OrdinalIgnoreCase),
        $"ответ не назвал порядок оплаты: {message ?? "сообщения нет"}");
  }

  [Fact(DisplayName = "ИНН не по образцу договора отвергается")]
  public async Task InnOutsideTheContractPatternIsRefused()
  {
    const long maxUserId = 851002;
    var token = await AccessChecks.TokenAsync(stand.Client, maxUserId);

    var response = await Send(token, "carrier", CompanyName, MalformedInn, registeredInAisOssig: false);

    // AC-051b: 400, а не 422 — нарушен образец поля, то есть форма запроса.
    // Правило предметной области при этом не рассматривалось.
    (await ReferenceChecks.ProblemAsync(
        response, HttpStatusCode.BadRequest, "urn:imolt:problem:validation")).Dispose();
  }

  [Fact(DisplayName = "профиль показывает роль, компанию и признак АИС ОССиГ")]
  public async Task ProfileNamesRoleCompanyAndAisOssigRegistration()
  {
    const long maxUserId = 851003;
    var token = await AccessChecks.TokenAsync(stand.Client, maxUserId);

    var response = await Send(token, "carrier", CompanyName, ValidInn, registeredInAisOssig: true);
    (await ReferenceChecks.SuccessAsync(
        response, "createSubscriptionRequest", HttpStatusCode.Created)).Dispose();

    using var profile = await AccessChecks.ProfileAsync(stand.Client, token);
    var body = profile.RootElement;

    // AC-049d: то, что подано заявкой, кабинет показывает обратно. Профиль,
    // потерявший эти поля, оставляет перевозчика без способа увидеть, что
    // именно он о себе сообщил.
    Assert.Equal("carrier", body.GetProperty("role").GetString());
    Assert.Equal(CompanyName, body.GetProperty("companyName").GetString());
    Assert.True(
        body.GetProperty("registeredInAisOssig").GetBoolean(),
        "профиль не назвал признак регистрации транспорта в АИС ОССиГ, поданный заявкой (R-051)");
    Assert.Equal("pending", SubscriptionState(body));
  }

  // Состояние подписки лежит и в ответе заявки, и в профиле под одним именем:
  // схема SubscriptionState общая, и читать её надо одинаково.
  private static string? SubscriptionState(JsonElement body)
      => body.GetProperty("subscription").GetProperty("state").GetString();

  private Task<HttpResponseMessage> Send(
      string token,
      string role,
      string companyName,
      string inn,
      bool registeredInAisOssig)
      => AccessChecks.PostJsonAsync(
          stand.Client,
          AccessChecks.SubscriptionRequestsPath,
          $$"""
            {
              "role": "{{role}}",
              "companyName": "{{companyName}}",
              "inn": "{{inn}}",
              "registeredInAisOssig": {{(registeredInAisOssig ? "true" : "false")}}
            }
            """,
          token);
}
