using Imolt.Bot.Domain;
using Imolt.Bot.Ports;

namespace Imolt.Bot.Application;

/// Объявление платформе перечня команд чат-бота (R-070).
///
/// Перечень объявляется один раз на запуск службы: он свойство бота, а не
/// переписки. Показ перечня участнику — другое дело и живёт в состоянии
/// переписки (AC-070b).
///
/// Выполняется отдельной работой, а не на старте хоста: обращение к платформе
/// ходит по сети, и служба не обязана ждать её, чтобы подняться.
///
/// @req: R-070
/// @adr: ADR-0009
public sealed class BotAnnouncement(
    IMaxMessages messages,
    BotAccount account,
    ILogger<BotAnnouncement> logger) : BackgroundService
{
  protected override async Task ExecuteAsync(CancellationToken stoppingToken)
  {
    try
    {
      var bot = await account.GetAsync(stoppingToken).ConfigureAwait(false);

      logger.LogInformation(
          "Платформа MAX опознала чат-бот: учётная запись {Username}, идентификатор {ContactId}",
          bot.Username,
          bot.ContactId);

      await messages.DeclareCommandsAsync(BotTexts.Commands, stoppingToken).ConfigureAwait(false);
    }
    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
    {
      // Служба останавливается — это не отказ платформы.
    }
    catch (MaxRefusedException refusal)
    {
      // Необъявленный перечень команд не мешает боту отвечать: участник не
      // увидит подсказку платформы, но переписка работает. Поэтому отказ
      // называется в журнале, а служба продолжает работу.
      logger.LogWarning(refusal, "Перечень команд платформе MAX не объявлен");
    }
  }
}
