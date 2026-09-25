using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Сводка маршрута по выбранным полигонам (R-032, R-034, R-050, R-057).
/// Решением команды от 25.09.2026 доступ в версии 1 не разграничивается:
/// маршрут открыт всем, а поле access остаётся формой разграничения, которая
/// переживёт решение и включится настройкой, когда заказчик назовёт тарифы.
///
/// Проверка фальсифицируема: она падает, если маршрут снова закроется, если
/// выданный доступ начнёт называть причину отказа, если участок пропадёт хотя
/// бы у одного выбранного полигона, если плечо перестанет совпадать с
/// сохранённым, если участок перестанет называть время в пути или переход во
/// внешние карты, если в обременениях появится значение при неназванном
/// источнике и если итог сводки разойдётся с итогом операции выбора.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-050a, AC-032b, AC-032d
[Collection(ImoltDealsCollection.Name)]
public sealed class CalculationRouteEndpointTests(ImoltDealsStand stand)
{
  [Fact(DisplayName = "маршрут открыт без входа и называет каждый выбранный полигон")]
  public async Task RouteIsOpenWithoutSignInAndNamesEverySelectedLandfill()
  {
    var calculationId = await DealChecks.CreateSelectedCalculationAsync(
        stand.Client, ImoltDealsStand.VostokId, ImoltDealsStand.IkshaId);

    var response = await stand.Client.GetAsync($"{DealChecks.CalculationsPath}/{calculationId}/route");
    using var route = await ReferenceChecks.OkAsync(response, "getCalculationRoute");

    // AC-050a: решением команды от 25.09.2026 доступ в версии 1 не
    // разграничивается. Поле access осталось — форма разграничения переживёт
    // решение, — но признак выдан, а причина отказа не называется.
    var access = route.RootElement.GetProperty("access");
    Assert.True(
        access.GetProperty("granted").GetBoolean(),
        "маршрут закрыт, хотя решением по Q-011 в версии 1 он открыт всем");
    Assert.True(
        !access.TryGetProperty("reason", out var reason) || reason.ValueKind == JsonValueKind.Null,
        "выданный доступ не вправе называть причину отказа");

    // Участок на каждый выбранный полигон, и это не совпадение по числу:
    // сверяются сами идентификаторы.
    var landfills = route.RootElement.GetProperty("legs").EnumerateArray()
        .Select(leg => leg.GetProperty("landfillId").GetString())
        .ToList();

    Assert.Equal(
        new[] { ImoltDealsStand.VostokId, ImoltDealsStand.IkshaId }.Order(),
        landfills.Order());

    // Итог назван вместе с участками: сводка отвечает и на вопрос «сколько
    // это стоит», а не только «как туда доехать».
    Assert.Equal(
        ImoltDealsStand.SelectionTotalAmount,
        CalculationChecks.Amount(route.RootElement.GetProperty("total")));
  }

  [Fact(DisplayName = "участок маршрута называет плечо, время в пути и переход во внешние карты")]
  public async Task RouteLegNamesDistanceDurationAndExternalMap()
  {
    var calculationId = await DealChecks.CreateSelectedCalculationAsync(
        stand.Client, ImoltDealsStand.VostokId);

    var response = await stand.Client.GetAsync($"{DealChecks.CalculationsPath}/{calculationId}/route");
    using var route = await ReferenceChecks.OkAsync(response, "getCalculationRoute");

    var leg = Assert.Single(route.RootElement.GetProperty("legs").EnumerateArray());

    // AC-032d: плечо — то самое, по которому посчитана перевозка. Число взято
    // из начального набора (45 км до «Востока»), а не из ответа самой службы:
    // сверка ответа с собой прошла бы и при нуле.
    Assert.Equal(ImoltDealsStand.VostokDistanceKm, leg.GetProperty("distanceKm").GetDouble());

    // Время в пути приходит из сохранённого плеча. Ноль здесь означал бы
    // мгновенную доставку, а пустое значение — что время неизвестно; ни то,
    // ни другое для плеча начального набора не верно.
    var duration = leg.GetProperty("durationMinutes");
    Assert.True(
        duration.ValueKind == JsonValueKind.Number && duration.GetInt32() > 0,
        "участок не назвал времени в пути, хотя оно сохранено вместе с плечом");

    // Переход во внешние карты: правило сборки ссылки проверено модульно
    // (AC-034a), здесь проверяется, что она вообще доходит до ответа.
    var external = leg.GetProperty("externalMapUrl").GetString();
    Assert.False(string.IsNullOrWhiteSpace(external), "участок не назвал перехода во внешние карты");
    Assert.StartsWith("https://", external, StringComparison.Ordinal);

    // Обременения пусты: источник не назван решением по Q-003, и пустота
    // здесь — принятое решение, а не забытое поле.
    Assert.Empty(leg.GetProperty("encumbrances").EnumerateArray());
  }

  [Fact(DisplayName = "итог сводки маршрута совпадает с итогом выбора")]
  public async Task RouteTotalMatchesTheTotalReturnedBySelection()
  {
    var calculationId = await DealChecks.CreateCalculationAsync(stand.Client);

    string selectionTotal;
    using (var selection = await DealChecks.SelectAsync(
        stand.Client, calculationId, ImoltDealsStand.VostokId, ImoltDealsStand.IkshaId))
    {
      selectionTotal = CalculationChecks.Amount(selection.RootElement.GetProperty("total"));
    }

    var response = await stand.Client.GetAsync($"{DealChecks.CalculationsPath}/{calculationId}/route");
    using var route = await ReferenceChecks.OkAsync(response, "getCalculationRoute");

    // AC-032b: сравниваются два ответа службы, а не ответ и записанное число.
    // Жёсткое число рядом — страховка от совпадения двух одинаково неверных
    // итогов: 19 800,00 + 20 080,00 = 39 880,00 ₽ (пример ответа
    // setCalculationSelection в договоре).
    Assert.Equal(ImoltDealsStand.SelectionTotalAmount, selectionTotal);
    Assert.Equal(selectionTotal, CalculationChecks.Amount(route.RootElement.GetProperty("total")));
  }
}
