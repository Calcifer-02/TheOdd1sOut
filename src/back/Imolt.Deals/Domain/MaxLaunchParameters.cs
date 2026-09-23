using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Web;

namespace Imolt.Deals.Domain;

/// Стартовые параметры мини-приложения платформы MAX и проверка их подписи
/// (ADR-0006).
///
/// Алгоритм взят из документации платформы (dev.max.ru, раздел «Валидация
/// данных») и записан в ADR-0006; здесь он воспроизведён, а не придуман:
/// строка проверки — все параметры, кроме `hash`, по алфавиту и через перевод
/// строки; ключ подписи — HMAC-SHA256 с ключом «WebAppData» над ключом бота;
/// подпись — HMAC-SHA256 этим ключом над строкой проверки, в
/// шестнадцатеричном виде.
///
/// Ключ бота в правило приходит доводом и наружу не возвращается ни в каком
/// виде: проверка подписи возможна только на сервере (R-056, риск AR-006).
///
/// @req: R-049, R-056
/// @adr: ADR-0006
public sealed record MaxLaunchParameters(string MaxUserId, string? DisplayName, DateTimeOffset AuthorizedAt)
{
  private const string SignatureField = "hash";

  private const string AuthorizedAtField = "auth_date";

  private const string UserField = "user";

  /// Ключ, которым платформа производит ключ подписи из ключа бота. Значение
  /// дословно из документации платформы; собственного смысла у строки нет.
  private const string DerivationKey = "WebAppData";

  /// Разбирает строку и проверяет подпись. Пусто означает «подпись не
  /// сошлась»: различать «подделано» и «испорчено» клиенту не нужно, а нам
  /// нечем — и то и другое означает, что личности нет.
  public static MaxLaunchParameters? Verified(string? initData, string botToken)
  {
    if (string.IsNullOrWhiteSpace(initData) || string.IsNullOrWhiteSpace(botToken))
    {
      return null;
    }

    var parameters = Parse(initData);

    if (!parameters.TryGetValue(SignatureField, out var signature)
        || !parameters.TryGetValue(AuthorizedAtField, out var authorizedAt))
    {
      return null;
    }

    // Сравнение постоянного времени: посимвольное давало бы по времени ответа
    // подсказку, сколько знаков подписи угадано.
    var expected = Signature(parameters, botToken);
    if (!CryptographicOperations.FixedTimeEquals(
        Encoding.ASCII.GetBytes(expected),
        Encoding.ASCII.GetBytes(signature)))
    {
      return null;
    }

    if (!long.TryParse(authorizedAt, NumberStyles.Integer, CultureInfo.InvariantCulture, out var seconds))
    {
      return null;
    }

    var user = User(parameters);

    return user is null
        ? null
        : new MaxLaunchParameters(user.Value.Id, user.Value.DisplayName, DateTimeOffset.FromUnixTimeSeconds(seconds));
  }

  /// Не устарели ли параметры. Договор величину не называет, поэтому срок
  /// приходит доводом: он объявлен настройкой службы, а не записан здесь.
  public bool IsFresh(DateTimeOffset now, TimeSpan lifetime) => now - AuthorizedAt <= lifetime;

  private static string Signature(Dictionary<string, string> parameters, string botToken)
  {
    var verified = string.Join(
        '\n',
        parameters
            .Where(pair => pair.Key != SignatureField)
            .OrderBy(pair => pair.Key, StringComparer.Ordinal)
            .Select(pair => $"{pair.Key}={pair.Value}"));

    using var derivation = new HMACSHA256(Encoding.UTF8.GetBytes(DerivationKey));
    var key = derivation.ComputeHash(Encoding.UTF8.GetBytes(botToken));

    using var signing = new HMACSHA256(key);

    return Convert.ToHexStringLower(signing.ComputeHash(Encoding.UTF8.GetBytes(verified)));
  }

  // Значения приходят в кодировке URL и в строку проверки идут раскодированными.
  private static Dictionary<string, string> Parse(string initData)
  {
    var parameters = new Dictionary<string, string>(StringComparer.Ordinal);

    foreach (var pair in initData.Split('&', StringSplitOptions.RemoveEmptyEntries))
    {
      var separator = pair.IndexOf('=', StringComparison.Ordinal);

      if (separator > 0)
      {
        parameters[HttpUtility.UrlDecode(pair[..separator])] = HttpUtility.UrlDecode(pair[(separator + 1)..]);
      }
    }

    return parameters;
  }

  // Учётная запись лежит объектом JSON внутри параметра. Негодный объект
  // означает отсутствие личности, а не пустое имя: подпись сошлась, но
  // сказать, кто пришёл, нечем.
  private static (string Id, string? DisplayName)? User(Dictionary<string, string> parameters)
  {
    if (!parameters.TryGetValue(UserField, out var json))
    {
      return null;
    }

    try
    {
      using var document = JsonDocument.Parse(json);
      var root = document.RootElement;

      if (!root.TryGetProperty("id", out var id))
      {
        return null;
      }

      var identifier = id.ValueKind == JsonValueKind.Number
          ? id.GetInt64().ToString(CultureInfo.InvariantCulture)
          : id.GetString();

      return string.IsNullOrWhiteSpace(identifier)
          ? null
          : (identifier, root.TryGetProperty("first_name", out var name) ? name.GetString() : null);
    }
    catch (JsonException)
    {
      return null;
    }
  }
}
