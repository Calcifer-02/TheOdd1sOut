using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Imolt.Api.Tests;

/// Сборка и подпись строки стартовых параметров мини-приложения платформы
/// MAX. Проверка подписывает параметры сама — проверочным ключом бота, который
/// задаётся службе настройкой стенда. Настоящий ключ платформы выдают
/// организаторы трека, проверкам он не нужен и в репозиторий не попадает
/// (ADR-0006, инвариант 2).
///
/// Алгоритм повторён по ADR-0006, раздел «Результат проверки»:
/// строка проверки — все параметры, кроме `hash`, отсортированные по ключу от
/// «a» к «z» и склеенные переводом строки в виде «ключ=значение», причём
/// значения берутся после URL-декодирования; ключ подписи —
/// HMAC-SHA256 с ключом «WebAppData» над ключом бота; подпись — HMAC-SHA256
/// ключом подписи над строкой проверки в шестнадцатеричном виде.
///
/// Свой счёт подписи здесь неизбежен. Если бы проверка звала ту же единицу,
/// что и служба, она подтверждала бы согласие реализации с самой собой, а не с
/// опубликованным алгоритмом: подпись, посчитанная обеими сторонами по одной
/// ошибке, сойдётся.
///
internal static class MaxInitDataBuilder
{
  /// Постоянная составляющая ключа подписи, названная документацией
  /// платформы. Латиницей и буквально: значение входит в счёт подписи, и
  /// перевод на русский сделал бы подпись другой.
  private const string SigningSalt = "WebAppData";

  private const string HashKey = "hash";

  private const string AuthDateKey = "auth_date";

  private const string QueryIdKey = "query_id";

  private const string UserKey = "user";

  /// Набор стартовых параметров без подписи. Состав — из ADR-0006: время
  /// выдачи, идентификатор запроса и объект учётной записи. Объект чата не
  /// кладётся: он необязателен, а лишний параметр менял бы строку проверки
  /// и уводил причину отказа от проверяемой.
  public static IReadOnlyDictionary<string, string> Parameters(
      long maxUserId,
      DateTimeOffset authDate,
      string displayName = "Иван",
      string queryId = "AAH-imolt-proverka")
      => new Dictionary<string, string>(StringComparer.Ordinal)
      {
        // Время выдачи — число секунд эпохи Unix. Инвариантная культура
        // обязательна: служба глобально выставляет ru-RU, и разделитель
        // разрядов русской локали порвал бы и подпись, и разбор.
        [AuthDateKey] = authDate.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture),
        [QueryIdKey] = queryId,
        [UserKey] = UserJson(maxUserId, displayName),
      };

  /// Объект учётной записи платформы как его отдаёт мини-приложение.
  /// Идентификатор пишется числом, а не строкой: так он записан в примере
  /// договора (`user=%7B%22id%22%3A812345%7D`), а профиль называет ту же
  /// учётную запись строкой — поле `maxUserId` схемы Profile.
  public static string UserJson(long maxUserId, string displayName)
      => $$"""{"id":{{maxUserId.ToString(CultureInfo.InvariantCulture)}},"first_name":"{{displayName}}"}""";

  /// Учётная запись в том виде, в каком её обязан назвать профиль.
  public static string MaxUserIdOf(long maxUserId) => maxUserId.ToString(CultureInfo.InvariantCulture);

  /// Подписанная строка стартовых параметров: сами параметры плюс поле
  /// `hash`, посчитанное ключом бота.
  public static string Signed(string botToken, IReadOnlyDictionary<string, string> parameters)
      => Query(parameters, Signature(botToken, parameters));

  /// Подделка: подпись считается по исходным параметрам, а учётная запись
  /// подменяется после счёта. Именно так выглядит попытка выдать себя за
  /// другого — чужое поле при прежней подписи (AC-049b).
  public static string SignedWithSubstitutedUser(
      string botToken,
      IReadOnlyDictionary<string, string> parameters,
      string substitutedUserJson)
  {
    var signature = Signature(botToken, parameters);

    var substituted = new Dictionary<string, string>(parameters, StringComparer.Ordinal)
    {
      [UserKey] = substitutedUserJson,
    };

    return Query(substituted, signature);
  }

  /// Подпись набора параметров. Отдаётся наружу, потому что AC-056c ищет это
  /// значение в теле ответов: подпись стартовых параметров наружу не выходит
  /// так же, как и сам ключ бота.
  public static string Signature(string botToken, IReadOnlyDictionary<string, string> parameters)
  {
    var dataCheckString = string.Join(
        "\n",
        parameters
            .Where(parameter => !string.Equals(parameter.Key, HashKey, StringComparison.Ordinal))
            .OrderBy(parameter => parameter.Key, StringComparer.Ordinal)
            .Select(parameter => $"{parameter.Key}={parameter.Value}"));

    // Ключ подписи производный: постоянная составляющая выступает ключом
    // HMAC, а ключ бота — сообщением, а не наоборот. Перестановка даёт другую
    // подпись, и сошлась бы она только сама с собой.
    var signingKey = HMACSHA256.HashData(
        Encoding.UTF8.GetBytes(SigningSalt),
        Encoding.UTF8.GetBytes(botToken));

    return Convert.ToHexStringLower(
        HMACSHA256.HashData(signingKey, Encoding.UTF8.GetBytes(dataCheckString)));
  }

  /// Значение поля `hash` из собранной строки. Берётся разбором строки, а не
  /// повторным счётом: у подделки подпись относится к другим параметрам, и
  /// пересчёт вернул бы не то значение, которое ушло службе.
  public static string HashOf(string initData)
      => initData
          .Split('&')
          .Select(pair => pair.Split('=', 2))
          .Where(pair => pair.Length == 2 && string.Equals(pair[0], HashKey, StringComparison.Ordinal))
          .Select(pair => Uri.UnescapeDataString(pair[1]))
          .Single();

  // Строка запроса: параметры в кодировке URL, подпись последним полем.
  // Порядок полей в строке произволен — сервер сортирует их сам, — но здесь
  // он задан однозначно, чтобы одинаковые входные данные давали одинаковую
  // строку от запуска к запуску.
  private static string Query(IReadOnlyDictionary<string, string> parameters, string signature)
      => string.Join(
          "&",
          parameters
              .OrderBy(parameter => parameter.Key, StringComparer.Ordinal)
              .Append(new KeyValuePair<string, string>(HashKey, signature))
              .Select(parameter =>
                  $"{Uri.EscapeDataString(parameter.Key)}={Uri.EscapeDataString(parameter.Value)}"));
}
