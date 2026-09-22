using System.Globalization;
using Imolt.Database;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace Imolt.Api.Tests;

/// Стенд с действующим сезонным коэффициентом перевозки (R-022).
///
/// Стенд отдельный вынужденно: действующий коэффициент меняет стоимость
/// перевозки любого расчёта, а ImoltCalculationsStand обязан отдавать числа
/// примера договора без коэффициента (AC-018a — AC-018c). Один стенд на оба
/// набора условий означал бы, что одно из двух утверждений проверяется на
/// данных другого.
///
/// @supports: R-022, R-058
public sealed class ImoltSeasonalTransportStand : IAsyncLifetime
{
  /// Сезонный коэффициент стенда. Значение не круглое намеренно: при
  /// коэффициенте 2 произведение совпало бы с удвоенным плечом или удвоенным
  /// объёмом, и ошибку в том, к чему коэффициент применён, было бы не видно.
  public const decimal SeasonalFactor = 1.150m;

  /// Адрес вывоза примера договора: от него сохранены плечи 45 и 52 км.
  public const string PickupValue = "г Москва, ул Годовикова, д 9";

  public const double PickupLatitude = 55.8055;

  public const double PickupLongitude = 37.6206;

  private readonly PostgreSqlContainer database = new PostgreSqlBuilder("postgres:17-alpine")
      .WithDatabase("imolt")
      .WithUsername("imolt")
      .WithPassword("imolt")
      .Build();

  private ImoltApiFactory? service;

  public string ConnectionString => database.GetConnectionString();

  public HttpClient Client { get; private set; } = null!;

  public async Task InitializeAsync()
  {
    await database.StartAsync();

    await MigrationRunner.ApplyAsync(ConnectionString, CancellationToken.None);
    await SeedAsync(CancellationToken.None);

    service = new ImoltApiFactory(ConnectionString);
    Client = service.CreateClient();
  }

  public async Task DisposeAsync()
  {
    Client?.Dispose();
    service?.Dispose();
    await database.DisposeAsync();
  }

  private async Task SeedAsync(CancellationToken cancellationToken)
  {
    await using var connection = new NpgsqlConnection(ConnectionString);
    await connection.OpenAsync(cancellationToken);

    // Срок действия отсчитывается от даты запуска, а не записан буквально:
    // критерий требует коэффициента, действующего «на дату расчёта», а расчёт
    // выполняется в день прогона. Фиксированный интервал сделал бы стенд
    // верным сегодня и бессмысленным через месяц — это не та определённость,
    // которую даёт запись даты.
    await using var command = new NpgsqlCommand(
        $"""
            insert into transport_coefficient (id, kind, valid_from, valid_to, hour_from, hour_to, factor)
            values (1, 'seasonal', current_date - 30, current_date + 30, null, null, {SeasonalFactor.ToString(CultureInfo.InvariantCulture)})
            on conflict (id) do nothing;
            """,
        connection);

    await command.ExecuteNonQueryAsync(cancellationToken);
  }
}

/// Стенд сезонного коэффициента на проверки сокрытия коэффициентов.
[CollectionDefinition(Name)]
public sealed class ImoltSeasonalTransportCollection : ICollectionFixture<ImoltSeasonalTransportStand>
{
  public const string Name = "расчёт ИМОЛТ с действующим сезонным коэффициентом";
}
