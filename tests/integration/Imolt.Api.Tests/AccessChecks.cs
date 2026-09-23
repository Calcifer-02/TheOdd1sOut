using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Общая часть проверок доступа и кабинета: обмен стартовых параметров на
/// маркер, обращения с маркером и без него, счёт записей участника.
///
/// Сверка ответов с договором берётся у ReferenceChecks, а сборка тела
/// расчёта — у CalculationChecks: договорный оракул один на службу, и второй
/// его обёртки быть не должно. Здесь добавлено только то, чего у соседних
/// областей нет, — заголовок Authorization и путь от подписанных параметров
/// до маркера.
///
/// Маркер кладётся в каждый запрос отдельно, а не в DefaultRequestHeaders
/// клиента: клиент на стенде один на весь класс проверок, и общий заголовок
/// сделал бы гостевой запрос соседней проверки запросом участника.
///
internal static class AccessChecks
{
  public const string SessionsPath = "/v1/auth/sessions";

  public const string ProfilePath = "/v1/profile";

  public const string SubscriptionRequestsPath = "/v1/subscription-requests";

  public const string DocumentServiceOrdersPath = "/v1/document-service-orders";

  public const string CalculationsPath = "/v1/calculations";

  /// Свежие стартовые параметры участника, подписанные ключом бота стенда.
  public static string FreshInitData(long maxUserId, string displayName = "Иван")
      => MaxInitDataBuilder.Signed(
          ImoltAccessStand.BotToken,
          MaxInitDataBuilder.Parameters(maxUserId, DateTimeOffset.UtcNow, displayName));

  /// Обмен стартовых параметров на сессию — как есть, без сверки с договором:
  /// отказ тоже проверяется этим вызовом.
  public static Task<HttpResponseMessage> CreateSessionAsync(
      HttpClient client,
      string initData,
      bool personalDataConsent = true)
      => client.PostAsync(
          SessionsPath,
          Body($$"""
              {
                "initData": "{{initData}}",
                "personalDataConsent": {{(personalDataConsent ? "true" : "false")}}
              }
              """));

  /// Созданная сессия, сверенная с договором: 201 и тело по схеме Session.
  public static async Task<JsonDocument> IssuedSessionAsync(HttpClient client, string initData)
  {
    var response = await CreateSessionAsync(client, initData);

    return await ReferenceChecks.SuccessAsync(response, "createSession", HttpStatusCode.Created);
  }

  /// Маркер доступа участника: полный путь от подписанных параметров до
  /// заголовка Authorization. Учётная запись у каждой проверки своя — счёт
  /// записей участника не должен зависеть от порядка запуска соседних
  /// проверок.
  public static async Task<string> TokenAsync(HttpClient client, long maxUserId)
  {
    using var session = await IssuedSessionAsync(client, FreshInitData(maxUserId));

    return AccessTokenOf(session.RootElement);
  }

  /// Маркер доступа из ответа операции createSession.
  public static string AccessTokenOf(JsonElement session)
  {
    var token = session.GetProperty("accessToken").GetString();
    Assert.False(
        string.IsNullOrWhiteSpace(token),
        "сессия создана без маркера доступа: предъявлять операциям кабинета нечего");

    return token!;
  }

  /// Профиль участника, сверенный с договором.
  public static async Task<JsonDocument> ProfileAsync(HttpClient client, string token)
  {
    var response = await GetAsync(client, ProfilePath, token);

    return await ReferenceChecks.OkAsync(response, "getProfile");
  }

  /// Чтение с маркером либо без него: пустой маркер означает гостя.
  public static Task<HttpResponseMessage> GetAsync(HttpClient client, string path, string? token)
      => client.SendAsync(Request(HttpMethod.Get, path, token, content: null));

  /// Отправка тела с маркером либо без него.
  public static Task<HttpResponseMessage> PostJsonAsync(
      HttpClient client,
      string path,
      string json,
      string? token)
      => client.SendAsync(Request(HttpMethod.Post, path, token, Body(json)));

  /// Расчёт примера договора: 20 тонн лома бетона с адреса вывоза, у которого
  /// сохранены плечи до обоих полигонов. Маркер необязателен — гостевой расчёт
  /// договором разрешён, и AC-008a требует показать обе стороны.
  public static async Task<string> CreateCalculationAsync(HttpClient client, string? token)
  {
    var response = await PostJsonAsync(
        client,
        CalculationsPath,
        CalculationChecks.CalculationRequestJson(
            CalculationChecks.ItemJson(ImoltAccessStand.ConcreteGroupId, ImoltAccessStand.ConcreteTons, "t"),
            ImoltAccessStand.PickupValue,
            ImoltAccessStand.PickupLatitude,
            ImoltAccessStand.PickupLongitude,
            distanceKm: ImoltAccessStand.WideDistanceKm),
        token);

    using var calculation = await CalculationChecks.CreatedAsync(response, "createCalculation");

    return CalculationChecks.IdOf(calculation.RootElement);
  }

  /// Сколько учётных записей платформы заведено под этим идентификатором.
  public static Task<long> SubscriberCountAsync(ImoltAccessStand stand, long maxUserId)
      => stand.CountAsync(
          "select count(*) from subscriber where max_user_id = @maxUserId",
          ("maxUserId", MaxInitDataBuilder.MaxUserIdOf(maxUserId)));

  private static HttpRequestMessage Request(
      HttpMethod method,
      string path,
      string? token,
      HttpContent? content)
  {
    var request = new HttpRequestMessage(method, path) { Content = content };

    if (!string.IsNullOrEmpty(token))
    {
      request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    return request;
  }

  private static StringContent Body(string json) => new(json, Encoding.UTF8, "application/json");
}
