using System.Net;
using Imolt.Shared;
using Xunit;

namespace Imolt.Api.Tests;

/// Справочник групп отходов: карточка, поиск по названию и коду каталога
/// отходов, пределы страницы. Цена перевозки за тонна-километр и коэффициент
/// плотности — свойства группы, и второго места их хранения нет.
///
/// Ожидаемые значения взяты из начального набора данных
/// (src/back/Imolt.Database/Migrations/0002_demo_dataset.sql), а форма ответа
/// сверяется с договором машинно: схемы WasteGroup и WasteGroupPage.
///
/// Проверка фальсифицируема: она падает, если цена перевозки уедет числом
/// вместо строки с двумя знаками или разойдётся с набором, если поиск
/// перестанет смотреть в коды каталога или начнёт возвращать всё подряд, если
/// несуществующая группа отдаст пустую карточку вместо отказа и если страница
/// по умолчанию отдаст не десять записей либо примет limit сверх предела
/// договора.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-039a, AC-039b, AC-013a, AC-013b, AC-060a, AC-060b
[Collection(ImoltReferencesCollection.Name)]
public sealed class WasteGroupEndpointsTests(ImoltReferencesStand stand)
{
  [Fact(DisplayName = "карточка группы отходов несёт коды каталога, цену перевозки строкой и дату актуальности")]
  public async Task WasteGroupCardCarriesEveryDeclaredProperty()
  {
    var response = await stand.Client.GetAsync("/v1/waste-groups/beton-lom");
    using var document = await ReferenceChecks.OkAsync(response, "getWasteGroup");
    var group = document.RootElement;

    Assert.Equal("beton-lom", group.GetProperty("id").GetString());
    Assert.Equal("Лом бетона и железобетона", group.GetProperty("name").GetString());

    var codes = group.GetProperty("fkkoCodes")
        .EnumerateArray()
        .Select(code => code.GetString() ?? string.Empty)
        .ToArray();
    Assert.Equal(new[] { "8 22 201 01 21 5" }, codes);

    // «12.00» — цена перевозки группы beton-lom за тонна-километр из
    // начального набора. Строка с двумя знаками после точки: двоичная
    // дробь округляет рубли по дороге, а смета этого не прощает (схема
    // Money договора).
    var price = group.GetProperty("transportPricePerTonKm");
    Assert.Equal("12.00", price.GetProperty("amount").GetString());
    Assert.Equal("RUB", price.GetProperty("currency").GetString());

    Assert.Equal(2.0, group.GetProperty("densityTonPerCubicMeter").GetDouble(), 4);
    Assert.Equal(ImoltReferencesStand.DataDate, group.GetProperty("updatedAt").GetString());
  }

  [Fact(DisplayName = "несуществующая группа отходов отвечает отказом, а не пустой карточкой")]
  public async Task MissingWasteGroupAnswersWithNotFoundProblem()
  {
    // Сначала существующая группа. Без этого утверждения проверку прошла
    // бы и незарегистрированная точка: запасной обработчик службы тоже
    // отвечает 404 с кодом not-found, и отсутствие маршрута выглядело бы
    // как исправно работающий отказ.
    var existing = await stand.Client.GetAsync("/v1/waste-groups/beton-lom");
    Assert.Equal(HttpStatusCode.OK, existing.StatusCode);

    var response = await stand.Client.GetAsync("/v1/waste-groups/net-takoy-gruppy");
    using var document = await ReferenceChecks.ProblemAsync(
        response, HttpStatusCode.NotFound, Problems.NotFound);

    var title = document.RootElement.GetProperty("title").GetString();
    Assert.False(string.IsNullOrWhiteSpace(title), "заголовок отказа пуст: показывать пользователю нечего");
  }

  [Fact(DisplayName = "поиск по части названия находит группу и не приносит посторонние")]
  public async Task SearchByNameFragmentFindsOnlyMatchingGroups()
  {
    var response = await stand.Client.GetAsync(Query("бетон"));
    using var document = await ReferenceChecks.OkAsync(response, "listWasteGroups");
    var ids = ReferenceChecks.Ids(document.RootElement);

    Assert.Contains("beton-lom", ids);

    // Поиск, возвращающий весь справочник, формально «содержит искомое».
    // Отрицательное утверждение отделяет отбор от его отсутствия.
    Assert.DoesNotContain("drevesina", ids);
    Assert.DoesNotContain("kirpich-lom", ids);
  }

  [Fact(DisplayName = "поиск по коду каталога отходов находит группу с этим кодом")]
  public async Task SearchByFkkoCodeFindsTheGroupThatCarriesIt()
  {
    var response = await stand.Client.GetAsync(Query("8 22 201"));
    using var document = await ReferenceChecks.OkAsync(response, "listWasteGroups");
    var ids = ReferenceChecks.Ids(document.RootElement);

    Assert.Contains("beton-lom", ids);

    // У «Лома кирпичной кладки» код 8 23 101 — отбор по коду обязан её
    // отсечь. У «Древесины» кода каталога нет намеренно (начальный набор,
    // комментарий про Q-015): поиск по коду её не находит, и это
    // наблюдаемый факт, а не недосмотр набора.
    Assert.DoesNotContain("kirpich-lom", ids);
    Assert.DoesNotContain("drevesina", ids);
  }

  [Fact(DisplayName = "страница справочника по умолчанию ограничена десятью записями")]
  public async Task DefaultPageHoldsTenRecords()
  {
    var response = await stand.Client.GetAsync("/v1/waste-groups");
    using var document = await ReferenceChecks.OkAsync(response, "listWasteGroups");
    var page = document.RootElement;

    // Десять — значение по умолчанию из договора (parameters/Limit,
    // default: 10; R-060): первый экран показывает десять записей,
    // остальные догружаются.
    Assert.Equal(10, page.GetProperty("items").GetArrayLength());
    Assert.Equal(10, page.GetProperty("limit").GetInt32());
    Assert.Equal(0, page.GetProperty("offset").GetInt32());

    var total = page.GetProperty("total").GetInt32();
    Assert.True(
        total > 10,
        $"всего записей {total}: на справочнике не длиннее страницы предел ничем не подтверждается");
  }

  [Fact(DisplayName = "limit больше ста отклоняется кодом 400, а ровно сто принимается")]
  public async Task LimitAboveTheContractCeilingIsRejected()
  {
    // Сто — верхняя граница договора (parameters/Limit, maximum: 100).
    // Без утверждения о принятой сотне отказ на 101 дала бы и служба,
    // отвергающая любой limit.
    var accepted = await stand.Client.GetAsync("/v1/waste-groups?limit=100");
    Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);

    var response = await stand.Client.GetAsync("/v1/waste-groups?limit=101");
    using var document = await ReferenceChecks.ProblemAsync(
        response, HttpStatusCode.BadRequest, Problems.Validation);

    var detail = document.RootElement.TryGetProperty("detail", out var value) ? value.GetString() : null;
    Assert.False(
        string.IsNullOrWhiteSpace(detail),
        "отказ не называет, что именно поправить: по такому ответу клиент не исправит запрос");
  }

  private static string Query(string text) => "/v1/waste-groups?query=" + Uri.EscapeDataString(text);
}
