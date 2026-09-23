using System.Collections;
using System.Globalization;
using System.Reflection;
using Imolt.Calculations.Domain;
using Xunit;

namespace Imolt.Domain.Tests;

/// Правила участка маршрута: ссылка во внешние карты строится от координат и
/// не несёт ключа доступа (R-034, R-057), а перечень обременений остаётся
/// пустым, пока источник данных не назван и допустимость показа не
/// подтверждена (R-035, Q-003).
///
/// Проверка модульная намеренно, и этого требует не только ADR-0001. Гостю
/// поле externalMapUrl не отдаётся вовсе — маршрут для него закрыт подпиской
/// (AC-050a), — поэтому через точку HTTP эти два правила не наблюдаемы:
/// проверка снаружи подтверждала бы замок, а не разбираемое ею правило.
/// Личности пользователя в службе пока нет, и другого наблюдателя, кроме
/// гостя, не существует.
///
/// Ожидаемая поверхность области объявлена здесь и разрешается отражением, а
/// не ссылкой на тип: прямая ссылка на ещё не заведённый тип уронила бы
/// сборку всего проверочного проекта и вместе с ней проверки соседних правил,
/// которые сегодня зелены. Отражение оставляет отказ там, где ему место, — в
/// этих двух проверках, с именем недостающего символа в сообщении.
///
/// Ожидается:
///   ExternalMapRoute.UrlFor(double fromLatitude, double fromLongitude,
///       double toLatitude, double toLongitude) -> string
///   RouteLeg.Of(string landfillId, double distanceKm, int? durationMinutes,
///       string? externalMapUrl) -> RouteLeg, со свойством Encumbrances
///
/// Проверка фальсифицируема: она падает, если ссылка перестанет быть
/// абсолютной и вести на внешнюю службу, если из неё пропадёт любая из двух
/// пар координат, если в неё попадёт ключ доступа или токен и если в участке
/// маршрута появится хоть одно обременение, пока источник данных не назван.
///
///   dotnet test tests/unit/Imolt.Domain.Tests
///
/// @ac: AC-034a, AC-035a
public sealed class RouteLegRulesTests
{
  /// Координаты адреса вывоза примера договора (AC-034a).
  private const double PickupLatitude = 55.8055;

  private const double PickupLongitude = 37.6206;

  /// Координаты полигона из предусловия критерия. Записаны дословно из
  /// AC-034a и от координат начального набора данных отличаются намеренно:
  /// правило строит ссылку от того, что ему передали, а не от справочника.
  private const double LandfillLatitude = 55.6790;

  private const double LandfillLongitude = 38.2220;

  private const string VostokId = "vostok-timohovo";

  private const string IkshaId = "iksha";

  /// Имена доводов запроса, под которыми во внешнюю службу уезжает ключ
  /// доступа. Перечень закрытый: критерий запрещает ключ и токен, и поиск по
  /// любому похожему слову отвергал бы безобидные доводы вроде «rtext».
  private static readonly string[] SecretMarkers =
      ["apikey", "api_key", "api-key", "key=", "token", "secret", "signature"];

  [Fact(DisplayName = "ссылка на внешние карты строится от координат и не несёт ключа")]
  public void ExternalMapUrlCarriesBothPointsAndNoAccessKey()
  {
    var url = ExternalMapUrl(PickupLatitude, PickupLongitude, LandfillLatitude, LandfillLongitude);

    // Ссылка ведёт во внешнюю службу: относительный путь открылся бы внутри
    // самого сервиса, а критерий требует перехода в сторонние карты.
    Assert.True(
        Uri.TryCreate(url, UriKind.Absolute, out var address),
        $"ссылка «{url}» не абсолютна: открыть её во внешней службе нечем");
    Assert.Equal(Uri.UriSchemeHttps, address!.Scheme);
    Assert.False(
        address.IsLoopback,
        $"ссылка «{url}» ведёт на саму службу, а не во внешний сервис карт");

    // Обе пары координат стоят в ссылке. Инвариантная культура обязательна:
    // служба глобально выставляет ru-RU, и в русской локали разделителем
    // дробной части была бы запятая — искалась бы запись, которой в ссылке
    // быть не может.
    foreach (var coordinate in new[] { PickupLatitude, PickupLongitude, LandfillLatitude, LandfillLongitude })
    {
      var text = coordinate.ToString("0.#####", CultureInfo.InvariantCulture);
      Assert.True(
          url.Contains(text, StringComparison.Ordinal),
          $"в ссылке «{url}» нет координаты {text}: маршрут откроется не оттуда или не туда");
    }

    // Ключа доступа в ссылке нет. Условия коммерческого использования
    // внешних карт не подтверждены (Q-008), но ключ в ссылке, которую
    // открывает пользователь, — утечка независимо от ответа на вопрос.
    var leaked = SecretMarkers.FirstOrDefault(marker => url.Contains(marker, StringComparison.OrdinalIgnoreCase));
    Assert.True(leaked is null, $"в ссылке «{url}» уехал ключ доступа: совпадение по «{leaked}»");
  }

  [Fact(DisplayName = "обременения остаются пустыми, пока источник не назван")]
  public void RouteLegLeavesEncumbrancesEmptyUntilTheSourceIsNamed()
  {
    // Два полигона, а не один: пустой перечень, выданный на одном
    // идентификаторе, неотличим от пустого перечня, записанного в коде для
    // этого идентификатора.
    foreach (var landfillId in new[] { VostokId, IkshaId })
    {
      var encumbrances = Encumbrances(landfillId);

      Assert.NotNull(encumbrances);
      Assert.Empty(encumbrances!);
    }
  }

  // Ссылка во внешние карты, полученная от области. Отражение разрешает
  // символ, которого может ещё не быть: отказ должен назвать недостающее имя,
  // а не сорвать сборку проекта.
  private static string ExternalMapUrl(
      double fromLatitude,
      double fromLongitude,
      double toLatitude,
      double toLongitude)
  {
    var method = Method(
        "ExternalMapRoute",
        "UrlFor",
        [typeof(double), typeof(double), typeof(double), typeof(double)],
        "string UrlFor(double fromLatitude, double fromLongitude, double toLatitude, double toLongitude)");

    var url = method.Invoke(null, [fromLatitude, fromLongitude, toLatitude, toLongitude]) as string;

    Assert.False(string.IsNullOrWhiteSpace(url), "правило вернуло пустую ссылку на внешние карты");

    return url!;
  }

  // Перечень обременений участка маршрута до названного полигона.
  private static IEnumerable? Encumbrances(string landfillId)
  {
    var method = Method(
        "RouteLeg",
        "Of",
        [typeof(string), typeof(double), typeof(int?), typeof(string)],
        "RouteLeg Of(string landfillId, double distanceKm, int? durationMinutes, string? externalMapUrl)");

    // Плечо и время в пути взяты из начального набора данных: 45 км и 62
    // минуты до «Востока». Значения здесь несущественны — существенно лишь
    // то, что участок собран полностью и обременения ему взять неоткуда.
    var leg = method.Invoke(null, [landfillId, 45d, 62, "https://example.invalid/route"]);
    Assert.NotNull(leg);

    var property = leg!.GetType().GetProperty("Encumbrances", BindingFlags.Public | BindingFlags.Instance);
    Assert.True(
        property is not null,
        "у участка маршрута нет свойства Encumbrances: перечень обременений договором объявлен (схема RouteLeg)");

    return property!.GetValue(leg) as IEnumerable;
  }

  // Открытый статический метод объявленной областью формы. Имя типа ищется по
  // простому имени: раскладка областей — предмет решения о границах
  // (ADR-0001), и проверка правила её не назначает.
  private static MethodInfo Method(
      string typeName,
      string methodName,
      Type[] parameters,
      string expectedSignature)
  {
    var type = AreaAssemblies
        .SelectMany(assembly => assembly.GetExportedTypes())
        .FirstOrDefault(candidate => candidate.Name == typeName);

    Assert.True(
        type is not null,
        $"область не объявляет тип {typeName}. Ожидается открытый тип со статическим методом "
            + $"«{expectedSignature}»; искали в сборках {Names}");

    var method = type!.GetMethod(methodName, BindingFlags.Public | BindingFlags.Static, parameters);

    Assert.True(
        method is not null,
        $"у типа {type.FullName} нет метода «{expectedSignature}»");

    return method!;
  }

  // Сборки предметных областей, в которых правило может жить. Точка маршрута
  // объявлена договором в области «расчёт» (x-область: расчёт), а критерии
  // AC-034a и AC-035a перечислены среди приёмочных проверок сделки: обе
  // сборки просматриваются, и расхождение раскладки не выдаётся за
  // отсутствие правила.
  private static IReadOnlyList<Assembly> AreaAssemblies { get; } = LoadAreaAssemblies();

  private static string Names => string.Join(", ", AreaAssemblies.Select(assembly => assembly.GetName().Name));

  private static IReadOnlyList<Assembly> LoadAreaAssemblies()
  {
    var assemblies = new List<Assembly> { typeof(PlacementCost).Assembly };

    try
    {
      assemblies.Add(Assembly.Load("Imolt.Deals"));
    }
    catch (FileNotFoundException)
    {
      // Сборка области «сделка» пуста и может не попасть в выходной каталог.
      // Это не повод срывать проверку: недостающий символ назовёт утверждение
      // ниже, и в сообщении будет видно, где его искали.
    }

    return assemblies;
  }
}
