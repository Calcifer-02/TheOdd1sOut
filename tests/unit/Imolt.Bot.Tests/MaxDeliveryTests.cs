using System.Reflection;
using System.Runtime.ExceptionServices;
using Imolt.Bot.Domain;
using Imolt.Bot.Ports;
using Xunit;

namespace Imolt.Bot.Tests;

/// Пределы платформы при обращениях к ней: скорость удаления и повторы
/// отклонённой отправки (R-081, R-082, критерии AC-081a, AC-082a, AC-082b).
///
/// Платформа MAX в проверке не участвует: порт подменяется двойником
/// `RecordingMaxMessages`, который считает обращения и отвечает отказом.
/// Настоящих обращений нет ни одного — ни токена, ни сети.
///
/// Время принимается доводом, а не берётся у системы: ожидание между
/// обращениями подменяется функцией, которая двигает часы проверки. Иначе
/// проверка предела ждала бы по-настоящему и зависела от скорости машины.
///
/// Соблюдение пределов обязан обеспечивать тот, кто вызывает порт. В
/// объявленной поверхности такого места сегодня нет, поэтому ожидаемая форма
/// названа здесь и разрешается отражением: прямая ссылка на незаведённый тип
/// уронила бы сборку всего проверочного проекта, а отражение оставляет отказ
/// в этих трёх проверках и называет недостающее имя.
///
/// Ожидается:
///   MaxDelivery.DeleteAllAsync(IMaxMessages messages, IReadOnlyList&lt;string&gt; messageIds,
///       int perSecond, Func&lt;TimeSpan, CancellationToken, Task&gt; wait,
///       CancellationToken cancellationToken) -> Task
///   MaxDelivery.SendAsync(IMaxMessages messages, long chatId, OutgoingMessage message,
///       int maxRetries, Func&lt;TimeSpan, CancellationToken, Task&gt; wait,
///       CancellationToken cancellationToken) -> Task&lt;string&gt;
///
///   dotnet test tests/unit/Imolt.Bot.Tests
public sealed class MaxDeliveryTests
{
  private const long ChatId = 4242;

  /// Предел платформы из R-081: не более двух удалений в секунду. Передаётся
  /// доводом — ограничение платформы, а не выбор проекта.
  private const int DeletesPerSecond = 2;

  /// Предел повторов из R-082: отклонённая отправка повторяется не более трёх
  /// раз. Вместе с первым обращением это не более четырёх обращений.
  private const int MaxRetries = 3;

  /// Начало отсчёта часов проверки. Записано числом, а не взято у системы:
  /// `DateTimeOffset.UtcNow` сделал бы прогон невоспроизводимым.
  private static readonly DateTimeOffset Origin =
      new(2026, 9, 24, 12, 0, 0, TimeSpan.FromHours(3));

  private static readonly OutgoingMessage Notice = new("Заявка принята в работу", null, false);

  /// Проверка падает, если удаление уйдёт на платформу пачкой без выдержки,
  /// если в любую секунду попадёт больше двух удалений и если удалено будет
  /// не то, что назначено.
  ///
  /// @ac: AC-081a
  [Fact(DisplayName = "пять назначенных удалений уходят не быстрее двух в секунду")]
  public async Task DeletingFiveMessagesNeverExceedsTwoDeletionsPerSecond()
  {
    var time = new TestClock();
    var platform = new RecordingMaxMessages(() => time.Now);
    var ids = new[] { "msg-01", "msg-02", "msg-03", "msg-04", "msg-05" };

    await DeleteAllAsync(platform, ids, DeletesPerSecond, time.WaitAsync, CancellationToken.None);

    Assert.Equal(ids, platform.Deleted);

    var moments = platform.DeleteMoments;

    // Скользящее окно в секунду: удаление под номером i + 2 не может попасть
    // в ту же секунду, что и удаление под номером i, — иначе за секунду их
    // оказалось бы три.
    for (var i = 0; i + DeletesPerSecond < moments.Count; i++)
    {
      var window = moments[i + DeletesPerSecond] - moments[i];
      Assert.True(
          window >= TimeSpan.FromSeconds(1),
          $"удаления с {i + 1}-го по {i + 1 + DeletesPerSecond}-е уложились в {window}: за секунду вышло больше {DeletesPerSecond} удалений");
    }
  }

  /// Проверка падает, если отклонённая отправка не повторяется вовсе и если
  /// повторов окажется больше трёх.
  ///
  /// @ac: AC-082a
  [Fact(DisplayName = "отклонённая платформой отправка повторяется, но не более трёх раз")]
  public async Task RefusedSendIsRetriedAndNoMoreThanThreeTimes()
  {
    var time = new TestClock();

    // Платформа отклоняет всё: так видно и то, что повтор есть, и то, где он
    // останавливается.
    var platform = new RecordingMaxMessages(() => time.Now, refusedSends: int.MaxValue);

    await Assert.ThrowsAsync<MaxRefusedException>(
        () => SendAsync(platform, ChatId, Notice, MaxRetries, time.WaitAsync, CancellationToken.None));

    Assert.True(
        platform.SendCalls > 1,
        "отклонённая отправка не повторялась ни разу: обращение к платформе было одно");

    Assert.True(
        platform.SendCalls <= MaxRetries + 1,
        $"платформу дёрнули {platform.SendCalls} раз: при пределе в {MaxRetries} повтора обращений не больше {MaxRetries + 1}");
  }

  /// Проверка падает, если исчерпанные повторы уронят вызывающего чем-то,
  /// кроме объявленного отказа, если отказ окажется безымянным и если после
  /// него служба перестанет отправлять сообщения и принимать обновления.
  ///
  /// @ac: AC-082b
  [Fact(DisplayName = "после исчерпанных повторов отказ назван, а служба продолжает работу")]
  public async Task ExhaustedRetriesAreNamedAndTheServiceKeepsWorking()
  {
    var time = new TestClock();

    // Отклоняются ровно те обращения, что укладываются в предел повторов;
    // следующее сообщение платформа принимает.
    var platform = new RecordingMaxMessages(() => time.Now, refusedSends: MaxRetries + 1);

    var refusal = await Assert.ThrowsAsync<MaxRefusedException>(
        () => SendAsync(platform, ChatId, Notice, MaxRetries, time.WaitAsync, CancellationToken.None));

    Assert.False(
        string.IsNullOrWhiteSpace(refusal.Message),
        "отказ пришёл без пояснения: назвать его в журнале службы нечем");

    // Служба жива: следующее сообщение уходит.
    var messageId = await SendAsync(platform, ChatId, Notice, MaxRetries, time.WaitAsync, CancellationToken.None);

    Assert.False(
        string.IsNullOrWhiteSpace(messageId),
        "после исчерпанных повторов следующее сообщение не отправилось: служба остановилась на отказе");

    // И следующие обновления по-прежнему принимаются.
    platform.Offer(new BotUpdate(UpdateKind.MessageCreated, ChatId, "user-01", "Участник", "/help", null));
    var (updates, _) = await platform.UpdatesAsync(null, CancellationToken.None);

    Assert.Single(updates);
  }

  /// Удаление перечня сообщений с оглядкой на предел платформы. Разрешается
  /// отражением: символа может ещё не быть, и отказ обязан назвать его имя.
  private static async Task DeleteAllAsync(
      IMaxMessages platform,
      IReadOnlyList<string> messageIds,
      int perSecond,
      Func<TimeSpan, CancellationToken, Task> wait,
      CancellationToken cancellationToken)
  {
    var method = Method(
        "MaxDelivery",
        "DeleteAllAsync",
        [
          typeof(IMaxMessages),
          typeof(IReadOnlyList<string>),
          typeof(int),
          typeof(Func<TimeSpan, CancellationToken, Task>),
          typeof(CancellationToken),
        ],
        "Task DeleteAllAsync(IMaxMessages messages, IReadOnlyList<string> messageIds, int perSecond,"
            + " Func<TimeSpan, CancellationToken, Task> wait, CancellationToken cancellationToken)");

    await InvokeAsync(method, [platform, messageIds, perSecond, wait, cancellationToken]);
  }

  /// Отправка сообщения с ограниченными повторами отклонённого обращения.
  private static async Task<string> SendAsync(
      IMaxMessages platform,
      long chatId,
      OutgoingMessage message,
      int maxRetries,
      Func<TimeSpan, CancellationToken, Task> wait,
      CancellationToken cancellationToken)
  {
    var method = Method(
        "MaxDelivery",
        "SendAsync",
        [
          typeof(IMaxMessages),
          typeof(long),
          typeof(OutgoingMessage),
          typeof(int),
          typeof(Func<TimeSpan, CancellationToken, Task>),
          typeof(CancellationToken),
        ],
        "Task<string> SendAsync(IMaxMessages messages, long chatId, OutgoingMessage message, int maxRetries,"
            + " Func<TimeSpan, CancellationToken, Task> wait, CancellationToken cancellationToken)");

    var returned = await InvokeAsync(method, [platform, chatId, message, maxRetries, wait, cancellationToken]);

    return returned as string ?? string.Empty;
  }

  /// Открытый статический метод объявленной формы в сборке чат-бота.
  private static MethodInfo Method(
      string typeName,
      string methodName,
      Type[] parameters,
      string expectedSignature)
  {
    var assembly = typeof(BotTexts).Assembly;

    var type = assembly
        .GetExportedTypes()
        .FirstOrDefault(candidate => string.Equals(candidate.Name, typeName, StringComparison.Ordinal));

    Assert.True(
        type is not null,
        $"сборка {assembly.GetName().Name} не объявляет тип {typeName}. Ожидается открытый тип"
            + $" со статическим методом «{expectedSignature}»: соблюдать пределы платформы"
            + " обязан тот, кто вызывает порт, а такого места в объявленной поверхности нет");

    var method = type!.GetMethod(methodName, BindingFlags.Public | BindingFlags.Static, parameters);

    Assert.True(
        method is not null,
        $"у типа {type.FullName} нет метода «{expectedSignature}»");

    return method!;
  }

  /// Вызов разрешённого отражением метода с ожиданием его завершения. Отказ
  /// правила разворачивается из конверта отражения: иначе проверка увидела бы
  /// не тот тип исключения, который объявлен портом.
  private static async Task<object?> InvokeAsync(MethodInfo method, object?[] arguments)
  {
    object? returned;

    try
    {
      returned = method.Invoke(null, arguments);
    }
    catch (TargetInvocationException failure) when (failure.InnerException is not null)
    {
      ExceptionDispatchInfo.Capture(failure.InnerException).Throw();
      throw;
    }

    var task = returned as Task;

    Assert.True(
        task is not null,
        $"метод {method.Name} вернул не задачу: обращение к платформе выполняется асинхронно");

    await task!;

    var result = task.GetType().GetProperty("Result", BindingFlags.Public | BindingFlags.Instance);

    return result?.GetValue(task);
  }

  /// Часы проверки: время двигает ожидание, а не система. Так предел
  /// удаления проверяется без настоящей выдержки в секунду.
  private sealed class TestClock
  {
    private DateTimeOffset now = Origin;

    public DateTimeOffset Now => now;

    public Task WaitAsync(TimeSpan span, CancellationToken cancellationToken)
    {
      now = now.Add(span);
      return Task.CompletedTask;
    }
  }
}
