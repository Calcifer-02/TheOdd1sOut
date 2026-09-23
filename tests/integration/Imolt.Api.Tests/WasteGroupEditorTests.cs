using System.Globalization;
using System.Net;
using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Редактор цен менеджера данных: правка группы отходов, разграничение по
/// праву ведения справочников, перенос новой цены в расчёт и сдвиг даты
/// актуальности цен.
///
/// Право живёт в учётной записи участника, а не в маркере доступа (ADR-0007):
/// участник с правом и участник без права входят одинаково, и отличает их
/// только состав обладателей, объявленный развёртыванием. Поэтому отказ
/// проверяется настоящей сессией без права, а не отсутствием маркера, —
/// отсутствие маркера даёт другой отказ, и он проверяется отдельно.
///
/// Форма каждого успешного ответа сверяется со схемой договора оракулом, а не
/// перечислением полей: договор здесь исполнимый, и проверка не вправе знать
/// о форме ответа больше него.
///
/// Проверка фальсифицируема: она падает, если правка не доходит до
/// справочника или доходит помимо названного поля; если непереданные поля
/// затираются; если участник без права правит цену, если отказ по праву
/// теряет свой код причины или если запрос без маркера перестаёт отличаться
/// от запроса без права; если новая цена не попадает в следующий расчёт; и
/// если дата актуальности цен остаётся на дне начального набора.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-042a, AC-042b, AC-042c, AC-043a, AC-048c
[Collection(ImoltReferenceEditorCollection.Name)]
public sealed class WasteGroupEditorTests(ImoltReferenceEditorStand stand)
{
  /// Код причины отказа по праву. Назначен ADR-0007 и отличается от
  /// `subscription-required`: у отказов разные причины и разные действия
  /// пользователя — одному оформить подписку, другому обратиться к владельцу
  /// данных. Договор объявляет оба кода в ответе Forbidden.
  private const string RoleRequired = "urn:imolt:problem:role-required";

  private const string AuthenticationRequired = "urn:imolt:problem:authentication-required";

  [Fact(DisplayName = "менеджер данных задаёт группе отходов цену перевозки за тонна-километр")]
  public async Task ManagerSetsTransportPriceOfWasteGroup()
  {
    var token = await stand.DataManagerTokenAsync();

    var response = await stand.SendJsonAsync(
        HttpMethod.Patch,
        Card(ImoltReferenceEditorStand.PriceEditorGroupId),
        TransportPriceJson("32.00"),
        token);

    using var updated = await ReferenceChecks.OkAsync(response, "updateWasteGroup");

    Assert.Equal("32.00", PriceOf(updated.RootElement));
    Assert.Equal(stand.EditDate, updated.RootElement.GetProperty("updatedAt").GetString());

    // Ответ операции и карточка справочника — два разных чтения. Без второго
    // проверку прошла бы служба, которая вернула присланное значение, а в
    // справочник его не записала.
    using var card = await CardAsync(ImoltReferenceEditorStand.PriceEditorGroupId);

    Assert.Equal("32.00", PriceOf(card.RootElement));
    Assert.Equal(stand.EditDate, card.RootElement.GetProperty("updatedAt").GetString());
  }

  [Fact(DisplayName = "правка одной цены не трогает название, коды ФККО и плотность")]
  public async Task UnnamedFieldsSurviveThePartialUpdate()
  {
    var token = await stand.DataManagerTokenAsync();

    var response = await stand.SendJsonAsync(
        HttpMethod.Patch,
        Card(ImoltReferenceEditorStand.PartialUpdateGroupId),
        TransportPriceJson("37.00"),
        token);

    using var updated = await ReferenceChecks.OkAsync(response, "updateWasteGroup");

    AssertUntouchedFields(updated.RootElement, "ответ операции");

    // Те же три поля в карточке: непереданное поле могло уцелеть в ответе и
    // пропасть в хранилище — снаружи это неразличимо до следующего чтения.
    using var card = await CardAsync(ImoltReferenceEditorStand.PartialUpdateGroupId);

    AssertUntouchedFields(card.RootElement, "карточка справочника");

    // Переданное поле при этом изменилось: без этого утверждения проверку
    // прошла бы служба, которая не меняет вообще ничего.
    Assert.Equal("37.00", PriceOf(card.RootElement));
  }

  [Fact(DisplayName = "участник без права ведения справочников цену не правит")]
  public async Task EditingWithoutThePermissionIsRefused()
  {
    var outsider = await stand.OutsiderTokenAsync();
    var path = Card(ImoltReferenceEditorStand.WithoutPermissionGroupId);
    var body = TransportPriceJson("99.00");

    var refused = await stand.SendJsonAsync(HttpMethod.Patch, path, body, outsider);

    using var problem = await ReferenceChecks.ProblemAsync(refused, HttpStatusCode.Forbidden, RoleRequired);
    Assert.False(
        string.IsNullOrWhiteSpace(problem.RootElement.GetProperty("title").GetString()),
        "отказ по праву пришёл без заголовка: показать участнику нечего");

    // Цена осталась прежней. Отказ, после которого значение всё же изменилось,
    // снаружи выглядит отказом — и именно так утекает правка постороннего.
    using var afterRefusal = await CardAsync(ImoltReferenceEditorStand.WithoutPermissionGroupId);
    Assert.Equal(ImoltReferenceEditorStand.WithoutPermissionPrice, PriceOf(afterRefusal.RootElement));

    // Тот же запрос без маркера отвечает иначе: нехватка входа и нехватка
    // права — разные причины и разные действия пользователя. Один код на оба
    // случая оставил бы участника без подсказки, что делать.
    var guest = await stand.SendJsonAsync(HttpMethod.Patch, path, body, token: null);

    using var guestProblem = await ReferenceChecks.ProblemAsync(
        guest, HttpStatusCode.Unauthorized, AuthenticationRequired);
    Assert.Equal(401, guestProblem.RootElement.GetProperty("status").GetInt32());

    using var afterGuest = await CardAsync(ImoltReferenceEditorStand.WithoutPermissionGroupId);
    Assert.Equal(ImoltReferenceEditorStand.WithoutPermissionPrice, PriceOf(afterGuest.RootElement));
  }

  [Fact(DisplayName = "изменённая вдвое цена перевозки вдвое увеличивает стоимость перевозки расчёта")]
  public async Task ChangedTransportPriceIsCarriedIntoTheNextCalculation()
  {
    var token = await stand.DataManagerTokenAsync();

    var before = await TransportCostAsync();
    Assert.True(
        before > 0,
        $"стоимость перевозки исходного расчёта равна {before}: сравнивать удвоение не с чем");

    var response = await stand.SendJsonAsync(
        HttpMethod.Patch,
        Card(ImoltReferenceEditorStand.CalculationGroupId),
        TransportPriceJson("60.00"),
        token);

    using var updated = await ReferenceChecks.OkAsync(response, "updateWasteGroup");
    Assert.Equal("60.00", PriceOf(updated.RootElement));

    var after = await TransportCostAsync();

    // Сравнивается отношение, а не величина: множители, общие обоим расчётам
    // (плечо перевозки, объём, сезонный коэффициент), сокращаются, и проверка
    // остаётся верной, когда состав формулы дополнят. Цена перевозки живёт
    // только в справочнике (R-043) — второго места, откуда расчёт мог бы её
    // взять, нет.
    Assert.Equal(before * 2, after);
  }

  [Fact(DisplayName = "правка цены двигает дату актуальности цен на день правки")]
  public async Task PriceEditMovesTheFreshnessDate()
  {
    var token = await stand.DataManagerTokenAsync();

    // Предусловие критерия: дата актуальности цен раньше сегодняшней.
    // Наблюдается на своей записи, а не на общей сводке: общую сводку мог
    // сдвинуть соседний класс проверок, а дата этой группы до правки — факт
    // начального набора.
    using var before = await CardAsync(ImoltReferenceEditorStand.FreshnessGroupId);
    Assert.Equal(ImoltReferenceEditorStand.SeedDate, before.RootElement.GetProperty("updatedAt").GetString());
    Assert.True(
        DateOnly.Parse(ImoltReferenceEditorStand.SeedDate, CultureInfo.InvariantCulture)
            < DateOnly.Parse(stand.EditDate, CultureInfo.InvariantCulture),
        $"день начального набора {ImoltReferenceEditorStand.SeedDate} не раньше дня правки {stand.EditDate}: "
            + "предусловие критерия не выполнено, и сдвиг даты проверять не на чем");

    var response = await stand.SendJsonAsync(
        HttpMethod.Patch,
        Card(ImoltReferenceEditorStand.FreshnessGroupId),
        TransportPriceJson("41.00"),
        token);

    using var updated = await ReferenceChecks.OkAsync(response, "updateWasteGroup");
    Assert.Equal(stand.EditDate, updated.RootElement.GetProperty("updatedAt").GetString());

    // Сводка актуальности и справочник берут дату из одного источника
    // (R-048). Полоса «Цены на 17.09.2026» над результатами расчёта после
    // правки обязана показать день правки — иначе пользователь считает по
    // новой цене, а видит старую дату.
    var freshness = await stand.GetAsync(ImoltReferenceEditorStand.DataFreshnessPath);
    using var summary = await ReferenceChecks.OkAsync(freshness, "getDataFreshness");

    Assert.Equal(stand.EditDate, summary.RootElement.GetProperty("pricesUpdatedAt").GetString());
  }

  private static string Card(string wasteGroupId)
      => $"{ImoltReferenceEditorStand.WasteGroupsPath}/{wasteGroupId}";

  private static string TransportPriceJson(string amount)
      => $$"""{ "transportPricePerTonKm": { "amount": "{{amount}}", "currency": "RUB" } }""";

  private static string PriceOf(JsonElement wasteGroup)
      => wasteGroup.GetProperty("transportPricePerTonKm").GetProperty("amount").GetString() ?? string.Empty;

  private static void AssertUntouchedFields(JsonElement wasteGroup, string where)
  {
    Assert.Equal(ImoltReferenceEditorStand.PartialUpdateGroupName, wasteGroup.GetProperty("name").GetString());

    var codes = wasteGroup
        .GetProperty("fkkoCodes")
        .EnumerateArray()
        .Select(code => code.GetString() ?? string.Empty)
        .ToList();

    Assert.True(
        codes.Count == 1 && codes[0] == ImoltReferenceEditorStand.PartialUpdateFkkoCode,
        $"{where}: перечень кодов ФККО после правки одной цены стал «{string.Join(", ", codes)}»");

    Assert.Equal(
        ImoltReferenceEditorStand.PartialUpdateDensity,
        wasteGroup.GetProperty("densityTonPerCubicMeter").GetDouble(),
        4);
  }

  private async Task<JsonDocument> CardAsync(string wasteGroupId)
  {
    var response = await stand.GetAsync(Card(wasteGroupId));

    return await ReferenceChecks.OkAsync(response, "getWasteGroup");
  }

  // Стоимость перевозки по группе расчёта на полигон примера договора.
  // Расчёт выполняется целиком, а не читается сохранённый: критерий требует
  // выполнить «тот же расчёт заново», а сохранённый считался по прежней цене.
  private async Task<decimal> TransportCostAsync()
  {
    var response = await CalculationChecks.PostJsonAsync(
        stand.Client,
        AccessChecks.CalculationsPath,
        CalculationChecks.CalculationRequestJson(
            CalculationChecks.ItemJson(
                ImoltReferenceEditorStand.CalculationGroupId,
                ImoltAccessStand.ConcreteTons,
                "t"),
            ImoltAccessStand.PickupValue,
            ImoltAccessStand.PickupLatitude,
            ImoltAccessStand.PickupLongitude,
            distanceKm: ImoltAccessStand.WideDistanceKm));

    using var calculation = await CalculationChecks.CreatedAsync(response, "createCalculation");

    var options = CalculationChecks.OptionsOf(
        calculation.RootElement,
        ImoltReferenceEditorStand.CalculationGroupId);
    var option = CalculationChecks.Option(options, ImoltReferenceEditorStand.TariffLandfillId);

    return CalculationChecks.AmountValue(option.GetProperty("transportCost"));
  }
}
