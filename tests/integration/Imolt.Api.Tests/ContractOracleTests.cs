using Xunit;

namespace Imolt.Api.Tests;

/// Самопроверка договорного оракула. Оракулом будут проверяться все точки
/// договора, поэтому он сам обязан ловить расхождения, а не молчать: оракул,
/// принимающий любое тело, превращает все проверки договора в подтверждающие.
///
/// Отдельно проверяются схемы области «справочники»: они собраны из ветвей
/// allOf, ссылок и массивов, и обход по ним глубже, чем у служебных точек.
/// Оракул, не дошедший до поля внутри записи страницы, промолчал бы о любом
/// расхождении там — а именно там живут суммы и даты актуальности.
///
/// Проверка фальсифицируема: она падает, если оракул перестанет замечать
/// отсутствие обязательного поля, значение вне перечня, несовпадение с
/// образцом или поле сверх объявленных, если он начнёт отвергать тело,
/// которое договор допускает, и если обход остановится на верхнем уровне
/// страницы, не заглянув в её записи.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
public sealed class ContractOracleTests
{
  private static readonly ContractOracle Oracle = ContractOracle.FromContract();

  [Fact(DisplayName = "оракул принимает ответ, совпадающий с договором")]
  public void MatchingBodyPassesWithoutViolations()
  {
    var violations = Oracle.Violations("getHealth", 200, """{"service":"api","status":"ok"}""");

    Assert.Empty(violations);
  }

  [Fact(DisplayName = "оракул называет отсутствующее обязательное поле")]
  public void MissingRequiredFieldIsNamed()
  {
    var violations = Oracle.Violations("getHealth", 200, """{"service":"api"}""");

    Assert.Contains(violations, violation => violation.Contains("status") && violation.Contains("обязательно"));
  }

  [Fact(DisplayName = "оракул называет значение вне перечня договора")]
  public void ValueOutsideEnumerationIsNamed()
  {
    var violations = Oracle.Violations("getHealth", 200, """{"service":"api","status":"okay"}""");

    Assert.Contains(violations, violation => violation.Contains("okay") && violation.Contains("перечень"));
  }

  [Fact(DisplayName = "оракул называет несовпадение с образцом суммы")]
  public void ValueOutsidePatternIsNamed()
  {
    // Запятая вместо точки — самая вероятная поломка: служба работает в
    // локали ru-RU, и число, отданное текущей культурой, выглядит так.
    var violations = Oracle.ViolationsAgainstSchema("Money", """{"amount":"10800,00","currency":"RUB"}""");

    Assert.Contains(violations, violation => violation.Contains("10800,00") && violation.Contains("образц"));
  }

  [Fact(DisplayName = "оракул называет поле сверх объявленных договором")]
  public void UndeclaredFieldIsNamed()
  {
    var violations = Oracle.ViolationsAgainstSchema(
        "Money", """{"amount":"10800.00","currency":"RUB","note":"лишнее"}""");

    Assert.Contains(violations, violation => violation.Contains("note") && violation.Contains("не объявлено"));
  }

  [Fact(DisplayName = "оракул принимает ответы справочников, собранные по примерам договора")]
  public void ReferenceResponsesFromTheContractPassWithoutViolations()
  {
    foreach (var (operationId, body) in ReferenceResponses)
    {
      var violations = Oracle.Violations(operationId, 200, body);

      Assert.True(
          violations.Count == 0,
          $"оракул отверг ответ операции {operationId}, взятый из договора: {string.Join("; ", violations)}");
    }
  }

  [Fact(DisplayName = "оракул видит расхождение внутри записи страницы справочника")]
  public void ViolationInsideAPageItemIsNamed()
  {
    // Сумма с запятой вместо точки — внутри записи страницы, а не на
    // верхнем уровне ответа. Обход обязан пройти ветви allOf, ссылку на
    // WasteGroup и элемент массива, иначе до этого поля он не доберётся.
    var body = WasteGroupPage.Replace("12.00", "12,00", StringComparison.Ordinal);

    var violations = Oracle.Violations("listWasteGroups", 200, body);

    Assert.Contains(
        violations,
        violation => violation.Contains("items/0/transportPricePerTonKm/amount")
                     && violation.Contains("образц"));
  }

  [Fact(DisplayName = "оракул видит потерянный перечень тарифов карточки полигона")]
  public void MissingCardFieldIsNamed()
  {
    // Карточка собрана из двух ветвей allOf: обязательные поля объявлены в
    // Landfill, а история юрлица — в соседней ветви. Без слияния ветвей
    // потеря тарифов осталась бы незамеченной.
    var body = LandfillCard.Replace("\"tariffs\"", "\"tarify\"", StringComparison.Ordinal);

    var violations = Oracle.Violations("getLandfill", 200, body);

    Assert.Contains(
        violations,
        violation => violation.Contains("tariffs") && violation.Contains("обязательно"));
  }

  [Fact(DisplayName = "оракул видит потерянную среднюю оценку страницы отзывов")]
  public void MissingAverageRatingIsNamed()
  {
    // Договор объявляет averageRating обязательным и допускает у него
    // пустое значение: пустая оценка и отсутствие поля — разные вещи.
    var violations = Oracle.Violations(
        "listLandfillReviews", 200, """{"items":[],"total":0,"limit":10,"offset":0}""");

    Assert.Contains(
        violations,
        violation => violation.Contains("averageRating") && violation.Contains("обязательно"));
  }

  // Тела ответов собраны из примеров договора и значений начального набора
  // данных: оракул сверяется с тем, что договор сам объявляет верным.
  private const string WasteGroupPage =
      """
        {"items":[{"id":"beton-lom","name":"Лом бетона и железобетона",
        "fkkoCodes":["8 22 201 01 21 5"],
        "transportPricePerTonKm":{"amount":"12.00","currency":"RUB"},
        "densityTonPerCubicMeter":2.0,"updatedAt":"2026-09-17"}],
        "total":1,"limit":10,"offset":0}
        """;

  private const string LandfillCard =
      """
        {"id":"vostok-timohovo","name":"Комплекс переработки «Восток»",
        "legalEntity":"ООО «Восток»",
        "address":"Московская обл., Богородский г. о., д. Тимохово",
        "coordinates":{"latitude":55.7286,"longitude":38.2153},
        "status":"active","statusUpdatedAt":"2026-09-17",
        "tariffs":[{"wasteGroupId":"beton-lom",
        "disposalPricePerTon":{"amount":"450.00","currency":"RUB"},
        "updatedAt":"2026-09-17"}],
        "legalEntityHistory":[
        {"legalEntity":"ООО «Тимохово»","since":"2023-01-01","until":"2026-02-28"},
        {"legalEntity":"ООО «Восток»","since":"2026-03-01","until":null}]}
        """;

  private static readonly (string OperationId, string Body)[] ReferenceResponses =
  [
      ("listWasteGroups", WasteGroupPage),
        ("getWasteGroup",
            """
            {"id":"beton-lom","name":"Лом бетона и железобетона",
            "fkkoCodes":["8 22 201 01 21 5"],
            "transportPricePerTonKm":{"amount":"12.00","currency":"RUB"},
            "densityTonPerCubicMeter":2.0,"updatedAt":"2026-09-17"}
            """),
        ("getLandfill", LandfillCard),
        ("listLandfills",
            """
            {"items":[{"id":"iksha","name":"Площадка «Икша»",
            "address":"Московская обл., Дмитровский г. о., пос. Икша",
            "coordinates":{"latitude":56.1556,"longitude":37.4906},
            "status":"active","statusUpdatedAt":"2026-09-17",
            "tariffs":[]}],"total":1,"limit":10,"offset":0}
            """),
        ("listLandfillReviews",
            """
            {"items":[{"id":"a1b2c3d4-0001-4a00-8a00-000000000001",
            "landfillId":"vostok-timohovo","rating":4,"text":null,
            "createdAt":"2026-09-17T10:00:00+03:00"}],
            "total":1,"limit":10,"offset":0,"averageRating":4.5}
            """),
        // Средняя оценка полигона без отзывов пуста, а не равна нулю: договор
        // объявляет её nullable именно ради этого случая.
        ("listLandfillReviews",
            """{"items":[],"total":0,"limit":10,"offset":0,"averageRating":null}"""),
        ("suggestAddresses",
            """
            {"items":[{"id":"msk-godovikova-9","value":"г Москва, ул Годовикова, д 9",
            "coordinates":{"latitude":55.8055,"longitude":37.6206},"area":"moscow"}],
            "total":1,"limit":10,"offset":0}
            """),
        ("getDataFreshness",
            """
            {"pricesUpdatedAt":"2026-09-17","statusesUpdatedAt":"2026-09-17",
            "landfillsWithStaleData":1}
            """),
    ];
}
