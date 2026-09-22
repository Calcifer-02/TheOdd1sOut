namespace Imolt.Shared;

/// Системное время. Единственное место службы, где берётся «сейчас».
public sealed class SystemClock : IClock
{
  public DateTimeOffset Now => DateTimeOffset.Now;

  public DateOnly Today => DateOnly.FromDateTime(DateTime.Now);
}
