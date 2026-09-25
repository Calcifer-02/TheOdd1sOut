using Dapper;
using Imolt.Deals.Contracts;
using Imolt.Deals.Ports;
using Imolt.Shared;
using Npgsql;

namespace Imolt.Deals.Adapters;

/// Заявки на вывоз поверх PostgreSQL (СУЩ-09).
///
/// Заявка обязана дойти до хранилища, а не остаться ответом: именно этого
/// разрыва касается риск AR-008 — форма на сайте сегодня пишет заявку только
/// в консоль браузера (R-053).
///
/// @req: R-053, R-054
/// @adr: ADR-0005
public sealed class PickupRequestStore(NpgsqlDataSource dataSource) : IPickupRequestStore
{
  public async Task SaveAsync(
      PickupRequest request,
      PickupRequestInput input,
      CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    await connection.ExecuteAsync(new CommandDefinition(
        """
        insert into pickup_request (
            id, calculation_id, landfill_id, contact_name, phone,
            personal_data_consent, created_at, state
        ) values (
            @id, @calculationId, @landfillId, @contactName, @phone,
            @consent, @createdAt, @state
        )
        """,
        new
        {
          id = Guid.Parse(request.Id),
          // Расчёт и полигон необязательны: заявку оставляют и со страницы
          // результатов, и без неё. Негодный идентификатор ссылкой не
          // становится — связь просто не заводится.
          calculationId = Key(input.CalculationId),
          landfillId = string.IsNullOrWhiteSpace(input.LandfillId) ? null : input.LandfillId,
          contactName = input.ContactName,
          phone = input.Phone,
          consent = input.PersonalDataConsent,
          createdAt = request.CreatedAt.ToUniversalTime(),
          state = request.State,
        },
        cancellationToken: cancellationToken));
  }

  private static Guid? Key(string? value) => Guid.TryParse(value, out var key) ? key : null;
}

/// Каталог услуг по документации поверх PostgreSQL (СУЩ-10).
///
/// Каталог — данные, а не перечень в коде: состав пакета заказчиком не
/// подтверждён (Q-005), и зашитый в код список пришлось бы переписывать на
/// каждое уточнение (R-052).
///
/// @req: R-052
/// @adr: ADR-0005
public sealed class DocumentServiceCatalog(NpgsqlDataSource dataSource) : IDocumentServiceCatalog
{
  public async Task<Page<DocumentService>> ListAsync(PageRequest page, CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    var total = await connection.ExecuteScalarAsync<int>(new CommandDefinition(
        "select count(*) from document_service",
        cancellationToken: cancellationToken));

    var rows = await connection.QueryAsync<ServiceRow>(new CommandDefinition(
        """
        select id, name, price_from, price_on_request
          from document_service
         order by id
         limit @limit offset @offset
        """,
        new { limit = page.Limit, offset = page.Offset },
        cancellationToken: cancellationToken));

    var items = rows
        .Select(row => new DocumentService(
            row.Id,
            row.Name,
            // Ноль означал бы бесплатную услугу, а цена просто не названа.
            row.PriceFrom is { } price ? Money.Rubles(price) : null,
            row.PriceOnRequest))
        .ToList();

    return Pages.Of(items, total, page);
  }

  private sealed class ServiceRow
  {
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public decimal? PriceFrom { get; set; }

    public bool PriceOnRequest { get; set; }
  }
}

/// Срок действия цены предложения (R-038).
///
/// Длительность объявляется настройкой службы: одно место на ответ операции и
/// на документ. Два места, считающие срок по-своему, расходятся молча — в
/// ответе одна дата, у клиента на руках другая.
///
/// @req: R-038
/// @adr: ADR-0005
public sealed class PriceValidity(int days) : IPriceValidity
{
  /// Значение по умолчанию, когда настройка не задана: решение команды по
  /// Q-010 от 25.09.2026. Заказчик срока не называл, поэтому число живёт
  /// настройкой — его ответ заменит величину, а не устройство.
  public const int DefaultDays = 14;

  public DateOnly UntilFrom(DateTimeOffset issuedAt)
      => DateOnly.FromDateTime(issuedAt.DateTime).AddDays(days);
}

/// Допустимое отклонение окончательной цены от предварительной (R-059).
///
/// Число печатается в документе, поэтому молчание о нём — не нейтральный
/// исход: клиент читает предварительную цену как окончательную. Величина той
/// же природы, что и срок действия, и приходит тем же путём — настройкой.
///
/// @req: R-059
/// @adr: ADR-0005
public sealed class PriceTolerance(decimal percent) : IPriceTolerance
{
  /// Значение по умолчанию: решение команды по Q-010 от 25.09.2026.
  public const decimal DefaultPercent = 10m;

  public decimal Percent { get; } = percent;
}
