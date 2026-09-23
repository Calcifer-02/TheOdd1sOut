using System.Text.RegularExpressions;
using Imolt.Deals.Contracts;
using Imolt.Deals.Domain;
using Imolt.Deals.Ports;
using Imolt.Shared;

namespace Imolt.Deals.Application;

/// Сценарии доступа: обмен стартовых параметров мини-приложения на маркер,
/// профиль, заявка на подписку и заказ услуги по документации.
///
/// Своего входа сервис не заводит (ADR-0006): личность даёт платформа, а
/// сервер только проверяет подпись ключом бота. Что именно открывает подписка,
/// заказчиком не установлено (Q-011), поэтому здесь объявлено её состояние, а
/// не политика доступа.
///
/// @req: R-049, R-050, R-051, R-052, R-054, R-056
/// @adr: ADR-0006
public sealed class AccessScenarios(
    ISubscriberStore subscribers,
    IDocumentServiceOrderStore orders,
    IAccessTokens tokens,
    IClock clock,
    MaxIdentitySettings settings)
{
  /// Обмен стартовых параметров на сессию (R-049).
  public async Task<Session> SignInAsync(SessionRequest? request, CancellationToken cancellationToken)
  {
    var initData = request?.InitData
        ?? throw new ArgumentOutOfRangeException(nameof(request), "строка стартовых параметров обязательна");

    var parameters = MaxLaunchParameters.Verified(initData, settings.BotToken)
        ?? throw new IdentityRefusedException(
            "Подпись стартовых параметров не сошлась: личность платформой не подтверждена");

    // Срок давности отделён от подписи намеренно: отказ обязан называть свою
    // причину, иначе клиент чинит не то (AC-049c).
    if (!parameters.IsFresh(clock.Now, settings.InitDataLifetime))
    {
      throw new IdentityRefusedException(
          "Срок давности стартовых параметров истёк: откройте мини-приложение заново");
    }

    // Согласие проверяется до записи: завести учётную запись и отказать —
    // худший из исходов, снаружи он неотличим от честного отказа (R-054).
    if (!request!.PersonalDataConsent)
    {
      throw new ConsentMissingException(
          "Без согласия на обработку персональных данных сессия не создаётся");
    }

    var profile = await subscribers.EnrolAsync(parameters.MaxUserId, parameters.DisplayName, cancellationToken);
    var (token, expiresIn) = tokens.Issue(new Participant(profile.Id, profile.MaxUserId));

    return new Session(token, expiresIn, profile);
  }

  public Task<Profile?> ProfileAsync(string subscriberId, CancellationToken cancellationToken)
      => subscribers.FindAsync(subscriberId, cancellationToken);

  /// Заявка на подписку (R-008, R-049, R-051). Состояние «ожидает» —
  /// нормальный исход: оплата идёт вне сервиса, и подтвердить её нечем.
  public Task<SubscriptionRequest> RequestSubscriptionAsync(
      string subscriberId,
      SubscriptionRequestInput? input,
      CancellationToken cancellationToken)
      => subscribers.RequestSubscriptionAsync(subscriberId, Checked(input), cancellationToken);

  /// Заказ услуги по документации (R-009, R-052, R-054).
  public async Task<DocumentServiceOrder> OrderServiceAsync(
      string subscriberId,
      DocumentServiceOrderInput? input,
      CancellationToken cancellationToken)
  {
    var order = input
        ?? throw new ArgumentOutOfRangeException(nameof(input), "тело заказа обязательно");

    if (string.IsNullOrWhiteSpace(order.ServiceId) || string.IsNullOrWhiteSpace(order.ObjectAddress))
    {
      throw new ArgumentOutOfRangeException(
          nameof(input), "услуга и адрес объекта обязательны");
    }

    if (!order.PersonalDataConsent)
    {
      throw new ConsentMissingException(
          "Без согласия на обработку персональных данных заказ не принимается");
    }

    if (!await orders.ServiceExistsAsync(order.ServiceId, cancellationToken))
    {
      throw new NothingToQuoteException($"Услуги {order.ServiceId} нет в каталоге");
    }

    var accepted = new DocumentServiceOrder(
        Guid.NewGuid().ToString(),
        order.ServiceId,
        clock.Now,
        DocumentServiceOrder.Accepted,
        "Заказ принят, менеджер свяжется в течение рабочего дня");

    await orders.SaveAsync(accepted, subscriberId, order, cancellationToken);

    return accepted;
  }

  /// Образец ИНН — дословно из договора (схема SubscriptionRequestInput).
  /// Держится здесь же, чтобы разбор и договор не разошлись между собой.
  private static Regex InnPattern { get; } =
      new(@"^[0-9]{10}$|^[0-9]{12}$", RegexOptions.Compiled);

  // Форма запроса проверяется до правил предметной области: промах по образцу
  // ИНН — ошибка запроса (400), а не нарушенное правило (422).
  private static SubscriptionRequestInput Checked(SubscriptionRequestInput? input)
  {
    var request = input
        ?? throw new ArgumentOutOfRangeException(nameof(input), "тело заявки обязательно");

    if (request.Role is not (SubscriberRoles.Carrier or SubscriberRoles.DemolitionCompany))
    {
      throw new ArgumentOutOfRangeException(
          nameof(input), request.Role, "роль подписчика — carrier либо demolitionCompany");
    }

    if (string.IsNullOrWhiteSpace(request.CompanyName))
    {
      throw new ArgumentOutOfRangeException(nameof(input), "название компании обязательно");
    }

    return InnPattern.IsMatch(request.Inn ?? string.Empty)
        ? request
        : throw new ArgumentOutOfRangeException(
            nameof(input), request.Inn, "ИНН записывается десятью либо двенадцатью цифрами");
  }
}

/// Роли подписчика, объявленные договором.
public static class SubscriberRoles
{
  public const string Carrier = "carrier";

  public const string DemolitionCompany = "demolitionCompany";
}

/// Настройки личности от платформы. Ключ бота и срок давности стартовых
/// параметров приходят из окружения: ключ — секрет, который не место в коде
/// (R-056), а срок договором не назван и остаётся решением развёртывания.
public sealed record MaxIdentitySettings(string BotToken, TimeSpan InitDataLifetime)
{
  /// Срок давности по умолчанию. Помечен демонстрационным: заказчик его не
  /// называл, и выдавать пять минут за его решение нельзя.
  public static TimeSpan DemonstrationLifetime { get; } = TimeSpan.FromMinutes(5);
}
