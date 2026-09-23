namespace Imolt.Shared;

/// Системное время. Единственное место службы, где берётся «сейчас».
///
/// Время приводится к часовому поясу обслуживаемой области, а не к поясу
/// машины. Причина прикладная: сервис считает вывоз по Москве и Московской
/// области, и «дата актуальности» цен и статусов — обещание пользователю о
/// свежести данных (R-048). Образ службы живёт в UTC, и цена, поправленная в
/// десять вечера по Москве, датировалась бы вчерашним днём — ровно тем
/// обещанием, которое нельзя нарушать.
///
/// Пояс задан смещением, а не именем: база часовых поясов в образ службы не
/// входит, и обращение по имени зависело бы от того, поставили её или нет.
/// Москва живёт на UTC+3 без сезонных переходов с 2014 года, поэтому
/// смещение здесь — не упрощение, а полное описание пояса.
///
/// @shared: imolt-shared
/// @adr: ADR-0005
public sealed class SystemClock : IClock
{
  private static readonly TimeSpan ServiceOffset = TimeSpan.FromHours(3);

  public DateTimeOffset Now => DateTimeOffset.UtcNow.ToOffset(ServiceOffset);

  public DateOnly Today => DateOnly.FromDateTime(Now.DateTime);

  public DateTimeOffset StartOfDay(DateOnly day) =>
      new(day.ToDateTime(TimeOnly.MinValue), ServiceOffset);
}
