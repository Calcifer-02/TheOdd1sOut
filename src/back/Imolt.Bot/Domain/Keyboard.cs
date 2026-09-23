namespace Imolt.Bot.Domain;

/// Кнопка сообщения. Вид кнопки платформа задаёт строкой, и от него зависит,
/// какие поля обязаны быть заполнены: кнопка открытия мини-приложения
/// называет учётную запись бота и его идентификатор, кнопка-ссылка — адрес.
///
/// Тип-сумма здесь не заводится намеренно: состав кнопки уходит на платформу
/// как есть, и лишний слой превращения означал бы второе место, где этот
/// состав описан.
///
/// @supports: R-069
public sealed record KeyboardButton(
    string Type,
    string Text,
    string? WebApp = null,
    long? ContactId = null,
    string? Url = null,
    string? Payload = null);

/// Встроенная клавиатура сообщения: строки кнопок.
///
/// @supports: R-069
public sealed record Keyboard(IReadOnlyList<IReadOnlyList<KeyboardButton>> Rows);

/// Сборка кнопки открытия мини-приложения (R-069).
///
/// Адрес приложения в кнопку не подставляется: платформа берёт его из
/// настроек бота, а кнопка называет только сам бот. Поэтому произвольный
/// внешний адрес через эту кнопку открыть нельзя — и это свойство проверяется
/// (AC-069b).
///
/// @req: R-069
/// @adr: ADR-0009
public static class MiniAppButton
{
  /// Вид кнопки, отведённый платформой мини-приложениям.
  public const string Kind = "open_app";

  public static Keyboard Of(BotIdentity bot, string text) =>
      throw new NotImplementedException("состав кнопки собирается в срезе реализации");
}
