using System.Globalization;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;

namespace Imolt.Api.Tests;

/// Вид ячейки книги. Различается не для удобства, а потому что схема разбора
/// обходится с этими видами по-разному: число применяется, слово вместо числа
/// и сохранённое значение формулы — отклоняются построчно.
internal enum WorkbookCellKind
{
  /// Ячейки нет вовсе. Пустой ключ — один из объявленных схемой отказов.
  Empty,

  /// Строковое значение: название, идентификатор, код ФККО, а также цена,
  /// записанная словом.
  Text,

  /// Число, записанное числом.
  Number,

  /// Ячейка с формулой и сохранённым значением. Сохранённому значению
  /// сервер не доверяет: его считал не он, и подложить туда можно что угодно.
  Formula,
}

/// Ячейка книги в том виде, в каком её кладёт сборщик. Значение хранится
/// строкой: в XML книги оно строкой и лежит, а промежуточный разбор здесь
/// проверял бы сборщик, а не то, что получит служба.
internal sealed record WorkbookCell(WorkbookCellKind Kind, string Value, string? FormulaText)
{
  /// Ячейки нет: столбец в строке пропущен.
  public static WorkbookCell Empty { get; } = new(WorkbookCellKind.Empty, string.Empty, null);

  /// Строковое значение как есть.
  public static WorkbookCell Text(string value) => new(WorkbookCellKind.Text, value, null);

  /// Число, записанное числом. Инвариантная культура обязательна: в XML книги
  /// разделитель дробной части — точка независимо от локали, и запятая
  /// русской локали сделала бы файл неразбираемым для любого читателя.
  public static WorkbookCell Number(decimal value)
      => new(WorkbookCellKind.Number, value.ToString(CultureInfo.InvariantCulture), null);

  /// Ячейка с формулой. Сохранённое значение задаётся отдельно, потому что
  /// проверке важно именно расхождение: формула в ячейке отклоняется даже
  /// тогда, когда сохранённое рядом число выглядит правдоподобным.
  public static WorkbookCell Formula(string formula, decimal cachedValue)
      => new(WorkbookCellKind.Formula, cachedValue.ToString(CultureInfo.InvariantCulture), formula);
}

/// Сборщик книги Excel в память для проверок импорта справочника.
///
/// Книга собирается проверкой, а не лежит файлом рядом: двоичный файл в
/// репозитории не читается на ревью, его нельзя поправить построчно, и
/// сгенерированное проект не версионирует. Здесь же каждая строка книги
/// названа тем, что она проверяет.
///
/// Форма книги — схема версии 1, закреплённая за срезом: первый лист,
/// заголовки в строке 1, сопоставление заголовка без учёта регистра и по
/// части до первой запятой. Схема живёт вне договора — договор задаёт только
/// `multipart/form-data` и поле `kind`, — и расхождение названо в отчёте
/// среза.
///
internal sealed class WorkbookBuilder
{
  /// Тип содержимого книги Excel. Расширения имени файла для отказа
  /// недостаточно (AC-045e), но заявленный тип отправлять всё равно нужно:
  /// проверяется разбор содержимого, а не разбор заголовка.
  public const string MediaType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  /// Заголовок ключевого столбца групп отходов и полигонов.
  public const string IdentifierColumn = "Идентификатор";

  public const string NameColumn = "Название";

  /// Заголовок с запятой и единицей измерения — так его пишет человек в
  /// выгрузке. На нём проверяется правило схемы «сравнивается часть до первой
  /// запятой»: совпасть он обязан с «Цена перевозки».
  public const string TransportPriceColumn = "Цена перевозки, руб/т·км";

  public const string DensityColumn = "Плотность";

  /// Столбец кодов каталога ФККО. Распознаётся, но не применяется: редакция
  /// каталога не сверена (Q-015).
  public const string FkkoCodesColumn = "Коды ФККО";

  /// Имя первого листа. Читается только он — остальные листы схема разбора
  /// не читает.
  private const string SheetName = "Справочник";

  private readonly List<IReadOnlyList<WorkbookCell>> rows = [];

  /// Строки книги по порядку первого появления. Заполняется только в записи
  /// табличного редактора: в ней текст ячейки лежит не в самой ячейке, а
  /// номером строки этой таблицы.
  private readonly List<string> shared = [];

  private bool editorStyle;

  private WorkbookBuilder(IReadOnlyList<string> headers)
      => rows.Add(headers.Select(WorkbookCell.Text).ToList());

  /// Книга с объявленными заголовками в первой строке.
  public static WorkbookBuilder WithHeaders(params string[] headers) => new(headers);

  /// Записать книгу так, как её пишет табличный редактор: текст — через общую
  /// таблицу строк, число — без явного признака типа.
  ///
  /// Это не вариант оформления, а единственная запись, которую сервис увидит
  /// в жизни: и Excel, и выгрузка таблицы Google кладут текст только в общую
  /// таблицу, а признак типа у числа опускают — «n» и так значение по
  /// умолчанию. Встроенная строка остаётся по умолчанию у прочих проверок:
  /// там она короче и к проверяемому критерию отношения не имеет.
  public WorkbookBuilder AsSpreadsheetEditorWrites()
  {
    editorStyle = true;

    return this;
  }

  /// Строка книги. Ячейки идут по порядку столбцов заголовка; пропущенный
  /// столбец задаётся WorkbookCell.Empty.
  public WorkbookBuilder Row(params WorkbookCell[] cells)
  {
    rows.Add(cells);

    return this;
  }

  /// Готовая книга байтами. Собирается целиком в памяти: временный файл на
  /// диске пережил бы прогон и сделал бы следующий зависимым от предыдущего.
  public byte[] Build()
  {
    using var stream = new MemoryStream();

    using (var document = SpreadsheetDocument.Create(stream, SpreadsheetDocumentType.Workbook))
    {
      var workbookPart = document.AddWorkbookPart();
      workbookPart.Workbook = new Workbook();

      var worksheetPart = workbookPart.AddNewPart<WorksheetPart>();
      var sheetData = new SheetData();
      worksheetPart.Worksheet = new Worksheet(sheetData);

      var sheets = workbookPart.Workbook.AppendChild(new Sheets());
      sheets.Append(new Sheet
      {
        Id = workbookPart.GetIdOfPart(worksheetPart),
        SheetId = 1U,
        Name = SheetName,
      });

      for (var index = 0; index < rows.Count; index++)
      {
        // Нумерация строк листа начинается с единицы, и заголовки занимают
        // первую: номер строки данных в книге на единицу больше её номера
        // среди данных. Именно этот номер критерий AC-045b требует назвать в
        // отказе.
        var rowIndex = (uint)(index + 1);
        var row = new Row { RowIndex = rowIndex };

        for (var column = 0; column < rows[index].Count; column++)
        {
          var cell = Build(
              rows[index][column],
              ColumnName(column) + rowIndex.ToString(CultureInfo.InvariantCulture));

          if (cell is not null)
          {
            row.Append(cell);
          }
        }

        sheetData.Append(row);
      }

      if (editorStyle)
      {
        // Таблица строк кладётся после обхода строк: до него неизвестно, что
        // в неё попадёт. Порядок частей в книге на чтение не влияет — часть
        // ищется по своему виду, а не по месту.
        var stringsPart = workbookPart.AddNewPart<SharedStringTablePart>();
        stringsPart.SharedStringTable = new SharedStringTable(
            shared.Select(value => new SharedStringItem(new Text(value))));
        stringsPart.SharedStringTable.Save();
      }

      workbookPart.Workbook.Save();
    }

    return stream.ToArray();
  }

  // Ячейка листа. По умолчанию строки кладутся встроенными: общая таблица
  // строк — отдельный шов, на котором разбор может сломаться по причине, к
  // проверяемому критерию отношения не имеющей. Записью табличного редактора
  // этот шов проверяется отдельно и нарочно.
  private Cell? Build(WorkbookCell source, string reference) => source.Kind switch
  {
    WorkbookCellKind.Empty => null,
    WorkbookCellKind.Text when editorStyle => new Cell
    {
      CellReference = reference,
      DataType = CellValues.SharedString,
      CellValue = new CellValue(SharedIndex(source.Value).ToString(CultureInfo.InvariantCulture)),
    },
    WorkbookCellKind.Text => new Cell
    {
      CellReference = reference,
      DataType = CellValues.InlineString,
      InlineString = new InlineString(new Text(source.Value)),
    },

    // Признак типа у числа опущен: табличный редактор его не пишет, потому
    // что «n» — значение по умолчанию. Разбор, опирающийся на явный признак,
    // на таком файле молча прочтёт пустоту.
    WorkbookCellKind.Number when editorStyle => new Cell
    {
      CellReference = reference,
      CellValue = new CellValue(source.Value),
    },
    WorkbookCellKind.Number => new Cell
    {
      CellReference = reference,
      DataType = CellValues.Number,
      CellValue = new CellValue(source.Value),
    },
    WorkbookCellKind.Formula => new Cell
    {
      CellReference = reference,
      DataType = CellValues.Number,
      CellFormula = new CellFormula(source.FormulaText ?? string.Empty),
      CellValue = new CellValue(source.Value),
    },
    _ => null,
  };

  // Место строки в общей таблице. Повторяющийся текст кладётся один раз —
  // ради этого таблица и заведена в формате, и разбор обязан читать её так же.
  private int SharedIndex(string value)
  {
    var index = shared.IndexOf(value);

    if (index >= 0)
    {
      return index;
    }

    shared.Add(value);

    return shared.Count - 1;
  }

  // Имя столбца листа по его порядковому номеру: 0 — «A», 26 — «AA».
  private static string ColumnName(int index)
  {
    var name = string.Empty;
    var current = index;

    do
    {
      name = (char)('A' + (current % 26)) + name;
      current = (current / 26) - 1;
    }
    while (current >= 0);

    return name;
  }
}
