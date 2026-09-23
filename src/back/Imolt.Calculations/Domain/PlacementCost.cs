using Imolt.Shared;

namespace Imolt.Calculations.Domain;

/// Стоимость размещения объёма одной группы отходов на одном полигоне.
///
/// Формула живёт здесь и только здесь (ADR-0001): перевозка — тонны, цена
/// группы за тонна-километр и плечо перевозки по дорожной сети; утилизация —
/// тонны и тариф полигона по этой группе; совокупная цена — их сумма (R-018).
///
/// Правило не обращается ни к базе, ни к сети, ни к часам: его проверка идёт
/// за доли секунды и не зависит от дня прогона (ARCH-025).
///
/// @req: R-017, R-018, R-019, R-021, R-022
/// @adr: ADR-0001
public readonly record struct PlacementCost
{
  private PlacementCost(Money transportCost, Money? disposalCost, Money totalCost)
  {
    TransportCost = transportCost;
    DisposalCost = disposalCost;
    TotalCost = totalCost;
  }

  public Money TransportCost { get; }

  /// Пусто, когда утилизация не нужна. Ноль означал бы бесплатный приём на
  /// полигоне, а флажок снят потому, что приёма нет вовсе (R-021).
  public Money? DisposalCost { get; }

  public Money TotalCost { get; }

  /// <param name="transportCoefficient">
  /// Сезонный или суточный множитель цены перевозки (R-022). Единица означает,
  /// что на дату расчёта ни один коэффициент не действует. К тарифу полигона
  /// не применяется: иначе R-022 молча переписал бы формулу R-018.
  /// </param>
  public static PlacementCost Of(
      decimal tons,
      Money transportPricePerTonKm,
      decimal distanceKm,
      Money? disposalPricePerTon,
      decimal transportCoefficient)
  {
    if (tons <= 0)
    {
      throw new ArgumentOutOfRangeException(nameof(tons), tons, "масса строго больше нуля");
    }

    if (distanceKm < 0)
    {
      throw new ArgumentOutOfRangeException(nameof(distanceKm), distanceKm, "плечо перевозки не отрицательно");
    }

    if (transportCoefficient <= 0)
    {
      throw new ArgumentOutOfRangeException(
          nameof(transportCoefficient), transportCoefficient, "коэффициент перевозки строго больше нуля");
    }

    // Округление до копейки делает сама денежная сумма — в момент создания,
    // а не при выводе: иначе два одинаковых на вид значения дают разную сумму.
    var transport = Money.Rubles(tons * transportPricePerTonKm.Amount * distanceKm * transportCoefficient);
    var disposal = disposalPricePerTon is { } tariff ? Money.Rubles(tons * tariff.Amount) : (Money?)null;
    var total = disposal is { } known ? transport + known : transport;

    return new PlacementCost(transport, disposal, total);
  }
}
