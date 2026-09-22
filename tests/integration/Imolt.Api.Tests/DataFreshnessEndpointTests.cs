using System.Globalization;
using Xunit;

namespace Imolt.Api.Tests;

/// Сводка актуальности данных. Ценность сервиса — свежесть цен и статусов,
/// поэтому день, на который посчитан результат, объявлен отдельной операцией:
/// дата нужна и до расчёта, над формой ввода, а не только под результатом.
///
/// Обе даты определены однозначно: начальный набор и достройка стенда
/// датированы 17.09.2026, и любой способ свести дату по справочнику — от
/// наибольшей до наименьшей — даёт одно и то же значение.
///
/// Проверка фальсифицируема: она падает, если сводка потеряет любую из двух
/// дат, если дата поедет к дате запроса вместо даты данных (сегодняшний день
/// не равен 17.09.2026) и если поле «полигоны с устаревшими данными» придёт
/// не числом.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-048a
/// @supports: R-048
[Collection(ImoltReferencesCollection.Name)]
public sealed class DataFreshnessEndpointTests(ImoltReferencesStand stand)
{
  [Fact(DisplayName = "сводка актуальности отдаёт дату цен и дату статусов")]
  public async Task FreshnessCarriesBothDates()
  {
    var response = await stand.Client.GetAsync("/v1/data-freshness");
    using var document = await ReferenceChecks.OkAsync(response, "getDataFreshness");
    var freshness = document.RootElement;

    Assert.Equal(ImoltReferencesStand.DataDate, freshness.GetProperty("pricesUpdatedAt").GetString());
    Assert.Equal(ImoltReferencesStand.DataDate, freshness.GetProperty("statusesUpdatedAt").GetString());

    // Числом полигонов с устаревшими данными интерфейс решает, показывать
    // ли предупреждение; строка на этом месте сломала бы сравнение.
    if (freshness.TryGetProperty("landfillsWithStaleData", out var stale))
    {
      Assert.True(
          stale.TryGetInt32(out var count) && count >= 0,
          $"число полигонов с устаревшими данными пришло значением «{stale}»");
    }
  }

  [Fact(DisplayName = "даты сводки совпадают с датой актуальности статуса полигонов реестра")]
  public async Task FreshnessAgreesWithTheRegistry()
  {
    // Сводка и реестр берут дату из одного справочника. Расхождение
    // означает второй источник цифры — тот случай, когда пользователю
    // показывают две разные «актуальности» одних и тех же данных.
    var freshnessResponse = await stand.Client.GetAsync("/v1/data-freshness");
    using var freshnessDocument = await ReferenceChecks.OkAsync(freshnessResponse, "getDataFreshness");
    var statusesUpdatedAt = freshnessDocument.RootElement.GetProperty("statusesUpdatedAt").GetString();

    var registryResponse = await stand.Client.GetAsync("/v1/landfills?limit=100");
    using var registryDocument = await ReferenceChecks.OkAsync(registryResponse, "listLandfills");

    var dates = registryDocument.RootElement.GetProperty("items")
        .EnumerateArray()
        .Select(landfill => landfill.GetProperty("statusUpdatedAt").GetString() ?? string.Empty)
        .Select(value => DateOnly.Parse(value, CultureInfo.InvariantCulture))
        .ToList();

    Assert.NotEmpty(dates);
    Assert.Equal(
        dates.Max().ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        statusesUpdatedAt);
  }
}
