using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Testcontainers.PostgreSql;
using Xunit;

namespace Imolt.Api.Tests;

/// Служба, поднятая целиком, и одноразовая база рядом с ней. База настоящая
/// той же версии, что в compose.yaml: готовность и миграции, проверенные на
/// подделке, не доказывают ничего о боевом окружении.
///
/// @supports: R-011
public sealed class ImoltApiStand : IAsyncLifetime
{
  private readonly PostgreSqlContainer database = new PostgreSqlBuilder("postgres:17-alpine")
      .WithDatabase("imolt")
      .WithUsername("imolt")
      .WithPassword("imolt")
      .Build();

  private ImoltApiFactory? service;

  /// Строка подключения в форме ключей Npgsql (Host=…;Port=…;Database=…):
  /// служба читает DATABASE_URL как есть и в вид URI его не преобразует.
  public string ConnectionString => database.GetConnectionString();

  public HttpClient Client { get; private set; } = null!;

  public async Task InitializeAsync()
  {
    await database.StartAsync();

    service = new ImoltApiFactory(ConnectionString);
    Client = service.CreateClient();
  }

  public async Task DisposeAsync()
  {
    Client?.Dispose();
    service?.Dispose();
    await database.DisposeAsync();
  }
}

/// Служба ИМОЛТ в процессе проверки. Поднимается тот же Program.cs, который
/// уходит в образ: подменяются только строка подключения к базе и настройки,
/// которые проверке нужно объявить явно (адрес и ключ внешней службы).
public sealed class ImoltApiFactory(
    string? connectionString,
    IReadOnlyDictionary<string, string?>? settings = null) : WebApplicationFactory<Program>
{
  protected override void ConfigureWebHost(IWebHostBuilder builder)
  {
    var values = new Dictionary<string, string?>
    {
      ["DATABASE_URL"] = connectionString ?? string.Empty,
    };

    // Настройки проверки кладутся поверх строки подключения, а не вместо
    // неё: сценарию внешней службы нужна и работающая база.
    foreach (var (key, value) in settings ?? new Dictionary<string, string?>())
    {
      values[key] = value;
    }

    // Источник добавляется последним и поэтому перекрывает переменную
    // окружения машины: иначе проверка «службы без DATABASE_URL» молча
    // подхватила бы чужую строку подключения и стала бы подтверждающей.
    builder.ConfigureAppConfiguration(configuration => configuration.AddInMemoryCollection(values));
  }
}

/// Общий стенд на все проверки, которым нужна поднятая служба с базой:
/// контейнер поднимается один раз, а не на каждый класс проверок.
[CollectionDefinition(Name)]
public sealed class ImoltApiCollection : ICollectionFixture<ImoltApiStand>
{
  public const string Name = "служба ИМОЛТ с одноразовой базой";
}
