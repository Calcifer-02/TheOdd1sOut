using System.Net;
using System.Text.Json;
using Imolt.Shared;
using Xunit;

namespace Imolt.Api.Tests;

/// Распределение объёма группы между выбранными полигонами (R-030, R-032):
/// 20 тонн лома бетона делятся как 12 и 8 тонн, и по каждой части считается
/// своя стоимость.
///
/// Суммы частей выведены из формулы и начального набора: 12 т до «Востока» —
/// 12 x 12,00 x 45 = 6 480,00 ₽ перевозки и 12 x 450,00 = 5 400,00 ₽
/// утилизации, итого 11 880,00 ₽; 8 т до «Икши» — 8 x 12,00 x 52 = 4 992,00 ₽
/// и 8 x 380,00 = 3 040,00 ₽, итого 8 032,00 ₽.
///
/// Проверка фальсифицируема: она падает, если части перестанут считаться по
/// своему объёму (а не по объёму всей группы), если несходящееся
/// распределение будет принято или применится частично и если после отказа
/// расчёт покажет не прежнее распределение.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-030a, AC-030b, AC-058b
[Collection(ImoltCalculationsCollection.Name)]
public sealed class CalculationAllocationEndpointTests(ImoltCalculationsStand stand)
{
  private const string CalculationsPath = "/v1/calculations";

  private const string ConcreteGroupId = "beton-lom";

  private const string VostokId = "vostok-timohovo";

  private const string IkshaId = "iksha";

  private const int WideDistanceKm = 60;

  [Fact(DisplayName = "распределение, сходящееся с объёмом группы, принимается и считается по частям")]
  public async Task AllocationThatMatchesTheGroupVolumeIsPricedPerPart()
  {
    var id = await CalculationIdAsync();

    var response = await AllocateAsync(id, 12, 8);
    using var document = await ReferenceChecks.OkAsync(response, "setCalculationAllocation");

    // AC-030a: у каждой части названы перевозка и совокупная цена. Числа
    // выведены из той же формулы, что и вариант размещения: часть, посчитанная
    // по объёму всей группы, дала бы 10 800,00 ₽ у обеих.
    var vostok = EntryOf(document.RootElement, VostokId);
    Assert.Equal(12, vostok.GetProperty("quantity").GetProperty("value").GetDouble(), 3);
    Assert.Equal("6480.00", CalculationChecks.Amount(vostok.GetProperty("transportCost")));
    Assert.Equal("11880.00", CalculationChecks.Amount(vostok.GetProperty("totalCost")));

    var iksha = EntryOf(document.RootElement, IkshaId);
    Assert.Equal(8, iksha.GetProperty("quantity").GetProperty("value").GetDouble(), 3);
    Assert.Equal("4992.00", CalculationChecks.Amount(iksha.GetProperty("transportCost")));
    Assert.Equal("8032.00", CalculationChecks.Amount(iksha.GetProperty("totalCost")));

    Assert.Equal("19912.00", CalculationChecks.Amount(document.RootElement.GetProperty("total")));
  }

  [Fact(DisplayName = "несходящееся распределение отвергается целиком и не меняет расчёт")]
  public async Task AllocationThatDoesNotAddUpIsRejectedWholesale()
  {
    var id = await CalculationIdAsync();

    var accepted = await AllocateAsync(id, 12, 8);
    Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);

    // 12 + 5 = 17 из 20 тонн группы.
    var response = await AllocateAsync(id, 12, 5);
    using var problem = await ReferenceChecks.ProblemAsync(
        response, HttpStatusCode.UnprocessableContent, Problems.AllocationMismatch);

    var detail = problem.RootElement.TryGetProperty("detail", out var value) ? value.GetString() : null;
    Assert.False(
        string.IsNullOrWhiteSpace(detail),
        "отказ не называет расхождение: по такому ответу непонятно, сколько тонн не разложено");

    // AC-058b: отказ читает пользователь, а не разработчик. Группа названа
    // именем справочника; идентификатор в тексте означал бы, что интерфейсу
    // придётся либо показать его, либо придумать свой текст вместо ответа.
    Assert.Contains("Лом бетона и железобетона", detail);
    Assert.DoesNotContain("beton-lom", detail);

    // AC-030b: «целиком» — значит первая часть тоже не применилась. Код отказа
    // без этой проверки ничего не доказывает: служба могла записать 12 тонн и
    // отвергнуть только вторую строку, и расчёт остался бы наполовину
    // переписанным.
    var reread = await stand.Client.GetAsync($"{CalculationsPath}/{id}");
    using var calculation = await ReferenceChecks.OkAsync(reread, "getCalculation");
    var allocation = calculation.RootElement.GetProperty("allocation");

    Assert.Equal(12, EntryOf(allocation, VostokId).GetProperty("quantity").GetProperty("value").GetDouble(), 3);
    Assert.Equal(8, EntryOf(allocation, IkshaId).GetProperty("quantity").GetProperty("value").GetDouble(), 3);
    Assert.Equal("19912.00", CalculationChecks.Amount(allocation.GetProperty("total")));
  }

  private static JsonElement EntryOf(JsonElement allocation, string landfillId)
  {
    foreach (var entry in allocation.GetProperty("entries").EnumerateArray())
    {
      if (entry.GetProperty("landfillId").GetString() == landfillId)
      {
        return entry;
      }
    }

    Assert.Fail($"в распределении нет части по полигону {landfillId}");
    return default;
  }

  private Task<HttpResponseMessage> AllocateAsync(string calculationId, int vostokTons, int ikshaTons)
      => CalculationChecks.PutJsonAsync(
          stand.Client,
          $"{CalculationsPath}/{calculationId}/allocation",
          $$"""
            {
              "entries": [
                { "wasteGroupId": "{{ConcreteGroupId}}", "landfillId": "{{VostokId}}", "quantity": { "value": {{vostokTons}}, "unit": "t" } },
                { "wasteGroupId": "{{ConcreteGroupId}}", "landfillId": "{{IkshaId}}", "quantity": { "value": {{ikshaTons}}, "unit": "t" } }
              ]
            }
            """);

  private async Task<string> CalculationIdAsync()
  {
    var created = await CalculationChecks.PostJsonAsync(
        stand.Client,
        CalculationsPath,
        CalculationChecks.CalculationRequestJson(
            CalculationChecks.ItemJson(ConcreteGroupId, 20, "t"),
            ImoltCalculationsStand.PickupValue,
            ImoltCalculationsStand.PickupLatitude,
            ImoltCalculationsStand.PickupLongitude,
            distanceKm: WideDistanceKm));

    using var calculation = await CalculationChecks.CreatedAsync(created, "createCalculation");

    return CalculationChecks.IdOf(calculation.RootElement);
  }
}
