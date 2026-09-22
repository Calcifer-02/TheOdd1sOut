using Imolt.Database;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace Imolt.Api.Tests;

/// Стенд области «справочники»: одноразовая база со схемой, начальным набором
/// данных и достройкой, которой в наборе нет.
///
/// Стенд свой, а не общий ImoltApiStand, по одной причине: здесь схема
/// накатывается в InitializeAsync, а MigrationRunnerTests на общем стенде
/// утверждает, что первое применение миграций непустое. Накатив схему в общем
/// стенде, проверку миграций пришлось бы переписать под оснастку — и она
/// перестала бы проверять повторяемость развёртывания. Признак
/// IMOLT_APPLY_MIGRATIONS при этом остаётся выключенным: схему применяет тот,
/// кто разворачивает, а не служба на старте (ADR-0002, инвариант 6).
///
/// Достройка набора объявлена здесь, а не в отдельных проверках: данные общие
/// на весь класс сценариев, и разбросанные по проверкам вставки сделали бы
/// исход зависимым от порядка запуска.
///
/// @supports: R-011, R-048
public sealed class ImoltReferencesStand : IAsyncLifetime
{
  /// Настройка, которой внешняя служба подсказок объявляется источником.
  /// Имя выбрано по образцу DATABASE_URL: служба читает настройки из корня
  /// конфигурации, и вторая форма записи развела бы одно окружение надвое.
  public const string SuggestionsUrlSetting = "ADDRESS_SUGGESTIONS_URL";

  /// Настройка с ключом доступа к внешней службе подсказок.
  public const string SuggestionsApiKeySetting = "ADDRESS_SUGGESTIONS_API_KEY";

  /// Значение ключа на стенде. Строка заведомо неповторима, чтобы её
  /// появление в ответе нельзя было списать на совпадение (AC-056a).
  public const string SuggestionsApiKey = "imolt-proverochnyy-kluch-9f4c1d77e2b8";

  /// Полигон со статусом «заблокирован». В начальном наборе оба полигона
  /// активны, и отбор по статусу на них ничего не различает (AC-040c).
  /// Заводится отдельная запись, а не блокируется «Икша»: «Икша» участвует
  /// в отборе по группе отходов и в проверке пустой средней оценки, и смена
  /// её статуса сделала бы те проверки верными по другой причине.
  public const string BlockedLandfillId = "zablokirovannyy-polygon";

  /// Дата актуальности всего, что лежит на стенде. Совпадает с датой
  /// начального набора (0002_demo_dataset.sql), поэтому сводка актуальности
  /// определена однозначно и не зависит от порядка вставки (AC-048a).
  public const string DataDate = "2026-09-17";

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

    // Ключ внешней службы задан, а адрес службы — нет: подсказки на этом
    // стенде отвечают из справочника адресов, и ключу неоткуда попасть в
    // ответ иначе как по ошибке службы (AC-056a).
    service = new ImoltApiFactory(ConnectionString, new Dictionary<string, string?>
    {
      [SuggestionsApiKeySetting] = SuggestionsApiKey,
    });
    Client = service.CreateClient();
  }

  public async Task DisposeAsync()
  {
    Client?.Dispose();
    service?.Dispose();
    await database.DisposeAsync();
  }

  // Достройка начального набора до того, что требуют критерии приёмки.
  // Каждая вставка повторяема: стенд поднимается один раз, но повторный
  // запуск не должен ни падать, ни удваивать записи.
  private async Task SeedAsync(CancellationToken cancellationToken)
  {
    await using var connection = new NpgsqlConnection(ConnectionString);
    await connection.OpenAsync(cancellationToken);

    await using var command = new NpgsqlCommand(
        $"""
            -- Десять групп сверх трёх из набора: предел страницы равен десяти
            -- (договор, parameters/Limit; R-060), и на трёх записях он не
            -- наблюдается. Названия намеренно не содержат слова «бетон» и не
            -- похожи на код каталога — иначе они попали бы в выдачу поиска и
            -- сделали бы проверки поиска неверными (AC-013a, AC-013b).
            insert into waste_group (id, name, transport_price_per_ton_km, density_ton_per_m3, updated_at)
            select
                'proverka-gruppa-' || to_char(series.n, 'FM00'),
                'Проверочная группа ' || to_char(series.n, 'FM00'),
                20.00,
                1.0000,
                date '{DataDate}'
            from generate_series(1, 10) as series(n)
            on conflict (id) do nothing;

            -- Заблокированный полигон для отбора по статусу (AC-040c).
            insert into landfill (
                id, name, legal_entity, address, latitude, longitude,
                object_kind, registered_in_ais_ossig, status, status_source, status_updated_at
            ) values (
                '{BlockedLandfillId}', 'Площадка «Проверочная»', 'ООО «Проверочная»',
                'Московская обл., Богородский г. о., д. Проверочная', 55.8500, 38.4400,
                'disposal', true, 'blocked', 'manual', date '{DataDate}'
            )
            on conflict (id) do nothing;

            -- Тариф заблокированного полигона: договор требует у полигона
            -- перечень тарифов, и полигон без единого тарифа проверял бы
            -- отбор по статусу на вырожденной записи.
            insert into landfill_tariff (landfill_id, waste_group_id, disposal_price_per_ton, updated_at)
            values ('{BlockedLandfillId}', 'beton-lom', 500.00, date '{DataDate}')
            on conflict (landfill_id, waste_group_id) do nothing;

            -- Две оценки полигона «Восток» — 4 и 5, средняя 4,5 (AC-031a).
            -- Идентификаторы и время заданы буквально: случайное значение
            -- сделало бы исход невоспроизводимым от запуска к запуску.
            insert into landfill_review (id, landfill_id, subscriber_id, rating, text, created_at) values
                ('a1b2c3d4-0001-4a00-8a00-000000000001', 'vostok-timohovo', null, 4,
                 'тариф на месте совпал со справочником', timestamptz '{DataDate} 10:00:00+03'),
                ('a1b2c3d4-0002-4a00-8a00-000000000002', 'vostok-timohovo', null, 5,
                 'статус подтвердился при заезде', timestamptz '{DataDate} 11:00:00+03')
            on conflict (id) do nothing;
            """,
        connection);

    await command.ExecuteNonQueryAsync(cancellationToken);
  }
}

/// Общий стенд справочников на все проверки области: контейнер поднимается
/// один раз, а не на каждый класс проверок.
[CollectionDefinition(Name)]
public sealed class ImoltReferencesCollection : ICollectionFixture<ImoltReferencesStand>
{
  public const string Name = "справочники ИМОЛТ на базе с начальным набором";
}
