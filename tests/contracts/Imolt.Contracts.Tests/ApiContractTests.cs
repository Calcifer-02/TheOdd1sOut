using System.Text.RegularExpressions;
using Microsoft.OpenApi;
using Microsoft.OpenApi.Reader;
using Microsoft.OpenApi.YamlReader;
using Xunit;
using YamlDotNet.Serialization;

namespace Imolt.Contracts.Tests;

// Проверка договора API: разбирается ли он оснасткой OpenAPI и совпадают ли
// объявленные в нём связи с реестром требований проекта.
//
// Проверка фальсифицируема: она падает, если испортить YAML, сослаться на
// несуществующее требование или открытый вопрос, забыть у операции область,
// требование либо состояние, повторить operationId, выдать необъявленную
// операцию за реализованную или оставить изменяющую операцию без ответа
// об ошибке.
//
//   dotnet test tests/contracts/Imolt.Contracts.Tests
//
// @supports: R-002
// @adr: ADR-0003
public sealed class ApiContractTests
{
    private static readonly string RepositoryRoot = FindRepositoryRoot();

    private static readonly string ContractPath = Path.Combine(
        RepositoryRoot, "src", "back", "Imolt.Api", "contracts", "openapi.yaml");

    private static readonly string RequirementsPath = Path.Combine(
        RepositoryRoot, "docs", "ПАКЕТ_АНАЛИТИКИ", "РЕЕСТР_ТРЕБОВАНИЙ.md");

    // У каждого вида записи свой реестр: вопросы живут отдельно от требований
    // с тех пор, как реестр открытых вопросов заведён своим документом.
    private static readonly string QuestionsPath = Path.Combine(
        RepositoryRoot, "docs", "ПАКЕТ_АНАЛИТИКИ", "ОТКРЫТЫЕ_ВОПРОСЫ.md");

    // Предметные области расчётной части по ADR-0001 и служебная зона,
    // в которой живут точки живости и готовности.
    private static readonly string[] AllowedAreas =
        ["справочники", "расчёт", "сделка", "служебное"];

    private static readonly string[] AllowedStates = ["реализовано", "объявлено"];

    private static readonly string[] HttpMethods =
        ["get", "post", "put", "patch", "delete", "head", "options", "trace"];

    // Конфигурация проверки для организаторов трека: тот же перечень точек,
    // что в договоре, в форме, которую требуют условия сдачи.
    private static readonly string DeliveryConfigPath = Path.Combine(RepositoryRoot, "DATA-API.yaml");

    private static IDictionary<object, object>? contract;

    private static IDictionary<object, object>? deliveryConfig;

    [Fact(DisplayName = "договор разбирается оснасткой OpenAPI без ошибок")]
    public async Task ContractParsesWithoutErrors()
    {
        var settings = new OpenApiReaderSettings();
        settings.AddYamlReader();

        await using var stream = File.OpenRead(ContractPath);
        var result = await OpenApiDocument.LoadAsync(stream, "yaml", settings);

        Assert.NotNull(result.Document);
        Assert.Empty(result.Diagnostic?.Errors ?? []);
    }

    [Fact(DisplayName = "у каждой операции объявлены область, требования и состояние")]
    public void EveryOperationCarriesProjectMetadata()
    {
        foreach (var (path, method, operation) in Operations())
        {
            var where = $"{method.ToUpperInvariant()} {path}";

            Assert.True(operation.ContainsKey("operationId"), $"{where}: нет operationId");
            Assert.True(operation.ContainsKey("summary"), $"{where}: нет краткого названия");

            var area = Text(operation, "x-область");
            Assert.True(area is not null, $"{where}: не объявлена область");
            Assert.Contains(area, AllowedAreas);

            var requirements = TextList(operation, "x-требования");
            Assert.True(requirements.Count > 0, $"{where}: не названо ни одного требования");

            var state = Text(operation, "x-состояние");
            Assert.True(state is not null, $"{where}: не объявлено состояние");
            Assert.Contains(state, AllowedStates);
        }
    }

    [Fact(DisplayName = "operationId у операций не повторяются")]
    public void OperationIdentifiersAreUnique()
    {
        var duplicates = Operations()
            .Select(operation => Text(operation.Operation, "operationId")!)
            .GroupBy(identifier => identifier)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToList();

        Assert.Empty(duplicates);
    }

    [Fact(DisplayName = "каждое требование договора есть в реестре требований")]
    public void ContractRequirementsExistInRegistry()
    {
        var known = IdentifiersFromRegistry(@"^\|\s*\d+\s*\|\s*(R-\d{3})\s*\|");

        var named = Operations()
            .SelectMany(operation => TextList(operation.Operation, "x-требования"))
            .Distinct()
            .ToList();

        Assert.NotEmpty(named);
        Assert.Empty(named.Except(known).OrderBy(identifier => identifier));
    }

    [Fact(DisplayName = "каждый открытый вопрос договора есть в реестре открытых вопросов")]
    public void ContractQuestionsExistInRegistry()
    {
        var known = IdentifiersFrom(QuestionsPath, @"^\|\s*(Q-\d{3})\s*\|");

        var named = Operations()
            .SelectMany(operation => TextList(operation.Operation, "x-вопросы"))
            .Distinct()
            .ToList();

        Assert.Empty(named.Except(known).OrderBy(identifier => identifier));
    }

    [Fact(DisplayName = "реализованными объявлены только те пути, которые служба действительно отдаёт")]
    public void OnlyServedPathsAreMarkedImplemented()
    {
        // Расчётная часть пока отвечает только на точки живости и готовности.
        // Пометка «реализовано» у чего-то ещё означала бы, что договор выдаёт
        // объявление за работающий код. Строку ниже двигает тот, кто написал
        // обработчик, — вместе с проверкой запуска.
        string[] servedByService = ["/health", "/ready"];

        var implemented = Operations()
            .Where(operation => Text(operation.Operation, "x-состояние") == "реализовано")
            .Select(operation => operation.Path)
            .Distinct()
            .OrderBy(path => path, StringComparer.Ordinal)
            .ToList();

        Assert.Equal(servedByService.OrderBy(path => path, StringComparer.Ordinal), implemented);
    }

    [Fact(DisplayName = "у каждой изменяющей операции объявлен ответ об ошибке")]
    public void ChangingOperationsDeclareFailure()
    {
        foreach (var (path, method, operation) in Operations())
        {
            if (method is "get")
            {
                continue;
            }

            var responses = Map(operation, "responses");
            var declared = responses.Keys
                .OfType<string>()
                .Any(code => code.StartsWith('4') || code.StartsWith('5'));

            Assert.True(declared, $"{method.ToUpperInvariant()} {path}: не объявлен ни один ответ об ошибке");
        }
    }

    // Идентификаторы берутся из строк таблиц реестра, а не из всего текста:
    // в пояснениях реестра встречаются примеры вроде «после R-999», и по ним
    // проверка молча признала бы существующим любой номер.
    [Fact(DisplayName = "перечень точек DATA-API.yaml совпадает с договором")]
    public void DeliveryChecksMatchTheContract()
    {
        var operations = Operations().ToDictionary(
            operation => Text(operation.Operation, "operationId")!,
            operation => operation);

        foreach (var check in DeliveryChecks())
        {
            var id = Text(check, "id")!;
            Assert.True(operations.ContainsKey(id), $"DATA-API.yaml: точки {id} нет в договоре");

            var (path, method, operation) = operations[id];
            Assert.Equal(method.ToUpperInvariant(), Text(check, "method"));
            Assert.Equal(path, Text(check, "path"));
            Assert.Equal(Text(operation, "x-состояние"), Text(check, "state"));
            Assert.Equal(Text(operation, "x-область"), Text(check, "area"));

            var declared = Map(operation, "responses").Keys
                .OfType<string>()
                .Where(code => code.StartsWith('2'))
                .Select(int.Parse)
                .OrderBy(code => code)
                .ToList();
            var expected = ((IEnumerable<object>)check["expectedStatus"])
                .Select(code => int.Parse((string)code))
                .OrderBy(code => code)
                .ToList();
            Assert.Equal(declared, expected);
        }

        Assert.Equal(operations.Count, DeliveryChecks().Count);
    }

    [Fact(DisplayName = "DATA-API.yaml объявляет тот же базовый адрес и только работающие проверки")]
    public void DeliveryConfigNamesTheStandAndWhatItServes()
    {
        var servers = (IEnumerable<object>)Contract()["servers"];
        var firstServer = (IDictionary<object, object>)servers.First();

        Assert.Equal(Text(firstServer, "url"), Text(DeliveryConfig(), "baseUrl"));

        var mandatory = ((IEnumerable<object>)DeliveryConfig()["mandatoryChecks"])
            .Cast<string>()
            .OrderBy(id => id, StringComparer.Ordinal)
            .ToList();

        var implemented = Operations()
            .Where(operation => Text(operation.Operation, "x-состояние") == "реализовано")
            .Select(operation => Text(operation.Operation, "operationId")!)
            .OrderBy(id => id, StringComparer.Ordinal)
            .ToList();

        Assert.Equal(implemented, mandatory);
    }

    private static IReadOnlyCollection<string> IdentifiersFromRegistry(string pattern)
        => IdentifiersFrom(RequirementsPath, pattern);

    private static IReadOnlyCollection<string> IdentifiersFrom(string path, string pattern)
    {
        var text = File.ReadAllText(path);
        return Regex.Matches(text, pattern, RegexOptions.Multiline)
            .Select(match => match.Groups[1].Value)
            .ToHashSet();
    }

    private static List<(string Path, string Method, IDictionary<object, object> Operation)> Operations()
    {
        var paths = Map(Contract(), "paths");
        var found = new List<(string, string, IDictionary<object, object>)>();

        foreach (var (key, value) in paths)
        {
            var path = (string)key;
            var item = (IDictionary<object, object>)value;

            foreach (var (methodName, body) in item)
            {
                var method = ((string)methodName).ToLowerInvariant();
                if (HttpMethods.Contains(method))
                {
                    found.Add((path, method, (IDictionary<object, object>)body));
                }
            }
        }

        return found;
    }

    private static IDictionary<object, object> Contract()
    {
        contract ??= new DeserializerBuilder()
            .Build()
            .Deserialize<Dictionary<object, object>>(File.ReadAllText(ContractPath));

        return contract;
    }

    private static IDictionary<object, object> DeliveryConfig()
    {
        deliveryConfig ??= new DeserializerBuilder()
            .Build()
            .Deserialize<Dictionary<object, object>>(File.ReadAllText(DeliveryConfigPath));

        return deliveryConfig;
    }

    private static List<IDictionary<object, object>> DeliveryChecks()
        => ((IEnumerable<object>)DeliveryConfig()["checks"])
            .Cast<IDictionary<object, object>>()
            .ToList();

    private static IDictionary<object, object> Map(IDictionary<object, object> node, string key)
        => (IDictionary<object, object>)node[key];

    private static string? Text(IDictionary<object, object> node, string key)
        => node.TryGetValue(key, out var value) ? value as string : null;

    private static List<string> TextList(IDictionary<object, object> node, string key)
        => node.TryGetValue(key, out var value) && value is IEnumerable<object> items
            ? items.OfType<string>().ToList()
            : [];

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);

        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "trip.json")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName
            ?? throw new InvalidOperationException("Корень репозитория не найден: рядом нет trip.json");
    }
}
