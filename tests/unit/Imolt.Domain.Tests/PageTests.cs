using System.Text.Json;
using Imolt.Shared;
using Xunit;

namespace Imolt.Domain.Tests;

/// Конверт списка в форме договора: общее число записей, предел, смещение и
/// сами записи (схемы ответов с полями total, limit, offset, items). Общее
/// число считается по всему набору, а не по странице: иначе кнопка «показать
/// ещё» не знает, когда остановиться (R-029, R-060).
///
/// Проверка фальсифицируема: она падает, если total начнёт передаваться числом
/// записей на странице, если конверт потеряет одно из четырёх полей договора
/// или если имена полей уйдут в другой регистр — договор объявляет их
/// строчными.
///
///   dotnet test tests/unit/Imolt.Domain.Tests
///
/// @ac: AC-060a
/// @supports: R-060
/// @adr: ADR-0005
public sealed class PageTests
{
    [Fact(DisplayName = "страница сообщает общее число записей набора, а не число записей на странице")]
    public void TotalCountsTheWholeSetNotThePage()
    {
        var items = new[] { "beton-lom", "drevesina", "kirpich-lom" };
        var request = PageRequest.Create(10, 0);

        var page = Pages.Of<string>(items, total: 12, request);

        Assert.Equal(12, page.Total);
        Assert.Equal(3, page.Items.Count);
        Assert.Equal(10, page.Limit);
        Assert.Equal(0, page.Offset);
    }

    [Fact(DisplayName = "конверт списка сериализуется четырьмя полями договора")]
    public void EnvelopeSerializesWithContractFields()
    {
        var page = Pages.Of<string>(
            ["beton-lom"], total: 12, PageRequest.Create(10, 20));

        using var document = JsonDocument.Parse(JsonSerializer.Serialize(page, ImoltJson.Options));
        var root = document.RootElement;

        Assert.Equal(12, root.GetProperty("total").GetInt32());
        Assert.Equal(10, root.GetProperty("limit").GetInt32());
        Assert.Equal(20, root.GetProperty("offset").GetInt32());
        Assert.Equal("beton-lom", root.GetProperty("items")[0].GetString());
    }
}
