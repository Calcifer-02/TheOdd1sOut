using System.Net;
using Imolt.Shared;
using Xunit;

namespace Imolt.Api.Tests;

/// Пересчёт объёма между тоннами и кубометрами через договор (R-014, R-015).
/// Коэффициент плотности — свойство группы отходов справочника, пользователь
/// его не вводит; мера расчёта заказчиком не выбрана (Q-009), поэтому сервер
/// возвращает обе меры и за него не решает.
///
/// Арифметику самого пересчёта держит модульная проверка
/// (AmountConversionRulesTests) — ADR-0001 требует её без базы и сети. Здесь
/// проверяется другое: что точка договора существует, берёт коэффициент из
/// справочника, отдаёт обе меры и отказывает по несуществующей группе.
///
/// Ожидаемые значения взяты из начального набора данных
/// (src/back/Imolt.Database/Migrations/0002_demo_dataset.sql): у «drevesina»
/// плотность 0,5 т/м³, у «beton-lom» — 2,0 т/м³.
///
/// Проверка фальсифицируема: она падает, если точка пересчёта не заведена,
/// если кубометры перестанут пересчитываться по коэффициенту группы, если
/// ответ отдаст одну меру вместо двух, если коэффициент пересчёта перестанет
/// называться и если несуществующая группа даст нулевой пересчёт вместо
/// отказа.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-015a, AC-015b, AC-014a
[Collection(ImoltCalculationsCollection.Name)]
public sealed class AmountConversionEndpointTests(ImoltCalculationsStand stand)
{
  private const string ConversionsPath = "/v1/amount-conversions";

  [Fact(DisplayName = "пересчёт превращает кубометры в тонны по коэффициенту плотности группы")]
  public async Task AmountConversionTurnsCubicMetersIntoTonsByGroupDensity()
  {
    var response = await CalculationChecks.PostJsonAsync(
        stand.Client,
        ConversionsPath,
        """
        { "items": [ { "wasteGroupId": "drevesina", "quantity": { "value": 15, "unit": "m3" } } ] }
        """);

    using var document = await ReferenceChecks.OkAsync(response, "convertAmounts");
    var item = document.RootElement.GetProperty("items").EnumerateArray().Single();

    Assert.Equal("drevesina", item.GetProperty("wasteGroupId").GetString());

    // AC-015a: 15 м³ при плотности 0,5 — это 7,5 тонны. Введённая мера
    // остаётся собой: объём не подменяется пересчитанной величиной.
    Assert.Equal(7.5, item.GetProperty("tons").GetDouble(), 4);
    Assert.Equal(15, item.GetProperty("cubicMeters").GetDouble(), 4);
    Assert.Equal(15, item.GetProperty("input").GetProperty("value").GetDouble(), 4);
    Assert.Equal("m3", item.GetProperty("input").GetProperty("unit").GetString());
  }

  [Fact(DisplayName = "пересчёт отдаёт обе меры и называет коэффициент плотности")]
  public async Task AmountConversionReturnsBothMeasuresAndNamesTheDensity()
  {
    var response = await CalculationChecks.PostJsonAsync(
        stand.Client,
        ConversionsPath,
        """
        { "items": [ { "wasteGroupId": "beton-lom", "quantity": { "value": 20, "unit": "t" } } ] }
        """);

    using var document = await ReferenceChecks.OkAsync(response, "convertAmounts");
    var item = document.RootElement.GetProperty("items").EnumerateArray().Single();

    // AC-015b: заполнены обе меры — 20 тонн и 10 м³ при плотности 2,0, —
    // и назван коэффициент, по которому сделан пересчёт. Без коэффициента в
    // ответе подпись «≈ 10 м³» под полем объёма нечем объяснить.
    Assert.Equal(20, item.GetProperty("tons").GetDouble(), 4);
    Assert.Equal(10, item.GetProperty("cubicMeters").GetDouble(), 4);
    Assert.Equal(2.0, item.GetProperty("densityTonPerCubicMeter").GetDouble(), 4);
  }

  [Fact(DisplayName = "пересчёт несуществующей группы отходов отвечает отказом")]
  public async Task AmountConversionRejectsUnknownWasteGroup()
  {
    // Сначала существующая группа: без этого утверждения проверку прошла бы и
    // незаведённая точка — запасной обработчик службы тоже отвечает 404 с
    // кодом not-found, и отсутствие маршрута выглядело бы как исправный отказ.
    var existing = await CalculationChecks.PostJsonAsync(
        stand.Client,
        ConversionsPath,
        """
        { "items": [ { "wasteGroupId": "beton-lom", "quantity": { "value": 20, "unit": "t" } } ] }
        """);
    Assert.Equal(HttpStatusCode.OK, existing.StatusCode);

    var response = await CalculationChecks.PostJsonAsync(
        stand.Client,
        ConversionsPath,
        """
        { "items": [ { "wasteGroupId": "net-takoy-gruppy", "quantity": { "value": 20, "unit": "t" } } ] }
        """);

    // AC-014a: пересчёт без коэффициента невозможен, и нулевой результат был
    // бы хуже отказа — по нему клиент считал бы, что отходов нет.
    using var document = await ReferenceChecks.ProblemAsync(
        response, HttpStatusCode.NotFound, Problems.NotFound);

    var title = document.RootElement.GetProperty("title").GetString();
    Assert.False(string.IsNullOrWhiteSpace(title), "заголовок отказа пуст: показывать пользователю нечего");
  }
}
