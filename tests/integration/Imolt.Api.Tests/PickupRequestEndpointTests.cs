using System.Net;
using Xunit;

namespace Imolt.Api.Tests;

/// Заявка на вывоз из результатов расчёта (R-053, R-054). Сейчас форма на
/// сайте пишет заявку только в консоль браузера (риск AR-008), и эта точка
/// закрывает разрыв: заявка попадает в хранилище и доходит до менеджера.
///
/// Согласие на обработку персональных данных проверяется сервером, а не
/// флажком в интерфейсе: флажок обходится запросом мимо формы, а
/// персональные данные при этом остаются персональными.
///
/// Отказ проверяется не только кодом ответа: отказ с кодом 422 и отказ с
/// кодом 422 и уже созданной записью выглядят для клиента одинаково.
/// Записи считаются по имени обратившегося — оно у каждой проверки своё, и
/// счёт не зависит от порядка запуска соседних проверок.
///
/// Проверка фальсифицируема: она падает, если принятая заявка перестанет
/// возвращать состояние или сообщение о дальнейшем ходе, если телефон
/// не по образцу договора будет принят или отвергнут другим кодом, если
/// заявка без согласия будет создана и если отказ оставит запись в хранилище.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-053a, AC-053b, AC-054a
[Collection(ImoltDealsCollection.Name)]
public sealed class PickupRequestEndpointTests(ImoltDealsStand stand)
{
  /// Телефон по образцу договора (схема PickupRequestInput, `^\+7[0-9]{10}$`).
  private const string ValidPhone = "+79161234567";

  /// Телефон, не отвечающий образцу: и запись неполная, и знака «плюс» нет.
  private const string MalformedPhone = "8916123";

  [Fact(DisplayName = "заявка с именем, телефоном и полигоном принимается")]
  public async Task PickupRequestWithNamePhoneAndLandfillIsAccepted()
  {
    var calculationId = await DealChecks.CreateSelectedCalculationAsync(
        stand.Client, ImoltDealsStand.VostokId);

    var response = await Send(calculationId, "Иван", ValidPhone, consent: true);
    using var accepted = await ReferenceChecks.SuccessAsync(
        response, "createPickupRequest", HttpStatusCode.Created);

    // AC-053a: состояние названо перечнем договора, а не текстом. Интерфейс
    // ветвится по нему, а не по сообщению.
    Assert.Equal("accepted", accepted.RootElement.GetProperty("state").GetString());

    // Ответ называет, что будет дальше: без этого клиент не знает, ждать ли
    // звонка и сколько.
    Assert.True(
        accepted.RootElement.TryGetProperty("message", out var message)
            && !string.IsNullOrWhiteSpace(message.GetString()),
        "заявка принята молча: клиенту не сказано, что произойдёт дальше");

    // Заявка дошла до хранилища, а не осталась ответом. Именно этого разрыва
    // касается риск AR-008.
    Assert.Equal(1L, await CountByNameAsync("Иван"));
  }

  [Fact(DisplayName = "телефон не по образцу договора отвергается")]
  public async Task PhoneOutsideTheContractPatternIsRefused()
  {
    var calculationId = await DealChecks.CreateSelectedCalculationAsync(
        stand.Client, ImoltDealsStand.VostokId);
    const string contactName = "Отказ по образцу телефона";

    var response = await Send(calculationId, contactName, MalformedPhone, consent: true);

    // AC-053b: 400, а не 422 — нарушен образец поля, то есть форма запроса.
    // Правило предметной области при этом не рассматривалось.
    await ReferenceChecks.ProblemAsync(
        response, HttpStatusCode.BadRequest, "urn:imolt:problem:validation");

    Assert.Equal(0L, await CountByNameAsync(contactName));
  }

  [Fact(DisplayName = "без согласия на обработку персональных данных заявки нет")]
  public async Task WithoutPersonalDataConsentNoRequestIsCreated()
  {
    var calculationId = await DealChecks.CreateSelectedCalculationAsync(
        stand.Client, ImoltDealsStand.VostokId);
    const string contactName = "Отказ без согласия";

    var response = await Send(calculationId, contactName, ValidPhone, consent: false);

    // AC-054a: 422, а не 400 — запрос разобран и по форме верен, но правило
    // R-054 запрещает принимать по нему персональные данные.
    using var problem = await ReferenceChecks.ProblemAsync(
        response, HttpStatusCode.UnprocessableContent, "urn:imolt:problem:validation");

    // Причиной названо именно отсутствие согласия: общий «запрос не прошёл
    // проверку» не подсказывает, какой флажок не отмечен.
    var detail = problem.RootElement.TryGetProperty("detail", out var value) ? value.GetString() : null;
    Assert.True(
        detail is not null && detail.Contains("соглас", StringComparison.OrdinalIgnoreCase),
        $"отказ не назвал причиной отсутствие согласия: {detail ?? "причина не указана"}");

    // Заявка в хранилище не создана. Проверка обязательна: сохранить
    // персональные данные и отказать — худший из исходов, и снаружи он от
    // честного отказа неотличим.
    Assert.Equal(0L, await CountByNameAsync(contactName));
  }

  private Task<HttpResponseMessage> Send(
      string calculationId,
      string contactName,
      string phone,
      bool consent)
      => CalculationChecks.PostJsonAsync(
          stand.Client,
          DealChecks.PickupRequestsPath,
          $$"""
            {
              "calculationId": "{{calculationId}}",
              "landfillId": "{{ImoltDealsStand.VostokId}}",
              "contactName": "{{contactName}}",
              "phone": "{{phone}}",
              "personalDataConsent": {{(consent ? "true" : "false")}}
            }
            """);

  private Task<long> CountByNameAsync(string contactName) => stand.CountAsync(
      "select count(*) from pickup_request where contact_name = @contactName",
      ("contactName", contactName));
}
