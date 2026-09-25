using System.Net;
using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Мера расчёта по зоне адреса вывоза (R-016): по Москве — тонны, по
/// Московской области — кубометры. Решение по Q-009 от 25.09.2026 привязывает
/// меру к адресу вывоза, а не к полигону.
///
/// Ожидаемые величины взяты из начального набора
/// (src/back/Imolt.Database/Migrations/0002_demo_dataset.sql): плотность
/// «beton-lom» — 2,0 т/м³, поэтому 20 тонн — это 10 кубометров. Адрес области
/// оттуда же, и от него сохранены плечи перевозки (0008, 0009).
///
/// Проверки фальсифицируемы: они падают, если мера перестанет зависеть от
/// зоны, если объём в мере расчёта не пересчитается по плотности группы, если
/// зону начнут брать из запроса вместо справочника, если смена меры изменит
/// стоимость и если адрес с неизвестной зоной получит расчёт вместо отказа.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-016a, AC-016b, AC-016c, AC-016d
[Collection(ImoltCalculationsCollection.Name)]
public sealed class CalculationMeasureTests(ImoltCalculationsStand stand)
{
  private const string CalculationsPath = "/v1/calculations";

  private const string ConcreteGroupId = "beton-lom";

  private const string VostokId = "vostok-timohovo";

  /// Предел расстояния запроса: шире плеча от адреса области до «Востока»
  /// (24,525 км) и шире значения по умолчанию.
  private const int WideDistanceKm = 60;

  private const double ConcreteTons = 20;

  /// Те же 20 тонн в кубометрах при плотности 2,0 т/м³.
  private const double ConcreteCubicMeters = 10;

  private const string OutsideServiceArea = "urn:imolt:problem:address-outside-service-area";

  [Fact(DisplayName = "расчёт по московскому адресу ведётся в тоннах")]
  public async Task CalculationFromMoscowPickupIsMeasuredInTons()
  {
    using var document = await CalculatedAsync(
        ImoltCalculationsStand.PickupValue,
        ImoltCalculationsStand.PickupLatitude,
        ImoltCalculationsStand.PickupLongitude,
        ConcreteTons,
        "t");

    // AC-016a: мера названа расчётом, а не выведена клиентом из адреса.
    Assert.Equal("t", document.RootElement.GetProperty("measure").GetString());

    var calculated = ItemOf(document.RootElement).GetProperty("calculated");
    Assert.Equal("t", calculated.GetProperty("unit").GetString());
    Assert.Equal(ConcreteTons, calculated.GetProperty("value").GetDouble(), 4);
  }

  [Fact(DisplayName = "расчёт по адресу области ведётся в кубометрах и пересчитывает введённое")]
  public async Task CalculationFromRegionPickupIsMeasuredInCubicMetersAndConvertsTheInput()
  {
    using var document = await CalculatedAsync(
        ImoltCalculationsStand.RegionPickupValue,
        ImoltCalculationsStand.RegionPickupLatitude,
        ImoltCalculationsStand.RegionPickupLongitude,
        ConcreteTons,
        "t");

    Assert.Equal("m3", document.RootElement.GetProperty("measure").GetString());

    var item = ItemOf(document.RootElement);

    // AC-016b: введённое остаётся собой. Подмена введённого пересчитанной
    // величиной лишила бы пользователя того, что он набрал.
    Assert.Equal(ConcreteTons, item.GetProperty("input").GetProperty("value").GetDouble(), 4);
    Assert.Equal("t", item.GetProperty("input").GetProperty("unit").GetString());

    // 20 т при плотности 2,0 — это 10 м³.
    var calculated = item.GetProperty("calculated");
    Assert.Equal("m3", calculated.GetProperty("unit").GetString());
    Assert.Equal(ConcreteCubicMeters, calculated.GetProperty("value").GetDouble(), 4);

    // Масса не изменилась: стоимость считается по тоннам в обеих зонах
    // (R-018), и мера меняет представление объёма, а не цену.
    Assert.Equal(ConcreteTons, item.GetProperty("tons").GetDouble(), 4);
  }

  [Fact(DisplayName = "смена меры ввода не меняет стоимость по тому же адресу области")]
  public async Task TheSameAmountCostsTheSameWhicheverMeasureItWasEnteredIn()
  {
    using var byTons = await CalculatedAsync(
        ImoltCalculationsStand.RegionPickupValue,
        ImoltCalculationsStand.RegionPickupLatitude,
        ImoltCalculationsStand.RegionPickupLongitude,
        ConcreteTons,
        "t");

    using var byCubicMeters = await CalculatedAsync(
        ImoltCalculationsStand.RegionPickupValue,
        ImoltCalculationsStand.RegionPickupLatitude,
        ImoltCalculationsStand.RegionPickupLongitude,
        ConcreteCubicMeters,
        "m3");

    // AC-016b, вторая половина: те же отходы, тот же адрес, разная мера
    // ввода. Расходящиеся здесь цены означали бы, что мера попала в формулу.
    Assert.Equal(TransportCostOf(byTons), TransportCostOf(byCubicMeters));

    // И объём в мере расчёта один и тот же: он считается от массы, а не от
    // того, в чём объём набрали.
    Assert.Equal(
        ConcreteCubicMeters,
        ItemOf(byCubicMeters.RootElement).GetProperty("calculated").GetProperty("value").GetDouble(),
        4);
  }

  [Fact(DisplayName = "зону адреса называет справочник, а не запрос")]
  public async Task ServiceAreaComesFromTheAddressDirectoryAndNotFromTheRequest()
  {
    // Запрос объявляет зоной Москву, а справочник относит этот адрес к
    // области. AC-016c: поверить запросу значило бы отдать клиенту выбор меры.
    var response = await CalculationChecks.PostJsonAsync(
        stand.Client,
        CalculationsPath,
        CalculationChecks.CalculationRequestJson(
            CalculationChecks.ItemJson(ConcreteGroupId, ConcreteTons, "t"),
            ImoltCalculationsStand.RegionPickupValue,
            ImoltCalculationsStand.RegionPickupLatitude,
            ImoltCalculationsStand.RegionPickupLongitude,
            distanceKm: WideDistanceKm,
            area: "moscow"));

    using var document = await CalculationChecks.CreatedAsync(response, "createCalculation");

    Assert.Equal("m3", document.RootElement.GetProperty("measure").GetString());
    Assert.Equal(
        "moscowRegion",
        document.RootElement.GetProperty("pickupAddress").GetProperty("area").GetString());
  }

  [Fact(DisplayName = "адрес, зону которого назвать нечем, расчёт не запускает")]
  public async Task CalculationRefusesAnAddressWhoseServiceAreaIsUnknown()
  {
    // Адреса нет в справочнике, и зона в запросе не названа: взять меру
    // расчёта неоткуда. AC-016d — отказ объявлен договором для этой операции.
    var response = await CalculationChecks.PostJsonAsync(
        stand.Client,
        CalculationsPath,
        CalculationChecks.CalculationRequestJson(
            CalculationChecks.ItemJson(ConcreteGroupId, ConcreteTons, "t"),
            ImoltCalculationsStand.UnknownAddressValue,
            ImoltCalculationsStand.UnknownAddressLatitude,
            ImoltCalculationsStand.UnknownAddressLongitude,
            distanceKm: WideDistanceKm,
            area: null));

    using var problem = await ReferenceChecks.ProblemAsync(
        response, HttpStatusCode.UnprocessableEntity, OutsideServiceArea);
    Assert.Equal(422, problem.RootElement.GetProperty("status").GetInt32());
  }

  /// Позиция расчёта по группе примера: в запросах проверки она одна.
  private static JsonElement ItemOf(JsonElement calculation)
      => calculation.GetProperty("items").EnumerateArray()
          .Single(item => item.GetProperty("wasteGroupId").GetString() == ConcreteGroupId);

  /// Стоимость перевозки до «Востока» — полигона, до которого от обоих
  /// адресов проверки сохранено плечо.
  private static string TransportCostOf(JsonDocument calculation)
      => CalculationChecks.Amount(
          CalculationChecks
              .Option(CalculationChecks.OptionsOf(calculation.RootElement, ConcreteGroupId), VostokId)
              .GetProperty("transportCost"));

  private async Task<JsonDocument> CalculatedAsync(
      string pickupValue,
      double latitude,
      double longitude,
      double amount,
      string unit)
  {
    var response = await CalculationChecks.PostJsonAsync(
        stand.Client,
        CalculationsPath,
        CalculationChecks.CalculationRequestJson(
            CalculationChecks.ItemJson(ConcreteGroupId, amount, unit),
            pickupValue,
            latitude,
            longitude,
            distanceKm: WideDistanceKm));

    return await CalculationChecks.CreatedAsync(response, "createCalculation");
  }
}
