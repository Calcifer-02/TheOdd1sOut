namespace Imolt.Calculations.Domain;

/// Мера объёма отходов. Договор объявляет ровно две: тонны и кубометры.
///
/// @shared: imolt-calculations
/// @adr: ADR-0001
public enum AmountUnit
{
  Ton,
  CubicMeter,
}

/// Пересчёт объёма между мерами по коэффициенту плотности группы отходов.
/// Пользователь коэффициент не вводит — это свойство группы (R-015).
///
/// Меру расчёта правило не выбирает: заказчик не решил, считать ли по адресу
/// вывоза или по полигону (Q-009), поэтому обе меры возвращаются рядом.
///
/// @req: R-014, R-015
/// @adr: ADR-0001
public static class AmountConversion
{
  public static decimal ToTons(decimal value, AmountUnit unit, decimal densityTonPerCubicMeter)
  {
    Ensure(value, densityTonPerCubicMeter);

    return unit == AmountUnit.Ton ? value : value * densityTonPerCubicMeter;
  }

  public static decimal ToCubicMeters(decimal value, AmountUnit unit, decimal densityTonPerCubicMeter)
  {
    Ensure(value, densityTonPerCubicMeter);

    return unit == AmountUnit.CubicMeter ? value : value / densityTonPerCubicMeter;
  }

  // Плотность ноль означала бы невесомые отходы и деление на ноль при обратном
  // пересчёте: такой группы в справочнике быть не может, и схема это держит.
  private static void Ensure(decimal value, decimal densityTonPerCubicMeter)
  {
    if (value <= 0)
    {
      throw new ArgumentOutOfRangeException(nameof(value), value, "объём строго больше нуля");
    }

    if (densityTonPerCubicMeter <= 0)
    {
      throw new ArgumentOutOfRangeException(
          nameof(densityTonPerCubicMeter),
          densityTonPerCubicMeter,
          "коэффициент плотности строго больше нуля");
    }
  }
}
