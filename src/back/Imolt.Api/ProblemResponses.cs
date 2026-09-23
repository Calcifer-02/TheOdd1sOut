using System.Globalization;
using System.Text.Json;
using Imolt.Calculations.Ports;
using Imolt.Deals.Ports;
using Imolt.References.Ports;
using Imolt.Shared;
using Microsoft.AspNetCore.Diagnostics;

namespace Imolt.Api;

/// Сборка документа об ошибке формата RFC 9457 — одним местом на всю службу.
/// Клиент ветвится по полю type, а не по заголовку, поэтому код причины
/// берётся из перечня Problems и сверяется с договором машинно.
///
/// Названы те требования, чьи отказы эта единица превращает в документ:
/// зонтичное R-011 уровня L1 непосредственной реализации не имеет.
///
/// @supports: R-014, R-020, R-030
/// @adr: ADR-0003
public static class ProblemResponses
{
  /// Обработчик необработанных исключений. Предметные отказы приходят сюда
  /// уже типизированными: остальное — отказ службы, а не запроса.
  public static Action<IApplicationBuilder> ExceptionHandler => builder =>
      builder.Run(async context =>
      {
        var failure = context.Features.Get<IExceptionHandlerFeature>()?.Error;

        switch (failure)
        {
          // Пределы запроса объявлены договором, и промах по ним — ошибка
          // запроса. Имя параметра уходит клиенту: без него он не знает, что
          // именно поправить.
          //
          // Именно «вне диапазона», а не любое ArgumentException: негодная
          // строка подключения — тоже ArgumentException, но это отказ службы,
          // и выдавать его за вину клиента нельзя.
          case ArgumentOutOfRangeException request:
            await WriteAsync(
                context,
                StatusCodes.Status400BadRequest,
                Problems.Validation,
                "Запрос не прошёл проверку",
                request.Message,
                [new ProblemField(request.ParamName ?? string.Empty, request.Message)]);
            break;

          // Запись справочника не заведена. Отдельный исход, а не ошибка
          // запроса: клиент назвал существующее поле, но записи за ним нет.
          case ReferenceMissingException missing:
            await WriteAsync(
                context,
                StatusCodes.Status404NotFound,
                Problems.NotFound,
                "Запись не найдена",
                missing.Message,
                []);
            break;

          // Распределение не сходится с объёмом группы. Договор объявляет
          // 422: запрос разобран, но нарушает правило предметной области.
          case AllocationMismatchException mismatch:
            await WriteAsync(
                context,
                StatusCodes.Status422UnprocessableEntity,
                Problems.AllocationMismatch,
                "Распределение не сходится с объёмом",
                mismatch.Message,
                []);
            break;

          // Полигон не годится для этой строки расчёта. Тоже 422, но код
          // причины другой: клиент ветвится по нему, а не по заголовку.
          case PlacementUnavailableException placement:
            await WriteAsync(
                context,
                StatusCodes.Status422UnprocessableEntity,
                Problems.Validation,
                "Полигон недоступен для этой группы отходов",
                placement.Message,
                []);
            break;

          // Плеча перевозки нет. Заголовка «повторите через N секунд» здесь
          // нет намеренно: расстояние не появится само по себе, и обещание
          // повтора было бы ложным (R-020).
          case RoadDistanceUnavailableException distance:
            await WriteAsync(
                context,
                StatusCodes.Status503ServiceUnavailable,
                Problems.DistanceServiceUnavailable,
                "Не удалось рассчитать расстояния",
                distance.Message,
                []);
            break;

          // Закреплять в предложении нечего: полигон не выбран. Код 422 —
          // запрос разобран, нарушено правило предметной области.
          case NothingToQuoteException nothing:
            await WriteAsync(
                context,
                StatusCodes.Status422UnprocessableEntity,
                Problems.Validation,
                "Предложение не выпущено",
                nothing.Message,
                []);
            break;

          // Согласия на обработку персональных данных нет. Принять данные и
          // отказать — худший из исходов, и снаружи он неотличим от честного
          // отказа (R-054).
          case ConsentMissingException consent:
            await WriteAsync(
                context,
                StatusCodes.Status422UnprocessableEntity,
                Problems.Validation,
                "Нет согласия на обработку персональных данных",
                consent.Message,
                []);
            break;

          // Личности нет: подпись стартовых параметров не сошлась, они
          // устарели либо маркер не предъявлен. Клиенту различать эти случаи
          // незачем — во всех трёх он открывает мини-приложение заново.
          case IdentityRefusedException identity:
            await WriteAsync(
                context,
                StatusCodes.Status401Unauthorized,
                Problems.AuthenticationRequired,
                "Личность не подтверждена",
                identity.Message,
                []);
            break;

          case AuthenticationRequiredException required:
            await WriteAsync(
                context,
                StatusCodes.Status401Unauthorized,
                Problems.AuthenticationRequired,
                "Нужна сессия участника",
                required.Message,
                []);
            break;

          // Отказ внешнего источника не равен отказу обслуживания: заголовок
          // называет, через сколько повторять (ADR-0002, инвариант 5).
          case UpstreamUnavailableException upstream:
            // Заголовок читает не человек, а клиент: культура здесь инвариантная,
            // иначе в русской локали число уедет с разделителем разрядов.
            context.Response.Headers.RetryAfter =
                upstream.RetryAfterSeconds.ToString(CultureInfo.InvariantCulture);
            await WriteAsync(
                context,
                StatusCodes.Status503ServiceUnavailable,
                Problems.DistanceServiceUnavailable,
                "Внешняя служба не ответила",
                upstream.Message,
                []);
            break;

          default:
            await WriteAsync(
                context,
                StatusCodes.Status500InternalServerError,
                "about:blank",
                "Внутренняя ошибка службы",
                "Повторите попытку позже",
                []);
            break;
        }
      });

  /// Неизвестный путь. Ответ тем же документом, что и остальные отказы:
  /// пустое тело разбирать нечем.
  public static RequestDelegate UnknownPath => context => WriteAsync(
      context,
      StatusCodes.Status404NotFound,
      Problems.NotFound,
      "Путь не найден",
      $"Служба не обслуживает путь {context.Request.Path}",
      []);

  /// Запись справочника не найдена. Отдельный ответ, а не пустое тело:
  /// опечатка в идентификаторе не должна читаться как «такого просто нет».
  public static IResult NotFound(string detail) => Results.Json(
      Document(Problems.NotFound, "Запись не найдена", StatusCodes.Status404NotFound, detail, null, []),
      ImoltJson.Options,
      contentType: "application/problem+json; charset=utf-8",
      statusCode: StatusCodes.Status404NotFound);

  private static Task WriteAsync(
      HttpContext context,
      int status,
      string type,
      string title,
      string? detail,
      IReadOnlyCollection<ProblemField> errors)
  {
    context.Response.StatusCode = status;
    context.Response.ContentType = "application/problem+json; charset=utf-8";

    var document = Document(type, title, status, detail, context.Request.Path.Value, errors);

    return context.Response.WriteAsync(
        JsonSerializer.Serialize(document, ImoltJson.Options),
        context.RequestAborted);
  }

  private static Dictionary<string, object?> Document(
      string type,
      string title,
      int status,
      string? detail,
      string? instance,
      IReadOnlyCollection<ProblemField> errors)
  {
    var document = new Dictionary<string, object?>
    {
      ["type"] = type,
      ["title"] = title,
      ["status"] = status,
    };

    if (detail is not null)
    {
      document["detail"] = detail;
    }

    if (instance is not null)
    {
      document["instance"] = instance;
    }

    if (errors.Count > 0)
    {
      document["errors"] = errors;
    }

    return document;
  }

  private sealed record ProblemField(string Field, string Message);
}
