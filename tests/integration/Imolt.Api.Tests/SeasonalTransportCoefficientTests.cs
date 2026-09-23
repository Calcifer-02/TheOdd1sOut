using System.Globalization;
using Xunit;

namespace Imolt.Api.Tests;

/// Сезонный коэффициент перевозки применяется к стоимости, но наружу не
/// отдаётся (R-022, R-058).
///
/// Стенд отдельный вынужденно: действующий коэффициент меняет стоимость
/// перевозки любого расчёта, а проверки формулы сверяются с числами примера
/// договора, посчитанными без коэффициента. Подробности выбора — в шапке
/// ImoltSeasonalTransportStand.
///
/// Проверка фальсифицируема: она падает, если коэффициент перестанет
/// применяться (перевозка вернулась бы к 10 800,00 ₽), если его применят к
/// утилизации и если он появится в ответе — полем или значением.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-022a
[Collection(ImoltSeasonalTransportCollection.Name)]
public sealed class SeasonalTransportCoefficientTests(ImoltSeasonalTransportStand stand)
{
  private const string ConcreteGroupId = "beton-lom";

  private const string VostokId = "vostok-timohovo";

  /// Стоимость перевозки без коэффициента: 20 т x 12,00 ₽ x 45 км.
  private const string TransportWithoutCoefficient = "10800.00";

  /// Она же с коэффициентом стенда: 10 800,00 x 1,15.
  private const string TransportWithCoefficient = "12420.00";

  /// Части имён полей, которыми коэффициент мог бы назваться в ответе.
  private static readonly string[] CoefficientFieldParts = ["coefficient", "factor", "коэффициент"];

  [Fact(DisplayName = "сезонный коэффициент меняет стоимость перевозки и в ответе не появляется")]
  public async Task SeasonalCoefficientMovesTransportCostWithoutAppearingInTheResponse()
  {
    var response = await CalculationChecks.PostJsonAsync(
        stand.Client,
        "/v1/calculations",
        CalculationChecks.CalculationRequestJson(
            CalculationChecks.ItemJson(ConcreteGroupId, 20, "t"),
            ImoltSeasonalTransportStand.PickupValue,
            ImoltSeasonalTransportStand.PickupLatitude,
            ImoltSeasonalTransportStand.PickupLongitude,
            distanceKm: 50));

    using var document = await CalculationChecks.CreatedAsync(response, "createCalculation");
    var option = CalculationChecks.Option(
        CalculationChecks.OptionsOf(document.RootElement, ConcreteGroupId), VostokId);

    // AC-022a, часть первая: стоимость перевозки отличается от произведения
    // без коэффициента. Названо и то, чему она равна: «просто не 10 800» дало
    // бы зелёный свет любой ошибке в умножении.
    var transport = CalculationChecks.Amount(option.GetProperty("transportCost"));
    Assert.NotEqual(TransportWithoutCoefficient, transport);
    Assert.Equal(TransportWithCoefficient, transport);

    // Утилизация остаётся прежней: коэффициент перевозки на тариф полигона не
    // распространяется, иначе R-022 молча переписал бы R-018.
    Assert.Equal("9000.00", CalculationChecks.Amount(option.GetProperty("disposalCost")));
    Assert.Equal("21420.00", CalculationChecks.Amount(option.GetProperty("totalCost")));

    // AC-022a, часть вторая: ни одного поля с коэффициентом.
    var names = CalculationChecks.FieldNames(document.RootElement);
    var leakedNames = names
        .Where(name => CoefficientFieldParts.Any(part =>
            name.Contains(part, StringComparison.OrdinalIgnoreCase)))
        .ToArray();

    Assert.True(
        leakedNames.Length == 0,
        $"в ответе расчёта есть поля с коэффициентом: {string.Join(", ", leakedNames)}");

    // И ни одного значения: коэффициент мог уехать под безобидным именем.
    // Момент создания расчёта исключён — доли секунды в нём складываются в те
    // же цифры случайно, и проверка становилась бы то зелёной, то красной.
    var factor = ImoltSeasonalTransportStand.SeasonalFactor.ToString(
        "0.00", CultureInfo.InvariantCulture);
    var leakedValues = CalculationChecks.ScalarValues(document.RootElement)
        .Where(value => value.Key != "createdAt")
        .Where(value => value.Value.Contains(factor, StringComparison.Ordinal))
        .Select(value => $"{value.Key} = {value.Value}")
        .ToArray();

    Assert.True(
        leakedValues.Length == 0,
        $"в ответе расчёта виден сам коэффициент: {string.Join("; ", leakedValues)}");
  }
}
