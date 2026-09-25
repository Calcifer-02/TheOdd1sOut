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

/// Зона обслуживания адреса. Договор объявляет ровно две, и обе названы
/// здесь: правило меры сравнивает с ними, а не с написанным на месте словом.
///
/// @shared: imolt-calculations
/// @adr: ADR-0001
public static class ServiceAreas
{
  public const string Moscow = "moscow";

  public const string MoscowRegion = "moscowRegion";
}

/// Мера расчёта по зоне адреса вывоза (R-016).
///
/// Москва считает в тоннах, Московская область — в кубических метрах. Меру
/// определяет адрес вывоза, а не полигон: решение по Q-009 от 25.09.2026.
/// После запрета захоронения ОССиГ в Москве с 01.07.2026 связка «вывоз из
/// Москвы, полигон в области» стала основным случаем, и мера по полигону
/// перевела бы в кубометры почти всякий расчёт.
///
/// Стоимость мера не трогает: тарифы заданы за тонну (R-018), и цена в обеих
/// зонах считается по массе.
///
/// @req: R-016
/// @adr: ADR-0001
public static class CalculationMeasure
{
  public static AmountUnit For(string? area) => area switch
  {
    ServiceAreas.Moscow => AmountUnit.Ton,
    ServiceAreas.MoscowRegion => AmountUnit.CubicMeter,
    _ => throw new ArgumentOutOfRangeException(
        nameof(area), area, "зона адреса вывоза — moscow либо moscowRegion"),
  };
}

/// Пересчёт объёма между мерами по коэффициенту плотности группы отходов.
/// Пользователь коэффициент не вводит — это свойство группы (R-015).
///
/// Меру расчёта правило не выбирает: её выбирает зона адреса вывоза (R-016),
/// а операция пересчёта об адресе не знает и возвращает обе меры рядом.
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
