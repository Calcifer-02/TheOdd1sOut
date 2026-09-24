using Imolt.Bot.Ports;
using Microsoft.Extensions.Options;

namespace Imolt.Bot.Application;

/// Длинный опрос обновлений платформы (ADR-0009, раздел «Обновления»).
///
/// Опрос выбран решением, а не вебхуком: публичного адреса у бота может не
/// быть, и проверяющий поднимает решение в Docker без туннелей (условия
/// трека, разд. 6.1). Вебхук остаётся возможностью настройки.
///
/// Отказ платформы не останавливает службу: обращение называется в журнале,
/// и опрос продолжается со следующей порции (R-082, AC-082b).
///
/// @req: R-082
/// @adr: ADR-0009
public sealed class UpdatePump(
    IMaxMessages messages,
    IServiceScopeFactory scopes,
    IOptions<BotOptions> options,
    ILogger<UpdatePump> logger) : BackgroundService
{
  /// Выдержка после неудачного опроса. Без неё отказ платформы превращается
  /// в непрерывный цикл обращений к ней же.
  private static readonly TimeSpan AfterFailure = TimeSpan.FromSeconds(5);

  protected override async Task ExecuteAsync(CancellationToken stoppingToken)
  {
    logger.LogInformation(
        "Длинный опрос обновлений MAX запущен, выдержка ожидания: {Seconds} с",
        options.Value.UpdatesTimeoutSeconds);

    long? marker = null;

    while (!stoppingToken.IsCancellationRequested)
    {
      try
      {
        var (updates, next) = await messages.UpdatesAsync(marker, stoppingToken).ConfigureAwait(false);
        marker = next;

        foreach (var update in updates)
        {
          await HandleAsync(update, stoppingToken).ConfigureAwait(false);
        }
      }
      catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
      {
        break;
      }
      catch (MaxRefusedException refusal)
      {
        logger.LogWarning(refusal, "Платформа MAX отклонила запрос обновлений");
        await Delay(stoppingToken).ConfigureAwait(false);
      }
      catch (HttpRequestException failure)
      {
        logger.LogWarning(failure, "Платформа MAX недоступна при запросе обновлений");
        await Delay(stoppingToken).ConfigureAwait(false);
      }
    }
  }

  /// Одно обновление — одна область действия зависимостей: состояние
  /// переписки читается и пишется соединением, которое не переживает порцию.
  ///
  /// Поломка на одном обновлении не уносит с собой остальные: служба обязана
  /// продолжать принимать следующие (AC-082b).
  private async Task HandleAsync(BotUpdate update, CancellationToken cancellationToken)
  {
    await using var scope = scopes.CreateAsyncScope();

    try
    {
      var scenarios = scope.ServiceProvider.GetRequiredService<DialogScenarios>();
      await scenarios.HandleAsync(update, cancellationToken).ConfigureAwait(false);
    }
    catch (MaxRefusedException refusal)
    {
      logger.LogError(
          refusal,
          "Обновление переписки {ChatId} не обработано: платформа MAX отклонила обращение",
          update.ChatId);
    }
    catch (HttpRequestException failure)
    {
      logger.LogError(
          failure,
          "Обновление переписки {ChatId} не обработано: внешняя служба недоступна",
          update.ChatId);
    }
    catch (InvalidOperationException failure)
    {
      logger.LogError(
          failure,
          "Обновление переписки {ChatId} не обработано: состав ответа платформы не разобран",
          update.ChatId);
    }
  }

  private static Task Delay(CancellationToken cancellationToken) =>
      Task.Delay(AfterFailure, cancellationToken);
}
