using Npgsql;

namespace Imolt.Api;

/// Служебные точки расчётной части: живость и готовность. По ним внешний узел
/// и оркестратор решают, отдавать ли службе трафик, поэтому они отвечают
/// раньше любой предметной логики и не зависят от неё.
///
/// @req: R-011
/// @adr: ADR-0004
public static class ServiceEndpoints
{
  public static void MapServiceEndpoints(this WebApplication app)
  {
    // Живость: отвечает, пока процесс жив. Внешних зависимостей не
    // трогает — иначе перезапуск базы данных выглядел бы как отказ самой
    // службы (критерий приёмки AC-011a).
    app.MapGet("/health", () => Results.Ok(new
    {
      service = "api",
      status = "ok",
    }));

    // Готовность: подтверждает, что служба видит базу данных по строке
    // подключения из окружения. Именно эта точка ловит разорванную связку
    // api → db в compose (AC-011b, AC-011c).
    app.MapGet("/ready", ReadinessAsync);
  }

  private static async Task<IResult> ReadinessAsync(
      IConfiguration configuration,
      CancellationToken cancellationToken)
  {
    var connectionString = configuration["DATABASE_URL"];
    if (string.IsNullOrWhiteSpace(connectionString))
    {
      return NotReady("переменная DATABASE_URL не задана");
    }

    try
    {
      // Соединение открывается своё, а не берётся из пула службы:
      // готовность обязана отвечать и тогда, когда пул исчерпан.
      await using var connection = new NpgsqlConnection(connectionString);
      await connection.OpenAsync(cancellationToken);
      await using var command = new NpgsqlCommand("select 1", connection);
      await command.ExecuteScalarAsync(cancellationToken);
    }
    catch (NpgsqlException exception)
    {
      return NotReady(exception.Message);
    }

    return Results.Ok(new
    {
      service = "api",
      status = "ready",
      database = "reachable",
    });
  }

  // Готовность отвечает своей схемой, а не документом об ошибке: договор
  // объявляет для неё ReadinessStatus и в отказе тоже (операция getReadiness).
  private static IResult NotReady(string reason) => Results.Json(
      new
      {
        service = "api",
        status = "not_ready",
        reason,
      },
      statusCode: StatusCodes.Status503ServiceUnavailable);
}
