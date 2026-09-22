namespace Imolt.Shared;

/// Денежная сумма сервиса. Наружу уходит строкой с двумя знаками после точки
/// (схема Money договора): двоичная дробь округляет рубли по дороге, а смета
/// этого не прощает. Внутри — decimal, а не double, по той же причине.
///
/// @shared: imolt-shared
/// @adr: ADR-0005
public readonly record struct Money
{
    private Money(decimal amount, string currency)
    {
        Amount = amount;
        Currency = currency;
    }

    /// Единственная валюта сервиса: расчёт ведётся по Москве и области (R-061).
    public const string RubleCode = "RUB";

    public decimal Amount { get; }

    public string Currency { get; }

    /// Сумма округляется в момент создания, а не при выводе: иначе два
    /// одинаковых на вид значения дают разную сумму при сложении.
    public static Money Rubles(decimal amount) =>
        new(decimal.Round(amount, 2, MidpointRounding.AwayFromZero), RubleCode);

    public static Money operator +(Money left, Money right) =>
        Rubles(left.Amount + right.Amount);

    public static Money operator *(Money money, decimal multiplier) =>
        Rubles(money.Amount * multiplier);
}
