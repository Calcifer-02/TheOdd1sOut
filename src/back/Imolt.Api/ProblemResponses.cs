using System.Text.Json;
using Imolt.Shared;
using Microsoft.AspNetCore.Diagnostics;

namespace Imolt.Api;

/// Сборка документа об ошибке формата RFC 9457 — одним местом на всю службу.
/// Клиент ветвится по полю type, а не по заголовку, поэтому код причины
/// берётся из перечня Problems и сверяется с договором машинно.
///
/// @supports: R-011
/// @adr: ADR-0003
internal static class ProblemResponses
{
    /// Обработчик необработанных исключений. Предметные отказы приходят сюда
    /// уже типизированными: остальное — отказ службы, а не запроса.
    public static Action<IApplicationBuilder> ExceptionHandler => builder =>
        builder.Run(async context =>
        {
            var failure = context.Features.Get<IExceptionHandlerFeature>()?.Error;

            var (status, type, title, detail, errors) = failure switch
            {
                // Пределы страницы объявлены договором, и промах по ним — это
                // ошибка запроса. Имя параметра уходит клиенту: без него он не
                // знает, что именно поправить.
                ArgumentOutOfRangeException range => (
                    StatusCodes.Status400BadRequest,
                    Problems.Validation,
                    "Запрос не прошёл проверку",
                    range.Message,
                    new[] { new ProblemField(range.ParamName ?? string.Empty, range.Message) }),
                _ => (
                    StatusCodes.Status500InternalServerError,
                    "about:blank",
                    "Внутренняя ошибка службы",
                    "Повторите попытку позже",
                    Array.Empty<ProblemField>()),
            };

            await WriteAsync(context, status, type, title, detail, errors);
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

    private static async Task WriteAsync(
        HttpContext context,
        int status,
        string type,
        string title,
        string? detail,
        IReadOnlyCollection<ProblemField> errors)
    {
        context.Response.Clear();
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/problem+json; charset=utf-8";

        var document = new Dictionary<string, object?>
        {
            ["type"] = type,
            ["title"] = title,
            ["status"] = status,
            ["detail"] = detail,
            ["instance"] = context.Request.Path.Value,
        };

        if (errors.Count > 0)
        {
            document["errors"] = errors;
        }

        await context.Response.WriteAsync(
            JsonSerializer.Serialize(document, ImoltJson.Options),
            context.RequestAborted);
    }

    private sealed record ProblemField(string Field, string Message);
}
