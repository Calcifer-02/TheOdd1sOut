using Xunit;

namespace Imolt.Api.Tests;

/// Сводка маршрута по выбранным полигонам (R-032, R-050, R-057). Гостю детали
/// маршрута закрыты, но итог назван: что именно закрыто подпиской, заказчиком
/// не решено (Q-011), поэтому договор объявляет форму разграничения — поле
/// access, — а не политику. Личности пользователя в службе пока нет вовсе, и
/// всякое обращение к маршруту идёт от гостя.
///
/// Проверка фальсифицируема: она падает, если точка маршрута начнёт отдавать
/// гостю участки вместо замка, если признак доступа станет истинным или
/// причина перестанет называться подпиской, если отказ придёт кодом вместо
/// ответа с названным итогом и если итог сводки маршрута разойдётся с итогом,
/// который вернула операция выбора.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-050a, AC-032b
[Collection(ImoltDealsCollection.Name)]
public sealed class CalculationRouteEndpointTests(ImoltDealsStand stand)
{
  /// Причина закрытия деталей, объявленная схемой Access договора.
  private const string SubscriptionRequired = "subscriptionRequired";

  [Fact(DisplayName = "гостю детали маршрута закрыты, но итог назван")]
  public async Task GuestGetsLockedRouteDetailsWithTheTotalStillNamed()
  {
    var calculationId = await DealChecks.CreateSelectedCalculationAsync(
        stand.Client, ImoltDealsStand.VostokId, ImoltDealsStand.IkshaId);

    var response = await stand.Client.GetAsync($"{DealChecks.CalculationsPath}/{calculationId}/route");
    using var route = await ReferenceChecks.OkAsync(response, "getCalculationRoute");

    // AC-050a: именно 200 с полем access, а не 403. Замок — это содержимое
    // ответа, по которому интерфейс показывает предложение подписки; отказ
    // кодом оставил бы страницу без итога, который гостю виден и сейчас.
    var access = route.RootElement.GetProperty("access");
    Assert.False(
        access.GetProperty("granted").GetBoolean(),
        "гостю выданы детали маршрута, хотя личности пользователя в службе нет");
    Assert.Equal(SubscriptionRequired, access.GetProperty("reason").GetString());

    // Участки пусты, а не заполнены расстояниями «на всякий случай»: закрытое
    // содержимое подменять нечем.
    Assert.Empty(route.RootElement.GetProperty("legs").EnumerateArray());

    // Итог назван вопреки замку — это и отличает разграничение деталей от
    // отказа в обслуживании.
    Assert.Equal(
        ImoltDealsStand.SelectionTotalAmount,
        CalculationChecks.Amount(route.RootElement.GetProperty("total")));
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
