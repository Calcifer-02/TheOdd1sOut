using System.Net;
using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Личность участника даёт платформа MAX: своего входа по паролю или коду
/// сервис не заводит (ADR-0006). Мини-приложение передаёт строку стартовых
/// параметров, служба проверяет её подпись ключом бота и выдаёт маркер
/// доступа.
///
/// Подпись проверяется по исходной строке, а не по разобранному клиентом
/// объекту: по объекту подпись не сверить, и доверие к нему равно доверию к
/// клиенту (ADR-0006, инвариант 3). Ключ бота при этом наружу не выходит ни в
/// каком виде — ни сам, ни своей подписью (R-056, AR-006).
///
/// Отказ проверяется не только кодом ответа: отказ с кодом 401 и отказ с
/// кодом 401 и уже заведённой учётной записью выглядят для клиента одинаково.
/// Учётные записи считаются по идентификатору платформы — он у каждой проверки
/// свой, и счёт не зависит от порядка запуска соседних проверок.
///
/// Проверка фальсифицируема: она падает, если сошедшаяся подпись перестанет
/// давать маркер, срок его действия или учётную запись из подписанных
/// параметров; если подделанная подпись или устаревшие параметры дадут маркер
/// либо оставят учётную запись в хранилище; если отказ по сроку давности
/// перестанет называть причину; если ключ бота или подпись параметров попадут
/// в тело ответа; и если кабинет начнёт отвечать гостю тем же, чем участнику.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-049a, AC-049b, AC-049c, AC-050b, AC-054b, AC-056c
[Collection(ImoltAccessCollection.Name)]
public sealed class MaxSessionEndpointTests(ImoltAccessStand stand)
{
  /// Код причины отказа «нужен вход». Договор не называет код для отказа
  /// операции createSession, а перечень кодов службы держит для входа ровно
  /// один — тот, который критерий AC-050b называет прямо. Расхождение
  /// названо здесь, а не обойдено молча.
  private const string AuthenticationRequired = "urn:imolt:problem:authentication-required";

  private const string Validation = "urn:imolt:problem:validation";

  [Fact(DisplayName = "сошедшаяся подпись обменивается на маркер и профиль")]
  public async Task SignedInitDataIsExchangedForTokenAndProfile()
  {
    const long maxUserId = 812345;

    using var session = await AccessChecks.IssuedSessionAsync(
        stand.Client, AccessChecks.FreshInitData(maxUserId, "Иван"));
    var body = session.RootElement;

    // AC-049a: маркер непуст — иначе предъявлять операциям кабинета нечего.
    var token = AccessChecks.AccessTokenOf(body);
    Assert.NotEmpty(token);

    // Срок действия назван полем: клиент не угадывает его по опыту
    // (описание операции createSession в договоре).
    var expiresIn = body.GetProperty("expiresIn").GetInt32();
    Assert.True(
        expiresIn > 0,
        $"срок действия маркера объявлен величиной {expiresIn}: по ней клиент не знает, когда обновлять сессию");

    // Профиль называет ту учётную запись, которая была подписана, а не
    // произвольную: подпись покрывает идентификатор пользователя, и
    // несовпадение означало бы, что личность взята не из неё.
    Assert.Equal(
        MaxInitDataBuilder.MaxUserIdOf(maxUserId),
        body.GetProperty("profile").GetProperty("maxUserId").GetString());
  }

  [Fact(DisplayName = "подделанная подпись маркера не даёт")]
  public async Task SubstitutedUserIdentifierIsRefusedWithoutToken()
  {
    const long signedMaxUserId = 812346;
    const long substitutedMaxUserId = 999001;

    var parameters = MaxInitDataBuilder.Parameters(signedMaxUserId, DateTimeOffset.UtcNow);
    var forged = MaxInitDataBuilder.SignedWithSubstitutedUser(
        ImoltAccessStand.BotToken,
        parameters,
        MaxInitDataBuilder.UserJson(substitutedMaxUserId, "Иван"));

    var response = await AccessChecks.CreateSessionAsync(stand.Client, forged);

    // AC-049b: 401, а не 422 — предъявленная личность не подтверждена, и
    // разбирать правило предметной области не на чем.
    using var problem = await ReferenceChecks.ProblemAsync(
        response, HttpStatusCode.Unauthorized, AuthenticationRequired);

    // Маркера в ответе нет ни под каким именем: отказ, приложивший маркер,
    // отказом не является.
    Assert.DoesNotContain("accessToken", CalculationChecks.FieldNames(problem.RootElement));

    // Учётная запись не заведена ни под подписанным идентификатором, ни под
    // подставленным. Снаружи отказ с записью от честного неотличим, а запись
    // означает, что подделка уже завела себе личность в сервисе.
    Assert.Equal(0L, await AccessChecks.SubscriberCountAsync(stand, signedMaxUserId));
    Assert.Equal(0L, await AccessChecks.SubscriberCountAsync(stand, substitutedMaxUserId));
  }

  [Fact(DisplayName = "устаревшие параметры запуска маркера не дают")]
  public async Task StaleInitDataIsRefusedWithStalenessAsTheReason()
  {
    const long maxUserId = 812347;

    // «Сутки назад» по критерию AC-049c, с запасом в минуту: ровно сутки —
    // правдоподобная граница срока давности, и параметры на самой границе
    // прошли бы или не прошли в зависимости от того, строгое сравнение или
    // нет. Проверяется отказ устаревшим, а не поведение на границе.
    var issuedAt = DateTimeOffset.UtcNow - TimeSpan.FromDays(1) - TimeSpan.FromMinutes(1);
    var stale = MaxInitDataBuilder.Signed(
        ImoltAccessStand.BotToken,
        MaxInitDataBuilder.Parameters(maxUserId, issuedAt));

    var response = await AccessChecks.CreateSessionAsync(stand.Client, stale);

    using var problem = await ReferenceChecks.ProblemAsync(
        response, HttpStatusCode.Unauthorized, AuthenticationRequired);

    // AC-049c: причиной назван срок давности, а не подпись. Подпись здесь
    // сошлась, и отказ «подпись не сошлась» отправил бы разработчика
    // мини-приложения искать несуществующую ошибку в подписи.
    var detail = problem.RootElement.TryGetProperty("detail", out var value) ? value.GetString() : null;
    Assert.True(
        detail is not null && NamesStaleness(detail),
        $"отказ не назвал причиной срок давности стартовых параметров: {detail ?? "причина не указана"}");
  }

  [Fact(DisplayName = "без согласия на обработку персональных данных сессии нет")]
  public async Task WithoutPersonalDataConsentNoSessionIsCreated()
  {
    const long maxUserId = 812348;

    var response = await AccessChecks.CreateSessionAsync(
        stand.Client, AccessChecks.FreshInitData(maxUserId), personalDataConsent: false);

    // AC-054b: 422, а не 400 — запрос разобран и по форме верен, подпись
    // сошлась, но правило R-054 запрещает заводить по нему учётную запись.
    using var problem = await ReferenceChecks.ProblemAsync(
        response, HttpStatusCode.UnprocessableContent, Validation);

    // Причиной названо именно отсутствие согласия: общий «запрос не прошёл
    // проверку» не подсказывает, какой флажок не отмечен.
    var detail = problem.RootElement.TryGetProperty("detail", out var value) ? value.GetString() : null;
    Assert.True(
        detail is not null && detail.Contains("соглас", StringComparison.OrdinalIgnoreCase),
        $"отказ не назвал причиной отсутствие согласия: {detail ?? "причина не указана"}");

    // Учётная запись в хранилище не заведена. Сохранить персональные данные и
    // отказать — худший из исходов, и снаружи он от честного отказа неотличим.
    Assert.Equal(0L, await AccessChecks.SubscriberCountAsync(stand, maxUserId));
  }

  [Fact(DisplayName = "ключ бота и подпись параметров не покидают сервер")]
  public async Task NeitherBotTokenNorInitDataSignatureLeavesTheServer()
  {
    const long maxUserId = 812349;

    var initData = AccessChecks.FreshInitData(maxUserId);
    var signature = MaxInitDataBuilder.HashOf(initData);

    using var session = await AccessChecks.IssuedSessionAsync(stand.Client, initData);
    var token = AccessChecks.AccessTokenOf(session.RootElement);

    using var profile = await AccessChecks.ProfileAsync(stand.Client, token);

    // AC-056c: просматривается всё тело ответа, а не отдельные поля. Секрет,
    // уехавший под безобидным именем, — та же утечка, и проверка одного
    // уровня пропустила бы его внутри профиля.
    AssertCarriesNoSecret(session.RootElement, "createSession", signature);
    AssertCarriesNoSecret(profile.RootElement, "getProfile", signature);
  }

  [Fact(DisplayName = "операция кабинета без маркера не выполняется, а с маркером выполняется")]
  public async Task ProfileIsRefusedWithoutTokenAndServedWithIt()
  {
    const long maxUserId = 812350;

    var guestResponse = await AccessChecks.GetAsync(stand.Client, AccessChecks.ProfilePath, token: null);

    // AC-050b: код причины устойчив — интерфейс ветвится по нему, а не по
    // заголовку отказа, и показывает вход вместо пустого кабинета.
    (await ReferenceChecks.ProblemAsync(
        guestResponse, HttpStatusCode.Unauthorized, AuthenticationRequired)).Dispose();

    // Тот же запрос с маркером обслуживается. Без этой половины проверка
    // прошла бы и на службе, которая закрыла кабинет вообще всем.
    var token = await AccessChecks.TokenAsync(stand.Client, maxUserId);
    using var profile = await AccessChecks.ProfileAsync(stand.Client, token);

    Assert.Equal(
        MaxInitDataBuilder.MaxUserIdOf(maxUserId),
        profile.RootElement.GetProperty("maxUserId").GetString());
  }

  // Отказ по сроку давности называется разными словами, и критерий требует
  // смысла, а не формулировки. Признаётся любое из общеупотребительных
  // обозначений просроченности; слова о подписи среди них нет намеренно.
  private static bool NamesStaleness(string detail)
      => detail.Contains("давност", StringComparison.OrdinalIgnoreCase)
          || detail.Contains("устарел", StringComparison.OrdinalIgnoreCase)
          || detail.Contains("истёк", StringComparison.OrdinalIgnoreCase)
          || detail.Contains("истек", StringComparison.OrdinalIgnoreCase)
          || detail.Contains("срок", StringComparison.OrdinalIgnoreCase);

  private static void AssertCarriesNoSecret(
      JsonElement body,
      string operationId,
      string signature)
  {
    foreach (var (field, value) in CalculationChecks.ScalarValues(body))
    {
      Assert.False(
          value.Contains(ImoltAccessStand.BotToken, StringComparison.Ordinal),
          $"ответ операции {operationId} вынес ключ бота наружу в поле «{field}»");
      Assert.False(
          value.Contains(signature, StringComparison.OrdinalIgnoreCase),
          $"ответ операции {operationId} вынес подпись стартовых параметров наружу в поле «{field}»");
    }
  }
}
