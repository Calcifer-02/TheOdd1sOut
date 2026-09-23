using Imolt.Shared;
using Xunit;

namespace Imolt.Api.Tests;

/// Сверка перечня кодов причин в коде с договором. Код причины — устойчивая
/// часть договора: клиент ветвится по нему, поэтому расхождение в любую
/// сторону означает, что одна из сторон обещает не то, что делает.
///
/// Проверка фальсифицируема: она падает, если в договоре объявят код, которого
/// нет в перечне службы (клиент будет ждать причину, которую служба никогда не
/// вернёт), и если служба заведёт код, о котором договор молчит.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
public sealed class ProblemCodesTests
{
  [Fact(DisplayName = "перечень кодов причин в коде совпадает с договором")]
  public void ProblemCodesMatchTheContract()
  {
    var declared = ContractOracle.FromContract().ProblemCodes();
    var implemented = Problems.All.ToHashSet(StringComparer.Ordinal);

    var missing = declared.Except(implemented, StringComparer.Ordinal)
        .OrderBy(code => code, StringComparer.Ordinal)
        .ToList();
    var extra = implemented.Except(declared, StringComparer.Ordinal)
        .OrderBy(code => code, StringComparer.Ordinal)
        .ToList();

    Assert.True(
        missing.Count == 0,
        "договор объявляет коды, которых нет в перечне службы: " + string.Join(", ", missing));
    Assert.True(
        extra.Count == 0,
        "служба объявляет коды, которых нет в договоре: " + string.Join(", ", extra));
  }
}
