using Imolt.Shared;
using Xunit;

namespace Imolt.Domain.Tests;

/// Перечень устойчивых кодов причин ошибки. Интерфейс ветвится по коду, а не
/// по тексту заголовка (схема Problem договора), поэтому коды живут одним
/// местом и не переписываются в каждом обработчике.
///
/// Здесь проверяется только форма перечня: договор в модульном проекте не
/// читается. Сверку состава с файлом договора ведёт интеграционный проект —
/// проверка ProblemCodesMatchTheContract.
///
/// Проверка фальсифицируема: она падает, если в перечень попадёт код без
/// пространства имён urn:imolt:problem (и клиент не отличит его от чужого)
/// либо если один код будет объявлен дважды под разными именами.
///
///   dotnet test tests/unit/Imolt.Domain.Tests
///
/// @supports: R-011
public sealed class ProblemsTests
{
  private const string ContractNamespace = "urn:imolt:problem:";

  [Fact(DisplayName = "каждый код причины принадлежит пространству имён договора")]
  public void EveryCodeBelongsToTheContractNamespace()
  {
    Assert.NotEmpty(Problems.All);

    var foreign = Problems.All
        .Where(code => !code.StartsWith(ContractNamespace, StringComparison.Ordinal))
        .ToList();

    Assert.True(
        foreign.Count == 0,
        "коды вне пространства имён договора: " + string.Join(", ", foreign));
  }

  [Fact(DisplayName = "коды причин не повторяются")]
  public void CodesAreNotRepeated()
  {
    var repeated = Problems.All
        .GroupBy(code => code, StringComparer.Ordinal)
        .Where(group => group.Count() > 1)
        .Select(group => group.Key)
        .ToList();

    Assert.True(
        repeated.Count == 0,
        "коды объявлены дважды: " + string.Join(", ", repeated));
  }
}
