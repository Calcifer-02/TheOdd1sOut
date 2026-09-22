using Imolt.Shared;
using Xunit;

namespace Imolt.Domain.Tests;

/// Разбор параметров страницы. Договор объявляет их один раз переиспользуемыми
/// параметрами Limit и Offset: limit — целое от 1 до 100 со значением по
/// умолчанию 10, offset — целое от 0 со значением по умолчанию 0. Второго
/// места, где эти границы живут, быть не должно.
///
/// Проверка фальсифицируема: она падает, если значение по умолчанию разойдётся
/// с договором, если негодное значение молча приведётся к границе вместо
/// ошибки проверки данных (тогда клиент получит не ту страницу и не узнает об
/// этом) или если включительная граница 100 будет отвергнута.
///
///   dotnet test tests/unit/Imolt.Domain.Tests
///
/// @ac: AC-060a, AC-060b
/// @supports: R-060
public sealed class PageRequestTests
{
  [Fact(DisplayName = "без параметров страница берёт значения по умолчанию из договора")]
  public void MissingParametersFallBackToContractDefaults()
  {
    var page = PageRequest.Create(null, null);

    Assert.Equal(10, page.Limit);
    Assert.Equal(0, page.Offset);
  }

  [Theory(DisplayName = "значение вне границ договора отвергается как ошибка проверки данных")]
  [InlineData(101, null, "limit")]
  [InlineData(0, null, "limit")]
  [InlineData(null, -1, "offset")]
  public void OutOfRangeValuesAreRejected(int? limit, int? offset, string expectedParameter)
  {
    var failure = Assert.Throws<ArgumentOutOfRangeException>(() => PageRequest.Create(limit, offset));

    // Имя параметра — не украшение: по нему служба собирает поле errors
    // документа об ошибке, а пользователь узнаёт, что именно поправить.
    Assert.Equal(expectedParameter, failure.ParamName);
  }

  [Fact(DisplayName = "верхняя граница limit допустима: договор объявляет её включительно")]
  public void UpperBoundIsInclusive()
  {
    var page = PageRequest.Create(100, 0);

    Assert.Equal(100, page.Limit);
    Assert.Equal(0, page.Offset);
  }
}
