namespace Imolt.Shared;

/// Разобранные параметры страницы списка. Договор объявляет пределы явно
/// (параметры Limit и Offset), и негодное значение здесь отвергается, а не
/// приводится к границе молча: иначе клиент получит не ту страницу и не
/// узнает об этом.
///
/// @shared: imolt-shared
/// @adr: ADR-0005
public readonly record struct PageRequest
{
    private PageRequest(int limit, int offset)
    {
        Limit = limit;
        Offset = offset;
    }

    /// Первая страница — десять записей (R-029, R-060).
    public const int DefaultLimit = 10;

    public const int MaxLimit = 100;

    public int Limit { get; }

    public int Offset { get; }

    public static PageRequest Create(int? limit, int? offset)
    {
        var resolvedLimit = limit ?? DefaultLimit;
        var resolvedOffset = offset ?? 0;

        if (resolvedLimit is < 1 or > MaxLimit)
        {
            throw new ArgumentOutOfRangeException(
                nameof(limit),
                resolvedLimit,
                $"число записей на странице — от 1 до {MaxLimit}");
        }

        if (resolvedOffset < 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(offset),
                resolvedOffset,
                "смещение не может быть отрицательным");
        }

        return new PageRequest(resolvedLimit, resolvedOffset);
    }
}

/// Страница списка в форме договора: общее число записей, предел, смещение и
/// сами записи. Общее число считается по всему набору, а не по странице —
/// иначе кнопка «показать ещё» не знает, когда остановиться.
///
/// @shared: imolt-shared
/// @adr: ADR-0005
public sealed record Page<T>(int Total, int Limit, int Offset, IReadOnlyList<T> Items)
{
    public static Page<T> Of(IReadOnlyList<T> items, int total, PageRequest request) =>
        new(total, request.Limit, request.Offset, items);
}
