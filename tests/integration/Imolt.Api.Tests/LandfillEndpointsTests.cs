using System.Globalization;
using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Реестр полигонов: карточка с тарифами и историей юрлица, отбор по
/// принимаемой группе отходов и по статусу, дата актуальности статуса у каждой
/// записи списка.
///
/// Ожидаемые значения — из начального набора данных
/// (src/back/Imolt.Database/Migrations/0002_demo_dataset.sql) и достройки
/// стенда; форма ответа сверяется со схемами Landfill, LandfillPage и
/// LandfillCard договора.
///
/// Проверка фальсифицируема: она падает, если карточка потеряет координаты,
/// статус, дату актуальности или тарифы, если отбор по группе и по статусу
/// перестанет отбирать (вернёт весь реестр) либо начнёт отбирать лишнее
/// (вернёт пустой список), если смена юридического лица сотрёт накопленные
/// тарифы и если хотя бы у одной записи списка дата актуальности статуса
/// окажется незаполненной.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-040a, AC-040b, AC-040c, AC-041a, AC-048b
[Collection(ImoltReferencesCollection.Name)]
public sealed class LandfillEndpointsTests(ImoltReferencesStand stand)
{
  [Fact(DisplayName = "карточка полигона несёт адрес, координаты, статус, дату актуальности и тарифы по группам")]
  public async Task LandfillCardCarriesEveryDeclaredProperty()
  {
    var response = await stand.Client.GetAsync("/v1/landfills/vostok-timohovo");
    using var document = await ReferenceChecks.OkAsync(response, "getLandfill");
    var landfill = document.RootElement;

    Assert.Equal("Комплекс переработки «Восток»", landfill.GetProperty("name").GetString());
    Assert.Equal("Московская обл., Богородский г. о., д. Тимохово", landfill.GetProperty("address").GetString());

    var coordinates = landfill.GetProperty("coordinates");
    Assert.Equal(55.7286, coordinates.GetProperty("latitude").GetDouble(), 4);
    Assert.Equal(38.2153, coordinates.GetProperty("longitude").GetDouble(), 4);

    Assert.Equal("active", landfill.GetProperty("status").GetString());
    Assert.Equal(ImoltReferencesStand.DataDate, landfill.GetProperty("statusUpdatedAt").GetString());

    var tariffs = landfill.GetProperty("tariffs").EnumerateArray().ToList();
    Assert.NotEmpty(tariffs);

    // «450.00» за тонну по группе beton-lom — значение начального набора,
    // выведенное из канонического примера договора.
    var concrete = tariffs.Single(tariff => tariff.GetProperty("wasteGroupId").GetString() == "beton-lom");
    Assert.Equal("450.00", concrete.GetProperty("disposalPricePerTon").GetProperty("amount").GetString());
    Assert.Equal("RUB", concrete.GetProperty("disposalPricePerTon").GetProperty("currency").GetString());
    Assert.Equal(ImoltReferencesStand.DataDate, concrete.GetProperty("updatedAt").GetString());
  }

  [Fact(DisplayName = "реестр отбирается по принимаемой группе отходов")]
  public async Task RegistryIsFilteredByAcceptedWasteGroup()
  {
    var response = await stand.Client.GetAsync("/v1/landfills?wasteGroupId=drevesina");
    using var document = await ReferenceChecks.OkAsync(response, "listLandfills");
    var ids = ReferenceChecks.Ids(document.RootElement);

    // Древесину принимает только «Восток»: тарифа этой группы у «Икши» в
    // наборе нет. Положительное утверждение отсекает пустой ответ,
    // отрицательное — ответ «весь реестр».
    Assert.Contains("vostok-timohovo", ids);
    Assert.DoesNotContain("iksha", ids);
  }

  [Fact(DisplayName = "реестр отбирается по статусу и не приносит заблокированный полигон")]
  public async Task RegistryIsFilteredByStatus()
  {
    var active = await stand.Client.GetAsync("/v1/landfills?status=active");
    using var activeDocument = await ReferenceChecks.OkAsync(active, "listLandfills");
    var activeIds = ReferenceChecks.Ids(activeDocument.RootElement);

    Assert.Contains("vostok-timohovo", activeIds);
    Assert.DoesNotContain(ImoltReferencesStand.BlockedLandfillId, activeIds);

    // Обратный отбор. Без него проверку прошла бы и служба, которая
    // заблокированный полигон вовсе не отдаёт: тогда его отсутствие в
    // активных ничего не говорило бы об отборе.
    var blocked = await stand.Client.GetAsync("/v1/landfills?status=blocked");
    using var blockedDocument = await ReferenceChecks.OkAsync(blocked, "listLandfills");
    var blockedIds = ReferenceChecks.Ids(blockedDocument.RootElement);

    Assert.Contains(ImoltReferencesStand.BlockedLandfillId, blockedIds);
    Assert.DoesNotContain("vostok-timohovo", blockedIds);
  }

  [Fact(DisplayName = "смена юридического лица сохраняется историей и не обнуляет тарифы")]
  public async Task LegalEntityHistoryKeepsAccumulatedTariffs()
  {
    var response = await stand.Client.GetAsync("/v1/landfills/vostok-timohovo");
    using var document = await ReferenceChecks.OkAsync(response, "getLandfill");
    var landfill = document.RootElement;

    var history = landfill.GetProperty("legalEntityHistory").EnumerateArray().ToList();

    // В наборе два периода: «Тимохово» до 28.02.2026 и «Восток» с
    // 01.03.2026. Один период означал бы, что предыдущее юрлицо потеряно.
    Assert.Equal(2, history.Count);

    var previous = history.Single(period => period.GetProperty("legalEntity").GetString() == "ООО «Тимохово»");
    Assert.Equal("2023-01-01", previous.GetProperty("since").GetString());
    Assert.Equal("2026-02-28", previous.GetProperty("until").GetString());

    var current = history.Single(period => period.GetProperty("legalEntity").GetString() == "ООО «Восток»");
    Assert.Equal("2026-03-01", current.GetProperty("since").GetString());
    Assert.True(
        !current.TryGetProperty("until", out var until) || until.ValueKind is JsonValueKind.Null,
        "у действующего юридического лица проставлена дата окончания: период закрыт, хотя он открыт");

    // Смысл требования R-041 именно здесь: история есть, а тарифы целы.
    Assert.NotEmpty(landfill.GetProperty("tariffs").EnumerateArray());
    Assert.Equal("ООО «Восток»", landfill.GetProperty("legalEntity").GetString());
  }

  [Fact(DisplayName = "у каждого полигона реестра заполнена дата актуальности статуса")]
  public async Task EveryLandfillCarriesItsStatusDate()
  {
    var response = await stand.Client.GetAsync("/v1/landfills");
    using var document = await ReferenceChecks.OkAsync(response, "listLandfills");

    var items = document.RootElement.GetProperty("items").EnumerateArray().ToList();
    Assert.NotEmpty(items);

    foreach (var landfill in items)
    {
      var id = landfill.GetProperty("id").GetString();
      var statusUpdatedAt = landfill.GetProperty("statusUpdatedAt").GetString();

      // Культура задаётся явно: служба выставляет ru-RU глобально
      // (Program.cs), а договор объявляет дату форматом date из ISO 8601.
      Assert.True(
          DateOnly.TryParse(statusUpdatedAt, CultureInfo.InvariantCulture, out _),
          $"у полигона {id} дата актуальности статуса не разбирается как дата: «{statusUpdatedAt}»");
    }
  }
}
