using Microsoft.AspNetCore.Mvc;
using System.Text.Json.Serialization;
using Imolt.References.Contracts;
using Imolt.Deals.Ports;
using Imolt.References.Ports;
using Imolt.Shared;

namespace Imolt.Api;

/// Точки области «справочники»: группы отходов, полигоны, отзывы, актуальность
/// данных и подсказки адреса. Здесь только связывание HTTP с портами области —
/// предметные правила живут в самой области (ADR-0001, ADR-0005).
///
/// @req: R-012, R-013, R-031, R-039, R-040, R-041, R-048, R-088
/// @adr: ADR-0003
public static class ReferenceEndpoints
{
  /// Наименьшая длина запроса подсказок по договору: на двух символах
  /// подсказка бессмысленна, а нагрузка на источник — настоящая.
  private const int MinimalSuggestionQuery = 3;

  private const int MaximalSuggestionQuery = 200;

  public static void MapReferenceEndpoints(this WebApplication app)
  {
    app.MapGet("/v1/waste-groups", async (
        [FromQuery] string? query,
        [FromQuery] int? limit,
        [FromQuery] int? offset,
        [FromServices] IWasteGroupCatalog catalog,
        CancellationToken cancellationToken) =>
        Results.Ok(await catalog.SearchAsync(query, PageRequest.Create(limit, offset), cancellationToken)));

    app.MapGet("/v1/waste-groups/{wasteGroupId}", async (
        [FromRoute] string wasteGroupId,
        [FromServices] IWasteGroupCatalog catalog,
        CancellationToken cancellationToken) =>
    {
      var group = await catalog.FindAsync(wasteGroupId, cancellationToken);

      return group is null
          ? ProblemResponses.NotFound($"Группа отходов {wasteGroupId} не найдена")
          : Results.Ok(group);
    });

    app.MapGet("/v1/landfills", async (
        [FromQuery] string? query,
        [FromQuery] string? wasteGroupId,
        [FromQuery] string? status,
        [FromQuery] string? sort,
        [FromQuery] string? order,
        [FromQuery] int? limit,
        [FromQuery] int? offset,
        [FromServices] ILandfillRegistry registry,
        CancellationToken cancellationToken) =>
    {
      // Статус вне объявленного перечня — ошибка запроса, а не пустой ответ:
      // иначе опечатка в отборе выглядит как «таких полигонов нет».
      if (status is not null and not ("active" or "blocked" or "unconfirmed"))
      {
        throw new ArgumentOutOfRangeException(
            nameof(status), status, "статус полигона — active, blocked либо unconfirmed");
      }

      // Поле порядка вне объявленного перечня — ошибка запроса, а не молчаливый
      // возврат к порядку по умолчанию: иначе опечатка выглядит как работающая
      // сортировка, показывающая не тот порядок (R-088).
      var sortField = sort switch
      {
        null or "" or "name" => LandfillSort.Name,
        "status" => LandfillSort.Status,
        "updatedAt" => LandfillSort.UpdatedAt,
        "tariff" => LandfillSort.Tariff,
        _ => throw new ArgumentOutOfRangeException(
            nameof(sort), sort, "поле порядка — name, status, updatedAt либо tariff"),
      };

      if (order is not null and not ("asc" or "desc"))
      {
        throw new ArgumentOutOfRangeException(nameof(order), order, "направление порядка — asc либо desc");
      }

      var filter = new LandfillFilter(query, wasteGroupId, status, sortField, order == "desc");

      return Results.Ok(await registry.SearchAsync(filter, PageRequest.Create(limit, offset), cancellationToken));
    });

    app.MapGet("/v1/landfills/{landfillId}", async (
        [FromRoute] string landfillId,
        [FromServices] ILandfillRegistry registry,
        CancellationToken cancellationToken) =>
    {
      var card = await registry.FindAsync(landfillId, cancellationToken);

      return card is null
          ? ProblemResponses.NotFound($"Полигон {landfillId} не найден")
          : Results.Ok(card);
    });

    app.MapPost("/v1/landfills/{landfillId}/reviews", async (
        HttpContext context,
        [FromRoute] string landfillId,
        [FromBody] LandfillReviewInput? input,
        [FromServices] ILandfillRegistry registry,
        [FromServices] IAccessTokens tokens,
        CancellationToken cancellationToken) =>
    {
      // Оценка достоверности сведений именная: аноним ничего не говорит о
      // доверии к самой оценке (R-031).
      var participant = AccessEndpoints.Participant(context, tokens);
      var review = await registry.AddReviewAsync(
          landfillId,
          participant.Id,
          input?.Rating ?? throw new ArgumentOutOfRangeException(nameof(input), "оценка обязательна"),
          input.Text,
          cancellationToken);

      return review is null
          ? ProblemResponses.NotFound($"Полигон {landfillId} не найден")
          : Results.Created($"/v1/landfills/{landfillId}/reviews", review);
    });

    app.MapGet("/v1/landfills/{landfillId}/reviews", async (
        [FromRoute] string landfillId,
        [FromQuery] int? limit,
        [FromQuery] int? offset,
        [FromServices] ILandfillRegistry registry,
        CancellationToken cancellationToken) =>
    {
      // Отзывы несуществующего полигона — не пустой список, а отказ: иначе
      // опечатка в адресе читается как «полигон без отзывов».
      if (!await registry.ExistsAsync(landfillId, cancellationToken))
      {
        return ProblemResponses.NotFound($"Полигон {landfillId} не найден");
      }

      var (reviews, average) = await registry.ReviewsAsync(
          landfillId, PageRequest.Create(limit, offset), cancellationToken);

      return Results.Ok(new LandfillReviewPageResponse(
          reviews.Total, reviews.Limit, reviews.Offset, reviews.Items, average));
    });

    app.MapGet("/v1/data-freshness", async (
        [FromServices] IDataFreshnessSource freshness,
        CancellationToken cancellationToken) =>
        Results.Ok(await freshness.ReadAsync(cancellationToken)));

    app.MapGet("/v1/address-suggestions", async (
        [FromQuery] string? query,
        [FromQuery] int? limit,
        [FromServices] IAddressSuggestions suggestions,
        CancellationToken cancellationToken) =>
    {
      if (query is null || query.Trim().Length < MinimalSuggestionQuery)
      {
        throw new ArgumentOutOfRangeException(
            nameof(query), query, $"запрос подсказок — не короче {MinimalSuggestionQuery} символов");
      }

      if (query.Length > MaximalSuggestionQuery)
      {
        throw new ArgumentOutOfRangeException(
            nameof(query), query.Length, $"запрос подсказок — не длиннее {MaximalSuggestionQuery} символов");
      }

      var page = PageRequest.Create(limit, offset: 0);
      var found = await suggestions.SuggestAsync(query, page.Limit, cancellationToken);

      // Общее число равно числу найденных: источник подсказок отдаёт верхушку
      // совпадений, а не страницу из известного набора.
      return Results.Ok(Pages.Of(found, found.Count, page));
    });
  }
}

/// Страница отзывов: конверт списка плюс средняя оценка. Отдельная форма
/// нужна потому, что договор объявляет среднюю оценку обязательным полем,
/// допускающим пустоту, — её нельзя опустить при отсутствии отзывов (R-031).
///
/// @supports: R-031
public sealed record LandfillReviewPageResponse(
    int Total,
    int Limit,
    int Offset,
    IReadOnlyList<LandfillReview> Items,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] double? AverageRating);
