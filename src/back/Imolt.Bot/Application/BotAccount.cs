using Imolt.Bot.Domain;
using Imolt.Bot.Ports;

namespace Imolt.Bot.Application;

/// Ожидание между обращениями к платформе.
///
/// Объявлено отдельным типом, а не взято у системных часов внутри доставки:
/// проверка предела удаления обязана двигать время сама, иначе она ждёт
/// по-настоящему и зависит от скорости машины (правила проекта, «Детерминизм
/// там, где важен повтор»).
///
/// @supports: R-081, R-082
public delegate Task Wait(TimeSpan span, CancellationToken cancellationToken);

/// Учётная запись самого бота, спрошенная у платформы один раз на процесс.
///
/// Значения не пишутся в код: их отдаёт платформа по запросу о себе, и из них
/// складывается кнопка открытия мини-приложения (R-069). Спрашивать при
/// каждом сообщении незачем — учётная запись живёт дольше процесса.
///
/// @supports: R-069
/// @adr: ADR-0009
public sealed class BotAccount(IMaxMessages messages)
{
  /// Запомненный ответ платформы. Замка нет намеренно: запрос о себе
  /// идемпотентен, и гонка двух первых обращений стоит одного лишнего
  /// запроса, а не неверного состава кнопки.
  private BotIdentity? known;

  public async Task<BotIdentity> GetAsync(CancellationToken cancellationToken)
  {
    known ??= await messages.WhoAmIAsync(cancellationToken).ConfigureAwait(false);

    return known;
  }
}
