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
/// Проверки фальсифицируемы: они падают, если заявка перестанет переводить
/// подписку в «pending»; если ответ перестанет называть, что оплата идёт вне
/// сервиса; если ИНН или телефон не по образцу договора будут приняты или
/// отвергнуты другим кодом; если заявка без телефона перестанет приниматься;
/// и если профиль перестанет называть поданные заявкой роль, компанию,
/// телефон и три признака.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-049d, AC-051a, AC-051b, AC-051c, AC-051d
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

  /// Телефон по образцу договора: «+7» и десять цифр.
  private const string ValidPhone = "+79161234567";

  /// Телефон, названный критерием AC-051d: человек пишет его так каждый день,
  /// но канонической записи здесь нет — ни «+7», ни десяти цифр после него.
  private const string MalformedPhone = "495-532-02-73";

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

  [Fact(DisplayName = "заявка накапливает телефон, лицензию и санитарно-эпидемиологическое заключение")]
  public async Task SubscriptionRequestKeepsPhoneLicenceAndSanitaryConclusion()
  {
    const long maxUserId = 851004;
    var token = await AccessChecks.TokenAsync(stand.Client, maxUserId);

    // AC-051c. Признаки заданы разными значениями нарочно: на двух истинах
    // перепутанные местами поля прошли бы проверку.
    var response = await Send(
        token,
        "carrier",
        CompanyName,
        ValidInn,
        registeredInAisOssig: true,
        phone: ValidPhone,
        hasTransportLicense: true,
        hasSanitaryConclusion: false);

    (await ReferenceChecks.SuccessAsync(
        response, "createSubscriptionRequest", HttpStatusCode.Created)).Dispose();

    using var profile = await AccessChecks.ProfileAsync(stand.Client, token);
    var body = profile.RootElement;

    // Телефон возвращается тем же, каким принят: приведение записи на стороне
    // сервиса сделало бы образец договора неправдой.
    Assert.Equal(ValidPhone, body.GetProperty("phone").GetString());
    Assert.True(body.GetProperty("hasTransportLicense").GetBoolean(), "профиль не назвал признак лицензии");
    Assert.False(
        body.GetProperty("hasSanitaryConclusion").GetBoolean(),
        "профиль назвал заключение, которого заявка не заявляла");
  }

  [Fact(DisplayName = "телефон не по образцу отвергается, а заявка без телефона принимается")]
  public async Task MalformedPhoneIsRefusedWhileARequestWithoutOneIsAccepted()
  {
    const long maxUserId = 851005;
    var token = await AccessChecks.TokenAsync(stand.Client, maxUserId);

    // AC-051d, первая половина: 400, как и промах по образцу ИНН, — нарушена
    // форма запроса, а не правило предметной области.
    var refused = await Send(
        token, "carrier", CompanyName, ValidInn, registeredInAisOssig: false, phone: MalformedPhone);

    (await ReferenceChecks.ProblemAsync(
        refused, HttpStatusCode.BadRequest, "urn:imolt:problem:validation")).Dispose();

    // Вторая половина: без телефона заявка проходит. Участник пришёл из
    // мессенджера, и обратный канал у менеджера есть и без номера.
    var accepted = await Send(token, "carrier", CompanyName, ValidInn, registeredInAisOssig: false);

    (await ReferenceChecks.SuccessAsync(
        accepted, "createSubscriptionRequest", HttpStatusCode.Created)).Dispose();

    using var profile = await AccessChecks.ProfileAsync(stand.Client, token);

    // Неназванный телефон остаётся неназванным: пустая строка вместо пустоты
    // читалась бы как «телефон есть, но пустой».
    var phone = profile.RootElement.TryGetProperty("phone", out var value) ? value : default;
    Assert.True(
        phone.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null,
        $"профиль назвал телефон «{phone}», которого заявка не подавала");
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
      bool registeredInAisOssig,
      string? phone = null,
      bool? hasTransportLicense = null,
      bool? hasSanitaryConclusion = null)
  {
    // Необъявленное поле в тело не попадает вовсе: схема запрещает лишние
    // свойства, а «null» у необязательного поля — не то же, что его
    // отсутствие, и критерий AC-051d проверяет именно отсутствие.
    var fields = new List<string>
    {
      Field("role", Text(role)),
      Field("companyName", Text(companyName)),
      Field("inn", Text(inn)),
      Field("registeredInAisOssig", Flag(registeredInAisOssig)),
    };

    if (phone is not null)
    {
      fields.Add(Field("phone", Text(phone)));
    }

    if (hasTransportLicense is not null)
    {
      fields.Add(Field("hasTransportLicense", Flag(hasTransportLicense.Value)));
    }

    if (hasSanitaryConclusion is not null)
    {
      fields.Add(Field("hasSanitaryConclusion", Flag(hasSanitaryConclusion.Value)));
    }

    return AccessChecks.PostJsonAsync(
        stand.Client,
        AccessChecks.SubscriptionRequestsPath,
        "{" + string.Join(",", fields) + "}",
        token);
  }

  private static string Field(string name, string value) => Text(name) + ":" + value;

  private static string Text(string value) => JsonSerializer.Serialize(value);

  private static string Flag(bool value) => value ? "true" : "false";
}
