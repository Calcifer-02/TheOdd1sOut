using System.Globalization;
using Imolt.Bot;
using Imolt.Bot.Application;
using Imolt.Bot.Domain;
using Imolt.Bot.Ports;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace Imolt.Bot.Tests;

/// Сценарии переписки целиком: первое сообщение с кнопкой и перечнем команд,
/// справочный ответ, короткий расчёт, порядок в переписке и извещение
/// (R-069, R-070, R-072, R-075, R-077, R-078, R-079, R-083; критерии
/// AC-069a, AC-070a, AC-070b, AC-072a, AC-072b, AC-075a, AC-077a, AC-077b,
/// AC-078a, AC-079a, AC-083a).
///
/// Платформа MAX в проверках не участвует: порт подменяется двойником
/// `RecordingMaxMessages`, справочник и языковая модель — своими двойниками.
/// Ни токена, ни сети, ни базы данных.
///
///   dotnet test tests/unit/Imolt.Bot.Tests
public sealed class DialogScenarioTests
{
  private const long ChatId = 4242;

  /// Начало отсчёта часов проверки. Записано числом: время у системы сделало
  /// бы прогон невоспроизводимым.
  private static readonly DateTimeOffset Origin =
      new(2026, 9, 24, 12, 0, 0, TimeSpan.FromHours(3));

  private static readonly DateOnly Actual = new(2026, 9, 17);

  private static readonly CultureInfo Russian = CultureInfo.GetCultureInfo("ru-RU");

  private static readonly LandfillTariffs Vostok = new(
      "Комплекс переработки «Восток»",
      [new TariffFact("Лом бетона и железобетона", 450m, "RUB", Actual)]);

  /// Проверка падает, если первое обращение останется без ответа, если ответ
  /// придёт не одним сообщением, если в нём не будет перечня объявленных
  /// команд и если к сообщению не приложится кнопка запуска мини-приложения.
  ///
  /// @ac: AC-069a
  /// @ac: AC-070a
  [Fact(DisplayName = "первое обращение к чат-боту получает одно сообщение с командами и кнопкой запуска")]
  public async Task FirstContactReceivesOneMessageWithCommandsAndTheMiniAppButton()
  {
    var platform = new RecordingMaxMessages(() => Origin);
    var dialogs = new InMemoryDialogs();
    var scenarios = Build(platform, dialogs);

    await scenarios.HandleAsync(Started(), CancellationToken.None);

    var sent = Assert.Single(platform.Sent);

    foreach (var command in BotTexts.Commands)
    {
      Assert.Contains(command.Name, sent.Text, StringComparison.Ordinal);
    }

    Assert.NotNull(sent.Keyboard);
    var row = Assert.Single(sent.Keyboard.Rows);
    var button = Assert.Single(row);

    Assert.Equal(MiniAppButton.Kind, button.Type);
    Assert.Equal(platform.Identity.ContactId, button.ContactId);

    Assert.True(
        dialogs.Find(ChatId).CommandsAnnounced,
        "перечень команд показан, но в состоянии переписки это не записано: он уйдёт повторно");
  }

  /// Проверка падает, если перечень команд уйдёт участнику второй раз —
  /// в ответ на любое следующее обращение в той же переписке.
  ///
  /// @ac: AC-070b
  [Fact(DisplayName = "следующее обращение в той же переписке перечня команд не повторяет")]
  public async Task NextContactInTheSameDialogNeverRepeatsTheCommandList()
  {
    var platform = new RecordingMaxMessages(() => Origin);
    var dialogs = new InMemoryDialogs();
    var scenarios = Build(platform, dialogs);

    await scenarios.HandleAsync(Started(), CancellationToken.None);
    await scenarios.HandleAsync(Said("/help"), CancellationToken.None);

    Assert.Equal(2, platform.Sent.Count);

    Assert.DoesNotContain(
        "/",
        platform.Sent[1].Text,
        StringComparison.Ordinal);
  }

  /// Проверка падает, если при выключенной языковой модели участник останется
  /// без ответа, получит отказ «возможность не настроена» или значение не из
  /// справочника.
  ///
  /// @ac: AC-077b
  [Fact(DisplayName = "вопрос о тарифе при выключенной языковой модели получает ответ справочника")]
  public async Task QuestionAnsweredFromTheCatalogueWhenTheLanguageModelIsOff()
  {
    var platform = new RecordingMaxMessages(() => Origin);
    var dialogs = Announced();
    var scenarios = Build(platform, dialogs, new StubCatalog(tariffs: Vostok));

    await scenarios.HandleAsync(Said("Какой тариф на полигоне Восток?"), CancellationToken.None);

    var sent = Assert.Single(platform.Sent);

    Assert.Contains(450m.ToString("C2", Russian), sent.Text, StringComparison.Ordinal);
    Assert.Contains("17.09.2026", sent.Text, StringComparison.Ordinal);

    Assert.DoesNotContain("не настроен", sent.Text, StringComparison.OrdinalIgnoreCase);
    Assert.DoesNotContain(
        ReferenceAnswers.LanguageModelMark,
        sent.Text,
        StringComparison.Ordinal);
  }

  /// Проверка падает, если включённая модель получит вопрос без фактов
  /// справочника или её ответ уйдёт участнику без пометки.
  ///
  /// @ac: AC-077a
  [Fact(DisplayName = "включённая языковая модель отвечает по фактам справочника и ответ помечается")]
  public async Task EnabledLanguageModelAnswersFromCatalogueFactsAndItsAnswerIsMarked()
  {
    var platform = new RecordingMaxMessages(() => Origin);
    var model = new StubLanguageModel(enabled: true, answer: "Приём тонны стоит 450,00 ₽.");
    var scenarios = Build(platform, Announced(), new StubCatalog(tariffs: Vostok), model);

    await scenarios.HandleAsync(Said("Какой тариф на полигоне Восток?"), CancellationToken.None);

    Assert.NotNull(model.Prompt);
    Assert.Contains("Комплекс переработки «Восток»", model.Prompt, StringComparison.Ordinal);

    var sent = Assert.Single(platform.Sent);

    Assert.Contains(ReferenceAnswers.LanguageModelMark, sent.Text, StringComparison.Ordinal);
  }

  /// Проверка падает, если о ненайденном в справочнике предмете чат-бот
  /// промолчит или назовёт значение: и то и другое вредно одинаково.
  ///
  /// @ac: AC-075a
  [Fact(DisplayName = "вопрос о неизвестном сервису полигоне получает ответ об отсутствии данных")]
  public async Task QuestionAboutAnUnknownLandfillIsAnsweredWithMissingData()
  {
    var platform = new RecordingMaxMessages(() => Origin);
    var scenarios = Build(platform, Announced(), new StubCatalog());

    await scenarios.HandleAsync(Said("Какой тариф на полигоне Северный?"), CancellationToken.None);

    var sent = Assert.Single(platform.Sent);

    Assert.Contains("нет данных", sent.Text, StringComparison.Ordinal);
    Assert.False(
        sent.Text.Any(char.IsDigit),
        "в ответе об отсутствии данных названо число: участник прочитает его как значение сервиса");
  }

  /// Проверка падает, если короткий расчёт уйдёт в расчётную часть не тем
  /// составом, если ответ не назовёт цену и предварительность и если к нему
  /// не приложится кнопка перехода в мини-приложение за сравнением.
  ///
  /// @ac: AC-072a
  /// @ac: AC-072b
  [Fact(DisplayName = "сообщение с адресом, группой и объёмом получает карточку расчёта с кнопкой сравнения")]
  public async Task QuickQuoteMessageReceivesACardWithThePriceAndTheComparisonButton()
  {
    var platform = new RecordingMaxMessages(() => Origin);
    var dialogs = Announced();
    var catalog = new StubCatalog(price: new PreliminaryPrice(
        "calc-01",
        "Лом бетона и железобетона",
        "Комплекс переработки «Восток»",
        19800m,
        "RUB",
        Actual));

    var scenarios = Build(platform, dialogs, catalog);

    await scenarios.HandleAsync(
        Said("г Москва, ул Годовикова, д 9; лом бетона; 20 т"),
        CancellationToken.None);

    Assert.NotNull(catalog.Asked);
    Assert.Equal("лом бетона", catalog.Asked.WasteGroup);
    Assert.Equal(20m, catalog.Asked.Amount);
    Assert.Equal("t", catalog.Asked.Unit);

    var sent = Assert.Single(platform.Sent);

    Assert.Contains(19800m.ToString("C2", Russian), sent.Text, StringComparison.Ordinal);
    Assert.Contains(QuickQuotes.PreliminaryMark, sent.Text, StringComparison.Ordinal);

    Assert.NotNull(sent.Keyboard);
    var button = Assert.Single(Assert.Single(sent.Keyboard.Rows));
    Assert.Equal(MiniAppButton.Kind, button.Type);

    Assert.True(
        sent.IsCard,
        "ответ расчётом отправлен обычным сообщением: следующий расчёт оставит в переписке второе такое же");

    Assert.Equal("msg-01", dialogs.Find(ChatId).CardMessageId);
  }

  /// Проверка падает, если при достигнутом пределе отправка обойдётся без
  /// удаления, если удалено будет не самое раннее сообщение чат-бота и если
  /// новое состояние переписки не сохранится.
  ///
  /// @ac: AC-078a
  [Fact(DisplayName = "отправка при достигнутом пределе удаляет самое раннее своё сообщение и сохраняет состояние")]
  public async Task SendingAtTheDepthLimitDeletesTheEarliestOwnMessageAndStoresTheState()
  {
    var settings = new BotOptions();
    var platform = new RecordingMaxMessages(() => Origin);
    var dialogs = new InMemoryDialogs();

    var own = Enumerable.Range(1, settings.DialogDepth)
        .Select(number => "old-" + number.ToString("00", CultureInfo.InvariantCulture))
        .ToList();

    var state = DialogState.Empty(ChatId) with { CommandsAnnounced = true, OwnMessageIds = own };
    dialogs.Put(state);

    var scenarios = Build(platform, dialogs, options: settings);

    var next = await scenarios.PublishAsync(
        state,
        new OutgoingMessage("Заявка принята в работу", null, IsCard: false),
        CancellationToken.None);

    Assert.Equal([own[0]], platform.Deleted);
    Assert.Equal(settings.DialogDepth, next.OwnMessageIds.Count);
    Assert.Equal(next, dialogs.Find(ChatId));
  }

  /// Проверка падает, если изменившийся расчёт уйдёт новым сообщением вместо
  /// правки прежней карточки.
  ///
  /// @ac: AC-079a
  [Fact(DisplayName = "изменившийся расчёт переписывает прежнюю карточку и нового сообщения не отправляет")]
  public async Task ChangedCalculationRewritesTheCardWithoutSendingANewMessage()
  {
    var platform = new RecordingMaxMessages(() => Origin);
    var dialogs = new InMemoryDialogs();

    var state = DialogState.Empty(ChatId) with
    {
      CommandsAnnounced = true,
      CardMessageId = "card-01",
      OwnMessageIds = ["card-01"],
    };

    dialogs.Put(state);

    var scenarios = Build(platform, dialogs);

    await scenarios.PublishAsync(
        state,
        new OutgoingMessage("Расчёт вывоза: предварительная цена", null, IsCard: true),
        CancellationToken.None);

    Assert.Equal(["card-01"], platform.Edited);
    Assert.Equal(0, platform.SendCalls);
    Assert.Empty(platform.Deleted);
    Assert.Equal("card-01", dialogs.Find(ChatId).CardMessageId);
  }

  /// Проверка падает, если извещение не дойдёт до переписки и если в нём не
  /// будет названо, какая заявка и в какой статус перешла.
  ///
  /// @ac: AC-083a
  [Fact(DisplayName = "смена статуса заявки доходит до переписки с номером заявки и новым статусом")]
  public async Task PickupRequestStatusChangeReachesTheDialogNamingNumberAndStatus()
  {
    var platform = new RecordingMaxMessages(() => Origin);
    var dialogs = Announced();
    var scenarios = Build(platform, dialogs);

    await scenarios.NotifyAsync(
        ChatId,
        new PickupRequestNotice("2026-000123", "принята в работу"),
        CancellationToken.None);

    var sent = Assert.Single(platform.Sent);

    Assert.Contains("2026-000123", sent.Text, StringComparison.Ordinal);
    Assert.Contains("принята в работу", sent.Text, StringComparison.Ordinal);

    Assert.False(
        sent.IsCard,
        "извещение отправлено карточкой: карточка в переписке одна и занята расчётом");
  }

  private static DialogScenarios Build(
      RecordingMaxMessages platform,
      InMemoryDialogs dialogs,
      IReferenceCatalog? catalog = null,
      ILanguageModel? languageModel = null,
      BotOptions? options = null) =>
      new(
          platform,
          dialogs,
          catalog ?? new StubCatalog(),
          languageModel ?? new StubLanguageModel(enabled: false, answer: null),
          new BotAccount(platform),
          Options.Create(options ?? new BotOptions()),
          (span, cancellationToken) => Task.CompletedTask,
          NullLogger<DialogScenarios>.Instance);

  /// Переписка, в которой перечень команд уже показан: проверке нужен не он,
  /// а следующий ответ чат-бота.
  private static InMemoryDialogs Announced()
  {
    var dialogs = new InMemoryDialogs();
    dialogs.Put(DialogState.Empty(ChatId) with { CommandsAnnounced = true });

    return dialogs;
  }

  private static BotUpdate Started() =>
      new(UpdateKind.BotStarted, ChatId, "user-01", "Участник", null, null);

  private static BotUpdate Said(string text) =>
      new(UpdateKind.MessageCreated, ChatId, "user-01", "Участник", text, null);

  /// Состояние переписок в памяти проверки: база в модульной проверке не
  /// поднимается.
  private sealed class InMemoryDialogs : IDialogs
  {
    private readonly Dictionary<long, DialogState> states = [];

    public void Put(DialogState state) => states[state.ChatId] = state;

    public DialogState Find(long chatId) =>
        states.TryGetValue(chatId, out var state) ? state : DialogState.Empty(chatId);

    public Task<DialogState> FindAsync(long chatId, CancellationToken cancellationToken) =>
        Task.FromResult(Find(chatId));

    public Task SaveAsync(DialogState state, CancellationToken cancellationToken)
    {
      Put(state);

      return Task.CompletedTask;
    }
  }

  /// Справочник сервиса, отвечающий заранее назначенным. Пусто означает, что
  /// записи у сервиса нет, — то самое состояние, которое требует R-075.
  private sealed class StubCatalog(
      LandfillTariffs? tariffs = null,
      DensityFact? density = null,
      PreliminaryPrice? price = null) : IReferenceCatalog
  {
    /// Запрос расчёта, с которым обратился чат-бот.
    public QuickQuoteRequest? Asked { get; private set; }

    public Task<LandfillTariffs?> FindLandfillTariffsAsync(
        string query,
        CancellationToken cancellationToken) =>
        Task.FromResult(tariffs);

    public Task<DensityFact?> FindDensityAsync(string query, CancellationToken cancellationToken) =>
        Task.FromResult(density);

    public Task<PreliminaryPrice?> QuoteAsync(
        QuickQuoteRequest request,
        CancellationToken cancellationToken)
    {
      Asked = request;

      return Task.FromResult(price);
    }
  }

  /// Языковая модель проверки: помнит обращение и отвечает назначенным.
  private sealed class StubLanguageModel(bool enabled, string? answer) : ILanguageModel
  {
    /// Текст обращения, с которым к модели пришли.
    public string? Prompt { get; private set; }

    public bool Enabled => enabled;

    public Task<string?> AnswerAsync(string prompt, CancellationToken cancellationToken)
    {
      Prompt = prompt;

      return Task.FromResult(answer);
    }
  }
}
