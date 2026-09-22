namespace Imolt.Shared;

/// Время приходит в домен портом, а не системным вызовом: иначе расчёт
/// перестаёт воспроизводиться, а проверка сезонного коэффициента зависит от
/// дня, когда её запустили (правило ARCH-025).
///
/// @shared: imolt-shared
/// @adr: ADR-0005
public interface IClock
{
    DateTimeOffset Now { get; }

    DateOnly Today { get; }
}
