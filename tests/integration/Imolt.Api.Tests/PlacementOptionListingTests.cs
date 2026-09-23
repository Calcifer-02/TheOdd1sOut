using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Подбор полигонов: состав строки результата, сортировка, фильтр расстояния
/// и пустой список с названной причиной (R-023 — R-026, R-029).
///
/// На стенде три полигона с плечами 45 («Восток»), 47 («На ремонте») и 52 км
/// («Икша») и совокупными ценами 19 800,00, 21 280,00 и 20 080,00 ₽ за 20 тонн
/// лома бетона. Третья запись заведена намеренно: на двух полигонах сортировка
/// по цене и сортировка по расстоянию дают один и тот же порядок, и перепутать
/// их было бы незаметно.
///
/// Запросы задают предел расстояния явно там, где критерий требует видеть
/// «Икшу» (52 км): предел по умолчанию — 50 км (R-025, R-026), и на нём она
/// отсеивается. Слова критерия «без параметров сортировки» относятся к
/// сортировке, и сортировка в этих запросах не задаётся.
///
/// Проверка фальсифицируема: она падает, если строка результата потеряет
/// объявленное поле, если порядок по умолчанию перестанет быть по возрастанию
/// совокупной цены, если сортировка по расстоянию по убыванию даст тот же
/// порядок, что по цене, если любая из сторон фильтра расстояния перестанет
/// отсекать, если расчёт без указанного предела сохранит не 50 км «не далее»
/// и если пустой список придёт ошибкой или без названной причины.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-023a, AC-024a, AC-024b, AC-025a, AC-025b, AC-026a, AC-029a
[Collection(ImoltCalculationsCollection.Name)]
public sealed class PlacementOptionListingTests(ImoltCalculationsStand stand)
{
  private const string CalculationsPath = "/v1/calculations";

  private const string ConcreteGroupId = "beton-lom";

  private const string VostokId = "vostok-timohovo";

  private const string IkshaId = "iksha";

  /// Предел расстояния, при котором в подбор попадают все три полигона стенда.
  private const int WideDistanceKm = 60;

  [Fact(DisplayName = "строка варианта размещения несёт все объявленные договором поля")]
  public async Task PlacementOptionRowCarriesEveryDeclaredField()
  {
    using var page = await OptionsPageAsync(ConcreteGroupId, $"distanceKm={WideDistanceKm}");
    var option = CalculationChecks.Option(page.RootElement, VostokId);

    // AC-023a. Оракул договора уже отверг бы строку без обязательного поля;
    // здесь названо, что именно в этих полях стоит, — иначе пустая строка
    // «Комплекс переработки» формально прошла бы схему.
    Assert.Equal("Комплекс переработки «Восток»", option.GetProperty("landfillName").GetString());
    Assert.Equal(
        "Московская обл., Богородский г. о., д. Тимохово",
        option.GetProperty("address").GetString());
    Assert.Equal(45, option.GetProperty("distanceKm").GetDouble(), 3);
    Assert.Equal("10800.00", CalculationChecks.Amount(option.GetProperty("transportCost")));
    Assert.Equal("19800.00", CalculationChecks.Amount(option.GetProperty("totalCost")));
    Assert.Equal("active", option.GetProperty("status").GetString());
    Assert.Equal(ImoltCalculationsStand.DataDate, option.GetProperty("statusUpdatedAt").GetString());
  }

  [Fact(DisplayName = "без параметров сортировки список идёт по возрастанию совокупной цены")]
  public async Task DefaultOrderIsTotalCostAscending()
  {
    using var page = await OptionsPageAsync(ConcreteGroupId, $"distanceKm={WideDistanceKm}");
    var ids = CalculationChecks.LandfillIds(page.RootElement);

    // AC-024a: «Восток» (19 800,00) впереди «Икши» (20 080,00). Полигон
    // «На ремонте» (21 280,00) идёт за ними и порядок первых двух не меняет.
    Assert.Equal(VostokId, ids[0]);
    Assert.Equal(IkshaId, ids[1]);

    Assert.Equal("19800.00", CalculationChecks.Amount(
        CalculationChecks.Option(page.RootElement, VostokId).GetProperty("totalCost")));
    Assert.Equal("20080.00", CalculationChecks.Amount(
        CalculationChecks.Option(page.RootElement, IkshaId).GetProperty("totalCost")));
  }

  [Fact(DisplayName = "сортировка по расстоянию по убыванию ставит дальний полигон первым")]
  public async Task DistanceOrderDescendingPutsTheFarthestLandfillFirst()
  {
    using var page = await OptionsPageAsync(
        ConcreteGroupId, $"sort=distance&order=desc&distanceKm={WideDistanceKm}");
    var ids = CalculationChecks.LandfillIds(page.RootElement);

    // AC-024b: «Икша» в 52 км — самая дальняя из трёх. По совокупной цене она
    // вторая, поэтому совпадение порядков здесь исключено.
    Assert.Equal(IkshaId, ids[0]);
    Assert.Equal(52, CalculationChecks.Option(page.RootElement, IkshaId)
        .GetProperty("distanceKm")
        .GetDouble(), 3);
  }

  [Fact(DisplayName = "отбор «не далее N километров» отсекает дальние полигоны")]
  public async Task AtMostFilterDropsLandfillsBeyondTheLimit()
  {
    using var page = await OptionsPageAsync(ConcreteGroupId, "distanceMode=atMost&distanceKm=50");
    var ids = CalculationChecks.LandfillIds(page.RootElement);

    // AC-025a: «Икша» в 52 км за пределом. Утверждение о «Востоке» отделяет
    // отбор от пустого ответа: список, из которого выпало всё, тоже «не
    // содержит Икшу».
    Assert.DoesNotContain(IkshaId, ids);
    Assert.Contains(VostokId, ids);
  }

  [Fact(DisplayName = "отбор «не менее N километров» отсекает ближние полигоны")]
  public async Task AtLeastFilterDropsLandfillsCloserThanTheLimit()
  {
    using var page = await OptionsPageAsync(ConcreteGroupId, "distanceMode=atLeast&distanceKm=50");
    var ids = CalculationChecks.LandfillIds(page.RootElement);

    // AC-025b: «Восток» в 45 км ближе предела. «Икша» в 52 км остаётся —
    // иначе отбор было бы не отличить от отбора, отсекающего всё.
    Assert.DoesNotContain(VostokId, ids);
    Assert.Contains(IkshaId, ids);
  }

  [Fact(DisplayName = "расчёт без указанного предела расстояния сохраняет 50 километров «не далее»")]
  public async Task CalculationWithoutDistanceFilterKeepsFiftyKilometresAtMost()
  {
    var response = await CalculationChecks.PostJsonAsync(
        stand.Client,
        CalculationsPath,
        CalculationChecks.CalculationRequestJson(
            CalculationChecks.ItemJson(ConcreteGroupId, 20, "t"),
            ImoltCalculationsStand.PickupValue,
            ImoltCalculationsStand.PickupLatitude,
            ImoltCalculationsStand.PickupLongitude));

    using var document = await CalculationChecks.CreatedAsync(response, "createCalculation");

    // AC-026a, R-026: предел по умолчанию закрепляется в самом расчёте, а не
    // подставляется заново при каждом чтении. Иначе смена значения по
    // умолчанию молча изменила бы смысл уже сохранённого расчёта.
    var filter = document.RootElement.GetProperty("distanceFilter");
    Assert.Equal("atMost", filter.GetProperty("mode").GetString());
    Assert.Equal(50, filter.GetProperty("km").GetInt32());
  }

  [Fact(DisplayName = "пустой список вариантов размещения не ошибка и называет причину")]
  public async Task EmptyListNamesTheReasonInsteadOfFailing()
  {
    var response = await CalculationChecks.PostJsonAsync(
        stand.Client,
        CalculationsPath,
        CalculationChecks.CalculationRequestJson(
            CalculationChecks.ItemJson(ConcreteGroupId, 20, "t")
                + ", "
                + CalculationChecks.ItemJson(ImoltCalculationsStand.UnacceptedWasteGroupId, 15, "m3"),
            ImoltCalculationsStand.PickupValue,
            ImoltCalculationsStand.PickupLatitude,
            ImoltCalculationsStand.PickupLongitude,
            distanceKm: WideDistanceKm));

    using var document = await CalculationChecks.CreatedAsync(response, "createCalculation");
    var options = CalculationChecks.OptionsOf(
        document.RootElement, ImoltCalculationsStand.UnacceptedWasteGroupId);

    // AC-029a: ни один полигон не принимает эту группу. Код 200 и названная
    // причина — потому что интерфейс по ней выбирает подсказку: снять фильтр
    // расстояния или сменить тип отходов (Э-12). Без причины обе пустоты
    // выглядят одинаково.
    Assert.Empty(options.GetProperty("items").EnumerateArray());
    Assert.Equal(0, options.GetProperty("total").GetInt32());
    Assert.Equal("noLandfillsForWasteGroup", options.GetProperty("emptyReason").GetString());

    // Соседняя вкладка при этом непуста: иначе пустой ответ объяснялся бы
    // сломанным подбором, а не отсутствием принимающих полигонов.
    Assert.NotEmpty(CalculationChecks.OptionsOf(document.RootElement, ConcreteGroupId)
        .GetProperty("items")
        .EnumerateArray());
  }

  // Расчёт создаётся на каждую проверку заново: выбор и распределение — часть
  // его состояния, и общий расчёт сделал бы исход зависимым от порядка запуска.
  private async Task<JsonDocument> OptionsPageAsync(string wasteGroupId, string query)
  {
    var created = await CalculationChecks.PostJsonAsync(
        stand.Client,
        CalculationsPath,
        CalculationChecks.CalculationRequestJson(
            CalculationChecks.ItemJson(wasteGroupId, 20, "t"),
            ImoltCalculationsStand.PickupValue,
            ImoltCalculationsStand.PickupLatitude,
            ImoltCalculationsStand.PickupLongitude,
            distanceKm: WideDistanceKm));

    using var calculation = await CalculationChecks.CreatedAsync(created, "createCalculation");
    var id = CalculationChecks.IdOf(calculation.RootElement);

    var response = await stand.Client.GetAsync(
        $"{CalculationsPath}/{id}/options?wasteGroupId={Uri.EscapeDataString(wasteGroupId)}&{query}");

    return await ReferenceChecks.OkAsync(response, "listPlacementOptions");
  }
}
