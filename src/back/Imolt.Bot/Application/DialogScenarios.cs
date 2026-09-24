using Imolt.Bot.Domain;
using Imolt.Bot.Ports;
using Microsoft.Extensions.Options;

namespace Imolt.Bot.Application;

/// Сценарии переписки чат-бота (R-069, R-070, R-072 — R-079, R-083).
///
/// Здесь сходятся три правила решения: вход в мини-приложение даёт кнопка
/// (ADR-0009, инвариант 1), предметных величин бот не считает (инвариант 4),
/// переписка состояния не хранит — оно живёт в базе решения (инвариант 5).
///
/// Пределы платформы соблюдает доставка `MaxDelivery`, порядок в переписке
/// назначает политика `DialogPolicy`: сценарий их применяет, а не повторяет.
///
/// @req: R-069, R-070, R-072, R-073, R-075, R-077, R-078, R-079, R-083
/// @adr: ADR-0009
public sealed class DialogScenarios(
    IMaxMessages messages,
    IDialogs dialogs,
    IReferenceCatalog catalog,
    ILanguageModel languageModel,
    BotAccount account,
    IOptions<BotOptions> options,
    Wait wait,
    ILogger<DialogScenarios> logger)
{
  /// Подсказка, когда сообщение не распознано ни как вопрос справочника, ни
  /// как короткий расчёт. Молчание участник прочитает как поломку.
  public const string Hint =
      "Чат-бот понимает вопрос о тарифе полигона или о коэффициенте плотности группы отходов"
      + " и короткий расчёт." + " " + QuickQuotes.Format;

  /// Расчётная часть не ответила. Отличается от «данных нет» (R-075): там
  /// сервис искал и не нашёл, здесь — не смог спросить.
  public const string ServiceUnavailable =
      "Расчётная часть сервиса сейчас недоступна. Повторите вопрос немного позже.";

  /// Обработать обновление платформы.
  ///
  /// Разбираются только те виды обновлений, на которые бот отвечает:
  /// остальные пропускаются, а не разбираются впрок.
  public async Task HandleAsync(BotUpdate update, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(update);

    if (update.Kind == UpdateKind.Unknown)
    {
      return;
    }

    var state = await dialogs.FindAsync(update.ChatId, cancellationToken).ConfigureAwait(false);
    var command = CommandOf(update.Text);

    // Первое обращение к чат-боту: одно сообщение с перечнем команд и
    // кнопкой открытия мини-приложения (R-069, R-070). Признак объявления
    // живёт в базе, а не в переписке: удаление сообщения его не сбрасывает.
    if (!state.CommandsAnnounced)
    {
      var greeting = new OutgoingMessage(
          BotTexts.Greeting,
          await MiniAppKeyboardAsync(cancellationToken).ConfigureAwait(false),
          IsCard: false);

      state = await PublishAsync(
          state with { CommandsAnnounced = true },
          greeting,
          cancellationToken).ConfigureAwait(false);

      // Обращение «начать» само по себе ответа сверх приветствия не требует.
      if (update.Kind == UpdateKind.BotStarted || string.Equals(command, "start", StringComparison.Ordinal))
      {
        return;
      }
    }

    var answer = await AnswerAsync(update, command, cancellationToken).ConfigureAwait(false);

    if (answer is not null)
    {
      await PublishAsync(state, answer, cancellationToken).ConfigureAwait(false);
    }
  }

  /// Известить участника о смене статуса его заявки на вывоз (R-083).
  public async Task NotifyAsync(
      long chatId,
      PickupRequestNotice notice,
      CancellationToken cancellationToken)
  {
    var state = await dialogs.FindAsync(chatId, cancellationToken).ConfigureAwait(false);

    // Извещение — обычное сообщение, а не карточка: карточка в переписке одна
    // и занята расчётом (R-079).
    var message = new OutgoingMessage(Notices.Text(notice), null, IsCard: false);

    await PublishAsync(state, message, cancellationToken).ConfigureAwait(false);
  }

  /// Показать сообщение в переписке по политике и пределам платформы.
  ///
  /// Порядок один и тот же: сначала освободить место, потом показать, потом
  /// записать новое состояние. Обратный порядок оставил бы в состоянии
  /// идентификатор, которого в переписке уже нет.
  public async Task<DialogState> PublishAsync(
      DialogState state,
      OutgoingMessage message,
      CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(state);

    var settings = options.Value;
    var plan = DialogPolicy.Plan(state, message, settings.DialogDepth);

    await MaxDelivery
        .DeleteAllAsync(messages, plan.Delete, settings.DeletionsPerSecond, wait.Invoke, cancellationToken)
        .ConfigureAwait(false);

    string messageId;

    if (plan.EditMessageId is { } edited)
    {
      await messages.EditAsync(edited, message, cancellationToken).ConfigureAwait(false);
      messageId = edited;
    }
    else
    {
      messageId = await MaxDelivery
          .SendAsync(messages, state.ChatId, message, settings.SendRetries, wait.Invoke, cancellationToken)
          .ConfigureAwait(false);
    }

    var next = DialogPolicy.Applied(state, message, plan, messageId);
    await dialogs.SaveAsync(next, cancellationToken).ConfigureAwait(false);

    return next;
  }

  /// Что ответить на сообщение участника. Пусто — отвечать нечем и не нужно.
  private async Task<OutgoingMessage?> AnswerAsync(
      BotUpdate update,
      string? command,
      CancellationToken cancellationToken)
  {
    if (string.Equals(command, "help", StringComparison.Ordinal))
    {
      return new OutgoingMessage(
          BotTexts.Help,
          await MiniAppKeyboardAsync(cancellationToken).ConfigureAwait(false),
          IsCard: false);
    }

    if (string.Equals(command, "calculate", StringComparison.Ordinal)
        || string.Equals(command, "start", StringComparison.Ordinal))
    {
      // Карточка расчёта в переписке одна: повторная команда переписывает
      // прежнюю, а не добавляет вторую (R-079).
      return new OutgoingMessage(
          "Расчёт вывоза открывается в мини-приложении кнопкой ниже." + Environment.NewLine
              + QuickQuotes.Format,
          await MiniAppKeyboardAsync(cancellationToken).ConfigureAwait(false),
          IsCard: true);
    }

    var text = update.Text?.Trim();

    if (string.IsNullOrEmpty(text))
    {
      return null;
    }

    if (QuickQuotes.Parse(text) is { } request)
    {
      return await QuoteAsync(request, cancellationToken).ConfigureAwait(false);
    }

    var question = ReferenceQuestions.Parse(text);

    if (question.Topic == ReferenceTopic.Unknown)
    {
      return new OutgoingMessage(Hint, null, IsCard: false);
    }

    var answer = await ReferenceAnswerAsync(text, question, cancellationToken).ConfigureAwait(false);

    return new OutgoingMessage(answer.Text, null, IsCard: false);
  }

  /// Справочный ответ (R-073 — R-077).
  private async Task<ReferenceAnswer> ReferenceAnswerAsync(
      string text,
      ReferenceQuestion question,
      CancellationToken cancellationToken)
  {
    if (string.IsNullOrWhiteSpace(question.Subject))
    {
      return ReferenceAnswers.SubjectMissing(question);
    }

    ReferenceAnswer found;
    IReadOnlyList<string> facts;

    try
    {
      if (question.Topic == ReferenceTopic.LandfillTariff)
      {
        var tariffs = await catalog
            .FindLandfillTariffsAsync(question.Subject, cancellationToken)
            .ConfigureAwait(false);

        if (tariffs is null)
        {
          return ReferenceAnswers.NoData(question);
        }

        found = ReferenceAnswers.Tariffs(tariffs);
        facts = LanguageModelPrompt.Facts(tariffs);
      }
      else
      {
        var density = await catalog
            .FindDensityAsync(question.Subject, cancellationToken)
            .ConfigureAwait(false);

        if (density is null)
        {
          return ReferenceAnswers.NoData(question);
        }

        found = ReferenceAnswers.Density(density);
        facts = LanguageModelPrompt.Facts(density);
      }
    }
    catch (HttpRequestException failure)
    {
      logger.LogWarning(failure, "Справочник сервиса не ответил на вопрос участника");
      return new ReferenceAnswer(ServiceUnavailable, FromLanguageModel: false);
    }

    if (!languageModel.Enabled)
    {
      // Выключенная модель не оставляет участника без ответа и о себе не
      // сообщает (AC-077b).
      return found;
    }

    var spoken = await languageModel
        .AnswerAsync(LanguageModelPrompt.Compose(text, facts), cancellationToken)
        .ConfigureAwait(false);

    return string.IsNullOrWhiteSpace(spoken) ? found : ReferenceAnswers.Marked(spoken);
  }

  /// Ответ на короткий расчёт (R-072).
  private async Task<OutgoingMessage> QuoteAsync(
      QuickQuoteRequest request,
      CancellationToken cancellationToken)
  {
    PreliminaryPrice? price;

    try
    {
      price = await catalog.QuoteAsync(request, cancellationToken).ConfigureAwait(false);
    }
    catch (HttpRequestException failure)
    {
      logger.LogWarning(failure, "Расчётная часть не ответила на короткий расчёт из переписки");
      return new OutgoingMessage(ServiceUnavailable, null, IsCard: false);
    }

    if (price is null)
    {
      return new OutgoingMessage(
          "Сервис не смог посчитать вывоз по этим данным: проверьте адрес и название группы отходов."
              + Environment.NewLine + QuickQuotes.Format,
          null,
          IsCard: false);
    }

    // Карточка расчёта — единственное сообщение переписки, которое бот
    // переписывает при изменении (R-079). Кнопка ведёт за сравнением
    // полигонов в мини-приложение (AC-072b).
    return new OutgoingMessage(
        QuickQuotes.Text(price),
        await MiniAppKeyboardAsync(cancellationToken).ConfigureAwait(false),
        IsCard: true);
  }

  private async Task<Keyboard> MiniAppKeyboardAsync(CancellationToken cancellationToken)
  {
    var bot = await account.GetAsync(cancellationToken).ConfigureAwait(false);

    return MiniAppButton.Of(bot, BotTexts.OpenAppLabel);
  }

  /// Имя команды из сообщения: платформа присылает её знаком «/» перед
  /// именем, иногда с учётной записью бота через «@».
  private static string? CommandOf(string? text)
  {
    var trimmed = text?.TrimStart();

    if (trimmed is null || trimmed.Length < 2 || trimmed[0] != '/')
    {
      return null;
    }

    var name = trimmed[1..].Split([' ', '@'], 2)[0];

    return BotTexts.Commands.Any(command => string.Equals(command.Name, name, StringComparison.Ordinal))
        ? name
        : null;
  }
}
