using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using UglyToad.PdfPig;
using UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor;
using Xunit;

namespace Imolt.Api.Tests;

/// Общая часть проверок области «сделка»: подготовка расчёта с выбором
/// полигонов, обращения к точкам сделки и разбор документа коммерческого
/// предложения.
///
/// Сборка тела запроса и денежные помощники берутся у области «расчёт»
/// (CalculationChecks, ReferenceChecks): договорный оракул один на службу, и
/// второй его обёртки быть не должно. Здесь добавлено только то, чего у
/// расчёта нет, — работа с файлом предложения.
///
internal static class DealChecks
{
  public const string CalculationsPath = "/v1/calculations";

  public const string PickupRequestsPath = "/v1/pickup-requests";

  public const string DocumentServicesPath = "/v1/document-services";

  /// Сигнатура формата PDF: первые байты файла (AC-036c). Заголовок ответа
  /// служба выставляет сама, а сигнатура принадлежит самому файлу.
  private static readonly byte[] PdfSignature = "%PDF-"u8.ToArray();

  /// Расчёт примера договора: 20 тонн лома бетона с адреса вывоза, у которого
  /// сохранены плечи до обоих полигонов.
  public static async Task<string> CreateCalculationAsync(HttpClient client)
  {
    var response = await CalculationChecks.PostJsonAsync(
        client,
        CalculationsPath,
        CalculationChecks.CalculationRequestJson(
            CalculationChecks.ItemJson(ImoltDealsStand.ConcreteGroupId, ImoltDealsStand.ConcreteTons, "t"),
            ImoltDealsStand.PickupValue,
            ImoltDealsStand.PickupLatitude,
            ImoltDealsStand.PickupLongitude,
            distanceKm: ImoltDealsStand.WideDistanceKm));

    using var calculation = await CalculationChecks.CreatedAsync(response, "createCalculation");

    return CalculationChecks.IdOf(calculation.RootElement);
  }

  /// Выбор полигонов по группе отходов. Выбор задаётся целиком (R-027), и
  /// пустой перечень означает снятый выбор.
  public static async Task<JsonDocument> SelectAsync(
      HttpClient client,
      string calculationId,
      params string[] landfillIds)
  {
    var entries = string.Join(
        ", ",
        landfillIds.Select(landfillId =>
            $$"""{ "wasteGroupId": "{{ImoltDealsStand.ConcreteGroupId}}", "landfillId": "{{landfillId}}" }"""));

    var response = await CalculationChecks.PutJsonAsync(
        client,
        $"{CalculationsPath}/{calculationId}/selection",
        $$"""{ "entries": [{{entries}}] }""");

    return await ReferenceChecks.OkAsync(response, "setCalculationSelection");
  }

  /// Расчёт с уже сделанным выбором полигонов — предусловие критериев
  /// маршрута и предложения. Расчёт на каждую проверку свой: выбор — часть
  /// состояния расчёта, и общий расчёт сделал бы исход зависимым от порядка
  /// запуска.
  public static async Task<string> CreateSelectedCalculationAsync(
      HttpClient client,
      params string[] landfillIds)
  {
    var calculationId = await CreateCalculationAsync(client);

    (await SelectAsync(client, calculationId, landfillIds)).Dispose();

    return calculationId;
  }

  /// Дата создания расчёта. Нужна критерию AC-037a: документ обязан называть
  /// дату расчёта, а не дату печати файла.
  public static async Task<DateTimeOffset> CreatedAtAsync(HttpClient client, string calculationId)
  {
    var response = await client.GetAsync($"{CalculationsPath}/{calculationId}");
    using var calculation = await ReferenceChecks.OkAsync(response, "getCalculation");

    return calculation.RootElement.GetProperty("createdAt").GetDateTimeOffset();
  }

  public static Task<HttpResponseMessage> IssueQuoteAsync(HttpClient client, string calculationId)
      => CalculationChecks.PostJsonAsync(
          client,
          $"{CalculationsPath}/{calculationId}/quotes",
          """{ "customerName": "ООО «Подрядчик»" }""");

  /// Выпуск предложения, сверенный с договором: 201 и тело по схеме Quote.
  public static async Task<JsonDocument> IssuedQuoteAsync(HttpClient client, string calculationId)
  {
    var response = await IssueQuoteAsync(client, calculationId);

    return await ReferenceChecks.SuccessAsync(response, "createQuote", HttpStatusCode.Created);
  }

  /// Путь к файлу предложения, как его назвало само предложение. Берётся из
  /// ответа, а не собирается проверкой: критерий AC-036a требует, чтобы путь
  /// указывал на операцию скачивания именно этого предложения.
  public static string DocumentUrl(JsonElement quote)
  {
    var url = quote.GetProperty("documentUrl").GetString();
    Assert.False(string.IsNullOrWhiteSpace(url), "предложение выпущено без пути к документу: скачивать нечего");

    return url!;
  }

  /// Скачанный файл предложения вместе с ответом: заголовки нужны проверке
  /// медиатипа и имени файла (AC-036c).
  public static async Task<(HttpResponseMessage Response, byte[] Body)> DownloadAsync(
      HttpClient client,
      string documentUrl)
  {
    var response = await client.GetAsync(documentUrl);
    var body = await response.Content.ReadAsByteArrayAsync();

    return (response, body);
  }

  /// Скачанный файл, о котором уже известно, что операция ответила 200.
  /// Договор объявляет у downloadQuoteDocument двоичное тело, и договорный
  /// оракул к нему неприменим — отсюда отдельная проверка кода состояния.
  public static async Task<byte[]> DownloadedDocumentAsync(HttpClient client, string documentUrl)
  {
    var (response, body) = await DownloadAsync(client, documentUrl);

    Assert.True(
        response.StatusCode == HttpStatusCode.OK,
        $"операция downloadQuoteDocument ответила кодом {(int)response.StatusCode} вместо 200 "
            + $"на пути {documentUrl}: {Preview(body)}");

    return body;
  }

  public static bool HasPdfSignature(byte[] body)
      => body.Length >= PdfSignature.Length && body.Take(PdfSignature.Length).SequenceEqual(PdfSignature);

  /// Текст документа, приведённый к одной строке с одиночными пробелами.
  /// Приведение обязательно: в файле те же слова разнесены по строкам и
  /// колонкам, а неразрывный пробел русской локали от обычного отличается
  /// только разрядом, но не видом.
  public static string DocumentText(byte[] body)
  {
    using var document = PdfDocument.Open(body);

    var pages = document.GetPages().Select(page => ContentOrderTextExtractor.GetText(page));

    return Normalize(string.Join(" ", pages));
  }

  /// Сумма, записанная русской локалью: разделитель дробной части — запятая
  /// (R-061). Разделитель разрядов критерием AC-061a не назван, поэтому
  /// принимаются обе записи — с ним и без него.
  public static bool ContainsRussianAmount(string text, decimal amount)
  {
    var grouped = Normalize(amount.ToString("N2", RussianCulture));
    var plain = amount.ToString("0.00", RussianCulture);

    return text.Contains(grouped, StringComparison.Ordinal)
        || text.Contains(plain, StringComparison.Ordinal);
  }

  /// Дата, записанная русской локалью: 17.09.2026.
  public static string RussianDate(DateOnly date) => date.ToString("dd.MM.yyyy", RussianCulture);

  /// Начало тела ответа в понятном виде — для сообщения об отказе. Документ
  /// двоичный, и в отказе от него полезны только первые печатные знаки:
  /// обычно там лежит документ об ошибке, а не файл.
  public static string Preview(byte[] body)
  {
    var text = Encoding.UTF8.GetString(body);

    return text.Length <= 400 ? text : string.Concat(text.AsSpan(0, 400), "…");
  }

  private static CultureInfo RussianCulture { get; } = new("ru-RU");

  // Пробельные разряды приводятся к обычному пробелу, а их череда — к одному:
  // иначе совпадение зависело бы от того, каким пробелом библиотека печати
  // разделила разряды суммы.
  private static string Normalize(string text) => Regex.Replace(text, @"\s+", " ").Trim();
}
