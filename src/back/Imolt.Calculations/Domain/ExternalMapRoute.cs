using System.Globalization;

namespace Imolt.Calculations.Domain;

/// Ссылка на маршрут во внешней службе карт (R-034, R-057).
///
/// Ссылка строится из координат и больше ни из чего: её открывает сам
/// пользователь в своём браузере, и ключ доступа в ней стал бы утечкой
/// независимо от того, чем кончится вопрос об условиях коммерческого
/// использования карт (Q-008, риск AR-006). Обращений к внешней службе
/// правило не делает — оно собирает адрес.
///
/// @req: R-034, R-057
/// @adr: ADR-0001
public static class ExternalMapRoute
{
  /// Точность записи координаты: пять знаков после точки — примерно метр на
  /// местности, и столько же хранит таблица расстояний.
  private const string CoordinateFormat = "0.#####";

  public static string UrlFor(
      double fromLatitude,
      double fromLongitude,
      double toLatitude,
      double toLongitude)
  {
    // Инвариантная культура обязательна: служба глобально выставляет ru-RU, и
    // запятая вместо точки сделала бы ссылку недействительной.
    var from = Point(fromLatitude, fromLongitude);
    var to = Point(toLatitude, toLongitude);

    return $"https://yandex.ru/maps/?rtext={from}~{to}&rtt=auto";
  }

  private static string Point(double latitude, double longitude)
      => string.Create(
          CultureInfo.InvariantCulture,
          $"{latitude.ToString(CoordinateFormat, CultureInfo.InvariantCulture)},"
          + $"{longitude.ToString(CoordinateFormat, CultureInfo.InvariantCulture)}");
}
