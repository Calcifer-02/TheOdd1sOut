using Imolt.Bot.Domain;
using Xunit;

namespace Imolt.Bot.Tests;

/// Состав кнопки открытия мини-приложения (R-069, критерии AC-069a и
/// AC-069b). Кнопка — единственный продуктовый вход в мини-приложение
/// (ADR-0009, инвариант 1), поэтому её состав проверяется отдельно от
/// сценария переписки.
///
/// Проверки модульные: состав кнопки уезжает на платформу как есть, а самой
/// платформы в проверке нет — ADR-0009 прямо называет это границей
/// проверяемого («проверить платформенный запуск можно только в самой
/// платформе»).
///
///   dotnet test tests/unit/Imolt.Bot.Tests
public sealed class MiniAppButtonTests
{
  /// Учётная запись бота проекта: `GET /me` вернул её 24.09.2026 (ADR-0009,
  /// раздел результата проверки). Здесь она — исходные данные проверки, а не
  /// настройка службы.
  private static readonly BotIdentity Bot = new("t782_hakaton_max_bot", 418419942);

  /// Второй бот, которого у проекта нет. Нужен, чтобы отличить сборку
  /// состава от вписанного в код значения: ADR-0009 называет смену бота
  /// последствием, которое нельзя откатить дёшево.
  private static readonly BotIdentity AnotherBot = new("another_service_bot", 100500);

  /// Проверка падает, если кнопка собрана не тем видом, который платформа
  /// отвела мини-приложениям, если подпись кнопки потерялась или если строк с
  /// кнопками в клавиатуре оказалось не одна.
  ///
  /// @ac: AC-069a
  [Fact(DisplayName = "ответ несёт одну кнопку запуска мини-приложения объявленного платформой вида")]
  public void MiniAppButtonCarriesThePlatformKindReservedForMiniApps()
  {
    var keyboard = MiniAppButton.Of(Bot, BotTexts.OpenAppLabel);

    Assert.NotNull(keyboard);
    Assert.NotNull(keyboard.Rows);

    var button = OnlyButton(keyboard);

    Assert.False(
        string.IsNullOrWhiteSpace(MiniAppButton.Kind),
        "вид кнопки мини-приложения не объявлен: платформе нечего передать");

    // Вид кнопки — то единственное, по чему платформа отличает запуск
    // мини-приложения от перехода по ссылке.
    Assert.True(
        string.Equals(button.Type, MiniAppButton.Kind, StringComparison.Ordinal),
        $"кнопка объявлена видом «{button.Type}», а мини-приложениям платформа отвела «{MiniAppButton.Kind}»");

    Assert.True(
        string.Equals(button.Text, BotTexts.OpenAppLabel, StringComparison.Ordinal),
        $"подпись кнопки «{button.Text}» разошлась с текстом чат-бота «{BotTexts.OpenAppLabel}»");
  }

  /// Проверка падает, если кнопка перестанет называть учётную запись и
  /// идентификатор самого бота, если состав окажется вписанным в код и не
  /// изменится вслед за учётной записью, а также если в любое поле кнопки
  /// попадёт абсолютный адрес.
  ///
  /// @ac: AC-069b
  [Fact(DisplayName = "кнопка называет самого чат-бота и не несёт произвольного адреса")]
  public void MiniAppButtonNamesItsOwnBotAndCarriesNoArbitraryAddress()
  {
    var button = OnlyButton(MiniAppButton.Of(Bot, BotTexts.OpenAppLabel));

    var webApp = button.WebApp ?? string.Empty;
    Assert.True(
        webApp.Contains(Bot.Username, StringComparison.Ordinal),
        $"кнопка не называет учётную запись бота: в поле мини-приложения «{webApp}» нет «{Bot.Username}»");

    Assert.True(
        button.ContactId == Bot.ContactId,
        $"кнопка называет идентификатор {button.ContactId}, а бот проекта — {Bot.ContactId}");

    Assert.True(
        button.Url is null,
        $"в кнопке запуска стоит адрес «{button.Url}»: адрес приложения платформа берёт из настроек бота (ADR-0009)");

    // Ни одно поле кнопки не содержит абсолютного адреса. Иначе через кнопку
    // запуска открывался бы произвольный внешний ресурс, чего критерий
    // AC-069b не допускает.
    foreach (var field in new[] { button.Text, button.WebApp, button.Url, button.Payload })
    {
      if (field is null)
      {
        continue;
      }

      Assert.False(
          Uri.TryCreate(field, UriKind.Absolute, out _),
          $"в составе кнопки стоит абсолютный адрес «{field}»: кнопка обязана называть только сам чат-бот");
    }

    // Состав собирается из переданной учётной записи, а не записан в коде:
    // иначе смена бота оставила бы кнопку указывающей на прежнего.
    var another = OnlyButton(MiniAppButton.Of(AnotherBot, BotTexts.OpenAppLabel));
    var anotherWebApp = another.WebApp ?? string.Empty;

    Assert.True(
        anotherWebApp.Contains(AnotherBot.Username, StringComparison.Ordinal),
        $"состав кнопки не пошёл за учётной записью: при боте «{AnotherBot.Username}» в поле стоит «{anotherWebApp}»");

    Assert.True(
        another.ContactId == AnotherBot.ContactId,
        $"идентификатор в кнопке не пошёл за учётной записью: ожидали {AnotherBot.ContactId}, получили {another.ContactId}");
  }

  /// Единственная кнопка клавиатуры. Кнопка запуска собирается одна: вторая в
  /// том же ответе означала бы второй вход, которого решение не предусматривает.
  private static KeyboardButton OnlyButton(Keyboard keyboard)
  {
    var row = Assert.Single(keyboard.Rows);
    return Assert.Single(row);
  }
}
