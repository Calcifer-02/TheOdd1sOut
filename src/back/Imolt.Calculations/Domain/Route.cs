using Imolt.Shared;

namespace Imolt.Calculations.Domain;

/// Модель маршрута по выбранным полигонам (R-032 — R-035, R-050).
///
/// Живёт в домене, а не в зоне контрактов: участок маршрута несёт правило —
/// перечень обременений пуст, пока не назван их источник, — а зона контрактов
/// объявляет форму, а не правила (ADR-0001, роли зон).
///
/// @req: R-032, R-033, R-035, R-050
/// @adr: ADR-0001
public sealed record Encumbrance(string Kind, string Title)
{
  public const string TrafficPolicePost = "trafficPolicePost";

  public const string WeightControl = "weightControl";
}

/// Участок маршрута до одного полигона (R-033, R-034).
///
/// Перечень обременений пуст всегда, пока не назван их источник (Q-003).
/// Это свойство участка, а не случайность вызова: собрать участок со списком
/// обременений нельзя — такого способа у типа нет. Правдоподобный пост,
/// поставленный «для полноты», водитель принял бы за настоящий.
public sealed class RouteLeg
{
  private RouteLeg(string landfillId, double distanceKm, int? durationMinutes, string? externalMapUrl)
  {
    LandfillId = landfillId;
    DistanceKm = distanceKm;
    DurationMinutes = durationMinutes;
    ExternalMapUrl = externalMapUrl;
  }

  public string LandfillId { get; }

  public double DistanceKm { get; }

  /// Время в пути. Пусто, когда источник расстояний его не сообщил: ноль
  /// означал бы мгновенную доставку.
  public int? DurationMinutes { get; }

  /// Ссылка на маршрут во внешних картах (R-034, R-057).
  public string? ExternalMapUrl { get; }

  public IReadOnlyList<Encumbrance> Encumbrances { get; } = [];

  public static RouteLeg Of(
      string landfillId,
      double distanceKm,
      int? durationMinutes,
      string? externalMapUrl)
  {
    if (string.IsNullOrWhiteSpace(landfillId))
    {
      throw new ArgumentOutOfRangeException(nameof(landfillId), "участок маршрута ведёт к названному полигону");
    }

    return distanceKm < 0
        ? throw new ArgumentOutOfRangeException(nameof(distanceKm), distanceKm, "плечо перевозки не отрицательно")
        : new RouteLeg(landfillId, distanceKm, durationMinutes, externalMapUrl);
  }
}

/// Доступ к содержимому ответа (R-050). Когда доступ не выдан, содержательные
/// поля пусты, а интерфейс показывает замок вместо выдумки. Что именно
/// закрыто подпиской, заказчиком не установлено (Q-011): объявлена форма
/// разграничения, а не политика.
public sealed record RouteAccess(bool Granted, string? Reason)
{
  public const string SubscriptionRequired = "subscriptionRequired";

  public const string AuthenticationRequired = "authenticationRequired";
}

/// Сводка маршрута по выбранным полигонам (R-032). Итог назван даже при
/// закрытых деталях: это и отличает разграничение содержимого от отказа в
/// обслуживании.
public sealed record RouteSummary(
    RouteAccess Access,
    IReadOnlyList<RouteLeg> Legs,
    Money Total);
