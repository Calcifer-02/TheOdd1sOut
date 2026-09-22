using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Что расчёт не отдаёт наружу (R-021, R-058, R-059). Интерфейс прост потому,
/// что вводятся только адрес, тип отходов, объём и мера; цена перевозки за
/// тонна-километр и тариф утилизации за тонну — данные справочников, и в ответ
/// расчёта они не попадают.
///
/// Запрещённые значения ищутся по всему телу ответа, а не в отдельном поле:
/// утечка тарифа под другим именем — та же утечка. Значения взяты из
/// начального набора и достройки стенда: 12,00 ₽ за тонна-километр у
/// «beton-lom», 450,00, 380,00 и 500,00 ₽ за тонну у трёх полигонов.
///
/// Проверка фальсифицируема: она падает, если выключенная утилизация всё
/// равно попадёт в совокупную цену, если в ответе появится поле или значение
/// исходной цены либо тарифа и если расчёт перестанет помечаться
/// предварительным.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-021a, AC-058a, AC-059a
/// @supports: R-021, R-058, R-059
[Collection(ImoltCalculationsCollection.Name)]
public sealed class CalculationDisclosureTests(ImoltCalculationsStand stand)
{
  private const string CalculationsPath = "/v1/calculations";

  private const string ConcreteGroupId = "beton-lom";

  private const string VostokId = "vostok-timohovo";

  private const int WideDistanceKm = 60;

  /// Части имён полей, за которыми стоит исходная величина справочника:
  /// transportPricePerTonKm, disposalPricePerTon, tariffs. Отбор идёт по
  /// «PerTon», а не по «price»: договор законно отдаёт дату актуальности цен
  /// (pricesUpdatedAt), и отбор по «price» отверг бы её.
  private static readonly string[] ForbiddenFieldParts = ["perton", "tariff"];

  /// Значения справочников, которых в ответе быть не должно: цена перевозки
  /// группы и тарифы утилизации трёх полигонов стенда.
  private static readonly string[] ForbiddenValues = ["12.00", "450.00", "380.00", "500.00"];

  [Fact(DisplayName = "без утилизации совокупная цена состоит из одной перевозки")]
  public async Task DisposalDisabledLeavesOnlyTransportInTheTotal()
  {
    using var document = await CalculationAsync(disposalRequired: false);
    var option = CalculationChecks.Option(
        CalculationChecks.OptionsOf(document.RootElement, ConcreteGroupId), VostokId);

    // AC-021a: стоимости утилизации нет вовсе. Ноль означал бы бесплатный
    // приём на полигоне, а флажок снят потому, что приёма нет.
    var disposalPresent = option.TryGetProperty("disposalCost", out var disposal)
        && disposal.ValueKind is not JsonValueKind.Null;
    Assert.False(
        disposalPresent,
        $"при выключенной утилизации вариант размещения всё равно несёт её стоимость: {option.GetRawText()}");

    Assert.Equal("10800.00", CalculationChecks.Amount(option.GetProperty("transportCost")));
    Assert.Equal(
        CalculationChecks.Amount(option.GetProperty("transportCost")),
        CalculationChecks.Amount(option.GetProperty("totalCost")));
  }

  [Fact(DisplayName = "ответ расчёта не раскрывает цену за тонна-километр и тариф за тонну")]
  public async Task CalculationResponseHidesPerTonKmPriceAndDisposalTariff()
  {
    using var document = await CalculationAsync(disposalRequired: true);

    // AC-058a, часть первая: ни одного поля с исходной величиной.
    var names = CalculationChecks.FieldNames(document.RootElement);
    foreach (var part in ForbiddenFieldParts)
    {
      var leaked = names.Where(name => name.Contains(part, StringComparison.OrdinalIgnoreCase)).ToArray();
      Assert.True(
          leaked.Length == 0,
          $"в ответе расчёта есть поля с исходной величиной справочника: {string.Join(", ", leaked)}");
    }

    // AC-058a, часть вторая: значение могло уехать и под безобидным именем,
    // поэтому просматриваются все значения тела. Посчитанные суммы примера
    // (10800.00, 9000.00, 19800.00, 12480.00, 7600.00, 20080.00, 11280.00,
    // 10000.00, 21280.00) ни одну из искомых строк не содержат, и ложного
    // срабатывания на них нет. Момент создания расчёта из просмотра исключён:
    // доли секунды в нём складываются в те же цифры случайно, и проверка
    // становилась бы то зелёной, то красной без всякой утечки.
    var leaks = CalculationChecks.ScalarValues(document.RootElement)
        .Where(value => value.Key != "createdAt")
        .Where(value => ForbiddenValues.Any(forbidden =>
            value.Value.Contains(forbidden, StringComparison.Ordinal)))
        .Select(value => $"{value.Key} = {value.Value}")
        .ToArray();

    Assert.True(
        leaks.Length == 0,
        $"в ответе расчёта видны величины справочника: {string.Join("; ", leaks)}");
  }

  [Fact(DisplayName = "расчёт помечен предварительным")]
  public async Task CalculationIsMarkedPreliminary()
  {
    using var document = await CalculationAsync(disposalRequired: true);

    // AC-059a, R-059: признак истинен всегда — допустимое отклонение финальной
    // цены заказчиком не названо (Q-010), и расчёт не выдаёт себя за
    // окончательный.
    Assert.True(
        document.RootElement.GetProperty("preliminary").GetBoolean(),
        "расчёт не помечен предварительным: клиент принял бы предварительную цену за окончательную");
  }

  private async Task<JsonDocument> CalculationAsync(bool disposalRequired)
  {
    var response = await CalculationChecks.PostJsonAsync(
        stand.Client,
        CalculationsPath,
        CalculationChecks.CalculationRequestJson(
            CalculationChecks.ItemJson(ConcreteGroupId, 20, "t"),
            ImoltCalculationsStand.PickupValue,
            ImoltCalculationsStand.PickupLatitude,
            ImoltCalculationsStand.PickupLongitude,
            disposalRequired,
            WideDistanceKm));

    return await CalculationChecks.CreatedAsync(response, "createCalculation");
  }
}
