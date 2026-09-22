using System.Globalization;
using System.Text.RegularExpressions;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Imolt.Shared;

/// Настройки разбора и сборки JSON на границе службы — одним местом.
/// Копия настроек расходится с оригиналом и начинает отдавать другой договор.
///
/// @shared: imolt-shared
/// @adr: ADR-0005
public static class ImoltJson
{
  public static JsonSerializerOptions Options { get; } = Create();

  private static JsonSerializerOptions Create()
  {
    var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
    // Необязательное поле без значения не пишется вовсе. Договор объявляет
    // пустоту допустимой лишь там, где сказано «nullable», и лишний null в
    // остальных местах его нарушает. Поля, где пустота обязана быть видимой,
    // помечаются на месте объявления.
    options.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    options.Converters.Add(new MoneyJsonConverter());
    return options;
  }
}

/// Денежная сумма на границе: строка с точкой и код валюты. Инвариантная
/// культура здесь обязательна — служба глобально выставляет ru-RU, и запятая
/// порвала бы образец договора «^-?[0-9]+\.[0-9]{2}$».
internal sealed class MoneyJsonConverter : JsonConverter<Money>
{
  public override Money Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
  {
    decimal? amount = null;
    string? currency = null;

    if (reader.TokenType != JsonTokenType.StartObject)
    {
      throw new JsonException("денежная сумма передаётся объектом с полями amount и currency");
    }

    while (reader.Read() && reader.TokenType != JsonTokenType.EndObject)
    {
      if (reader.TokenType != JsonTokenType.PropertyName)
      {
        continue;
      }

      var name = reader.GetString();
      reader.Read();

      switch (name)
      {
        case "amount":
          amount = ParseAmount(reader.GetString());
          break;
        case "currency":
          currency = reader.GetString();
          break;
      }
    }

    if (amount is null)
    {
      throw new JsonException("в денежной сумме нет поля amount");
    }

    if (currency is not null && currency != Money.RubleCode)
    {
      throw new JsonException($"валюта {currency} сервисом не поддерживается");
    }

    return Money.Rubles(amount.Value);
  }

  /// Сумма сверяется с образцом договора до разбора. Без этого инвариантная
  /// культура читает запятую как разделитель разрядов, и «10800,00» молча
  /// становится 1 080 000: договор нарушен, а ошибки нет.
  private static decimal ParseAmount(string? raw)
  {
    if (string.IsNullOrEmpty(raw))
    {
      throw new JsonException("поле amount пусто");
    }

    if (!AmountFormat.IsMatch(raw))
    {
      throw new JsonException(
          $"сумма «{raw}» не совпадает с образцом договора «{Money.AmountPattern}»");
    }

    return decimal.Parse(
        raw,
        NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint,
        CultureInfo.InvariantCulture);
  }

  private static readonly Regex AmountFormat =
      new(Money.AmountPattern, RegexOptions.CultureInvariant);

  public override void Write(Utf8JsonWriter writer, Money value, JsonSerializerOptions options)
  {
    writer.WriteStartObject();
    writer.WriteString("amount", value.Amount.ToString("F2", CultureInfo.InvariantCulture));
    writer.WriteString("currency", value.Currency);
    writer.WriteEndObject();
  }
}
