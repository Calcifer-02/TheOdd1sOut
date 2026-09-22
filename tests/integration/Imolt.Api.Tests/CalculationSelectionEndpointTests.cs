using Xunit;

namespace Imolt.Api.Tests;

/// Выбор полигонов и сводка расчёта (R-027, R-028, R-032). Выбор задаётся
/// целиком, а не по одному: так сводка справа всегда отвечает тому, что
/// отмечено флажками.
///
/// Проверка фальсифицируема: она падает, если пустой набор перестанет снимать
/// выбор или оставит ненулевой итог, если выбор заблокированного полигона
/// начнёт запрещаться или пройдёт молча без предупреждения и если итог выбора
/// разойдётся с суммой совокупных цен отмеченных полигонов.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-027a, AC-028a, AC-032a
/// @supports: R-027, R-028, R-032
[Collection(ImoltCalculationsCollection.Name)]
public sealed class CalculationSelectionEndpointTests(ImoltCalculationsStand stand)
{
  private const string CalculationsPath = "/v1/calculations";

  private const string ConcreteGroupId = "beton-lom";

  private const string VostokId = "vostok-timohovo";

  private const string IkshaId = "iksha";

  private const int WideDistanceKm = 60;

  [Fact(DisplayName = "пустой набор снимает выбор и обнуляет итог")]
  public async Task EmptySelectionClearsTheChoiceAndZeroesTheTotal()
  {
    var id = await CalculationIdAsync();

    // Сначала выбор непустой: иначе «ноль выбранных» после пустого набора
    // ничем не отличается от точки, которая выбор вообще не сохраняет.
    var chosen = await SelectAsync(id, EntryJson(ConcreteGroupId, VostokId));
    using (var state = await ReferenceChecks.OkAsync(chosen, "setCalculationSelection"))
    {
      Assert.Equal(1, state.RootElement.GetProperty("selectedLandfills").GetInt32());
    }

    var response = await SelectAsync(id, string.Empty);
    using var document = await ReferenceChecks.OkAsync(response, "setCalculationSelection");

    // AC-027a: итог «0.00», а не отсутствие итога. Пустая сводка и сводка на
    // ноль рублей выглядят для клиента по-разному.
    Assert.Empty(document.RootElement.GetProperty("entries").EnumerateArray());
    Assert.Equal(0, document.RootElement.GetProperty("selectedLandfills").GetInt32());
    Assert.Equal("0.00", CalculationChecks.Amount(document.RootElement.GetProperty("total")));
  }

  [Fact(DisplayName = "выбор заблокированного полигона принимается и сопровождается предупреждением")]
  public async Task BlockedLandfillStaysSelectedAndRaisesAWarning()
  {
    var id = await CalculationIdAsync();
    var blocked = ImoltCalculationsStand.BlockedLandfillInPlacementId;

    var response = await SelectAsync(id, EntryJson(ConcreteGroupId, blocked));
    using var document = await ReferenceChecks.OkAsync(response, "setCalculationSelection");

    // AC-028a, R-028: решение остаётся за пользователем — предупреждение не
    // отменяет выбор. Поэтому проверяются оба факта: выбор принят и о нём
    // предупреждено.
    Assert.Equal(1, document.RootElement.GetProperty("selectedLandfills").GetInt32());
    Assert.Contains(
        document.RootElement.GetProperty("entries").EnumerateArray(),
        entry => entry.GetProperty("landfillId").GetString() == blocked);

    var warning = Assert.Single(
        document.RootElement.GetProperty("warnings").EnumerateArray(),
        candidate => candidate.GetProperty("code").GetString() == "landfillBlocked");

    Assert.Equal(blocked, warning.GetProperty("landfillId").GetString());
    Assert.False(
        string.IsNullOrWhiteSpace(warning.GetProperty("message").GetString()),
        "предупреждение без текста нечего показать рядом с флажком");
  }

  [Fact(DisplayName = "итог выбора равен сумме совокупных цен отмеченных полигонов")]
  public async Task SelectionTotalSumsTheChosenLandfills()
  {
    var id = await CalculationIdAsync();

    var response = await SelectAsync(
        id,
        EntryJson(ConcreteGroupId, VostokId) + ", " + EntryJson(ConcreteGroupId, IkshaId));

    using var document = await ReferenceChecks.OkAsync(response, "setCalculationSelection");

    // AC-032a: 19 800,00 + 20 080,00 = 39 880,00 ₽ — число из примера договора
    // (пример ответа setCalculationSelection). Выбор двух полигонов по одной
    // группе отходов договор объявляет прямо, и сводка обязана сложить оба.
    Assert.Equal(2, document.RootElement.GetProperty("selectedLandfills").GetInt32());
    Assert.Equal("39880.00", CalculationChecks.Amount(document.RootElement.GetProperty("total")));
  }

  private static string EntryJson(string wasteGroupId, string landfillId)
      => $$"""{ "wasteGroupId": "{{wasteGroupId}}", "landfillId": "{{landfillId}}" }""";

  private Task<HttpResponseMessage> SelectAsync(string calculationId, string entriesJson)
      => CalculationChecks.PutJsonAsync(
          stand.Client,
          $"{CalculationsPath}/{calculationId}/selection",
          $$"""{ "entries": [{{entriesJson}}] }""");

  // Расчёт на каждую проверку свой: выбор — часть состояния расчёта, и общий
  // расчёт сделал бы исход зависимым от порядка запуска.
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
