using Imolt.References.Domain;
using Xunit;

namespace Imolt.Domain.Tests;

/// Разбор книги справочника: что принимается, что отвергается и по какой
/// причине (R-045).
///
/// Проверка модульная намеренно. Правила разбора решают, какая цена попадёт в
/// справочник, а оттуда — в коммерческое предложение клиенту; проверять их
/// только через поднятую базу и HTTP значит проверять их реже и грубее.
/// Схему книги договор не задаёт, поэтому она закреплена доменом, и падать
/// эта проверка обязана при всякой её молчаливой правке.
///
/// Проверка фальсифицируема: она падает, если разбор начнёт доверять
/// сохранённому значению формулы, если отвергнутая строка перестанет
/// называть номер и причину, если испорченное значение снимет всю строку
/// целиком и если столбец кодов ФККО начнёт применяться вопреки Q-015.
///
///   dotnet test tests/unit/Imolt.Domain.Tests
///
/// @ac: AC-045b, AC-045f
public sealed class WorkbookInterpreterTests
{
  private static readonly WorkbookSchema Groups = WorkbookSchema.For(ReferenceImportKind.WasteGroups);

  [Fact(DisplayName = "обычная строка даёт значение для записи и поля договора")]
  public void PlainRowBecomesCandidate()
  {
    var interpreted = WorkbookInterpreter.Interpret(
        Book([Row(2, "beton-lom", "32,50")]),
        Groups);

    var candidate = Assert.Single(interpreted.Candidates);

    Assert.Equal("beton-lom", candidate.EntityId);
    Assert.Equal("transportPricePerTonKm", candidate.Field);

    // Запятая — обычный разделитель в книге менеджера данных, и она обязана
    // приводиться к тому же виду, в каком величина придёт из базы.
    Assert.Equal("32.5", candidate.Value);
    Assert.Empty(interpreted.Rejections);
  }

  [Fact(DisplayName = "ячейка с формулой отвергается, а её значение не применяется")]
  public void FormulaCellIsRefused()
  {
    var interpreted = WorkbookInterpreter.Interpret(
        Book([new WorkbookRow(7, [Cell("beton-lom"), new WorkbookCell("99", IsFormula: true)])]),
        Groups);

    // AC-045b: сохранённое значение формулы посчитал не сервис, и доверять
    // ему нельзя — иначе в справочник попадёт цена, которую никто не вводил.
    Assert.Empty(interpreted.Candidates);

    var rejection = Assert.Single(interpreted.Rejections);
    Assert.Equal(7, rejection.Row);
    Assert.Equal(ImportRejections.Formula, rejection.Reason);
  }

  [Fact(DisplayName = "цена словом отвергается с номером строки")]
  public void WordInsteadOfPriceIsRefused()
  {
    var interpreted = WorkbookInterpreter.Interpret(
        Book([Row(4, "beton-lom", "по запросу")]),
        Groups);

    Assert.Empty(interpreted.Candidates);
    Assert.Equal(4, Assert.Single(interpreted.Rejections).Row);
    Assert.Equal(ImportRejections.NotANumber, interpreted.Rejections[0].Reason);
  }

  [Fact(DisplayName = "отрицательная цена отвергается отдельной причиной")]
  public void NegativePriceIsRefused()
  {
    var interpreted = WorkbookInterpreter.Interpret(
        Book([Row(5, "beton-lom", "-10")]),
        Groups);

    Assert.Empty(interpreted.Candidates);
    Assert.Equal(ImportRejections.Negative, Assert.Single(interpreted.Rejections).Reason);
  }

  [Fact(DisplayName = "пустой ключ снимает строку целиком")]
  public void EmptyKeyRefusesTheWholeRow()
  {
    var interpreted = WorkbookInterpreter.Interpret(
        Book([Row(6, "   ", "32")]),
        Groups);

    Assert.Empty(interpreted.Candidates);
    Assert.Equal(ImportRejections.EmptyKey, Assert.Single(interpreted.Rejections).Reason);
  }

  [Fact(DisplayName = "испорченное значение снимает себя, а не всю строку")]
  public void BadValueDoesNotRefuseNeighbours()
  {
    var book = new Workbook(
        ["Идентификатор", "Название", "Цена перевозки"],
        [new WorkbookRow(3, [Cell("beton-lom"), Cell("Лом бетона"), Cell("по запросу")])]);

    var interpreted = WorkbookInterpreter.Interpret(book, Groups);

    // Рабочая книга несёт столбцы, которые импорт не применяет по разным
    // причинам. Снимать из-за одного такого столбца всю строку значит не
    // импортировать ничего.
    var candidate = Assert.Single(interpreted.Candidates);
    Assert.Equal("name", candidate.Field);
    Assert.Equal(ImportRejections.NotANumber, Assert.Single(interpreted.Rejections).Reason);
  }

  [Fact(DisplayName = "столбец кодов ФККО называется отказом, но соседние поля применяются")]
  public void FkkoColumnIsWithheldWithoutRefusingTheRow()
  {
    var book = new Workbook(
        ["Идентификатор", "Цена перевозки", "Коды ФККО"],
        [new WorkbookRow(2, [Cell("beton-lom"), Cell("32"), Cell("8 22 101 01 21 5")])]);

    var interpreted = WorkbookInterpreter.Interpret(book, Groups);

    // AC-045f: редакция каталога не сверена (Q-015), поэтому коды импортом не
    // применяются. Причина названа вслух: молча пропущенный столбец читается
    // как «импортировалось», и расхождение всплывёт позже.
    Assert.Equal(ImportRejections.FkkoCodesWithheld, Assert.Single(interpreted.Rejections).Reason);
    Assert.Equal("transportPricePerTonKm", Assert.Single(interpreted.Candidates).Field);
  }

  [Fact(DisplayName = "заголовок с единицей измерения и в другом регистре распознаётся")]
  public void HeaderWithUnitIsRecognised()
  {
    var book = new Workbook(
        ["  ИДЕНТИФИКАТОР ", "Цена перевозки, руб/т·км"],
        [new WorkbookRow(2, [Cell("beton-lom"), Cell("32")])]);

    var interpreted = WorkbookInterpreter.Interpret(book, Groups);

    Assert.Empty(interpreted.MissingHeaders);
    Assert.Equal("transportPricePerTonKm", Assert.Single(interpreted.Candidates).Field);
  }

  [Fact(DisplayName = "книга без ключевого столбца отвергается до разбора строк")]
  public void MissingKeyColumnRefusesTheSheet()
  {
    var book = new Workbook(
        ["Название", "Цена перевозки"],
        [new WorkbookRow(2, [Cell("Лом бетона"), Cell("32")])]);

    var interpreted = WorkbookInterpreter.Interpret(book, Groups);

    // Отказ структурный, а не построчный: без ключа применять значения некуда,
    // и перечислять то же самое по каждой строке — шум.
    Assert.Equal("идентификатор", Assert.Single(interpreted.MissingHeaders));
    Assert.Empty(interpreted.Candidates);
    Assert.Empty(interpreted.Rejections);
  }

  [Fact(DisplayName = "ключ тарифа собирается из пары столбцов")]
  public void TariffKeyIsAPair()
  {
    var book = new Workbook(
        ["Полигон", "Группа отходов", "Цена утилизации"],
        [new WorkbookRow(2, [Cell("vostok-timohovo"), Cell("beton-lom"), Cell("480")])]);

    var interpreted = WorkbookInterpreter.Interpret(
        book, WorkbookSchema.For(ReferenceImportKind.Tariffs));

    // Тариф — ячейка таблицы «полигон и группа отходов», и одного столбца для
    // него мало: иначе два тарифа одного полигона сольются в один.
    Assert.Equal("vostok-timohovo/beton-lom", Assert.Single(interpreted.Candidates).EntityId);
  }

  private static Workbook Book(IReadOnlyList<WorkbookRow> rows)
      => new(["Идентификатор", "Цена перевозки"], rows);

  private static WorkbookRow Row(int number, string id, string price)
      => new(number, [Cell(id), Cell(price)]);

  private static WorkbookCell Cell(string text) => new(text, IsFormula: false);
}

/// Отпечаток затронутых импортом значений: он решает, устарел ли предпросмотр
/// (R-045).
///
/// Проверка фальсифицируема: она падает, если отпечаток начнёт зависеть от
/// порядка строк (база вправе вернуть их как ей удобно), если перестанет
/// различать пустое значение и отсутствующее поле и если правка затронутого
/// значения перестанет его менять.
///
///   dotnet test tests/unit/Imolt.Domain.Tests
///
/// @ac: AC-045d
public sealed class ImportSnapshotTests
{
  [Fact(DisplayName = "отпечаток не зависит от порядка значений")]
  public void SnapshotIgnoresOrder()
  {
    (string, string, string?)[] straight =
    [
        ("beton-lom", "transportPricePerTonKm", "12"),
        ("drevesina", "transportPricePerTonKm", "16"),
    ];

    (string, string, string?)[] reversed =
    [
        ("drevesina", "transportPricePerTonKm", "16"),
        ("beton-lom", "transportPricePerTonKm", "12"),
    ];

    Assert.Equal(ImportSnapshot.Of(straight), ImportSnapshot.Of(reversed));
  }

  [Fact(DisplayName = "правка затронутого значения меняет отпечаток")]
  public void ChangedValueChangesSnapshot()
  {
    var before = ImportSnapshot.Of([("beton-lom", "transportPricePerTonKm", "12")]);
    var after = ImportSnapshot.Of([("beton-lom", "transportPricePerTonKm", "13")]);

    // Ровно на этом держится отказ 409: предпросмотр считался на «12», и
    // применить его поверх «13» значит тихо отменить чужую правку.
    Assert.NotEqual(before, after);
  }

  [Fact(DisplayName = "пустое значение отличается от значения из пробела")]
  public void EmptyIsNotBlank()
  {
    var missing = ImportSnapshot.Of([("beton-lom", "legalEntity", null)]);
    var blank = ImportSnapshot.Of([("beton-lom", "legalEntity", " ")]);

    Assert.NotEqual(missing, blank);
  }
}
