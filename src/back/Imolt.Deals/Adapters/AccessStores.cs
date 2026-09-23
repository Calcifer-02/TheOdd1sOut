using System.Security.Cryptography;
using System.Text;
using Dapper;
using Imolt.Deals.Contracts;
using Imolt.Deals.Ports;
using Imolt.Shared;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

namespace Imolt.Deals.Adapters;

/// Учётные записи участников и заявки на подписку поверх PostgreSQL
/// (СУЩ-13).
///
/// Повторный вход не заводит второго участника: учётная запись платформы —
/// естественный ключ, и она объявлена единственной в схеме.
///
/// @req: R-049, R-051
/// @adr: ADR-0005
public sealed class SubscriberStore(NpgsqlDataSource dataSource, IClock clock) : ISubscriberStore
{
  private const string Columns = """
    select id, max_user_id, display_name, role, company_name, inn,
           registered_in_ais_ossig, subscription_state, subscription_active_until
      from subscriber
    """;

  public async Task<Profile> EnrolAsync(
      string maxUserId,
      string? displayName,
      CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    // Имя обновляется при каждом входе: пользователь меняет его в платформе,
    // и показывать устаревшее — врать о том, кто вошёл.
    var row = await connection.QuerySingleAsync<SubscriberRow>(new CommandDefinition(
        """
        insert into subscriber (id, max_user_id, display_name, created_at)
        values (@id, @maxUserId, @displayName, @createdAt)
        on conflict (max_user_id) do update set display_name = excluded.display_name
        returning id, max_user_id, display_name, role, company_name, inn,
                  registered_in_ais_ossig, subscription_state, subscription_active_until
        """,
        new
        {
          id = Guid.NewGuid(),
          maxUserId,
          displayName,
          createdAt = clock.Now.ToUniversalTime(),
        },
        cancellationToken: cancellationToken));

    return Profile(row);
  }

  public async Task<Profile?> FindAsync(string subscriberId, CancellationToken cancellationToken)
  {
    if (!Guid.TryParse(subscriberId, out var key))
    {
      return null;
    }

    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    var row = await connection.QuerySingleOrDefaultAsync<SubscriberRow>(new CommandDefinition(
        $"{Columns} where id = @key",
        new { key },
        cancellationToken: cancellationToken));

    return row is null ? null : Profile(row);
  }

  public async Task<SubscriptionRequest> RequestSubscriptionAsync(
      string subscriberId,
      SubscriptionRequestInput input,
      CancellationToken cancellationToken)
  {
    var key = Guid.Parse(subscriberId);
    var id = Guid.NewGuid();
    var createdAt = clock.Now.ToUniversalTime();

    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
    await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

    // Реквизиты переносятся в учётную запись, а состояние подписки становится
    // «ожидает»: подтвердить оплату сервер не может, она идёт вне сервиса.
    await connection.ExecuteAsync(new CommandDefinition(
        """
        update subscriber
           set role = @role,
               company_name = @companyName,
               inn = @inn,
               registered_in_ais_ossig = @registeredInAisOssig,
               subscription_state = @state
         where id = @key
        """,
        new
        {
          key,
          role = input.Role,
          companyName = input.CompanyName,
          inn = input.Inn,
          registeredInAisOssig = input.RegisteredInAisOssig,
          state = SubscriptionState.Pending,
        },
        transaction,
        cancellationToken: cancellationToken));

    await connection.ExecuteAsync(new CommandDefinition(
        """
        insert into subscription_request (
            id, subscriber_id, role, company_name, inn, registered_in_ais_ossig, created_at, state
        ) values (
            @id, @key, @role, @companyName, @inn, @registeredInAisOssig, @createdAt, @state
        )
        """,
        new
        {
          id,
          key,
          role = input.Role,
          companyName = input.CompanyName,
          inn = input.Inn,
          registeredInAisOssig = input.RegisteredInAisOssig,
          createdAt,
          state = SubscriptionState.Pending,
        },
        transaction,
        cancellationToken: cancellationToken));

    await transaction.CommitAsync(cancellationToken);

    return new SubscriptionRequest(
        id.ToString(),
        createdAt.ToLocalTime(),
        new SubscriptionState(SubscriptionState.Pending, null),
        "Заявка принята. Оплата подписки оформляется вне сервиса: менеджер свяжется с вами.");
  }

  private static Profile Profile(SubscriberRow row) => new(
      row.Id.ToString(),
      row.MaxUserId,
      row.DisplayName,
      row.Role,
      row.CompanyName,
      row.Inn,
      row.RegisteredInAisOssig,
      new SubscriptionState(row.SubscriptionState, row.SubscriptionActiveUntil));

  // Средство доступа к данным собирает строки через открытые свойства, а
  // позиционные записи собрать не умеет.
  private sealed class SubscriberRow
  {
    public Guid Id { get; set; }

    public string MaxUserId { get; set; } = string.Empty;

    public string? DisplayName { get; set; }

    public string? Role { get; set; }

    public string? CompanyName { get; set; }

    public string? Inn { get; set; }

    public bool? RegisteredInAisOssig { get; set; }

    public string SubscriptionState { get; set; } = string.Empty;

    public DateOnly? SubscriptionActiveUntil { get; set; }
  }
}

/// Права участника поверх PostgreSQL (ADR-0007).
///
/// Право читается при каждом запросе, а не кладётся в маркер доступа: иначе
/// снятое право продолжало бы действовать до конца срока маркера, и отозванный
/// сотрудник правил бы цены ещё час.
///
/// @req: R-042, R-045
/// @adr: ADR-0007
public sealed class ParticipantPermissionStore(NpgsqlDataSource dataSource, IClock clock)
  : IParticipantPermissions
{
  public async Task<bool> HasAsync(
      string subscriberId,
      string permission,
      CancellationToken cancellationToken)
  {
    // Негодный идентификатор — то же, что отсутствие права: спорить о форме
    // строки здесь не с чем, прав у такого участника нет в любом случае.
    if (!Guid.TryParse(subscriberId, out var key))
    {
      return false;
    }

    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    return await connection.ExecuteScalarAsync<bool>(new CommandDefinition(
        """
        select exists (
          select 1 from subscriber_permission
           where subscriber_id = @key and permission = @permission)
        """,
        new { key, permission },
        cancellationToken: cancellationToken));
  }

  public async Task SetAsync(
      string subscriberId,
      IReadOnlyCollection<string> permissions,
      CancellationToken cancellationToken)
  {
    var key = Guid.Parse(subscriberId);
    var granted = permissions.ToArray();

    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
    await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

    // Сначала снимается лишнее, потом выдаётся недостающее: состав прав
    // приводится к объявленному, а не дополняется им.
    await connection.ExecuteAsync(new CommandDefinition(
        "delete from subscriber_permission where subscriber_id = @key and not (permission = any(@granted))",
        new { key, granted },
        transaction,
        cancellationToken: cancellationToken));

    foreach (var permission in granted)
    {
      await connection.ExecuteAsync(new CommandDefinition(
          """
          insert into subscriber_permission (subscriber_id, permission, granted_at)
          values (@key, @permission, @grantedAt)
          on conflict (subscriber_id, permission) do nothing
          """,
          new { key, permission, grantedAt = clock.Now.ToUniversalTime() },
          transaction,
          cancellationToken: cancellationToken));
    }

    await transaction.CommitAsync(cancellationToken);
  }
}

/// Заказы услуг по документации поверх PostgreSQL (СУЩ-10).
///
/// @req: R-052, R-054
/// @adr: ADR-0005
public sealed class DocumentServiceOrderStore(NpgsqlDataSource dataSource) : IDocumentServiceOrderStore
{
  public async Task<bool> ServiceExistsAsync(string serviceId, CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    return await connection.ExecuteScalarAsync<bool>(new CommandDefinition(
        "select exists (select 1 from document_service where id = @serviceId)",
        new { serviceId },
        cancellationToken: cancellationToken));
  }

  public async Task SaveAsync(
      DocumentServiceOrder order,
      string subscriberId,
      DocumentServiceOrderInput input,
      CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    await connection.ExecuteAsync(new CommandDefinition(
        """
        insert into document_service_order (
            id, service_id, subscriber_id, object_address, comment,
            personal_data_consent, created_at, state
        ) values (
            @id, @serviceId, @subscriberId, @objectAddress, @comment,
            @consent, @createdAt, @state
        )
        """,
        new
        {
          id = Guid.Parse(order.Id),
          serviceId = order.ServiceId,
          subscriberId = Guid.Parse(subscriberId),
          objectAddress = input.ObjectAddress,
          comment = input.Comment,
          consent = input.PersonalDataConsent,
          createdAt = order.CreatedAt.ToUniversalTime(),
          state = order.State,
        },
        cancellationToken: cancellationToken));
  }
}

/// Маркер доступа в форме JWT, объявленной договором.
///
/// Ключ подписи маркера — секрет службы, а не ключ бота: второй не должен
/// покидать проверку подписи стартовых параметров (R-056). Не заданный ключ
/// порождается при запуске: тогда маркеры живут до перезапуска службы, и это
/// честнее записанного в коде значения по умолчанию, которое одинаково у всех.
///
/// @req: R-049, R-050
/// @adr: ADR-0006
public sealed class AccessTokens : IAccessTokens
{
  private const string Issuer = "imolt";

  private const string SubscriberClaim = "sub";

  private const string MaxUserClaim = "max_user_id";

  private readonly SigningCredentials credentials;

  private readonly TokenValidationParameters validation;

  private readonly int lifetimeSeconds;

  public AccessTokens(string? secret, int lifetimeSeconds)
  {
    var key = new SymmetricSecurityKey(string.IsNullOrWhiteSpace(secret)
        ? RandomNumberGenerator.GetBytes(32)
        : SHA256.HashData(Encoding.UTF8.GetBytes(secret)));

    credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
    validation = new TokenValidationParameters
    {
      ValidateIssuer = true,
      ValidIssuer = Issuer,
      ValidateAudience = false,
      ValidateLifetime = true,
      IssuerSigningKey = key,
      // Расхождение часов не прощается: маркер с истёкшим сроком остаётся
      // истёкшим, а не действует ещё пять минут по умолчанию библиотеки.
      ClockSkew = TimeSpan.Zero,
    };

    this.lifetimeSeconds = lifetimeSeconds;
  }

  public (string Token, int ExpiresIn) Issue(Participant participant)
  {
    var descriptor = new SecurityTokenDescriptor
    {
      Issuer = Issuer,
      Expires = DateTime.UtcNow.AddSeconds(lifetimeSeconds),
      SigningCredentials = credentials,
      Claims = new Dictionary<string, object>
      {
        [SubscriberClaim] = participant.Id,
        [MaxUserClaim] = participant.MaxUserId,
      },
    };

    return (new JsonWebTokenHandler().CreateToken(descriptor), lifetimeSeconds);
  }

  public Participant? Resolve(string? token)
  {
    if (string.IsNullOrWhiteSpace(token))
    {
      return null;
    }

    var result = new JsonWebTokenHandler().ValidateTokenAsync(token, validation).GetAwaiter().GetResult();

    if (!result.IsValid)
    {
      return null;
    }

    var subscriber = Claim(result, SubscriberClaim);
    var maxUser = Claim(result, MaxUserClaim);

    return subscriber is null || maxUser is null ? null : new Participant(subscriber, maxUser);
  }

  private static string? Claim(TokenValidationResult result, string name)
      => result.Claims.TryGetValue(name, out var value) ? value as string : null;
}
