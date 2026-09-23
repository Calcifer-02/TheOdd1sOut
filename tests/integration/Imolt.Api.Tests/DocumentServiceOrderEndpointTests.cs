using System.Net;
using Xunit;

namespace Imolt.Api.Tests;

/// Заказ услуги по документации участником с сессией (R-009, R-052, R-054).
/// Каталог услуг уже отвечает, заказ — нет: требование неатомарно, и здесь
/// проверяется вторая половина.
///
/// Согласие на обработку персональных данных проверяется сервером, а не
/// флажком в интерфейсе: флажок обходится запросом мимо формы, а адрес объекта
/// сноса при этом остаётся персональными данными.
///
/// Отказ проверяется не только кодом ответа: отказ с кодом 422 и отказ с
/// кодом 422 и уже созданным заказом выглядят для клиента одинаково. Заказы
/// считаются по адресу объекта — он у каждой проверки свой, и счёт не зависит
/// от порядка запуска соседних проверок.
///
/// Проверка фальсифицируема: она падает, если принятый заказ перестанет
/// возвращать состояние перечнем договора, если заказ без согласия будет
/// создан или отвергнут другим кодом и если отказ оставит запись в хранилище.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-052b, AC-054c
[Collection(ImoltAccessCollection.Name)]
public sealed class DocumentServiceOrderEndpointTests(ImoltAccessStand stand)
{
  [Fact(DisplayName = "услуга по документации заказывается участником с сессией")]
  public async Task DocumentServiceIsOrderedByParticipantWithSession()
  {
    const long maxUserId = 852001;
    const string objectAddress = "г Москва, ул Годовикова, д 9";

    var token = await AccessChecks.TokenAsync(stand.Client, maxUserId);

    var response = await Send(token, objectAddress, personalDataConsent: true);
    using var accepted = await ReferenceChecks.SuccessAsync(
        response, "createDocumentServiceOrder", HttpStatusCode.Created);

    // AC-052b: состояние названо перечнем договора, а не текстом. Интерфейс
    // ветвится по нему, а не по сообщению.
    Assert.Equal("accepted", accepted.RootElement.GetProperty("state").GetString());
    Assert.Equal(
        ImoltAccessStand.PricedServiceId,
        accepted.RootElement.GetProperty("serviceId").GetString());

    // Заказ дошёл до хранилища, а не остался ответом: менеджеру нечего было бы
    // обрабатывать.
    Assert.Equal(1L, await CountByAddressAsync(objectAddress));
  }

  [Fact(DisplayName = "заказ услуги без согласия на обработку персональных данных не создаётся")]
  public async Task WithoutPersonalDataConsentNoOrderIsCreated()
  {
    const long maxUserId = 852002;
    const string objectAddress = "г Москва, ул Годовикова, д 11";

    var token = await AccessChecks.TokenAsync(stand.Client, maxUserId);

    var response = await Send(token, objectAddress, personalDataConsent: false);

    // AC-054c: 422, а не 400 — запрос разобран и по форме верен, но правило
    // R-054 запрещает принимать по нему персональные данные.
    using var problem = await ReferenceChecks.ProblemAsync(
        response, HttpStatusCode.UnprocessableContent, "urn:imolt:problem:validation");

    // Причиной названо именно отсутствие согласия: общий «запрос не прошёл
    // проверку» не подсказывает, какой флажок не отмечен.
    var detail = problem.RootElement.TryGetProperty("detail", out var value) ? value.GetString() : null;
    Assert.True(
        detail is not null && detail.Contains("соглас", StringComparison.OrdinalIgnoreCase),
        $"отказ не назвал причиной отсутствие согласия: {detail ?? "причина не указана"}");

    // Заказ в хранилище не создан. Сохранить персональные данные и отказать —
    // худший из исходов, и снаружи он от честного отказа неотличим.
    Assert.Equal(0L, await CountByAddressAsync(objectAddress));
  }

  private Task<HttpResponseMessage> Send(string token, string objectAddress, bool personalDataConsent)
      => AccessChecks.PostJsonAsync(
          stand.Client,
          AccessChecks.DocumentServiceOrdersPath,
          $$"""
            {
              "serviceId": "{{ImoltAccessStand.PricedServiceId}}",
              "objectAddress": "{{objectAddress}}",
              "comment": "снос ангара, начало работ 01.10.2026",
              "personalDataConsent": {{(personalDataConsent ? "true" : "false")}}
            }
            """,
          token);

  private Task<long> CountByAddressAsync(string objectAddress) => stand.CountAsync(
      "select count(*) from document_service_order where object_address = @objectAddress",
      ("objectAddress", objectAddress));
}
