using System.Net;
using System.Text.Json;
using Imolt.Shared;
using Xunit;

namespace Imolt.Api.Tests;

/// Создание расчёта: стоимость перевозки, стоимость утилизации, их сумма и
/// плечо перевозки по каждому полигону (R-017 — R-020).
///
/// Числа сверяются с каноническим примером договора
/// (src/back/Imolt.Api/contracts/openapi.yaml, components/examples/
/// ConcreteCalculation), а не с реализацией: 20 тонн лома бетона по 12,00 ₽
/// за тонна-километр дают 10 800,00 ₽ перевозки до «Востока» (45 км) и
/// 12 480,00 ₽ до «Икши» (52 км); тарифы 450,00 и 380,00 ₽ за тонну дают
/// 9 000,00 ₽ и 7 600,00 ₽ утилизации; итоги — 19 800,00 ₽ и 20 080,00 ₽.
///
/// Предел расстояния в запросах задан явно (60 км) и шире значения по
/// умолчанию. Причина: «Икша» стоит в 52 км, а предел по умолчанию — 50 км
/// (R-025, R-026), и на умолчании она не попала бы в ответ, хотя AC-018c и
/// AC-020a требуют оба полигона. Сам пример договора показывает эту же
/// несостыковку — фильтр «до 50 км» рядом с «Икшей» в 52 км, — и она названа
/// в отчёте, а не сглажена подбором запроса.
///
/// Проверка фальсифицируема: она падает, если точка расчёта не заведена, если
/// перевозка перестанет зависеть от плеча или от цены группы, если утилизация
/// возьмёт цену перевозки вместо тарифа полигона, если итог разойдётся с
/// суммой названных составляющих, если плечо подменится расстоянием по прямой
/// и если расчёт без сохранённого плеча ответит успехом вместо отказа.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-018a, AC-018b, AC-018c, AC-019a, AC-020a, AC-020b
/// @supports: R-017, R-018, R-019, R-020
[Collection(ImoltCalculationsCollection.Name)]
public sealed class CalculationFormulaEndpointTests(ImoltCalculationsStand stand)
{
  private const string CalculationsPath = "/v1/calculations";

  private const string ConcreteGroupId = "beton-lom";

  private const string VostokId = "vostok-timohovo";

  private const string IkshaId = "iksha";

  /// Предел расстояния запроса: шире, чем плечо «Икши» (52 км), и шире
  /// значения по умолчанию (50 км).
  private const int WideDistanceKm = 60;

  [Fact(DisplayName = "стоимость перевозки складывается из цены группы и плеча перевозки")]
  public async Task CreatedCalculationCarriesTransportCostFromGroupPriceAndRoadDistance()
  {
    using var document = await ConcreteCalculationAsync();
    var option = CalculationChecks.Option(
        CalculationChecks.OptionsOf(document.RootElement, ConcreteGroupId), VostokId);

    // AC-018a: 20 т x 12,00 ₽ за тонна-километр x 45 км.
    Assert.Equal("10800.00", CalculationChecks.Amount(option.GetProperty("transportCost")));
  }

  [Fact(DisplayName = "стоимость утилизации складывается из тарифа полигона по группе")]
  public async Task CreatedCalculationCarriesDisposalCostFromLandfillTariff()
  {
    using var document = await ConcreteCalculationAsync();
    var option = CalculationChecks.Option(
        CalculationChecks.OptionsOf(document.RootElement, ConcreteGroupId), VostokId);

    // AC-018b: 20 т x 450,00 ₽ за тонну.
    Assert.Equal("9000.00", CalculationChecks.Amount(option.GetProperty("disposalCost")));
  }

  [Fact(DisplayName = "совокупная цена сходится с примером договора по обоим полигонам")]
  public async Task CreatedCalculationTotalsMatchTheContractExampleForBothLandfills()
  {
    using var document = await ConcreteCalculationAsync();
    var options = CalculationChecks.OptionsOf(document.RootElement, ConcreteGroupId);

    // AC-018c. Второй полигон обязателен: на одном ближний тариф и ближнее
    // плечо неотличимы от жёстко записанного результата.
    Assert.Equal("19800.00", CalculationChecks.Amount(
        CalculationChecks.Option(options, VostokId).GetProperty("totalCost")));

    var iksha = CalculationChecks.Option(options, IkshaId);
    Assert.Equal("12480.00", CalculationChecks.Amount(iksha.GetProperty("transportCost")));
    Assert.Equal("7600.00", CalculationChecks.Amount(iksha.GetProperty("disposalCost")));
    Assert.Equal("20080.00", CalculationChecks.Amount(iksha.GetProperty("totalCost")));
  }

  [Fact(DisplayName = "у каждого варианта размещения перевозка и утилизация названы раздельно")]
  public async Task EveryPlacementOptionNamesTransportDisposalAndTheirSum()
  {
    using var document = await ConcreteCalculationAsync();
    var options = CalculationChecks.OptionsOf(document.RootElement, ConcreteGroupId);

    var items = options.GetProperty("items").EnumerateArray().ToArray();
    Assert.True(
        items.Length >= 2,
        $"вариантов размещения {items.Length}: на одной строке раздельность составляющих не наблюдается");

    foreach (var option in items)
    {
      // AC-019a: итог обязан сходиться именно с названными составляющими.
      // Совпадение итога с ожидаемым числом при разошедшихся составляющих —
      // та же ошибка, только незаметная.
      var transport = CalculationChecks.AmountValue(option.GetProperty("transportCost"));
      var disposal = CalculationChecks.AmountValue(option.GetProperty("disposalCost"));
      var total = CalculationChecks.AmountValue(option.GetProperty("totalCost"));

      Assert.Equal(transport + disposal, total);
    }
  }

  [Fact(DisplayName = "плечо перевозки берётся из сохранённого расстояния по дорожной сети")]
  public async Task RoadDistanceComesFromStoredLegsNotFromStraightLine()
  {
    using var document = await ConcreteCalculationAsync();
    var options = CalculationChecks.OptionsOf(document.RootElement, ConcreteGroupId);

    // AC-020a: 45 и 52 км — сохранённые плечи по дорожной сети. По прямой от
    // Годовикова, 9 до Тимохова около 42 км, до Икши — около 39: расстояние по
    // прямой занижает результат и в расчёт не кладётся (R-020).
    Assert.Equal(45, CalculationChecks.Option(options, VostokId).GetProperty("distanceKm").GetDouble(), 3);
    Assert.Equal(52, CalculationChecks.Option(options, IkshaId).GetProperty("distanceKm").GetDouble(), 3);
  }

  [Fact(DisplayName = "без сохранённого плеча расчёт отказывает, а не считает по прямой")]
  public async Task CalculationRefusesWhenNoRoadDistanceIsStored()
  {
    var response = await CalculationChecks.PostJsonAsync(
        stand.Client,
        CalculationsPath,
        CalculationChecks.CalculationRequestJson(
            CalculationChecks.ItemJson(ConcreteGroupId, 20, "t"),
            ImoltCalculationsStand.AddressWithoutStoredLegValue,
            ImoltCalculationsStand.AddressWithoutStoredLegLatitude,
            ImoltCalculationsStand.AddressWithoutStoredLegLongitude,
            distanceKm: WideDistanceKm));

    // AC-020b: заниженная цена хуже отказа — по ней заключают сделку. Адрес
    // при этом в зоне обслуживания и есть в справочнике, поэтому 422
    // «вне зоны обслуживания» здесь был бы подменой причины.
    using var document = await ReferenceChecks.ProblemAsync(
        response, HttpStatusCode.ServiceUnavailable, Problems.DistanceServiceUnavailable);

    var detail = document.RootElement.TryGetProperty("detail", out var value) ? value.GetString() : null;
    Assert.False(
        string.IsNullOrWhiteSpace(detail),
        "отказ не называет причину: по такому ответу пользователь не поймёт, повторять ли попытку");
  }

  private async Task<JsonDocument> ConcreteCalculationAsync()
  {
    var response = await CalculationChecks.PostJsonAsync(
        stand.Client,
        CalculationsPath,
        CalculationChecks.CalculationRequestJson(
            CalculationChecks.ItemJson(ConcreteGroupId, 20, "t"),
            ImoltCalculationsStand.PickupValue,
            ImoltCalculationsStand.PickupLatitude,
            ImoltCalculationsStand.PickupLongitude,
            distanceKm: WideDistanceKm));

    return await CalculationChecks.CreatedAsync(response, "createCalculation");
  }
}
