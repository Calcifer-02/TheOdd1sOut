using System.Net;
using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Ручной статус полигона. Правило сопоставления сообщений канала с
/// полигонами заказчиком не описано (Q-002), а служба сбора в состав версии 1
/// не входит (ADR-0002): ручной ввод — объявленный запасной путь, и он
/// проверяется как основной.
///
/// Поставленный вручную статус обязан назвать свой источник: пользователь,
/// решающий, ехать ли на полигон, различает «так сказал канал» и «так сказал
/// менеджер данных». Перечень состояний закрыт тремя значениями — «активен»,
/// «заблокирован», «не подтверждён»; четвёртое означало бы, что интерфейс
/// ветвится по значению, которого не знает.
///
/// Проверка фальсифицируема: она падает, если ручная постановка не доходит до
/// справочника, если источник статуса остаётся прежним, если дата
/// актуальности статуса не двигается, если основание теряется, если статус
/// вне перечня принимается или отвергается уже после записи и если вручную
/// заблокированный полигон выпадает из отбора по статусу.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-044a, AC-044b, AC-044c
[Collection(ImoltReferenceEditorCollection.Name)]
public sealed class LandfillStatusEditorTests(ImoltReferenceEditorStand stand)
{
  /// Основание ручного изменения из примера договора.
  private const string Reason = "подтверждено по телефону";

  [Fact(DisplayName = "менеджер данных блокирует полигон вручную с основанием")]
  public async Task ManagerBlocksLandfillManually()
  {
    var token = await stand.DataManagerTokenAsync();

    // Предусловие критерия: полигон начинает активным. Без этого чтения
    // проверку прошла бы служба, которая не меняет статус вовсе.
    using var before = await CardAsync(ImoltReferenceEditorStand.ManualStatusLandfillId);
    Assert.Equal("active", before.RootElement.GetProperty("status").GetString());

    var response = await stand.SendJsonAsync(
        HttpMethod.Put,
        StatusPath(ImoltReferenceEditorStand.ManualStatusLandfillId),
        StatusJson("blocked", Reason),
        token);

    using var state = await ReferenceChecks.OkAsync(response, "setLandfillStatus");
    var body = state.RootElement;

    Assert.Equal(ImoltReferenceEditorStand.ManualStatusLandfillId, body.GetProperty("landfillId").GetString());
    Assert.Equal("blocked", body.GetProperty("status").GetString());

    // Источник «manual» отличает ручную постановку от сообщения канала и от
    // официального перечня: по нему интерфейс объясняет, откуда статус.
    Assert.Equal("manual", body.GetProperty("source").GetString());
    Assert.Equal(stand.EditDate, body.GetProperty("statusUpdatedAt").GetString());
    Assert.Equal(Reason, body.GetProperty("reason").GetString());

    // Карточка полигона — второе чтение: ответ операции мог вернуть
    // присланное, не записав его в справочник.
    using var after = await CardAsync(ImoltReferenceEditorStand.ManualStatusLandfillId);
    Assert.Equal("blocked", after.RootElement.GetProperty("status").GetString());
    Assert.Equal(stand.EditDate, after.RootElement.GetProperty("statusUpdatedAt").GetString());
  }

  [Fact(DisplayName = "статус вне объявленного перечня отвергается и справочник не трогает")]
  public async Task StatusOutsideTheDeclaredVocabularyIsRefused()
  {
    var token = await stand.DataManagerTokenAsync();

    var response = await stand.SendJsonAsync(
        HttpMethod.Put,
        StatusPath(ImoltReferenceEditorStand.StatusVocabularyLandfillId),
        StatusJson("приостановлен", Reason),
        token);

    var body = await response.Content.ReadAsStringAsync();

    // Код причины здесь не закрепляется: критерий его не называет, а договор
    // у операции setLandfillStatus ответа 400 не объявляет вовсе.
    // Расхождение названо в отчёте среза; проверка держится того, что
    // критерий утверждает прямо, — кода состояния и документа об ошибке.
    Assert.True(
        response.StatusCode == HttpStatusCode.BadRequest,
        $"статус вне перечня принят кодом {(int)response.StatusCode}: {body}");
    Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

    using var problem = JsonDocument.Parse(body);
    Assert.True(
        problem.RootElement.TryGetProperty("type", out _),
        $"отказ пришёл без кода причины: интерфейсу не по чему ветвиться — {body}");

    // Статус не изменился. Отказ, после которого значение всё же записано, —
    // худший исход: снаружи он неотличим от честного.
    using var card = await CardAsync(ImoltReferenceEditorStand.StatusVocabularyLandfillId);
    Assert.Equal("active", card.RootElement.GetProperty("status").GetString());
    Assert.Equal(ImoltReferenceEditorStand.SeedDate, card.RootElement.GetProperty("statusUpdatedAt").GetString());
  }

  [Fact(DisplayName = "вручную заблокированный полигон виден отбору реестра по статусу")]
  public async Task ManuallyBlockedLandfillIsVisibleToTheStatusFilter()
  {
    var token = await stand.DataManagerTokenAsync();

    var response = await stand.SendJsonAsync(
        HttpMethod.Put,
        StatusPath(ImoltReferenceEditorStand.StatusFilterLandfillId),
        StatusJson("blocked", Reason),
        token);

    using var state = await ReferenceChecks.OkAsync(response, "setLandfillStatus");
    Assert.Equal("blocked", state.RootElement.GetProperty("status").GetString());

    // Предел страницы задаётся явно: по умолчанию реестр отдаёт десять
    // записей, и полигон мог бы не попасть в ответ по причине, к отбору
    // отношения не имеющей.
    var blocked = await stand.GetAsync($"{ImoltReferenceEditorStand.LandfillsPath}?status=blocked&limit=100");
    using var page = await ReferenceChecks.OkAsync(blocked, "listLandfills");

    var found = page.RootElement
        .GetProperty("items")
        .EnumerateArray()
        .Where(item => item.GetProperty("id").GetString() == ImoltReferenceEditorStand.StatusFilterLandfillId)
        .ToList();

    Assert.True(
        found.Count == 1,
        "вручную заблокированный полигон не найден отбором по статусу «заблокирован»: "
            + string.Join(", ", ReferenceChecks.Ids(page.RootElement)));
    Assert.Equal(stand.EditDate, found[0].GetProperty("statusUpdatedAt").GetString());

    // Обратный отбор. Без него проверку прошла бы служба, которая отдаёт
    // весь реестр независимо от запрошенного статуса.
    var active = await stand.GetAsync($"{ImoltReferenceEditorStand.LandfillsPath}?status=active&limit=100");
    using var activePage = await ReferenceChecks.OkAsync(active, "listLandfills");

    Assert.DoesNotContain(
        ImoltReferenceEditorStand.StatusFilterLandfillId,
        ReferenceChecks.Ids(activePage.RootElement));
  }

  private static string StatusPath(string landfillId)
      => $"{ImoltReferenceEditorStand.LandfillsPath}/{landfillId}/status";

  private static string StatusJson(string status, string reason)
      => $$"""{ "status": "{{status}}", "reason": "{{reason}}" }""";

  private async Task<JsonDocument> CardAsync(string landfillId)
  {
    var response = await stand.GetAsync($"{ImoltReferenceEditorStand.LandfillsPath}/{landfillId}");

    return await ReferenceChecks.OkAsync(response, "getLandfill");
  }
}
