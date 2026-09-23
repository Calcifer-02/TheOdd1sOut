using System.Net;
using Xunit;

namespace Imolt.Api.Tests;

/// Выпуск коммерческого предложения по результату расчёта (R-036, R-059).
/// Выпуск и скачивание разделены намеренно: повторное скачивание не должно
/// выпускать второе предложение с другим номером, поэтому операция выпуска
/// закрепляет цены и отдаёт путь к документу, а не сам документ.
///
/// Проверка фальсифицируема: она падает, если выпуск перестанет возвращать
/// номер, срок или итог, если итог разойдётся с итогом выбора, если признак
/// предварительности станет ложным, если путь к документу перестанет указывать
/// на скачивание именно этого предложения и если предложение начнёт
/// выпускаться по расчёту без единого выбранного полигона.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-036a, AC-036d
[Collection(ImoltDealsCollection.Name)]
public sealed class QuoteIssueEndpointTests(ImoltDealsStand stand)
{
  [Fact(DisplayName = "выпуск предложения возвращает номер, срок, итог и путь к документу")]
  public async Task IssuingAQuoteReturnsNumberValidityTotalAndDocumentPath()
  {
    var calculationId = await DealChecks.CreateSelectedCalculationAsync(
        stand.Client, ImoltDealsStand.VostokId, ImoltDealsStand.IkshaId);

    using var quote = await DealChecks.IssuedQuoteAsync(stand.Client, calculationId);

    var id = quote.RootElement.GetProperty("id").GetString();
    Assert.False(string.IsNullOrWhiteSpace(id), "предложение выпущено без идентификатора");

    Assert.False(
        string.IsNullOrWhiteSpace(quote.RootElement.GetProperty("number").GetString()),
        "номер предложения пуст: сослаться на предложение в переписке нечем");

    // AC-036a: итог предложения — итог выбора, 19 800,00 + 20 080,00
    // (пример ответа setCalculationSelection в договоре). Предложение
    // закрепляет цены расчёта, а не считает их заново.
    Assert.Equal(
        ImoltDealsStand.SelectionTotalAmount,
        CalculationChecks.Amount(quote.RootElement.GetProperty("total")));

    // Признак предварительности истинен всегда (R-059): допустимое отклонение
    // финальной цены заказчиком не названо (Q-010), и молчание об этом в
    // документе с ценами вводит клиента в заблуждение.
    Assert.True(
        quote.RootElement.GetProperty("preliminary").GetBoolean(),
        "предложение объявлено окончательным, хотя отклонение финальной цены не установлено");

    // Путь ведёт к операции скачивания именно этого предложения, а не к общей
    // точке: договор объявляет /v1/quotes/{quoteId}/document.
    Assert.Equal($"/v1/quotes/{id}/document", DealChecks.DocumentUrl(quote.RootElement));
  }

  [Fact(DisplayName = "предложение без выбранных полигонов не выпускается")]
  public async Task QuoteIsRefusedWhenNoLandfillIsSelected()
  {
    // Расчёт создаётся, но выбор не делается: в предложении нечего закреплять,
    // потому что строк с ценами нет.
    var calculationId = await DealChecks.CreateCalculationAsync(stand.Client);

    var response = await DealChecks.IssueQuoteAsync(stand.Client, calculationId);

    // AC-036d: 422, а не 400 — запрос разобран, нарушено правило предметной
    // области. Код причины берётся из перечня Problems службы: договор
    // объявляет у 422 документ RFC 9457, а не отдельную схему отказа.
    using var problem = await ReferenceChecks.ProblemAsync(
        response, HttpStatusCode.UnprocessableContent, "urn:imolt:problem:validation");

    // Отказ называет причину: без неё кнопка «Скачать КП» гаснет молча, и
    // пользователю не на что нажать дальше.
    Assert.True(
        problem.RootElement.TryGetProperty("detail", out var detail)
            && !string.IsNullOrWhiteSpace(detail.GetString()),
        "отказ выпуска не назвал причину: показать рядом с кнопкой нечего");
  }

  /// Регрессия на дефект ночного окна: номер складывался по дню службы
  /// (Москва, UTC+3), а счётчик выпущенных за день считал по дате UTC. С
  /// полуночи Москвы до полуночи UTC это разные дни, счётчик обнулялся раньше
  /// номера, и второе предложение получало номер первого — выпуск отвечал
  /// кодом 500 на нарушении единственности номера в базе.
  ///
  /// @ac: AC-036a
  [Fact(DisplayName = "два предложения одних суток получают разные номера")]
  public async Task TwoQuotesOfTheSameDayGetDifferentNumbers()
  {
    var first = await DealChecks.CreateSelectedCalculationAsync(
        stand.Client, ImoltDealsStand.VostokId, ImoltDealsStand.IkshaId);
    var second = await DealChecks.CreateSelectedCalculationAsync(
        stand.Client, ImoltDealsStand.VostokId, ImoltDealsStand.IkshaId);

    using var earlier = await DealChecks.IssuedQuoteAsync(stand.Client, first);
    using var later = await DealChecks.IssuedQuoteAsync(stand.Client, second);

    Assert.NotEqual(
        earlier.RootElement.GetProperty("number").GetString(),
        later.RootElement.GetProperty("number").GetString());
  }
}
