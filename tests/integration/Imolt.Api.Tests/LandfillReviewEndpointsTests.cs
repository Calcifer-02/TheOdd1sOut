using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Оценки полигонов. Оценка относится к достоверности сведений о полигоне, а
/// не к качеству услуги: по расхождению оценок видно, что цена или статус
/// разошлись с действительностью раньше, чем это заметит менеджер данных.
///
/// Отличие пустой средней оценки от нуля — предмет требования, а не
/// оформление: ноль в интерфейсе читается как худшая оценка, а «оценок нет» —
/// как отсутствие обратной связи.
///
/// Проверка фальсифицируема: она падает, если средняя оценка перестанет
/// считаться по выставленным оценкам (4 и 5 дают ровно 4,5) и если у полигона
/// без отзывов она придёт нулём либо вовсе исчезнет из ответа — договор
/// объявляет поле averageRating обязательным и допускает у него пустое
/// значение.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-031a, AC-031b
/// @supports: R-031
[Collection(ImoltReferencesCollection.Name)]
public sealed class LandfillReviewEndpointsTests(ImoltReferencesStand stand)
{
  [Fact(DisplayName = "список отзывов несёт среднюю оценку по выставленным оценкам")]
  public async Task ReviewPageCarriesTheAverageRating()
  {
    var response = await stand.Client.GetAsync("/v1/landfills/vostok-timohovo/reviews");
    using var document = await ReferenceChecks.OkAsync(response, "listLandfillReviews");
    var page = document.RootElement;

    var ratings = page.GetProperty("items")
        .EnumerateArray()
        .Select(review => review.GetProperty("rating").GetInt32())
        .OrderBy(rating => rating)
        .ToArray();

    // Стенд кладёт полигону «Восток» ровно две оценки — 4 и 5.
    Assert.Equal(new[] { 4, 5 }, ratings);
    Assert.Equal(2, page.GetProperty("total").GetInt32());

    var average = page.GetProperty("averageRating");
    Assert.True(
        average.ValueKind is JsonValueKind.Number,
        $"средняя оценка пришла значением вида {average.ValueKind}: считать по ней нечего");
    Assert.Equal(4.5, average.GetDouble(), 3);
  }

  [Fact(DisplayName = "у полигона без отзывов средняя оценка пуста, а не равна нулю")]
  public async Task LandfillWithoutReviewsHasNoAverageRating()
  {
    var response = await stand.Client.GetAsync("/v1/landfills/iksha/reviews");
    using var document = await ReferenceChecks.OkAsync(response, "listLandfillReviews");
    var page = document.RootElement;

    Assert.Empty(page.GetProperty("items").EnumerateArray());
    Assert.Equal(0, page.GetProperty("total").GetInt32());

    var average = page.GetProperty("averageRating");
    Assert.True(
        average.ValueKind is JsonValueKind.Null,
        $"средняя оценка полигона без отзывов пришла значением «{average}»: "
        + "ноль означает худшую оценку, а не её отсутствие");
  }
}
