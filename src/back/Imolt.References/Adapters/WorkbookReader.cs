using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using Imolt.References.Domain;
using Imolt.References.Ports;

// Имя Workbook занято и разметкой книги, и нашим разобранным листом. Псевдоним
// оставляет за коротким именем пакет, а наш тип называет прямо: так видно, где
// кончается чужая разметка и начинается разобранное нами.
using ParsedWorkbook = Imolt.References.Domain.Workbook;

namespace Imolt.References.Adapters;

/// Чтение книги Excel пакетом Open XML SDK (R-045).
///
/// Библиотека выбрана по лицензии и сопровождению, а не по привычке: карточка
/// практики PRACT-033 прямо запрещает делать имя библиотеки нормой и требует
/// проверки лицензии. Open XML SDK идёт под MIT и сопровождается тем же, кто
/// издаёт формат. Рассмотренный первым NPOI несёт для двоичной поставки сбор
/// за сопровождение при годовой выручке от десяти тысяч долларов, а ИМОЛТ —
/// действующий бизнес; по этому же признаку проект ранее отказался от
/// QuestPDF и ImageSharp.
///
/// Цена выбора названа честно: старый формат XLS Open XML SDK не читает.
/// Источник цен заказчика — таблица Google, её выгрузка даёт XLSX.
///
/// Макросы и внешние ссылки не исполняются: пакет разбирает разметку, а не
/// вычисляет книгу. Сохранённые значения формул сюда доходят, но отвергаются
/// разбором — значение формулы посчитал не сервис (правило зоны домена).
///
/// @req: R-045
/// @adr: ADR-0005
public sealed class WorkbookReader : IWorkbookReader
{
  public ParsedWorkbook Read(Stream content)
  {
    using var document = Open(content);

    var workbookPart = document.WorkbookPart
        ?? throw new WorkbookRefusedException("В файле нет книги", unsupportedMedia: true);

    // Берётся первый лист. Книга менеджера данных нередко несёт соседние
    // листы с заметками, и собрать данные со всех — значит применить то,
    // чего никто не показывал.
    var sheet = workbookPart.Workbook?.Sheets?.Elements<Sheet>().FirstOrDefault()
        ?? throw new WorkbookRefusedException("В книге нет листов", unsupportedMedia: false);

    var identifier = sheet.Id?.Value
        ?? throw new WorkbookRefusedException("Лист книги повреждён", unsupportedMedia: false);

    if (workbookPart.GetPartById(identifier) is not WorksheetPart worksheet)
    {
      throw new WorkbookRefusedException("Лист книги повреждён", unsupportedMedia: false);
    }

    var strings = workbookPart.SharedStringTablePart?.SharedStringTable;
    var rows = worksheet.Worksheet?.Descendants<Row>().ToList() ?? [];

    if (rows.Count == 0)
    {
      throw new WorkbookRefusedException("Лист книги пуст", unsupportedMedia: false);
    }

    var headers = Cells(rows[0], strings).Select(cell => cell.Text).ToList();

    return new ParsedWorkbook(
        headers,
        rows.Skip(1)
            .Select(row => new WorkbookRow((int)(row.RowIndex?.Value ?? 0), Cells(row, strings)))
            .ToList());
  }

  private static SpreadsheetDocument Open(Stream content)
  {
    try
    {
      return SpreadsheetDocument.Open(content, isEditable: false);
    }
    catch (OpenXmlPackageException exception)
    {
      // Файл прошёл проверку сигнатуры, но книгой не оказался: это по-прежнему
      // вопрос формата, а не содержимого.
      throw new WorkbookRefusedException(
          "Файл не открывается как книга Excel: " + exception.Message, unsupportedMedia: true);
    }
    catch (FileFormatException exception)
    {
      throw new WorkbookRefusedException(
          "Файл не открывается как книга Excel: " + exception.Message, unsupportedMedia: true);
    }
  }

  /// Ячейки строки по местам столбцов. Разметка пропускает пустые ячейки
  /// вовсе, поэтому место столбца берётся из имени ячейки, а не из порядка
  /// её появления: иначе пустая ячейка сдвигает всю строку влево.
  private static List<WorkbookCell> Cells(Row row, SharedStringTable? strings)
  {
    var cells = new List<WorkbookCell>();

    foreach (var cell in row.Elements<Cell>())
    {
      var column = ColumnOf(cell.CellReference?.Value);

      while (cells.Count < column)
      {
        cells.Add(new WorkbookCell(string.Empty, false));
      }

      cells.Add(new WorkbookCell(Text(cell, strings), cell.CellFormula is not null));
    }

    return cells;
  }

  private static string Text(Cell cell, SharedStringTable? strings)
  {
    if (cell.DataType?.Value == CellValues.SharedString)
    {
      return int.TryParse(cell.CellValue?.Text, out var index)
          && strings?.ElementAtOrDefault(index) is SharedStringItem item
          ? item.InnerText
          : string.Empty;
    }

    return cell.DataType?.Value == CellValues.InlineString
        ? cell.InlineString?.InnerText ?? string.Empty
        : cell.CellValue?.Text ?? string.Empty;
  }

  /// Номер столбца из имени ячейки: «C7» — третий столбец, считая с нуля он
  /// второй. Имя может отсутствовать у повреждённой разметки — тогда ячейка
  /// становится следующей по порядку.
  private static int ColumnOf(string? reference)
  {
    if (string.IsNullOrEmpty(reference))
    {
      return -1;
    }

    var column = 0;

    foreach (var letter in reference)
    {
      if (!char.IsAsciiLetter(letter))
      {
        break;
      }

      column = (column * 26) + (char.ToUpperInvariant(letter) - 'A' + 1);
    }

    return column - 1;
  }
}
