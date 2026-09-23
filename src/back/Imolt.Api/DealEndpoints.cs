using Imolt.Deals.Application;
using Imolt.Deals.Contracts;
using Imolt.Shared;
using Microsoft.AspNetCore.Mvc;

namespace Imolt.Api;

/// Точки области «сделка»: выпуск и скачивание коммерческого предложения,
/// заявка на вывоз, каталог услуг по документации. Здесь только связывание
/// HTTP со сценариями области (ADR-0001, ADR-0005).
///
/// @req: R-036, R-052, R-053
/// @adr: ADR-0003
public static class DealEndpoints
{
  public static void MapDealEndpoints(this WebApplication app)
  {
    app.MapPost("/v1/calculations/{calculationId}/quotes", async (
        [FromRoute] string calculationId,
        [FromBody] QuoteRequest? request,
        [FromServices] DealScenarios scenarios,
        CancellationToken cancellationToken) =>
    {
      var quote = await scenarios.IssueAsync(calculationId, request, cancellationToken);

      return quote is null
          ? ProblemResponses.NotFound($"Расчёт {calculationId} не найден")
          : Results.Created(quote.DocumentUrl, quote);
    });

    app.MapGet("/v1/quotes/{quoteId}/document", async (
        [FromRoute] string quoteId,
        [FromServices] DealScenarios scenarios,
        CancellationToken cancellationToken) =>
    {
      var document = await scenarios.DocumentAsync(quoteId, cancellationToken);

      // Имя файла называется явно: без него документ сохранится под именем
      // пути запроса, и в папке загрузок окажется файл «document».
      return document is null
          ? ProblemResponses.NotFound($"Коммерческое предложение {quoteId} не найдено")
          : Results.File(document, "application/pdf", $"КП-{quoteId}.pdf");
    });

    app.MapPost("/v1/pickup-requests", async (
        [FromBody] PickupRequestInput? input,
        [FromServices] DealScenarios scenarios,
        CancellationToken cancellationToken) =>
        Results.Created(string.Empty, await scenarios.AcceptAsync(input, cancellationToken)));

    app.MapGet("/v1/document-services", async (
        [FromQuery] int? limit,
        [FromQuery] int? offset,
        [FromServices] DealScenarios scenarios,
        CancellationToken cancellationToken) =>
        Results.Ok(await scenarios.ServicesAsync(PageRequest.Create(limit, offset), cancellationToken)));
  }
}
