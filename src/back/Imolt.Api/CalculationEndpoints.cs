using Imolt.Calculations.Application;
using Imolt.Calculations.Contracts;
using Imolt.Deals.Ports;
using Imolt.Shared;
using Microsoft.AspNetCore.Mvc;

namespace Imolt.Api;

/// Точки области «расчёт»: пересчёт мер, создание расчёта, чтение расчёта,
/// варианты размещения, выбор и распределение. Здесь только связывание HTTP
/// со сценариями области — формула и правила живут в самой области
/// (ADR-0001, ADR-0005).
///
/// @req: R-008, R-014, R-018, R-023, R-024, R-025, R-027, R-030, R-032, R-050
/// @adr: ADR-0003
public static class CalculationEndpoints
{
  private static readonly string[] SortFields =
  [
      PlacementQuery.ByTotal,
      PlacementQuery.ByTransport,
      PlacementQuery.ByDisposal,
      PlacementQuery.ByDistance,
  ];

  public static void MapCalculationEndpoints(this WebApplication app)
  {
    app.MapPost("/v1/amount-conversions", async (
        [FromBody] AmountConversionRequest request,
        [FromServices] CalculationScenarios scenarios,
        CancellationToken cancellationToken) =>
        Results.Ok(await scenarios.ConvertAsync(request, cancellationToken)));

    app.MapGet("/v1/calculations", async (
        HttpContext context,
        [FromQuery] int? limit,
        [FromQuery] int? offset,
        [FromServices] CalculationScenarios scenarios,
        [FromServices] IAccessTokens tokens,
        CancellationToken cancellationToken) =>
    {
      var participant = AccessEndpoints.Participant(context, tokens);

      return Results.Ok(await scenarios.ListAsync(
          participant.Id, PageRequest.Create(limit, offset), cancellationToken));
    });

    app.MapPost("/v1/calculations", async (
        HttpContext context,
        [FromBody] CalculationRequest request,
        [FromServices] CalculationScenarios scenarios,
        [FromServices] IAccessTokens tokens,
        CancellationToken cancellationToken) =>
    {
      // Расчёт доступен гостю (R-050): маркер необязателен, но названный
      // участник становится владельцем — иначе кабинет пуст.
      var owner = AccessEndpoints.Guest(context, tokens)?.Id;
      var calculation = await scenarios.CreateAsync(request, owner, cancellationToken);

      // Договор объявляет 201 и адрес созданного расчёта: по нему страница
      // восстанавливается после перезагрузки (R-002).
      return Results.Created($"/v1/calculations/{calculation.Id}", calculation);
    });

    app.MapGet("/v1/calculations/{calculationId}", async (
        [FromRoute] string calculationId,
        [FromServices] CalculationScenarios scenarios,
        CancellationToken cancellationToken) =>
    {
      var calculation = await scenarios.FindAsync(calculationId, cancellationToken);

      return calculation is null
          ? ProblemResponses.NotFound($"Расчёт {calculationId} не найден")
          : Results.Ok(calculation);
    });

    app.MapGet("/v1/calculations/{calculationId}/options", async (
        [FromRoute] string calculationId,
        [FromQuery] string wasteGroupId,
        [FromQuery] string? sort,
        [FromQuery] string? order,
        [FromQuery] string? distanceMode,
        [FromQuery] int? distanceKm,
        [FromQuery] int? limit,
        [FromQuery] int? offset,
        [FromServices] CalculationScenarios scenarios,
        CancellationToken cancellationToken) =>
    {
      var query = new PlacementQuery(
          wasteGroupId,
          Checked(sort, SortFields, nameof(sort), PlacementQuery.ByTotal),
          Checked(order, [PlacementQuery.Ascending, PlacementQuery.Descending], nameof(order), PlacementQuery.Ascending),
          new DistanceFilter(
              Checked(
                  distanceMode,
                  [DistanceFilter.AtMost, DistanceFilter.AtLeast],
                  nameof(distanceMode),
                  DistanceFilter.AtMost),
              distanceKm ?? DistanceFilter.DefaultKm));

      var page = await scenarios.OptionsAsync(
          calculationId, query, PageRequest.Create(limit, offset), cancellationToken);

      // Одним кодом отвечают два разных «нет»: нет расчёта и нет такой
      // вкладки в нём. Текст отказа их различает — по коду клиент решает
      // одинаково, а показать пользователю надо разное.
      return page is null
          ? ProblemResponses.NotFound(
              $"В расчёте {calculationId} нет вкладки группы отходов {wasteGroupId}")
          : Results.Ok(page);
    });

    app.MapGet("/v1/calculations/{calculationId}/route", async (
        [FromRoute] string calculationId,
        [FromServices] CalculationScenarios scenarios,
        CancellationToken cancellationToken) =>
    {
      var route = await scenarios.RouteAsync(calculationId, cancellationToken);

      return route is null
          ? ProblemResponses.NotFound($"Расчёт {calculationId} не найден")
          : Results.Ok(route);
    });

    app.MapPut("/v1/calculations/{calculationId}/selection", async (
        [FromRoute] string calculationId,
        [FromBody] SelectionRequest request,
        [FromServices] CalculationScenarios scenarios,
        CancellationToken cancellationToken) =>
    {
      var state = await scenarios.SelectAsync(calculationId, request?.Entries, cancellationToken);

      return state is null
          ? ProblemResponses.NotFound($"Расчёт {calculationId} не найден")
          : Results.Ok(state);
    });

    app.MapPut("/v1/calculations/{calculationId}/allocation", async (
        [FromRoute] string calculationId,
        [FromBody] AllocationRequest request,
        [FromServices] CalculationScenarios scenarios,
        CancellationToken cancellationToken) =>
    {
      var state = await scenarios.AllocateAsync(calculationId, request?.Entries, cancellationToken);

      return state is null
          ? ProblemResponses.NotFound($"Расчёт {calculationId} не найден")
          : Results.Ok(state);
    });
  }

  // Значение вне объявленного договором перечня — ошибка запроса, а не тихий
  // возврат к умолчанию: иначе опечатка в сортировке выглядит как исправный
  // ответ в другом порядке.
  private static string Checked(string? value, string[] allowed, string name, string fallback)
  {
    if (string.IsNullOrWhiteSpace(value))
    {
      return fallback;
    }

    return allowed.Contains(value, StringComparer.Ordinal)
        ? value
        : throw new ArgumentOutOfRangeException(name, value, $"допустимые значения: {string.Join(", ", allowed)}");
  }
}
