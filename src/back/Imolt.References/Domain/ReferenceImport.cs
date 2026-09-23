using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Imolt.References.Domain;

/// Разбор книги справочника: что сервис соглашается прочитать и что отвергает
/// до предметной записи (R-045).
///
/// Схема книги договором не задана — договор знает только вид справочника и
/// форму предпросмотра. Поэтому схема закреплена здесь, в одном месте, и
/// версионируется вместе с кодом: разбор, разошедшийся со схемой в голове
/// менеджера данных, молча перезапишет цены не теми значениями.
///
/// Карточка практики PRACT-033 требует отделить структурную проверку от
/// предметного применения и не доверять сохранённым значениям формул. Здесь
/// живёт первая половина: структура, типы и причины отказа. Предметное
/// применение — в зоне приложения.
///
/// @req: R-045
/// @adr: ADR-0005
public static class ReferenceImportKind
{
  public const string WasteGroups = "wasteGroups";

  public const string Landfills = "landfills";

  public const string Tariffs = "tariffs";

  public static bool Known(string? kind)
      => kind is WasteGroups or Landfills or Tariffs;
}

/// Ячейка книги в том виде, в каком её отдаёт читатель: текст и признак того,
/// что за текстом стоит формула.
///
/// Признак формулы отделён намеренно. Книга хранит вместе с формулой её
/// последнее вычисленное значение, и это значение мог посчитать кто угодно и
/// когда угодно — принять его означало бы записать в справочник цену, которую
/// никто не подтверждал.
public sealed record WorkbookCell(string Text, bool IsFormula);

public sealed record WorkbookRow(int Number, IReadOnlyList<WorkbookCell> Cells);

/// Прочитанный лист книги. Читается только первый лист: книга менеджера
/// данных нередко несёт соседние листы с заметками, и молча собрать данные из
/// всех — значит применить то, чего никто не показывал.
public sealed record Workbook(IReadOnlyList<string> Headers, IReadOnlyList<WorkbookRow> Rows);

/// Ресурсные пределы разбора. Книга приходит снаружи и доверенной не
/// считается: без пределов один файл занимает память службы целиком.
public static class WorkbookLimits
{
  public const int MaximalBytes = 2 * 1024 * 1024;

  public const int MaximalRows = 5000;

  /// Сигнатура контейнера ZIP, с которого начинается всякая книга нового
  /// формата. Расширение имени файла ни о чём не говорит: переименовать можно
  /// что угодно, а подделать начало контейнера — уже не «случайно не тот
  /// файл».
  public static ReadOnlySpan<byte> ZipSignature => [0x50, 0x4B, 0x03, 0x04];

  public static bool LooksLikeWorkbook(ReadOnlySpan<byte> head)
      => head.Length >= 4 && head[..4].SequenceEqual(ZipSignature);
}

/// Причины, по которым строка не применяется. Текст читает менеджер данных и
/// по нему правит книгу, поэтому причина называет, что именно не так, а не
/// «ошибка разбора».
public static class ImportRejections
{
  public const string UnknownEntity = "записи с таким идентификатором в справочнике нет; импорт меняет существующие записи и не заводит новые";

  public const string Formula = "в ячейке формула; сохранённому значению формулы сервис не доверяет — впишите число";

  public const string NotANumber = "значение не разбирается как число";

  public const string Negative = "цена не может быть отрицательной";

  public const string EmptyKey = "не заполнен столбец, определяющий запись";

  /// Коды каталога ФККО не применяются, пока не сверена редакция каталога
  /// (Q-015). Отказ назван строкой, а не умолчанием: молча пропущенный
  /// столбец читается как «импортировалось», и расхождение всплывёт позже.
  public const string FkkoCodesWithheld = "коды ФККО импортом не применяются: редакция каталога не сверена, правьте их поштучно в редакторе";
}

/// Схема книги для одного вида справочника: какие заголовки сервис понимает и
/// в какое поле договора ложится каждый столбец.
///
/// Имена полей взяты из договора (`transportPricePerTonKm` и прочие), а не
/// придуманы заново: предпросмотр читает тот же клиент, что и карточку записи,
/// и два имени одного поля развели бы его надвое.
public sealed class WorkbookSchema
{
  public const string FkkoCodesHeader = "коды фкко";

  private WorkbookSchema(
      IReadOnlyList<string> keyHeaders,
      IReadOnlyDictionary<string, ImportField> fields)
  {
    KeyHeaders = keyHeaders;
    Fields = fields;
  }

  /// Столбцы, определяющие запись. У тарифа их два: тариф — это ячейка
  /// таблицы «полигон и группа отходов», и одного столбца для неё мало.
  public IReadOnlyList<string> KeyHeaders { get; }

  public IReadOnlyDictionary<string, ImportField> Fields { get; }

  public static WorkbookSchema For(string kind) => kind switch
  {
    ReferenceImportKind.WasteGroups => new WorkbookSchema(
        ["идентификатор"],
        new Dictionary<string, ImportField>(StringComparer.Ordinal)
        {
          ["название"] = new("name", ImportValueKind.Text),
          ["цена перевозки"] = new("transportPricePerTonKm", ImportValueKind.Money),
          ["плотность"] = new("densityTonPerCubicMeter", ImportValueKind.Number),
        }),
    ReferenceImportKind.Landfills => new WorkbookSchema(
        ["идентификатор"],
        new Dictionary<string, ImportField>(StringComparer.Ordinal)
        {
          ["название"] = new("name", ImportValueKind.Text),
          ["юрлицо"] = new("legalEntity", ImportValueKind.Text),
          ["адрес"] = new("address", ImportValueKind.Text),
        }),
    ReferenceImportKind.Tariffs => new WorkbookSchema(
        ["полигон", "группа отходов"],
        new Dictionary<string, ImportField>(StringComparer.Ordinal)
        {
          ["цена утилизации"] = new("disposalPricePerTon", ImportValueKind.Money),
        }),
    _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "вид справочника не объявлен договором"),
  };

  /// Приведение заголовка к сравнимому виду: регистр и обрамляющие пробелы не
  /// значимы, а хвост после запятой — единица измерения для человека
  /// («Цена перевозки, руб/т·км»), и на выбор столбца он не влияет.
  public static string Normalize(string header)
  {
    var comma = header.IndexOf(',', StringComparison.Ordinal);
    var head = comma >= 0 ? header[..comma] : header;

    return head.Trim().ToLowerInvariant();
  }
}

public enum ImportValueKind
{
  Text,
  Money,
  Number,
}

public sealed record ImportField(string Name, ImportValueKind Kind);

/// Чтение чисел из книги русской локалью. Менеджер данных набирает цену то с
/// запятой, то с точкой, а выгрузка из таблицы приносит разделители разрядов —
/// отвергать за это значит спорить с файлом, а не проверять его.
public static class ImportValues
{
  public static decimal? Number(string text)
  {
    // Пробелы выбрасываются все подряд, включая неразрывный: выгрузка из
    // таблицы разделяет разряды именно им, а записать его в исходном тексте
    // видимым знаком нельзя — невидимый символ в коде хуже лишней проверки.
    var cleaned = new string(text.Where(symbol => !char.IsWhiteSpace(symbol)).ToArray())
        .Replace(',', '.');

    return decimal.TryParse(
        cleaned,
        NumberStyles.Float,
        CultureInfo.InvariantCulture,
        out var value)
        ? value
        : null;
  }

  /// Запись величины в предпросмотре и в отпечатке. Инвариантная культура
  /// обязательна: предпросмотр сравнивается с пересчитанным отпечатком, и
  /// культура машины не должна влиять на то, устарел он или нет.
  public static string Text(decimal value) => value.ToString("0.####", CultureInfo.InvariantCulture);
}

/// Значение, которое книга предлагает записать: запись, поле и величина в том
/// виде, в каком она пойдёт на сравнение со справочником.
public sealed record ImportCandidate(string EntityId, string Field, string Value);

public sealed record ImportRejection(int Row, string Reason);

/// Итог разбора листа: что книга предлагает записать и что из неё не
/// применяется. Отсутствующие обязательные заголовки названы отдельно: это
/// отказ структурного уровня, а не отказ по строкам.
public sealed record InterpretedWorkbook(
    IReadOnlyList<string> MissingHeaders,
    IReadOnlyList<ImportCandidate> Candidates,
    IReadOnlyList<ImportRejection> Rejections);

/// Разбор листа по схеме вида справочника.
///
/// Правило отказов двухуровневое, и различие существенно. Испорченный ключ
/// (пустой либо ссылающийся на запись, которой нет) снимает строку целиком:
/// без записи применять значения некуда. Испорченное значение снимает только
/// себя: в рабочей книге менеджера данных рядом со ценой стоят столбцы,
/// которые импорт не применяет по другим причинам, и снимать из-за них всю
/// строку значило бы не импортировать ничего.
///
/// @req: R-045
public static class WorkbookInterpreter
{
  public static InterpretedWorkbook Interpret(Workbook workbook, WorkbookSchema schema)
  {
    var headers = workbook.Headers.Select(WorkbookSchema.Normalize).ToList();
    var missing = schema.KeyHeaders.Where(header => !headers.Contains(header)).ToList();

    if (missing.Count > 0)
    {
      return new InterpretedWorkbook(missing, [], []);
    }

    var keyColumns = schema.KeyHeaders.Select(header => headers.IndexOf(header)).ToList();
    var fkkoColumn = headers.IndexOf(WorkbookSchema.FkkoCodesHeader);
    var candidates = new List<ImportCandidate>();
    var rejections = new List<ImportRejection>();

    foreach (var row in workbook.Rows)
    {
      var keys = keyColumns.Select(column => Cell(row, column)).ToList();

      if (keys.Any(key => key.IsFormula || string.IsNullOrWhiteSpace(key.Text)))
      {
        rejections.Add(new ImportRejection(
            row.Number,
            keys.Any(key => key.IsFormula) ? ImportRejections.Formula : ImportRejections.EmptyKey));
        continue;
      }

      var entityId = string.Join('/', keys.Select(key => key.Text.Trim()));

      if (fkkoColumn >= 0 && !string.IsNullOrWhiteSpace(Cell(row, fkkoColumn).Text))
      {
        rejections.Add(new ImportRejection(row.Number, ImportRejections.FkkoCodesWithheld));
      }

      foreach (var (header, field) in schema.Fields)
      {
        var column = headers.IndexOf(header);

        if (column < 0)
        {
          continue;
        }

        var cell = Cell(row, column);

        // Пустая ячейка означает «в файле про это поле ничего не сказано».
        // Толковать её как «стереть значение» нельзя: в выгрузке из таблицы
        // пустых ячеек больше, чем заполненных.
        if (string.IsNullOrWhiteSpace(cell.Text))
        {
          continue;
        }

        if (cell.IsFormula)
        {
          rejections.Add(new ImportRejection(row.Number, ImportRejections.Formula));
          continue;
        }

        var value = Value(cell.Text, field.Kind);

        if (value.Reason is not null)
        {
          rejections.Add(new ImportRejection(row.Number, value.Reason));
          continue;
        }

        candidates.Add(new ImportCandidate(entityId, field.Name, value.Text!));
      }
    }

    return new InterpretedWorkbook([], candidates, rejections);
  }

  private static WorkbookCell Cell(WorkbookRow row, int column)
      => column >= 0 && column < row.Cells.Count ? row.Cells[column] : new WorkbookCell(string.Empty, false);

  private static (string? Text, string? Reason) Value(string text, ImportValueKind kind)
  {
    if (kind == ImportValueKind.Text)
    {
      return (text.Trim(), null);
    }

    var number = ImportValues.Number(text);

    if (number is null)
    {
      return (null, ImportRejections.NotANumber);
    }

    return number < 0
        ? (null, ImportRejections.Negative)
        : (ImportValues.Text(number.Value), null);
  }
}

/// Отпечаток затронутых импортом значений справочника.
///
/// Считается только по тем парам «запись и поле», которые импорт собирается
/// изменить. Отпечаток по всему справочнику объявлял бы предпросмотр
/// устаревшим из-за правки соседней записи, которой импорт не касается, —
/// и менеджер данных разбирал бы книгу заново без причины (R-045).
public static class ImportSnapshot
{
  public static string Of(IEnumerable<(string EntityId, string Field, string? Current)> values)
  {
    // Порядок закрепляется сортировкой: база вправе вернуть строки как ей
    // удобно, а отпечаток обязан совпасть при повторном чтении тех же данных.
    var ordered = values
        .OrderBy(value => value.EntityId, StringComparer.Ordinal)
        .ThenBy(value => value.Field, StringComparer.Ordinal)
        .Select(value => $"{value.EntityId}\u001F{value.Field}\u001F{value.Current ?? string.Empty}");

    return Convert.ToHexStringLower(
        SHA256.HashData(Encoding.UTF8.GetBytes(string.Join('\u001E', ordered))));
  }
}
