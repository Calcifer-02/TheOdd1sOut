using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Общая часть проверок области «расчёт»: сборка тела запроса по договору,
/// отправка, разбор результатов по группам отходов и обход всего тела ответа.
///
/// Тело запроса собирается строкой, а не объектом: договор задаёт форму JSON,
/// и сборка через промежуточный тип проверяла бы этот тип, а не договор.
/// Числа выводятся инвариантной культурой — служба глобально выставляет ru-RU
/// (Program.cs, раздел о локали), и запятая вместо точки порвала бы JSON ещё
/// до отправки.
///
internal static class CalculationChecks
{
  /// Успешное создание расчёта: договор объявляет ответ 201, а не 200.
  public static Task<JsonDocument> CreatedAsync(HttpResponseMessage response, string operationId)
      => ReferenceChecks.SuccessAsync(response, operationId, HttpStatusCode.Created);

  public static Task<HttpResponseMessage> PostJsonAsync(HttpClient client, string path, string json)
      => client.PostAsync(path, Body(json));

  public static Task<HttpResponseMessage> PutJsonAsync(HttpClient client, string path, string json)
      => client.PutAsync(path, Body(json));

  /// Тело запроса `createCalculation` по схеме CalculationRequest.
  /// Предел расстояния необязателен: его отсутствие — отдельный проверяемый
  /// случай (AC-026a), и подстановка значения по умолчанию здесь скрыла бы
  /// именно то, что проверяется.
  public static string CalculationRequestJson(
      string itemsJson,
      string pickupValue,
      double latitude,
      double longitude,
      bool disposalRequired = true,
      int? distanceKm = null,
      string distanceMode = "atMost",
      string? area = "moscow")
  {
    var filter = distanceKm is null
        ? string.Empty
        : $$"""
            ,
              "distanceFilter": { "mode": "{{distanceMode}}", "km": {{distanceKm.Value}} }
            """;

    // Зона адреса необязательна по договору, и её отсутствие — отдельный
    // проверяемый случай (AC-016d): по такому запросу сервису неоткуда взять
    // меру расчёта, если адреса нет и в справочнике.
    var declared = area is null
        ? string.Empty
        : $$"""
            ,
                "area": "{{area}}"
            """;

    return $$"""
        {
          "pickupAddress": {
            "value": "{{pickupValue}}",
            "coordinates": { "latitude": {{Number(latitude)}}, "longitude": {{Number(longitude)}} }{{declared}}
          },
          "items": [{{itemsJson}}],
          "disposalRequired": {{(disposalRequired ? "true" : "false")}}{{filter}}
        }
        """;
  }

  /// Позиция расчёта: группа отходов, объём и мера.
  public static string ItemJson(string wasteGroupId, double value, string unit)
      => $$"""{ "wasteGroupId": "{{wasteGroupId}}", "quantity": { "value": {{Number(value)}}, "unit": "{{unit}}" } }""";

  /// Идентификатор созданного расчёта.
  public static string IdOf(JsonElement calculation)
  {
    var id = calculation.GetProperty("id").GetString();
    Assert.False(string.IsNullOrWhiteSpace(id), "расчёт создан без идентификатора: читать его потом нечем");

    return id!;
  }

  /// Страница вариантов размещения по группе отходов внутри расчёта.
  public static JsonElement OptionsOf(JsonElement calculation, string wasteGroupId)
  {
    foreach (var result in calculation.GetProperty("results").EnumerateArray())
    {
      if (result.GetProperty("wasteGroupId").GetString() == wasteGroupId)
      {
        return result.GetProperty("options");
      }
    }

    Assert.Fail($"в расчёте нет вкладки группы отходов {wasteGroupId}");
    return default;
  }

  /// Идентификаторы полигонов страницы в порядке ответа: порядок — предмет
  /// проверок сортировки, поэтому он сохраняется, а не приводится к множеству.
  public static IReadOnlyList<string> LandfillIds(JsonElement page)
      => page.GetProperty("items")
          .EnumerateArray()
          .Select(option => option.GetProperty("landfillId").GetString() ?? string.Empty)
          .ToList();

  /// Вариант размещения по полигону. Ищется по идентификатору, а не по
  /// позиции: позиция — предмет отдельных проверок сортировки.
  public static JsonElement Option(JsonElement page, string landfillId)
  {
    foreach (var option in page.GetProperty("items").EnumerateArray())
    {
      if (option.GetProperty("landfillId").GetString() == landfillId)
      {
        return option;
      }
    }

    Assert.Fail(
        $"полигона {landfillId} нет среди вариантов размещения: {string.Join(", ", LandfillIds(page))}");
    return default;
  }

  /// Сумма строкой, как её объявляет схема Money договора.
  public static string Amount(JsonElement money)
      => money.GetProperty("amount").GetString() ?? string.Empty;

  /// Та же сумма числом — для утверждений о сходимости составляющих.
  /// Разбирается инвариантной культурой: договор объявляет точку, а служба
  /// глобально выставляет ru-RU, где разделитель дробной части — запятая.
  public static decimal AmountValue(JsonElement money)
      => decimal.Parse(Amount(money), CultureInfo.InvariantCulture);

  /// Все имена полей тела ответа, включая вложенные. Нужно там, где критерий
  /// говорит «в ответе нет такого поля»: проверка одного уровня пропустила бы
  /// то же поле внутри варианта размещения (AC-022a, AC-058a).
  public static IReadOnlyList<string> FieldNames(JsonElement node)
  {
    var names = new List<string>();
    CollectFieldNames(node, names);

    return names;
  }

  /// Все скалярные значения тела ответа вместе с именем поля, под которым они
  /// стоят. Нужно там, где критерий запрещает само значение, а не только имя
  /// поля: величина справочника, уехавшая под безобидным именем, — та же
  /// утечка (AC-022a, AC-058a). Имя поля возвращается рядом, чтобы отказ
  /// называл место утечки, а не только факт.
  public static IReadOnlyList<KeyValuePair<string, string>> ScalarValues(JsonElement node)
  {
    var values = new List<KeyValuePair<string, string>>();
    CollectScalarValues(node, "тело ответа", values);

    return values;
  }

  private static void CollectScalarValues(
      JsonElement node,
      string field,
      List<KeyValuePair<string, string>> values)
  {
    switch (node.ValueKind)
    {
      case JsonValueKind.Object:
        foreach (var property in node.EnumerateObject())
        {
          CollectScalarValues(property.Value, property.Name, values);
        }

        break;
      case JsonValueKind.Array:
        foreach (var element in node.EnumerateArray())
        {
          CollectScalarValues(element, field, values);
        }

        break;
      default:
        values.Add(new KeyValuePair<string, string>(field, node.ToString()));
        break;
    }
  }

  private static void CollectFieldNames(JsonElement node, List<string> names)
  {
    switch (node.ValueKind)
    {
      case JsonValueKind.Object:
        foreach (var field in node.EnumerateObject())
        {
          names.Add(field.Name);
          CollectFieldNames(field.Value, names);
        }

        break;
      case JsonValueKind.Array:
        foreach (var element in node.EnumerateArray())
        {
          CollectFieldNames(element, names);
        }

        break;
    }
  }

  private static StringContent Body(string json) => new(json, Encoding.UTF8, "application/json");

  private static string Number(double value) => value.ToString(CultureInfo.InvariantCulture);
}
