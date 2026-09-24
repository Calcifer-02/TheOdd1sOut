using Imolt.Bot.Ports;

namespace Imolt.Bot.Adapters;

/// Выключенное обращение к языковой модели — состояние по умолчанию
/// (решение по Q-019).
///
/// Поставщик модели заказчиком не назван, поэтому переходника к нему в
/// проекте нет. Выключенное состояние рабочее и молчаливое: участник получает
/// справочный ответ, а отказ «возможность не настроена» ему не показывается
/// (AC-077b).
///
/// @supports: R-076, R-077
public sealed class DisabledLanguageModel : ILanguageModel
{
  public bool Enabled => false;

  public Task<string?> AnswerAsync(string prompt, CancellationToken cancellationToken) =>
      Task.FromResult<string?>(null);
}
