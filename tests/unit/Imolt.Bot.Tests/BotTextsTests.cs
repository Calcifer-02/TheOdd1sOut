using Imolt.Bot.Domain;
using Xunit;

namespace Imolt.Bot.Tests;

/// Перечень команд чат-бота и однократность приветствия (R-070, критерии
/// AC-070a и AC-070b).
///
/// Перечень закрытый: бот распознаёт ровно то, что называет. Поэтому
/// проверяется не только «все объявленные команды названы в приветствии», но
/// и обратное — приветствие не обещает команды, которой в перечне нет.
///
///   dotnet test tests/unit/Imolt.Bot.Tests
public sealed class BotTextsTests
{
  private const long ChatId = 4242;

  /// Проверка падает, если перечень команд опустеет, если имя команды
  /// повторится или останется без пояснения, если приветствие умолчит о
  /// какой-либо объявленной команде и если оно пообещает команду, которой в
  /// перечне нет.
  ///
  /// @ac: AC-070a
  [Fact(DisplayName = "первое сообщение перечисляет ровно те команды, которые объявлены ботом")]
  public void GreetingListsExactlyTheDeclaredCommands()
  {
    Assert.NotEmpty(BotTexts.Commands);

    var repeated = BotTexts.Commands
        .GroupBy(command => command.Name, StringComparer.Ordinal)
        .Where(group => group.Count() > 1)
        .Select(group => group.Key)
        .ToList();

    Assert.True(
        repeated.Count == 0,
        "команда объявлена дважды: " + string.Join(", ", repeated));

    foreach (var command in BotTexts.Commands)
    {
      Assert.False(
          string.IsNullOrWhiteSpace(command.Name),
          "в перечне есть команда без имени: платформе нечего показать участнику");
      Assert.False(
          string.IsNullOrWhiteSpace(command.Description),
          $"у команды «{command.Name}» нет пояснения: перечень платформы показывает его рядом с именем");
    }

    // Приветствие — одно сообщение, а не рассылка: критерий требует, чтобы
    // команды перечислило одно сообщение (AC-070a).
    var greeting = BotTexts.Greeting;

    Assert.False(
        string.IsNullOrWhiteSpace(greeting),
        "приветствие пустое: перечислять команды нечем");

    foreach (var command in BotTexts.Commands)
    {
      Assert.True(
          greeting.Contains(command.Name, StringComparison.Ordinal),
          $"приветствие умалчивает о команде «{command.Name}»: участник о ней не узнает");
    }

    // Обратная сторона закрытого перечня: обещанного в приветствии, но не
    // объявленного платформе бот не распознает. Заодно падает, если в
    // приветствие попадёт адрес: вход в приложение даёт кнопка, а не ссылка
    // (ADR-0009, инвариант 1).
    var declared = BotTexts.Commands.Select(command => command.Name).ToHashSet(StringComparer.Ordinal);
    var unknown = PromisedCommands(greeting)
        .Where(name => !declared.Contains(name))
        .ToList();

    Assert.True(
        unknown.Count == 0,
        "приветствие обещает команды, которых бот не объявлял: " + string.Join(", ", unknown));
  }

  /// Проверка падает, если новая переписка начнётся с уже объявленным
  /// перечнем команд или если признак объявления сбросится при очередном
  /// сообщении бота, — в обоих случаях перечень ушёл бы участнику повторно.
  ///
  /// @ac: AC-070b
  [Fact(DisplayName = "однажды объявленный перечень команд не объявляется в переписке заново")]
  public void AnnouncedCommandsStayAnnouncedForTheWholeDialog()
  {
    // Новая переписка о перечне ещё не знает: иначе первое обращение
    // осталось бы без команд.
    Assert.False(
        DialogState.Empty(ChatId).CommandsAnnounced,
        "новая переписка заведена с уже объявленным перечнем команд: первое обращение останется без них");

    var announced = DialogState.Empty(ChatId) with
    {
      CommandsAnnounced = true,
      OwnMessageIds = ["msg-01"],
    };

    var notice = new OutgoingMessage("Заявка принята в работу", null, false);
    var next = DialogPolicy.Applied(announced, notice, new DialogPlan(null, []), "msg-02");

    Assert.True(
        next.CommandsAnnounced,
        "признак объявленного перечня потерялся после очередного сообщения: участник получит команды повторно");
  }

  /// Имена команд, обещанные текстом: платформа называет команду со знаком
  /// «/» перед именем, и только по нему её видно в свободном тексте.
  private static IReadOnlyList<string> PromisedCommands(string text)
  {
    var promised = new List<string>();

    for (var position = 0; position < text.Length; position++)
    {
      if (text[position] != '/')
      {
        continue;
      }

      var start = position + 1;
      var end = start;
      while (end < text.Length && (char.IsLetterOrDigit(text[end]) || text[end] == '_'))
      {
        end++;
      }

      if (end > start)
      {
        promised.Add(text[start..end]);
        position = end - 1;
      }
    }

    return promised;
  }
}
