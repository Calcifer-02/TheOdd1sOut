using Imolt.Deals.Contracts;
using Imolt.Deals.Domain;
using Imolt.Deals.Ports;
using Imolt.Shared;

namespace Imolt.Deals.Application;

/// Сценарии области «сделка»: выпуск и выдача коммерческого предложения,
/// заявка на вывоз, каталог услуг по документации.
///
/// Цены область не считает — она переносит в снимок то, что посчитал расчёт
/// (R-036). Справочник потом изменится, а выпущенный документ обязан остаться
/// прежним.
///
/// @req: R-036, R-037, R-038, R-052, R-053, R-054, R-059
/// @adr: ADR-0001
public sealed class DealScenarios(
    ICalculationSnapshot calculations,
    IQuoteStore quotes,
    IPickupRequestStore pickupRequests,
    IDocumentServiceCatalog catalog,
    IQuoteDocumentWriter writer,
    IPriceValidity validity,
    IClock clock)
{
  /// Выпуск предложения. Повторный вызов возвращает уже выпущенное: на номер
  /// ссылаются в переписке, и второй номер по тому же расчёту сделал бы
  /// ссылку неоднозначной (R-036).
  public async Task<Quote?> IssueAsync(
      string calculationId,
      QuoteRequest? request,
      CancellationToken cancellationToken)
  {
    var calculation = await calculations.FindAsync(calculationId, cancellationToken);

    if (calculation is null)
    {
      return null;
    }

    var issued = await quotes.FindByCalculationAsync(calculationId, cancellationToken);

    if (issued is not null)
    {
      return issued;
    }

    if (calculation.Lines.Count == 0)
    {
      throw new NothingToQuoteException(
          "В расчёте не выбрано ни одного полигона: закреплять в предложении нечего");
    }

    var issuedAt = clock.Now;
    var day = DateOnly.FromDateTime(issuedAt.DateTime);

    // Сутки берутся у часов службы теми же, по которым сложен номер. Счёт по
    // календарной дате в запросе давал бы другой день в окно между полуночью
    // Москвы и полуночью UTC: счётчик обнулялся раньше номера, и второе
    // предложение этой ночи получало номер первого.
    var dayStart = clock.StartOfDay(day);
    var issuedToday = await quotes.IssuedBetweenAsync(dayStart, dayStart.AddDays(1), cancellationToken);
    var number = QuoteNumber.Of(day, issuedToday + 1);
    var id = Guid.NewGuid().ToString();
    var total = calculation.Lines.Aggregate(Money.Rubles(0), (sum, line) => sum + line.TotalCost);

    var document = new QuoteDocumentModel(
        number,
        issuedAt,
        validity.UntilFrom(issuedAt),
        calculation.CreatedAt,
        calculation.PickupAddress,
        request?.CustomerName,
        calculation.Lines,
        total);

    var quote = new Quote(
        id,
        number,
        issuedAt,
        document.ValidUntil,
        total,
        // Признак предварительности истинен всегда: допустимое отклонение
        // финальной цены заказчиком не названо (R-059, Q-010).
        true,
        DocumentPathOf(id));

    await quotes.SaveAsync(quote, calculationId, document, cancellationToken);

    return quote;
  }

  /// Файл предложения. Собирается из снимка, а не из справочников: документ,
  /// пересчитанный при скачивании, разошёлся бы с тем, что клиент уже видел.
  public async Task<byte[]?> DocumentAsync(string quoteId, CancellationToken cancellationToken)
  {
    var document = await quotes.FindDocumentAsync(quoteId, cancellationToken);

    return document is null ? null : writer.Render(document);
  }

  /// Приём заявки на вывоз (R-053). Согласие проверяется до записи: сохранить
  /// персональные данные и отказать — худший из исходов (R-054).
  public async Task<PickupRequest> AcceptAsync(
      PickupRequestInput? input,
      CancellationToken cancellationToken)
  {
    var request = Checked(input);

    if (!request.PersonalDataConsent)
    {
      throw new ConsentMissingException(
          "Без согласия на обработку персональных данных заявка не принимается");
    }

    var accepted = new PickupRequest(
        Guid.NewGuid().ToString(),
        clock.Now,
        PickupRequest.Accepted,
        "Заявка принята, менеджер свяжется в течение рабочего дня");

    await pickupRequests.SaveAsync(accepted, request, cancellationToken);

    return accepted;
  }

  public Task<Page<DocumentService>> ServicesAsync(PageRequest page, CancellationToken cancellationToken)
      => catalog.ListAsync(page, cancellationToken);

  public static string DocumentPathOf(string quoteId) => $"/v1/quotes/{quoteId}/document";

  // Форма запроса проверяется до правил предметной области: промах по образцу
  // телефона — ошибка запроса (400), а неотмеченное согласие — нарушенное
  // правило (422), и путать их нельзя.
  private static PickupRequestInput Checked(PickupRequestInput? input)
  {
    var request = input
        ?? throw new ArgumentOutOfRangeException(nameof(input), "тело заявки обязательно");

    if (string.IsNullOrWhiteSpace(request.ContactName) || request.ContactName.Length > 200)
    {
      throw new ArgumentOutOfRangeException(
          nameof(input), request.ContactName, "имя обязательно и не длиннее двухсот знаков");
    }

    return PhonePattern.IsMatch(request.Phone ?? string.Empty)
        ? request
        : throw new ArgumentOutOfRangeException(
            nameof(input), request.Phone, "телефон записывается как +7 и десять цифр");
  }

  /// Образец телефона — дословно из договора (схема PickupRequestInput).
  /// Держится здесь же, чтобы разбор и договор не разошлись между собой.
  private static System.Text.RegularExpressions.Regex PhonePattern { get; } =
      new(@"^\+7[0-9]{10}$", System.Text.RegularExpressions.RegexOptions.Compiled);
}
