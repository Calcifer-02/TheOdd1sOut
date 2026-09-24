using System.Linq;
using Imolt.Bot.Domain;
using Xunit;

namespace Imolt.Bot.Tests;

/// Удаление сообщения из переписки не уносит расчёт (R-080, критерий AC-080a).
///
/// Переписка — лента, из которой сообщение может исчезнуть: его удаляет сам
/// бот, наводя порядок по пределу глубины, или участник со своей стороны.
/// Расчёт от этого пропасть не должен: участник открывает мини-приложение и
/// находит его по идентификатору.
///
/// Обещание держится устройством состояния: в переписке не хранится ничего,
/// кроме идентификаторов самой переписки и её сообщений. Расчёт живёт в базе
/// решения и к сообщению не привязан — потерять его вместе с сообщением
/// физически нечему. Проверка сторожит именно это: появись в состоянии
/// переписки поле с расчётом, она упадёт.
///
/// Проверка модульная намеренно: платформа MAX к проекту не подключена, и
/// подтвердить настоящее удаление в настоящей переписке сегодня нечем —
/// владелец ответа тот же, что у подключения платформы. Здесь проверяется
/// инвариант устройства, а не поведение платформы.
///
///   dotnet test tests/unit/Imolt.Bot.Tests
public sealed class DialogStateOutlivesMessagesTests
{
  private const long ChatId = 4242;

  private const string ParticipantId = "max-777";

  /// @ac: AC-080a
  [Fact(DisplayName = "состояние переписки не хранит расчёт, поэтому терять вместе с сообщением нечего")]
  public void DialogStateKeepsNoCalculation()
  {
    var поля = typeof(DialogState)
        .GetProperties()
        .Select(свойство => свойство.Name)
        .ToArray();

    // Состав объявлен целиком: новое поле в состоянии переписки обязано
    // пройти через эту проверку, а не появиться молча.
    Assert.Equal(
        ["ChatId", "ParticipantId", "CardMessageId", "OwnMessageIds", "CommandsAnnounced"],
        поля);

    Assert.DoesNotContain(поля, имя => имя.Contains("Calculation", System.StringComparison.Ordinal));
    Assert.DoesNotContain(поля, имя => имя.Contains("Quote", System.StringComparison.Ordinal));
  }

  /// @ac: AC-080a
  [Fact(DisplayName = "удаление сообщений чат-бота не рвёт связь переписки с участником")]
  public void DeletingOwnMessagesKeepsTheParticipantLink()
  {
    var сообщения = Enumerable
        .Range(1, DialogPolicy.DefaultDepth)
        .Select(номер => номер.ToString(System.Globalization.CultureInfo.InvariantCulture))
        .ToArray();

    var состояние = new DialogState(ChatId, ParticipantId, "card-1", сообщения, true);

    var план = DialogPolicy.Plan(состояние, new OutgoingMessage("Заявка принята", null, false), DialogPolicy.DefaultDepth);

    // Порядок наводится: самое раннее сообщение бота уходит.
    Assert.NotEmpty(план.Delete);

    // А связь переписки с участником удалением не трогается: по ней
    // мини-приложение и находит расчёты участника.
    var после = состояние with
    {
      OwnMessageIds = состояние.OwnMessageIds.Where(id => !план.Delete.Contains(id)).ToArray(),
    };

    Assert.Equal(ParticipantId, после.ParticipantId);
    Assert.Equal(ChatId, после.ChatId);
  }
}
