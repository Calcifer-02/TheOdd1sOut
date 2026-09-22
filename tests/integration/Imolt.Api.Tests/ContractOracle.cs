using System.Text.Json;
using System.Text.RegularExpressions;
using YamlDotNet.Serialization;

namespace Imolt.Api.Tests;

/// Договорный оракул: берёт схему ответа из openapi.yaml по operationId и коду
/// ответа и называет, чем тело ответа от неё отличается. Средство общее — им
/// проверяются все точки договора, а не только служебные.
///
/// Договор читается как обычный YAML, а не через объектную модель OpenAPI:
/// оракул обязан видеть ключевые слова так, как они записаны в файле
/// (nullable, additionalProperties), а объектная модель часть из них
/// нормализует и сверка пошла бы с производной, а не с источником.
///
/// Поддержано подмножество, которым договор действительно пользуется:
/// type, required, enum, pattern, nullable, items, properties,
/// additionalProperties: false, $ref, allOf.
///
/// @supports: R-011
public sealed class ContractOracle
{
    private readonly IDictionary<object, object> document;

    private readonly string rawText;

    private ContractOracle(IDictionary<object, object> document, string rawText)
    {
        this.document = document;
        this.rawText = rawText;
    }

    /// Путь к договору: файл, который служба отдаёт по /v1/openapi.yaml.
    public static string ContractPath { get; } = Path.Combine(
        RepositoryRoot(), "src", "back", "Imolt.Api", "contracts", "openapi.yaml");

    public static ContractOracle FromContract()
    {
        var text = File.ReadAllText(ContractPath);
        var parsed = new DeserializerBuilder().Build().Deserialize<Dictionary<object, object>>(text);

        return new ContractOracle(parsed, text);
    }

    /// Коды причин ошибки, объявленные договором. Берутся из текста целиком:
    /// код встречается и в примерах ответов, и в описании схемы Problem,
    /// поэтому обход по одним только схемам оставил бы часть незамеченной.
    public IReadOnlyCollection<string> ProblemCodes()
        => Regex.Matches(rawText, @"urn:imolt:problem:[a-z0-9-]+")
            .Select(match => match.Value)
            .ToHashSet(StringComparer.Ordinal);

    /// Расхождения тела ответа со схемой, объявленной для этой операции и
    /// этого кода ответа. Пустой перечень означает совпадение.
    public IReadOnlyList<string> Violations(string operationId, int statusCode, string body)
        => Violations(ResponseSchema(operationId, statusCode), body, $"{operationId} {statusCode}");

    /// Расхождения тела с именованной схемой из components/schemas. Нужно для
    /// проверки частей ответа и самой оснастки.
    public IReadOnlyList<string> ViolationsAgainstSchema(string schemaName, string body)
        => Violations(NamedSchema(schemaName), body, schemaName);

    private IReadOnlyList<string> Violations(IDictionary<object, object> schema, string body, string where)
    {
        var violations = new List<string>();

        JsonDocument parsed;
        try
        {
            parsed = JsonDocument.Parse(body);
        }
        catch (JsonException failure)
        {
            return [$"{where}: тело ответа не разбирается как JSON — {failure.Message}"];
        }

        using (parsed)
        {
            Check(schema, parsed.RootElement, string.Empty, violations);
        }

        return violations;
    }

    private void Check(IDictionary<object, object> schema, JsonElement node, string path, List<string> violations)
    {
        var effective = Flatten(schema);

        if (node.ValueKind is JsonValueKind.Null)
        {
            if (!effective.Nullable && !(effective.Enum?.Contains(null) ?? false))
            {
                violations.Add($"{Where(path)}: договор не допускает пустое значение");
            }

            return;
        }

        if (!TypeMatches(effective.Type, node))
        {
            violations.Add(
                $"{Where(path)}: договор объявляет тип {effective.Type}, а в ответе пришло значение вида {Kind(node)}");
            return;
        }

        if (effective.Enum is { } allowed)
        {
            var actual = Scalar(node);
            if (!allowed.Contains(actual, StringComparer.Ordinal))
            {
                violations.Add(
                    $"{Where(path)}: значение «{actual}» не входит в перечень договора [{string.Join(", ", allowed.Select(value => value ?? "null"))}]");
            }
        }

        if (effective.Pattern is { } pattern && node.ValueKind is JsonValueKind.String)
        {
            var actual = node.GetString()!;
            if (!Regex.IsMatch(actual, pattern))
            {
                violations.Add($"{Where(path)}: значение «{actual}» не совпадает с образцом «{pattern}»");
            }
        }

        switch (node.ValueKind)
        {
            case JsonValueKind.Object:
                CheckObject(effective, node, path, violations);
                break;
            case JsonValueKind.Array when effective.Items is { } items:
                var index = 0;
                foreach (var element in node.EnumerateArray())
                {
                    Check(items, element, $"{path}/{index++}", violations);
                }

                break;
        }
    }

    private void CheckObject(EffectiveSchema schema, JsonElement node, string path, List<string> violations)
    {
        var present = node.EnumerateObject().ToDictionary(field => field.Name, field => field.Value, StringComparer.Ordinal);

        foreach (var name in schema.Required.OrderBy(name => name, StringComparer.Ordinal))
        {
            if (!present.ContainsKey(name))
            {
                violations.Add($"{Where($"{path}/{name}")}: поле обязательно по договору, но в ответе его нет");
            }
        }

        foreach (var (name, value) in present)
        {
            if (schema.Properties.TryGetValue(name, out var declared))
            {
                Check(declared, value, $"{path}/{name}", violations);
            }
            else if (schema.AdditionalPropertiesForbidden)
            {
                violations.Add(
                    $"{Where($"{path}/{name}")}: поле не объявлено договором, а схема запрещает лишние поля");
            }
        }
    }

    // Схема собирается в одно целое: ссылки раскрываются, ветви allOf
    // сливаются. Без слияния запрет лишних полей в одной ветви отверг бы поля
    // соседней — договор комбинирует Page и items именно так.
    private EffectiveSchema Flatten(IDictionary<object, object> schema)
    {
        var result = new EffectiveSchema();
        Absorb(schema, result);
        return result;
    }

    private void Absorb(IDictionary<object, object> schema, EffectiveSchema into)
    {
        schema = Resolve(schema);

        if (schema.TryGetValue("allOf", out var branches) && branches is IEnumerable<object> parts)
        {
            foreach (var part in parts)
            {
                Absorb((IDictionary<object, object>)part, into);
            }
        }

        into.Type ??= Text(schema, "type");
        into.Pattern ??= Text(schema, "pattern");
        into.Nullable |= Text(schema, "nullable") == "true";

        if (schema.TryGetValue("enum", out var values) && values is IEnumerable<object> allowed)
        {
            into.Enum ??= allowed.Select(value => value as string).ToList();
        }

        if (schema.TryGetValue("required", out var required) && required is IEnumerable<object> names)
        {
            foreach (var name in names.OfType<string>())
            {
                into.Required.Add(name);
            }
        }

        if (schema.TryGetValue("properties", out var properties) && properties is IDictionary<object, object> declared)
        {
            foreach (var (name, value) in declared)
            {
                into.Properties[(string)name] = (IDictionary<object, object>)value;
            }
        }

        if (schema.TryGetValue("items", out var items) && items is IDictionary<object, object> element)
        {
            into.Items ??= element;
        }

        // Скалярные значения YAML приходят строками: «false» здесь — это
        // additionalProperties: false договора, а не имя схемы.
        into.AdditionalPropertiesForbidden |= Text(schema, "additionalProperties") == "false";
    }

    private IDictionary<object, object> Resolve(IDictionary<object, object> schema)
    {
        while (Text(schema, "$ref") is { } reference)
        {
            var name = reference.Split('/').Last();
            schema = NamedSchema(name);
        }

        return schema;
    }

    private IDictionary<object, object> NamedSchema(string name)
    {
        var schemas = Map(Map(document, "components"), "schemas");

        return schemas.TryGetValue(name, out var schema)
            ? (IDictionary<object, object>)schema
            : throw new InvalidOperationException($"договор не объявляет схему {name}");
    }

    private IDictionary<object, object> ResponseSchema(string operationId, int statusCode)
    {
        var operation = Operations()
            .FirstOrDefault(candidate => Text(candidate, "operationId") == operationId)
            ?? throw new InvalidOperationException($"договор не объявляет операцию {operationId}");

        var responses = Map(operation, "responses");
        if (!responses.TryGetValue(statusCode.ToString(), out var response))
        {
            throw new InvalidOperationException(
                $"договор не объявляет у операции {operationId} ответ с кодом {statusCode}");
        }

        var content = Map((IDictionary<object, object>)response, "content");
        if (!content.TryGetValue("application/json", out var json))
        {
            throw new InvalidOperationException(
                $"договор не объявляет у ответа {operationId} {statusCode} тела application/json");
        }

        return Map((IDictionary<object, object>)json, "schema");
    }

    private IEnumerable<IDictionary<object, object>> Operations()
    {
        string[] methods = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];

        foreach (var item in Map(document, "paths").Values.Cast<IDictionary<object, object>>())
        {
            foreach (var (method, body) in item)
            {
                if (methods.Contains(((string)method).ToLowerInvariant()))
                {
                    yield return (IDictionary<object, object>)body;
                }
            }
        }
    }

    private static bool TypeMatches(string? declared, JsonElement node) => declared switch
    {
        "object" => node.ValueKind is JsonValueKind.Object,
        "array" => node.ValueKind is JsonValueKind.Array,
        "string" => node.ValueKind is JsonValueKind.String,
        "integer" => node.ValueKind is JsonValueKind.Number && node.TryGetInt64(out _),
        "number" => node.ValueKind is JsonValueKind.Number,
        "boolean" => node.ValueKind is JsonValueKind.True or JsonValueKind.False,
        _ => true,
    };

    private static string Scalar(JsonElement node)
        => node.ValueKind is JsonValueKind.String ? node.GetString()! : node.GetRawText();

    private static string Kind(JsonElement node) => node.ValueKind switch
    {
        JsonValueKind.Object => "объект",
        JsonValueKind.Array => "массив",
        JsonValueKind.String => "строка",
        JsonValueKind.Number => "число",
        JsonValueKind.True or JsonValueKind.False => "логическое значение",
        _ => "пустое значение",
    };

    private static string Where(string path) => path.Length == 0 ? "тело ответа" : $"поле «{path}»";

    private static IDictionary<object, object> Map(IDictionary<object, object> node, string key)
        => (IDictionary<object, object>)node[key];

    private static string? Text(IDictionary<object, object> node, string key)
        => node.TryGetValue(key, out var value) ? value as string : null;

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);

        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "trip.json")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName
            ?? throw new InvalidOperationException("Корень репозитория не найден: рядом нет trip.json");
    }

    private sealed class EffectiveSchema
    {
        public string? Type { get; set; }

        public string? Pattern { get; set; }

        public bool Nullable { get; set; }

        public List<string?>? Enum { get; set; }

        public HashSet<string> Required { get; } = new(StringComparer.Ordinal);

        public Dictionary<string, IDictionary<object, object>> Properties { get; } = new(StringComparer.Ordinal);

        public IDictionary<object, object>? Items { get; set; }

        public bool AdditionalPropertiesForbidden { get; set; }
    }
}
