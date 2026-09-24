namespace Imolt.Bot.Domain;

/// Извещение о смене статуса заявки на вывоз (R-083).
///
/// Номер и статус приходят от того, кто статус сменил. Своего словаря
/// статусов чат-бот не заводит: состояния заявки — данные сервиса, а не
/// выбор в коде бота (правила проекта, «Продукт и раскладка»).
///
/// @supports: R-083
public sealed record PickupRequestNotice(string RequestNumber, string Status);

/// Тексты извещений (R-083).
///
/// Извещение — то, ради чего переписка уместнее экрана: участник не заходит
/// в мини-приложение проверять статус.
///
/// @req: R-083
public static class Notices
{
  public static string Text(PickupRequestNotice notice)
  {
    ArgumentNullException.ThrowIfNull(notice);
    ArgumentException.ThrowIfNullOrWhiteSpace(notice.RequestNumber);
    ArgumentException.ThrowIfNullOrWhiteSpace(notice.Status);

    // Названы обе величины извещения: номер заявки и новый статус (AC-083a).
    // Без номера участник не поймёт, о какой из своих заявок речь.
    return "Заявка на вывоз № " + notice.RequestNumber
        + ": новый статус — " + notice.Status + ".";
  }
}
