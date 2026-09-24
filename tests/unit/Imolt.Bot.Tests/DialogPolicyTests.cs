using System.Globalization;
using Imolt.Bot.Domain;
using Xunit;

namespace Imolt.Bot.Tests;

/// Политика переписки: глубина, неприкосновенность чужих сообщений и правка
/// карточки вместо новой отправки (R-078, R-079, критерии AC-078a, AC-078b,
/// AC-079a).
///
/// Политика — чистое правило: она называет, что изменить и что удалить, а
/// обращения к платформе выполняет вызывающий. Поэтому предел передаётся
/// доводом, а не берётся из настройки внутри правила (R-078: предел задаётся
/// настройкой, а не константой в коде).
///
///   dotnet test tests/unit/Imolt.Bot.Tests
public sealed class DialogPolicyTests
{
  private const long ChatId = 4242;

  /// Предел из решения по Q-020 от 23.09.2026. В проверке он берётся из
  /// объявленной области, а не пишется числом: два места для одного значения
  /// расходятся.
  private const int Depth = DialogPolicy.DefaultDepth;

  /// Очередное сообщение бота, не карточка: его отправка и наводит порядок в
  /// переписке.
  private static readonly OutgoingMessage Notice = new("Заявка принята в работу", null, false);

  /// Карточка расчёта: одно сообщение на переписку, которое бот переписывает.
  private static readonly OutgoingMessage Card = new("Расчёт вывоза: предварительная цена", null, true);

  /// Проверка падает, если при достигнутом пределе бот отправит сообщение, не
  /// удалив ни одного своего, если удалит не самое раннее, если удалит больше
  /// одного или если число его сообщений после отправки разойдётся с пределом.
  ///
  /// @ac: AC-078a
  [Fact(DisplayName = "при достигнутом пределе отправка удаляет самое раннее сообщение чат-бота")]
  public void ReachingTheDepthDeletesTheEarliestOwnMessage()
  {
    var own = OwnIds(1, Depth);
    var state = DialogState.Empty(ChatId) with { OwnMessageIds = own };

    var plan = DialogPolicy.Plan(state, Notice, Depth);

    Assert.NotNull(plan);
    var removed = Assert.Single(plan.Delete);
    Assert.True(
        string.Equals(removed, own[0], StringComparison.Ordinal),
        $"к удалению назначено «{removed}», а самое раннее сообщение чат-бота — «{own[0]}»");

    var applied = DialogPolicy.Applied(state, Notice, plan, "msg-11");

    Assert.True(
        applied.OwnMessageIds.Count == Depth,
        $"после отправки за ботом осталось {applied.OwnMessageIds.Count} сообщений при пределе {Depth}");
    Assert.DoesNotContain(own[0], applied.OwnMessageIds);
    Assert.Contains("msg-11", applied.OwnMessageIds);
  }

  /// Проверка падает, если политика назначит к удалению идентификатор,
  /// которого не было среди сообщений чат-бота, — например, вычислит его
  /// сама, — и если чужой идентификатор просочится в состояние переписки.
  ///
  /// @ac: AC-078b
  [Fact(DisplayName = "к удалению назначаются только сообщения самого чат-бота")]
  public void OnlyOwnMessagesAreEverScheduledForDeletion()
  {
    // Сообщений бота заведомо больше предела: иначе пустой перечень удаления
    // прошёл бы проверку, ничего не доказав.
    var own = OwnIds(1, Depth + 5);
    var state = DialogState.Empty(ChatId) with { OwnMessageIds = own };

    // Сообщения участника в состояние не попадают вовсе — это и есть способ
    // соблюсти критерий. Проверка следит за тем, чтобы политика не начала
    // называть идентификаторы, которых ей не давали.
    var foreign = new[] { "guest-01", "guest-02" };

    var plan = DialogPolicy.Plan(state, Notice, Depth);

    Assert.NotEmpty(plan.Delete);

    foreach (var id in plan.Delete)
    {
      Assert.True(
          own.Contains(id, StringComparer.Ordinal),
          $"к удалению назначено «{id}»: среди сообщений чат-бота такого нет, удалять чужое нельзя");
    }

    var applied = DialogPolicy.Applied(state, Notice, plan, "msg-99");

    foreach (var id in foreign)
    {
      Assert.DoesNotContain(id, applied.OwnMessageIds);
      Assert.DoesNotContain(id, plan.Delete);
    }
  }

  /// Проверка падает, если при заведённой карточке политика назначит новую
  /// отправку вместо правки, если карточка попадёт в перечень удаления и если
  /// правка будет назначена там, где карточки ещё нет.
  ///
  /// @ac: AC-079a
  [Fact(DisplayName = "изменение расчёта переписывает прежнюю карточку, а не отправляет новую")]
  public void ChangedCalculationRewritesTheExistingCard()
  {
    const string CardId = "card-01";

    var state = DialogState.Empty(ChatId) with
    {
      CardMessageId = CardId,
      OwnMessageIds = [CardId],
    };

    var plan = DialogPolicy.Plan(state, Card, Depth);

    Assert.True(
        string.Equals(plan.EditMessageId, CardId, StringComparison.Ordinal),
        $"вместо правки карточки «{CardId}» политика назначила правку «{plan.EditMessageId ?? "ничего"}»: в переписке появится второе сообщение с тем же содержанием");

    Assert.DoesNotContain(CardId, plan.Delete);

    // Обратный случай: там, где карточки ещё нет, править нечего. Без него
    // проверку прошла бы политика, всегда возвращающая идентификатор.
    var first = DialogPolicy.Plan(DialogState.Empty(ChatId), Card, Depth);

    Assert.True(
        first.EditMessageId is null,
        $"в переписке без карточки политика назначила правку «{first.EditMessageId}»: править ещё нечего");
  }

  /// Идентификаторы сообщений чат-бота подряд, от раннего к позднему.
  private static IReadOnlyList<string> OwnIds(int from, int count) =>
      Enumerable.Range(from, count)
          .Select(number => "msg-" + number.ToString("00", CultureInfo.InvariantCulture))
          .ToList();
}
