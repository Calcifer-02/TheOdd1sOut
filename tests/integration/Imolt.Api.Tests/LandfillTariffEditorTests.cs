using System.Net;
using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Тариф утилизации задаётся ячейкой таблицы «полигон и группа отходов»:
/// цена утилизации живёт у пары, а не у полигона целиком и не у группы
/// целиком. Запись обновляет дату актуальности тарифа — её расчёт показывает
/// пользователю (R-048).
///
/// Ячейка несуществующей пары не заводится: перечень полигонов идёт из
/// официального источника (R-046), а условия обмена с АИС ОССиГ не
/// установлены (Q-017). Редактор цен — не место, где полигон появляется
/// впервые.
///
/// Проверка фальсифицируема: она падает, если заданный тариф не доходит до
/// карточки полигона, если дата актуальности тарифа остаётся на дне
/// начального набора, если задание тарифа затрагивает соседнюю ячейку той же
/// таблицы и если обращение к несуществующему полигону заводит ячейку вместо
/// отказа.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-042d, AC-042e
[Collection(ImoltReferenceEditorCollection.Name)]
public sealed class LandfillTariffEditorTests(ImoltReferenceEditorStand stand)
{
  private const string NotFound = "urn:imolt:problem:not-found";

  [Fact(DisplayName = "менеджер данных задаёт цену утилизации по ячейке «полигон и группа отходов»")]
  public async Task ManagerSetsDisposalTariffOfOneCell()
  {
    var token = await stand.DataManagerTokenAsync();

    var response = await stand.SendJsonAsync(
        HttpMethod.Put,
        Cell(ImoltReferenceEditorStand.TariffLandfillId, ImoltReferenceEditorStand.TariffGroupId),
        DisposalPriceJson("480.00"),
        token);

    using var tariff = await ReferenceChecks.OkAsync(response, "setLandfillTariff");

    Assert.Equal(ImoltReferenceEditorStand.TariffGroupId, tariff.RootElement.GetProperty("wasteGroupId").GetString());
    Assert.Equal("480.00", AmountOf(tariff.RootElement));
    Assert.Equal(stand.EditDate, tariff.RootElement.GetProperty("updatedAt").GetString());

    // Карточка полигона — второе чтение. Без него проверку прошла бы служба,
    // которая вернула присланную цену, а в справочник её не записала.
    var card = await stand.GetAsync(
        $"{ImoltReferenceEditorStand.LandfillsPath}/{ImoltReferenceEditorStand.TariffLandfillId}");
    using var landfill = await ReferenceChecks.OkAsync(card, "getLandfill");

    var tariffs = landfill.RootElement.GetProperty("tariffs").EnumerateArray().ToList();

    var cell = tariffs.Single(row =>
        row.GetProperty("wasteGroupId").GetString() == ImoltReferenceEditorStand.TariffGroupId);
    Assert.Equal("480.00", AmountOf(cell));
    Assert.Equal(stand.EditDate, cell.GetProperty("updatedAt").GetString());

    // Соседняя ячейка того же полигона осталась прежней: цена утилизации
    // относится к паре, и правка одной группы, задевшая другую, увела бы в
    // коммерческое предложение чужую величину (AR-002).
    var neighbour = tariffs.Single(row =>
        row.GetProperty("wasteGroupId").GetString() == ImoltReferenceEditorStand.CalculationGroupId);
    Assert.Equal("400.00", AmountOf(neighbour));
  }

  [Fact(DisplayName = "тариф по несуществующему полигону не заводится")]
  public async Task TariffOfAnUnknownLandfillIsNotCreated()
  {
    var token = await stand.DataManagerTokenAsync();

    var response = await stand.SendJsonAsync(
        HttpMethod.Put,
        Cell(ImoltReferenceEditorStand.UnknownLandfillId, ImoltReferenceEditorStand.TariffGroupId),
        DisposalPriceJson("480.00"),
        token);

    using var problem = await ReferenceChecks.ProblemAsync(response, HttpStatusCode.NotFound, NotFound);
    Assert.Equal(404, problem.RootElement.GetProperty("status").GetInt32());

    // Счёт записей хранилища: отказ с кодом 404 и отказ с кодом 404 и
    // заведённой ячейкой выглядят для клиента одинаково, а вторая означает,
    // что редактор цен завёл полигон в обход официального перечня (R-046).
    Assert.Equal(
        0L,
        await stand.CountAsync(
            "select count(*) from landfill_tariff where landfill_id = @landfillId",
            ("landfillId", ImoltReferenceEditorStand.UnknownLandfillId)));
  }

  private static string Cell(string landfillId, string wasteGroupId)
      => $"{ImoltReferenceEditorStand.LandfillsPath}/{landfillId}/tariffs/{wasteGroupId}";

  private static string DisposalPriceJson(string amount)
      => $$"""{ "disposalPricePerTon": { "amount": "{{amount}}", "currency": "RUB" } }""";

  private static string AmountOf(JsonElement tariff)
      => tariff.GetProperty("disposalPricePerTon").GetProperty("amount").GetString() ?? string.Empty;
}
