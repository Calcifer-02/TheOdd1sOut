using Dapper;
using Imolt.Calculations.Ports;
using Imolt.Shared;
using Npgsql;

namespace Imolt.Calculations.Adapters;

/// Сезонные и суточные множители цены перевозки из таблицы
/// transport_coefficient (СУЩ-11, R-022).
///
/// Действующие коэффициенты перемножаются: сезонный и суточный — разные
/// обстоятельства и действуют вместе. Ни один не действует — множитель равен
/// единице, и формула R-018 работает как записана.
///
/// Наружу коэффициент не отдаётся (R-058): клиент видит стоимость, а не то,
/// из каких множителей она сложилась.
///
/// @req: R-022
/// @adr: ADR-0005
public sealed class TransportCoefficients(NpgsqlDataSource dataSource, IClock clock) : ITransportCoefficients
{
  public async Task<decimal> EffectiveAsync(CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    // Незаполненная граница означает «без ограничения с этой стороны»: у
    // сезонного коэффициента нет часов, у суточного — дат.
    var factors = await connection.QueryAsync<decimal>(new CommandDefinition(
        """
        select factor
          from transport_coefficient
         where (valid_from is null or valid_from <= @today)
           and (valid_to is null or valid_to >= @today)
           and (hour_from is null or hour_from <= @hour)
           and (hour_to is null or hour_to >= @hour)
        """,
        new { today = clock.Today, hour = clock.Now.Hour },
        cancellationToken: cancellationToken));

    return factors.Aggregate(1m, (product, factor) => product * factor);
  }
}
