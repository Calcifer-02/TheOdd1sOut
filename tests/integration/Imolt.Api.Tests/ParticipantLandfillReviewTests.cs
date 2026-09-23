using System.Net;
using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Оставление отзыва о полигоне участником с сессией (R-031, R-048).
/// Чтение отзывов со средней оценкой уже отвечает, создание — нет: требование
/// неатомарно, и это записано в реестре. Здесь проверяется вторая половина.
///
/// Оценка относится к достоверности сведений о полигоне, а не к качеству
/// услуги: по расхождению оценок видно, что цена или статус разошлись с
/// действительностью раньше, чем это заметит менеджер данных (риск AR-002).
/// Поэтому отзыв именной: у оценки без автора нет ни веса, ни способа
/// отличить её от накрутки.
///
/// Средняя оценка сверяется через уже реализованную операцию
/// listLandfillReviews, а не читается из базы: пересчёт, не дошедший до
/// ответа, пользователю не виден, а значит и не сделан. Величина считается от
/// состояния, которое проверка наблюдает сама, а не от числа в начальном
/// наборе: набор отзывов не содержит, и жёстко записанное значение сломалось
/// бы от первого же соседнего отзыва.
///
/// Проверка фальсифицируема: она падает, если отзыв перестанет приниматься,
/// если средняя оценка полигона не учтёт выставленную оценку и если отзыв
/// примут без маркера.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-031c
[Collection(ImoltAccessCollection.Name)]
public sealed class ParticipantLandfillReviewTests(ImoltAccessStand stand)
{
  /// Оценка из критерия AC-031c.
  private const int Rating = 4;

  private static string ReviewsPath
      => $"/v1/landfills/{ImoltAccessStand.ReviewedLandfillId}/reviews";

  [Fact(DisplayName = "отзыв участника принимается и меняет среднюю оценку полигона")]
  public async Task ParticipantReviewIsAcceptedAndRecomputesTheAverageRating()
  {
    const long maxUserId = 831001;
    var token = await AccessChecks.TokenAsync(stand.Client, maxUserId);

    var (countBefore, sumBefore) = await RatingsAsync();

    var response = await AccessChecks.PostJsonAsync(
        stand.Client,
        ReviewsPath,
        $$"""{ "rating": {{Rating}}, "text": "тариф на месте совпал со справочником" }""",
        token);

    using var review = await ReferenceChecks.SuccessAsync(
        response, "createLandfillReview", HttpStatusCode.Created);

    Assert.Equal(Rating, review.RootElement.GetProperty("rating").GetInt32());
    Assert.Equal(
        ImoltAccessStand.ReviewedLandfillId,
        review.RootElement.GetProperty("landfillId").GetString());

    var (countAfter, sumAfter) = await RatingsAsync();

    Assert.Equal(countBefore + 1, countAfter);

    // Средняя пересчитана с учётом отзыва, а не оставлена прежней и не
    // заменена последней оценкой: сумма выросла ровно на выставленную оценку.
    Assert.Equal(sumBefore + Rating, sumAfter, 3);
  }

  [Fact(DisplayName = "отзыв без маркера не принимается")]
  public async Task ReviewWithoutTokenIsRefused()
  {
    var response = await AccessChecks.PostJsonAsync(
        stand.Client,
        ReviewsPath,
        $$"""{ "rating": {{Rating}} }""",
        token: null);

    (await ReferenceChecks.ProblemAsync(
        response,
        HttpStatusCode.Unauthorized,
        "urn:imolt:problem:authentication-required")).Dispose();
  }

  // Число оценок и их сумма по ответу операции чтения. Сумма, а не средняя:
  // по ней видно, что учтена именно выставленная оценка, тогда как средняя
  // могла бы совпасть случайно.
  private async Task<(int Count, double Sum)> RatingsAsync()
  {
    // Предел страницы задан явно: по умолчанию операция отдаёт десять записей
    // (договор, parameters/Limit), и счёт по неполной странице разошёлся бы со
    // средней, посчитанной службой по всем отзывам.
    var response = await stand.Client.GetAsync($"{ReviewsPath}?limit=100");
    using var page = await ReferenceChecks.OkAsync(response, "listLandfillReviews");

    var total = page.RootElement.GetProperty("total").GetInt32();
    var average = page.RootElement.GetProperty("averageRating");

    Assert.True(
        total <= 100,
        $"у полигона {ImoltAccessStand.ReviewedLandfillId} накопилось {total} оценок: "
            + "страница в сто записей перестала охватывать их целиком");

    // Средняя пуста ровно тогда, когда оценок нет: ноль означал бы худшую
    // оценку, а не её отсутствие (AC-031b).
    return average.ValueKind is JsonValueKind.Null
        ? (total, 0)
        : (total, average.GetDouble() * total);
  }
}
