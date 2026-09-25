using System.Globalization;
using Xunit;

namespace Imolt.Api.Tests;

/// Документ коммерческого предложения (R-036, R-037, R-038, R-059, R-061):
/// файл на одном листе со всем составом расчёта, пригодный для
/// автоматического скачивания.
///
/// Срок действия цены, допустимое отклонение и реквизиты исполнителя
/// проверяются не записанными здесь значениями: все три объявляет настройкой
/// стенд, а проверка требует, чтобы служба назвала ту же величину. Записанное
/// в коде число прошло бы и у службы, которая настройку не читает вовсе.
///
/// Проверка фальсифицируема: она падает, если повторное скачивание выпустит
/// второе предложение или сменит номер в документе, если медиатип, заголовок
/// Content-Disposition или сигнатура файла перестанут отвечать формату PDF,
/// если из документа пропадёт любая часть состава расчёта, если срок действия
/// перестанет следовать настройке или разойдётся с датой в документе и если
/// суммы в документе будут напечатаны не русской локалью.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-036b, AC-036c, AC-037a, AC-037b, AC-038a, AC-059b, AC-061a
[Collection(ImoltDealsCollection.Name)]
public sealed class QuoteDocumentEndpointTests(ImoltDealsStand stand)
{
  /// Стоимость перевозки примера договора по «Востоку»: 20 т x 12,00 ₽ за
  /// тонна-километр x 45 км.
  private const decimal VostokTransportCost = 10800.00m;

  /// Стоимость утилизации там же: 20 т x 450,00 ₽ за тонну.
  private const decimal VostokDisposalCost = 9000.00m;

  /// Совокупная цена по «Востоку» — сумма названных составляющих.
  private const decimal VostokTotalCost = 19800.00m;

  /// Итог примера договора по двум полигонам, числом — для проверки записи
  /// суммы русской локалью.
  private const decimal SelectionTotalCost = 39880.00m;

  [Fact(DisplayName = "повторное скачивание не выпускает второй номер")]
  public async Task DownloadingTheDocumentTwiceKeepsASingleQuoteNumber()
  {
    var calculationId = await DealChecks.CreateSelectedCalculationAsync(
        stand.Client, ImoltDealsStand.VostokId, ImoltDealsStand.IkshaId);

    string number;
    string documentUrl;
    using (var quote = await DealChecks.IssuedQuoteAsync(stand.Client, calculationId))
    {
      number = quote.RootElement.GetProperty("number").GetString()!;
      documentUrl = DealChecks.DocumentUrl(quote.RootElement);
    }

    var first = DealChecks.DocumentText(await DealChecks.DownloadedDocumentAsync(stand.Client, documentUrl));
    var second = DealChecks.DocumentText(await DealChecks.DownloadedDocumentAsync(stand.Client, documentUrl));

    // AC-036b: номер выпущенного предложения стоит в обоих документах. Сверка
    // документов между собой этого не доказала бы: два одинаково пустых файла
    // тоже совпадают.
    Assert.Contains(number, first, StringComparison.Ordinal);
    Assert.Contains(number, second, StringComparison.Ordinal);

    // Хранилище хранит ровно одно предложение по расчёту. Совпадение номеров
    // в тексте — наблюдение снаружи; второе предложение, выпущенное и не
    // показанное, осталось бы за ним незамеченным.
    Assert.Equal(
        1L,
        await stand.CountAsync(
            "select count(*) from quote where calculation_id = @calculationId",
            ("calculationId", Guid.Parse(calculationId))));
  }

  [Fact(DisplayName = "документ отдаётся файлом, пригодным для автоматического скачивания")]
  public async Task TheDocumentIsServedAsAFileReadyForAutomaticDownload()
  {
    var documentUrl = await IssuedDocumentUrlAsync(ImoltDealsStand.VostokId);

    var (response, body) = await DealChecks.DownloadAsync(stand.Client, documentUrl);

    Assert.True(
        response.IsSuccessStatusCode,
        $"скачивание ответило кодом {(int)response.StatusCode}: {DealChecks.Preview(body)}");

    // AC-036c: медиатип объявлен договором дословно. Браузер по нему решает,
    // сохранять файл или показывать его как страницу.
    Assert.Equal("application/pdf", response.Content.Headers.ContentType?.MediaType);

    // Заголовок называет имя файла — иначе документ сохранится под именем
    // пути запроса, и в папке загрузок окажется файл «document».
    var disposition = response.Content.Headers.ContentDisposition;
    Assert.NotNull(disposition);
    Assert.False(
        string.IsNullOrWhiteSpace(disposition.FileName ?? disposition.FileNameStar),
        "Content-Disposition не назвал имя файла");

    // Сигнатура принадлежит самому файлу: медиатип можно объявить любым, а
    // содержимое от этого форматом PDF не станет.
    Assert.True(
        DealChecks.HasPdfSignature(body),
        $"тело ответа не начинается сигнатурой формата PDF: {DealChecks.Preview(body)}");
  }

  [Fact(DisplayName = "документ содержит весь состав расчёта")]
  public async Task TheDocumentCarriesTheWholeCompositionOfTheCalculation()
  {
    // AC-037a называет один полигон: по двум выбранным совокупная цена
    // сложилась бы, и разойтись с ней могла бы только сумма, а не строка.
    var calculationId = await DealChecks.CreateSelectedCalculationAsync(
        stand.Client, ImoltDealsStand.VostokId);
    var createdAt = await DealChecks.CreatedAtAsync(stand.Client, calculationId);

    var text = await DocumentTextAsync(calculationId);

    Assert.Contains(ImoltDealsStand.PickupValue, text, StringComparison.Ordinal);

    // Наименование группы отходов, а не её идентификатор: «beton-lom» клиенту
    // ничего не сообщает.
    Assert.Contains(ImoltDealsStand.ConcreteGroupName, text, StringComparison.Ordinal);

    // Объём вместе с мерой: без меры число 20 читается и как тонны, и как
    // кубометры, а цены у них разные (R-014).
    Assert.Matches(@"\b20(,\d+)?\s*(т\b|тонн)", text);

    // Обе составляющие и их сумма названы раздельно (R-019): итог без
    // составляющих клиенту нечем проверить.
    AssertRussianAmount(text, VostokTransportCost, "стоимость перевозки");
    AssertRussianAmount(text, VostokDisposalCost, "стоимость утилизации");
    AssertRussianAmount(text, VostokTotalCost, "совокупная цена");

    // Дата расчёта, а не дата печати файла: цены закреплены на день расчёта.
    // Принимается запись в часовом поясе ответа и в мировом времени —
    // часовой пояс печати договором не установлен.
    Assert.True(
        text.Contains(DealChecks.RussianDate(DateOnly.FromDateTime(createdAt.DateTime)), StringComparison.Ordinal)
            || text.Contains(
                DealChecks.RussianDate(DateOnly.FromDateTime(createdAt.UtcDateTime)),
                StringComparison.Ordinal),
        $"в документе нет даты расчёта {createdAt:O}");

    // Отметка о предварительности (R-059): молчание о ней в документе с
    // ценами читается как окончательная смета.
    Assert.Contains("редварительн", text, StringComparison.OrdinalIgnoreCase);
  }

  [Fact(DisplayName = "документ называет исполнителя")]
  public async Task TheDocumentNamesTheIssuerFromTheDeclaredSetting()
  {
    var calculationId = await DealChecks.CreateSelectedCalculationAsync(
        stand.Client, ImoltDealsStand.VostokId);

    var text = await DocumentTextAsync(calculationId);

    // AC-037b: реквизиты взяты из настройки, которую объявил стенд. Записанное
    // в коде наименование прошло бы и у службы, которая настройку не читает, —
    // а в другом развёртывании документ выпускает другая компания (Q-012).
    Assert.Contains(ImoltDealsStand.IssuerName, text, StringComparison.Ordinal);

    // Телефон и почта: документ уходит наружу, и ответить на него читатель
    // должен, не возвращаясь в мини-приложение.
    Assert.Contains(ImoltDealsStand.IssuerPhone, text, StringComparison.Ordinal);
    Assert.Contains(ImoltDealsStand.IssuerEmail, text, StringComparison.Ordinal);
  }

  [Fact(DisplayName = "документ называет допустимое отклонение числом")]
  public async Task TheDocumentNamesThePriceToleranceByNumber()
  {
    var calculationId = await DealChecks.CreateSelectedCalculationAsync(
        stand.Client, ImoltDealsStand.VostokId);

    var text = await DocumentTextAsync(calculationId);

    // AC-059b: число приходит из настройки стенда, а не записано здесь. Оно
    // намеренно отличается от значения службы по умолчанию: с десятью
    // процентами проверка прошла бы и у службы, которая настройку не читает.
    var tolerance = ImoltDealsStand.TolerancePercent.ToString("0.##", new CultureInfo("ru-RU"));

    Assert.Matches(tolerance + @"\s*%", text);

    // Отметка о предварительности остаётся: число говорит, насколько цена
    // вправе измениться, но не отменяет самого предупреждения (R-059).
    Assert.Contains("редварительн", text, StringComparison.OrdinalIgnoreCase);
  }

  [Fact(DisplayName = "срок действия цены называется одной величиной")]
  public async Task PriceValidityIsNamedByASingleDeclaredSetting()
  {
    var calculationId = await DealChecks.CreateSelectedCalculationAsync(
        stand.Client, ImoltDealsStand.VostokId, ImoltDealsStand.IkshaId);

    DateTimeOffset issuedAt;
    DateOnly validUntil;
    string documentUrl;
    using (var quote = await DealChecks.IssuedQuoteAsync(stand.Client, calculationId))
    {
      issuedAt = quote.RootElement.GetProperty("issuedAt").GetDateTimeOffset();
      validUntil = DateOnly.ParseExact(
          quote.RootElement.GetProperty("validUntil").GetString()!, "yyyy-MM-dd", CultureInfo.InvariantCulture);
      documentUrl = DealChecks.DocumentUrl(quote.RootElement);
    }

    // AC-038a: число дней здесь не записано намеренно — длительность
    // заказчиком не названа (Q-010). Сравнивается с величиной, которую
    // объявил стенд настройкой службы: жёстко записанный в коде срок с ней
    // разойдётся, каким бы правдоподобным он ни был.
    Assert.Equal(
        DateOnly.FromDateTime(issuedAt.DateTime).AddDays(ImoltDealsStand.ValidityDays),
        validUntil);

    // Та же дата напечатана в документе. Два места, считающие срок по-своему,
    // расходятся молча: в ответе одна дата, у клиента на руках другая.
    var text = DealChecks.DocumentText(
        await DealChecks.DownloadedDocumentAsync(stand.Client, documentUrl));

    Assert.Contains(DealChecks.RussianDate(validUntil), text, StringComparison.Ordinal);
  }

  [Fact(DisplayName = "суммы в документе напечатаны русской локалью, в ответе — по договору")]
  public async Task AmountsAreRussianInTheDocumentAndContractualInTheResponse()
  {
    var calculationId = await DealChecks.CreateSelectedCalculationAsync(
        stand.Client, ImoltDealsStand.VostokId, ImoltDealsStand.IkshaId);

    string documentUrl;
    using (var quote = await DealChecks.IssuedQuoteAsync(stand.Client, calculationId))
    {
      // AC-061a, схема Money: на границе службы сумма — строка с точкой.
      // Локаль — работа представления, и русская запятая в теле ответа
      // порвала бы разбор у всякого клиента.
      Assert.Equal(
          ImoltDealsStand.SelectionTotalAmount,
          CalculationChecks.Amount(quote.RootElement.GetProperty("total")));

      documentUrl = DealChecks.DocumentUrl(quote.RootElement);
    }

    var text = DealChecks.DocumentText(
        await DealChecks.DownloadedDocumentAsync(stand.Client, documentUrl));

    // В документе — та же сумма, но русской локалью и со знаком рубля:
    // документ читает человек, а не программа (R-061).
    AssertRussianAmount(text, SelectionTotalCost, "итог предложения");
    Assert.Contains("₽", text, StringComparison.Ordinal);
  }

  private static void AssertRussianAmount(string text, decimal amount, string what)
      => Assert.True(
          DealChecks.ContainsRussianAmount(text, amount),
          $"в документе нет суммы «{what}» ({amount}), записанной русской локалью");

  private async Task<string> IssuedDocumentUrlAsync(params string[] landfillIds)
  {
    var calculationId = await DealChecks.CreateSelectedCalculationAsync(stand.Client, landfillIds);

    using var quote = await DealChecks.IssuedQuoteAsync(stand.Client, calculationId);

    return DealChecks.DocumentUrl(quote.RootElement);
  }

  private async Task<string> DocumentTextAsync(string calculationId)
  {
    string documentUrl;
    using (var quote = await DealChecks.IssuedQuoteAsync(stand.Client, calculationId))
    {
      documentUrl = DealChecks.DocumentUrl(quote.RootElement);
    }

    return DealChecks.DocumentText(await DealChecks.DownloadedDocumentAsync(stand.Client, documentUrl));
  }
}
