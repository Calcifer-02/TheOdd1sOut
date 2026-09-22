using System.Net;
using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Общая часть проверок точек договора: сверка ответа с договором и разбор
/// страницы. Живёт одним местом, потому что иначе договорный оракул вызывался
/// бы в каждой проверке по-своему и форма ответа проверялась бы где-то строже,
/// где-то мягче. Заведена для области «справочники», областью «расчёт»
/// переиспользуется: оракул общий, и второй его обёртки быть не должно.
///
/// @supports: R-011
internal static class ReferenceChecks
{
  // Договор разбирается один раз на прогон: файл на две с лишним тысячи
  // строк, а обращений к нему — по нескольку на каждую проверку.
  private static readonly Lazy<ContractOracle> Oracle = new(ContractOracle.FromContract);

  /// Успешный ответ: код 200 и тело, совпадающее со схемой операции.
  public static Task<JsonDocument> OkAsync(HttpResponseMessage response, string operationId)
      => SuccessAsync(response, operationId, HttpStatusCode.OK);

  /// Успешный ответ с объявленным договором кодом состояния. Код передаётся
  /// отдельно, потому что создание расчёта отвечает 201, а не 200, и схема
  /// сверяется с той записью договора, которая этому коду соответствует.
  public static async Task<JsonDocument> SuccessAsync(
      HttpResponseMessage response,
      string operationId,
      HttpStatusCode expectedStatus)
  {
    var body = await response.Content.ReadAsStringAsync();

    Assert.True(
        response.StatusCode == expectedStatus,
        $"операция {operationId} ответила кодом {(int)response.StatusCode} "
            + $"вместо {(int)expectedStatus}: {Shorten(body)}");

    var violations = Oracle.Value.Violations(operationId, (int)expectedStatus, body);
    Assert.True(
        violations.Count == 0,
        $"ответ операции {operationId} разошёлся с договором: {string.Join("; ", violations)}");

    return JsonDocument.Parse(body);
  }

  /// Отказ: объявленный код состояния, документ RFC 9457 и устойчивый код
  /// причины в поле type — интерфейс ветвится по нему, а не по заголовку.
  public static async Task<JsonDocument> ProblemAsync(
      HttpResponseMessage response,
      HttpStatusCode expectedStatus,
      string expectedType)
  {
    var body = await response.Content.ReadAsStringAsync();

    Assert.True(
        response.StatusCode == expectedStatus,
        $"ожидался код {(int)expectedStatus}, пришёл {(int)response.StatusCode}: {Shorten(body)}");
    Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

    // Схема берётся по имени, а не по операции: договор отдаёт отказы
    // типом application/problem+json, а оракул ищет тело ответа по
    // application/json — по operationId схема отказа не нашлась бы.
    var violations = Oracle.Value.ViolationsAgainstSchema("Problem", body);
    Assert.True(
        violations.Count == 0,
        $"документ об ошибке разошёлся со схемой Problem: {string.Join("; ", violations)}");

    var document = JsonDocument.Parse(body);

    Assert.Equal(expectedType, document.RootElement.GetProperty("type").GetString());
    Assert.Equal((int)expectedStatus, document.RootElement.GetProperty("status").GetInt32());

    return document;
  }

  /// Идентификаторы записей страницы в порядке ответа.
  public static IReadOnlyList<string> Ids(JsonElement page)
      => page.GetProperty("items")
          .EnumerateArray()
          .Select(item => item.GetProperty("id").GetString() ?? string.Empty)
          .ToList();

  // Тело в сообщении об ошибке урезается: полный ответ страницы вытесняет
  // из вывода само утверждение, ради которого проверка писалась.
  private static string Shorten(string body)
      => body.Length <= 400 ? body : string.Concat(body.AsSpan(0, 400), "…");
}
