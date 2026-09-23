using Imolt.Deals.Application;
using Imolt.Deals.Contracts;
using Imolt.Deals.Ports;
using Imolt.Shared;
using Microsoft.AspNetCore.Mvc;

namespace Imolt.Api;

/// Точки доступа: обмен стартовых параметров мини-приложения на маркер,
/// профиль, заявка на подписку и заказ услуги по документации.
///
/// Здесь же живёт единственное место, где маркер превращается в участника:
/// второе такое место означало бы два разных ответа на вопрос «кто пришёл»
/// (ADR-0006).
///
/// @req: R-049, R-050, R-051
/// @adr: ADR-0003
public static class AccessEndpoints
{
  public static void MapAccessEndpoints(this WebApplication app)
  {
    app.MapPost("/v1/auth/sessions", async (
        [FromBody] SessionRequest? request,
        [FromServices] AccessScenarios scenarios,
        CancellationToken cancellationToken) =>
        Results.Created("/v1/profile", await scenarios.SignInAsync(request, cancellationToken)));

    app.MapGet("/v1/profile", async (
        HttpContext context,
        [FromServices] AccessScenarios scenarios,
        [FromServices] IAccessTokens tokens,
        CancellationToken cancellationToken) =>
    {
      var participant = Participant(context, tokens);
      var profile = await scenarios.ProfileAsync(participant.Id, cancellationToken);

      // Учётная запись, которой уже нет, — тот же «личности нет»: маркер
      // действителен, а участника за ним не стоит.
      return profile is null
          ? throw new AuthenticationRequiredException("Учётная запись не найдена")
          : Results.Ok(profile);
    });

    app.MapPost("/v1/subscription-requests", async (
        HttpContext context,
        [FromBody] SubscriptionRequestInput? input,
        [FromServices] AccessScenarios scenarios,
        [FromServices] IAccessTokens tokens,
        CancellationToken cancellationToken) =>
    {
      var participant = Participant(context, tokens);

      return Results.Created(
          "/v1/profile",
          await scenarios.RequestSubscriptionAsync(participant.Id, input, cancellationToken));
    });

    app.MapPost("/v1/document-service-orders", async (
        HttpContext context,
        [FromBody] DocumentServiceOrderInput? input,
        [FromServices] AccessScenarios scenarios,
        [FromServices] IAccessTokens tokens,
        CancellationToken cancellationToken) =>
    {
      var participant = Participant(context, tokens);

      return Results.Created(
          "/v1/document-services",
          await scenarios.OrderServiceAsync(participant.Id, input, cancellationToken));
    });
  }

  /// Участник по заголовку Authorization. Отсутствие маркера и негодный
  /// маркер дают один исход: клиенту различать их незачем, а называть,
  /// какой именно маркер не подошёл, — подсказка подбирающему.
  public static Participant Participant(HttpContext context, IAccessTokens tokens)
      => tokens.Resolve(Bearer(context))
          ?? throw new AuthenticationRequiredException(
              "Операция доступна участнику с сессией: откройте мини-приложение в MAX");

  /// Участник, если он назвался. Пусто означает гостя — договор объявляет
  /// расчёт доступным без входа (R-050).
  public static Participant? Guest(HttpContext context, IAccessTokens tokens)
      => tokens.Resolve(Bearer(context));

  private static string? Bearer(HttpContext context)
  {
    var header = context.Request.Headers.Authorization.ToString();

    return header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
        ? header["Bearer ".Length..].Trim()
        : null;
  }
}

/// Операция требует участника с сессией, а его нет. Договор объявляет такой
/// исход кодом 401 с кодом причины authentication-required.
///
/// @supports: R-050
public sealed class AuthenticationRequiredException(string message) : Exception(message)
{
}
