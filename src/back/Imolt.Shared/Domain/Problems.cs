namespace Imolt.Shared;

/// Устойчивые коды причин отказа. Клиент ветвится по коду, а не по заголовку,
/// поэтому перечень живёт одним местом и сверяется с договором машинно
/// (проверка ProblemCodesTests).
///
/// Кода wrong-base-url здесь нет намеренно: его возвращает внешний узел на
/// обращение мимо префикса /api, а не служба (ADR-0004).
///
/// @shared: imolt-shared
/// @adr: ADR-0005
public static class Problems
{
  public const string Validation = "urn:imolt:problem:validation";
  public const string NotFound = "urn:imolt:problem:not-found";
  public const string AuthenticationRequired = "urn:imolt:problem:authentication-required";
  public const string SubscriptionRequired = "urn:imolt:problem:subscription-required";
  /// Отличается от SubscriptionRequired действием пользователя: подписку он
  /// оформляет сам, а право ему выдаёт владелец данных (ADR-0007).
  public const string RoleRequired = "urn:imolt:problem:role-required";
  public const string AllocationMismatch = "urn:imolt:problem:allocation-mismatch";
  public const string AddressOutsideServiceArea = "urn:imolt:problem:address-outside-service-area";
  public const string DistanceServiceUnavailable = "urn:imolt:problem:distance-service-unavailable";
  public const string UnsupportedMediaType = "urn:imolt:problem:unsupported-media-type";
  public const string StalePreview = "urn:imolt:problem:stale-preview";
  public const string TooManyRequests = "urn:imolt:problem:too-many-requests";

  public static IReadOnlyCollection<string> All { get; } =
  [
      Validation,
        NotFound,
        AuthenticationRequired,
        SubscriptionRequired,
        RoleRequired,
        AllocationMismatch,
        AddressOutsideServiceArea,
        DistanceServiceUnavailable,
        UnsupportedMediaType,
        StalePreview,
        TooManyRequests,
    ];
}
