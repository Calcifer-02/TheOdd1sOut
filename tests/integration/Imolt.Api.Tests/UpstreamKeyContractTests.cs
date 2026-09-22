using Xunit;
using YamlDotNet.Serialization;

namespace Imolt.Api.Tests;

/// Ключ внешней службы не покидает сервер. Проверка ведётся по самому
/// договору: ключ, объявленный параметром запроса, обязывает клиента его
/// передать, а значит — держать у себя. Такой ключ становится общедоступным
/// в тот же день (риск AR-006), и ловить это нужно на договоре, до того как
/// клиент будет по нему написан.
///
/// Договор разбирается как обычный YAML, а не через объектную модель OpenAPI:
/// проверяется то, что записано в файле, а не производная от него.
///
/// Проверка фальсифицируема: она падает, если в договоре появится параметр
/// запроса, названный ключом, токеном, подписью или учётными данными внешней
/// службы, и если обход перестанет видеть параметры — перечень имён
/// сверяется с уже объявленными в договоре, и пустой обход это обнаружит.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-056b
/// @supports: R-056
public sealed class UpstreamKeyContractTests
{
  // Признаки имени, по которым параметр опознаётся как секрет. Перечень
  // взят из формулировки критерия приёмки AC-056a — «ключом, токеном или
  // подписью», — и дополнен обычными синонимами тех же понятий.
  private static readonly string[] SecretNameFragments =
  [
      "key", "token", "secret", "sign", "password", "credential", "auth",
    ];

  [Fact(DisplayName = "договор не объявляет ни одного параметра запроса с ключом внешней службы")]
  public void ContractDeclaresNoUpstreamKeyParameter()
  {
    var names = ParameterNames();

    // Обход обязан что-то находить: пустой перечень означал бы, что
    // проверка прошла, ничего не осмотрев.
    Assert.Contains("query", names);
    Assert.Contains("limit", names);

    var suspicious = names
        .Where(name => SecretNameFragments.Any(
            fragment => name.Contains(fragment, StringComparison.OrdinalIgnoreCase)))
        .OrderBy(name => name, StringComparer.Ordinal)
        .ToList();

    Assert.True(
        suspicious.Count == 0,
        "договор объявляет параметры запроса, похожие на секрет внешней службы: "
        + string.Join(", ", suspicious));
  }

  // Имена всех параметров договора: и объявленных у пути, и объявленных у
  // операции, и подставленных ссылкой на components/parameters.
  private static IReadOnlyCollection<string> ParameterNames()
  {
    var document = new DeserializerBuilder().Build()
        .Deserialize<Dictionary<object, object>>(File.ReadAllText(ContractOracle.ContractPath));

    var components = document.TryGetValue("components", out var node)
        && node is IDictionary<object, object> map
        && map.TryGetValue("parameters", out var shared)
        && shared is IDictionary<object, object> declared
            ? declared
            : new Dictionary<object, object>();

    var names = new HashSet<string>(StringComparer.Ordinal);

    foreach (var path in ((IDictionary<object, object>)document["paths"]).Values
                 .OfType<IDictionary<object, object>>())
    {
      foreach (var (key, value) in path)
      {
        // «parameters» у пути — список; у операции тот же ключ лежит
        // внутри её тела. Обход учитывает оба места: параметр,
        // объявленный один раз у пути, действует на все операции.
        var entries = (string)key == "parameters"
            ? value as IEnumerable<object>
            : (value as IDictionary<object, object>)?.TryGetValue("parameters", out var own) == true
                ? own as IEnumerable<object>
                : null;

        foreach (var parameter in entries?.OfType<IDictionary<object, object>>() ?? [])
        {
          names.Add(Name(parameter, components));
        }
      }
    }

    return names;
  }

  private static string Name(IDictionary<object, object> parameter, IDictionary<object, object> components)
  {
    if (parameter.TryGetValue("name", out var name))
    {
      return (string)name;
    }

    if (parameter.TryGetValue("$ref", out var reference))
    {
      var key = ((string)reference).Split('/').Last();

      return components.TryGetValue(key, out var target)
          ? Name((IDictionary<object, object>)target, components)
          : throw new InvalidOperationException($"договор ссылается на параметр {key}, которого не объявляет");
    }

    throw new InvalidOperationException("в договоре есть параметр без имени и без ссылки");
  }
}
