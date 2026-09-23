using System.Globalization;

namespace Imolt.Deals.Domain;

/// Номер коммерческого предложения: КП-2026-0917-014 (R-036).
///
/// Форма взята из примера договора. Номер читает и называет человек — в
/// переписке и по телефону, — поэтому он складывается из года, дня и
/// порядкового номера дня, а не из случайного идентификатора.
///
/// @req: R-036
/// @adr: ADR-0001
public static class QuoteNumber
{
  private const string Prefix = "КП";

  public static string Of(DateOnly day, int sequence)
  {
    if (sequence < 1)
    {
      throw new ArgumentOutOfRangeException(nameof(sequence), sequence, "порядковый номер дня начинается с единицы");
    }

    // Инвариантная культура: номер — машинный ключ в человеческой записи, и
    // в русской локали цифры от неё не меняются, а разделители могли бы.
    return string.Create(
        CultureInfo.InvariantCulture,
        $"{Prefix}-{day.Year:D4}-{day.Month:D2}{day.Day:D2}-{sequence:D3}");
  }
}
