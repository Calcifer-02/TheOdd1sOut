using Dapper;
using Imolt.Calculations.Contracts;
using Imolt.Calculations.Ports;
using Npgsql;

namespace Imolt.Calculations.Adapters;

/// Плечи перевозки по дорожной сети из таблицы road_distance (СУЩ-10).
///
/// Таблица — кэш ответов внешней службы маршрутизации: целевая служба
/// заказчиком не назначена (Q-008), и до её появления расстояния приходят
/// начальным набором и пополнением вручную. Полигона нет в ответе — плеча нет;
/// расстояние по прямой не подставляется, потому что оно занижает смету
/// (R-020).
///
/// @req: R-020
/// @adr: ADR-0005
public sealed class RoadDistances(NpgsqlDataSource dataSource) : IRoadDistances
{
  /// Ключ таблицы хранит координаты с пятью знаками после точки — примерно
  /// метр на местности. Округление здесь повторяет округление ключа: иначе
  /// один и тот же адрес не нашёл бы собственной строки.
  private const int KeyPrecision = 5;

  public async Task<IReadOnlyDictionary<string, double>> FromAsync(
      Coordinates pickup,
      CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

    var rows = await connection.QueryAsync<DistanceRow>(new CommandDefinition(
        """
        select landfill_id, distance_km
          from road_distance
         where from_latitude = @latitude
           and from_longitude = @longitude
        """,
        new
        {
          latitude = Math.Round((decimal)pickup.Latitude, KeyPrecision),
          longitude = Math.Round((decimal)pickup.Longitude, KeyPrecision),
        },
        cancellationToken: cancellationToken));

    return rows.ToDictionary(row => row.LandfillId, row => (double)row.DistanceKm);
  }

  // Средство доступа к данным собирает строку через открытые свойства, а
  // позиционную запись собрать не умеет.
  private sealed class DistanceRow
  {
    public string LandfillId { get; set; } = string.Empty;

    public decimal DistanceKm { get; set; }
  }
}
