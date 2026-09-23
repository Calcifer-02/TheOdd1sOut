using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Импорт справочника из книги: загрузка разбирает файл и показывает
/// расхождения, подтверждение их применяет. Два шага, а не один, потому что
/// молчаливая перезапись цен файлом не откатывается взглядом.
///
/// Импорт меняет только существующие записи: заведение полигонов идёт из
/// официального перечня (R-046), а условия обмена с АИС ОССиГ не установлены
/// (Q-017). Коды ФККО импорт не трогает — редакция каталога не сверена
/// (Q-015).
///
/// Форма книги — схема версии 1, закреплённая за срезом и собранная
/// WorkbookBuilder: первый лист, заголовки в строке 1, сопоставление по части
/// заголовка до первой запятой. Договор эту форму не задаёт; расхождение
/// названо в отчёте среза, а не восполнено догадкой в каждой проверке
/// по-своему.
///
/// Проверка фальсифицируема: она падает, если загрузка меняет справочник до
/// подтверждения; если неразобранная строка попадает в расхождения или
/// теряет номер и причину; если подтверждение применяет не то число
/// изменений; если предпросмотр можно применить дважды или применить поверх
/// более поздней правки редактора; если книгой считается всякий файл с
/// подходящим расширением; и если столбец кодов ФККО всё-таки применяется.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-045a, AC-045b, AC-045c, AC-045d, AC-045e, AC-045f, AC-045g
[Collection(ImoltReferenceEditorCollection.Name)]
public sealed class ReferenceImportTests(ImoltReferenceEditorStand stand)
{
  /// Вид загружаемого справочника из перечня договора.
  private const string WasteGroupsKind = "wasteGroups";

  /// Имя поля группы отходов, под которым цена перевозки названа договором.
  /// Схема разбора версии 1 сопоставляет с ним столбец «Цена перевозки»;
  /// договор имён полей расхождения не задаёт вовсе.
  private const string TransportPriceField = "transportPricePerTonKm";

  private const string StalePreview = "urn:imolt:problem:stale-preview";

  private const string UnsupportedMediaType = "urn:imolt:problem:unsupported-media-type";

  private const string RoleRequired = "urn:imolt:problem:role-required";

  [Fact(DisplayName = "загрузка книги показывает расхождения и справочник не меняет")]
  public async Task UploadShowsDifferencesAndChangesNothing()
  {
    var book = WorkbookBuilder
        .WithHeaders(WorkbookBuilder.IdentifierColumn, WorkbookBuilder.TransportPriceColumn)
        .Row(
            WorkbookCell.Text(ImoltReferenceEditorStand.PreviewGroupId),
            WorkbookCell.Number(30.00m))
        .Build();

    using var preview = await UploadAsync(book, "gruppy-othodov.xlsx");

    var changes = ChangesOf(preview.RootElement, ImoltReferenceEditorStand.PreviewGroupId);
    Assert.True(
        changes.Count == 1,
        $"расхождение по группе {ImoltReferenceEditorStand.PreviewGroupId} названо {changes.Count} раз(а), а в книге оно одно");

    var change = changes[0];

    // Критерий требует назвать четыре вещи: запись, поле, текущее значение и
    // значение из файла. Без поля и текущего значения предпросмотр
    // показывает «что-то изменится», и решать по нему нечего.
    Assert.Equal(TransportPriceField, change.GetProperty("field").GetString());
    Assert.Equal(
        25.00m,
        MoneyOf(change.GetProperty("currentValue").GetString(), "текущее значение расхождения"));
    Assert.Equal(
        30.00m,
        MoneyOf(change.GetProperty("fileValue").GetString(), "значение расхождения из файла"));

    // Справочник не тронут: в этом и состоит разделение на два шага.
    Assert.Equal(ImoltReferenceEditorStand.PreviewGroupPrice, await PriceAsync(ImoltReferenceEditorStand.PreviewGroupId));
  }

  [Fact(DisplayName = "неразобранные строки названы номером и причиной и в расхождения не идут")]
  public async Task RejectedRowsAreNamedAndNotApplied()
  {
    var book = WorkbookBuilder
        .WithHeaders(WorkbookBuilder.IdentifierColumn, WorkbookBuilder.TransportPriceColumn)

        // Строка 2: ссылка на запись, которой в справочнике нет. Импорт
        // новых записей не заводит (R-046, Q-017).
        .Row(
            WorkbookCell.Text(ImoltReferenceEditorStand.UnknownGroupId),
            WorkbookCell.Number(40.00m))

        // Строка 3: цена записана словом — числом она не разбирается.
        .Row(
            WorkbookCell.Text(ImoltReferenceEditorStand.WrittenPriceGroupId),
            WorkbookCell.Text("тридцать рублей"))

        // Строка 4: формула в ячейке. Сохранённое рядом значение выглядит
        // правдоподобным нарочно: сервер не вправе ему доверять, потому что
        // считал его не он.
        .Row(
            WorkbookCell.Text(ImoltReferenceEditorStand.FormulaGroupId),
            WorkbookCell.Formula("30+10", 40.00m))
        .Build();

    using var preview = await UploadAsync(book, "gruppy-othodov-s-oshibkami.xlsx");

    var rejected = RejectedRowsOf(preview.RootElement);
    var numbers = rejected.Select(row => row.GetProperty("row").GetInt32()).OrderBy(number => number).ToList();

    // Номера строк листа: заголовки занимают первую, данные идут со второй.
    // Номер — единственное, чем человек находит строку в своём файле.
    Assert.Equal(new[] { 2, 3, 4 }, numbers);

    foreach (var row in rejected)
    {
      var number = row.GetProperty("row").GetInt32();
      Assert.False(
          string.IsNullOrWhiteSpace(row.GetProperty("reason").GetString()),
          $"строка {number} отклонена без причины: исправлять файл не по чему");
    }

    // Ни одна из трёх не попала в расхождения: иначе подтверждение применило
    // бы значение, которого никто не разобрал.
    foreach (var entityId in new[]
             {
               ImoltReferenceEditorStand.UnknownGroupId,
               ImoltReferenceEditorStand.WrittenPriceGroupId,
               ImoltReferenceEditorStand.FormulaGroupId,
             })
    {
      Assert.Empty(ChangesOf(preview.RootElement, entityId));
    }
  }

  [Fact(DisplayName = "подтверждение применяет разобранные изменения и повторно не применяется")]
  public async Task ConfirmationAppliesParsedChangesExactlyOnce()
  {
    var token = await stand.DataManagerTokenAsync();

    var book = WorkbookBuilder
        .WithHeaders(WorkbookBuilder.IdentifierColumn, WorkbookBuilder.TransportPriceColumn)
        .Row(
            WorkbookCell.Text(ImoltReferenceEditorStand.AppliedFirstGroupId),
            WorkbookCell.Number(50.00m))
        .Row(
            WorkbookCell.Text(ImoltReferenceEditorStand.AppliedSecondGroupId),
            WorkbookCell.Number(60.00m))
        .Build();

    using var preview = await UploadAsync(book, "gruppy-othodov-dva-izmeneniya.xlsx");

    // Ровно два расхождения: книга обеих строк отличается от справочника, и
    // совпадающих значений в ней нет — иначе «два» получилось бы случайно.
    Assert.Equal(2, preview.RootElement.GetProperty("changes").GetArrayLength());

    var importId = IdOf(preview.RootElement);
    var confirmation = await stand.ConfirmReferenceImportAsync(importId, token);

    using var result = await ReferenceChecks.OkAsync(confirmation, "confirmReferenceImport");
    Assert.Equal(2, result.RootElement.GetProperty("appliedChanges").GetInt32());

    Assert.Equal("50.00", await PriceAsync(ImoltReferenceEditorStand.AppliedFirstGroupId));
    Assert.Equal("60.00", await PriceAsync(ImoltReferenceEditorStand.AppliedSecondGroupId));

    // Повторное подтверждение того же предпросмотра. Без отказа тот же файл
    // применялся бы сколько угодно раз, а сколько именно — зависело бы от
    // того, сколько раз нажали кнопку.
    var again = await stand.ConfirmReferenceImportAsync(importId, token);
    var body = await again.Content.ReadAsStringAsync();

    // Код причины здесь не закрепляется: договор объявляет для 409 пример с
    // устаревшим предпросмотром, а этот случай — уже применённый. Критерий
    // называет только код состояния.
    Assert.True(
        again.StatusCode == HttpStatusCode.Conflict,
        $"повторное подтверждение ответило кодом {(int)again.StatusCode}: {body}");
    Assert.Equal("application/problem+json", again.Content.Headers.ContentType?.MediaType);
  }

  [Fact(DisplayName = "устаревший предпросмотр не применяется поверх правки редактора")]
  public async Task StalePreviewIsNotAppliedOverTheEditorsValue()
  {
    var token = await stand.DataManagerTokenAsync();

    var book = WorkbookBuilder
        .WithHeaders(WorkbookBuilder.IdentifierColumn, WorkbookBuilder.TransportPriceColumn)
        .Row(
            WorkbookCell.Text(ImoltReferenceEditorStand.StalePreviewGroupId),
            WorkbookCell.Number(70.00m))
        .Build();

    using var preview = await UploadAsync(book, "gruppy-othodov-ustarevshiy.xlsx");
    var importId = IdOf(preview.RootElement);

    // Правка редактора после разбора: именно она делает предпросмотр
    // устаревшим. Величина 80,00 отличается и от справочной 28,00, и от
    // файловой 70,00 — по итогу видно, чьё значение уцелело.
    var edit = await stand.SendJsonAsync(
        HttpMethod.Patch,
        $"{ImoltReferenceEditorStand.WasteGroupsPath}/{ImoltReferenceEditorStand.StalePreviewGroupId}",
        """{ "transportPricePerTonKm": { "amount": "80.00", "currency": "RUB" } }""",
        token);

    using var edited = await ReferenceChecks.OkAsync(edit, "updateWasteGroup");
    Assert.Equal(
        "80.00",
        edited.RootElement.GetProperty("transportPricePerTonKm").GetProperty("amount").GetString());

    var confirmation = await stand.ConfirmReferenceImportAsync(importId, token);

    using var problem = await ReferenceChecks.ProblemAsync(confirmation, HttpStatusCode.Conflict, StalePreview);
    Assert.Equal(409, problem.RootElement.GetProperty("status").GetInt32());

    // Значение редактора уцелело: молчаливая перезапись более поздней правки
    // файлом — ровно то, ради чего импорт разделён на два шага.
    Assert.Equal("80.00", await PriceAsync(ImoltReferenceEditorStand.StalePreviewGroupId));
  }

  [Fact(DisplayName = "файл с расширением книги, но произвольным содержимым отвергается до разбора")]
  public async Task FileThatIsNotAWorkbookIsRefusedBeforeParsing()
  {
    var token = await stand.DataManagerTokenAsync();

    // Содержимое заведомо не книга, а имя и заявленный тип — книги: проверка
    // о том, что решение принимается по содержимому. Файл, отвергнутый по
    // расширению, оставил бы открытой подмену имени.
    var notAWorkbook = Encoding.UTF8.GetBytes("это не книга, а обычный текст; байтов контейнера здесь нет");

    var response = await stand.UploadReferenceAsync(
        notAWorkbook,
        "gruppy-othodov.xlsx",
        WasteGroupsKind,
        token);

    using var problem = await ReferenceChecks.ProblemAsync(
        response, HttpStatusCode.UnsupportedMediaType, UnsupportedMediaType);
    Assert.Equal(415, problem.RootElement.GetProperty("status").GetInt32());
  }

  [Fact(DisplayName = "столбец кодов ФККО в применение не идёт и причина отказа названа")]
  public async Task FkkoColumnIsNeverApplied()
  {
    var token = await stand.DataManagerTokenAsync();

    var book = WorkbookBuilder
        .WithHeaders(WorkbookBuilder.IdentifierColumn, WorkbookBuilder.FkkoCodesColumn)
        .Row(
            WorkbookCell.Text(ImoltReferenceEditorStand.FkkoImportGroupId),
            WorkbookCell.Text("8 11 111 01 21 5"))
        .Build();

    using var preview = await UploadAsync(book, "gruppy-othodov-fkko.xlsx");

    // Причина названа среди неразобранных значений: столбец распознан, но
    // редакция каталога не сверена (Q-015), и молчаливый пропуск столбца
    // выглядел бы для менеджера данных как успешный перенос.
    var rejected = RejectedRowsOf(preview.RootElement);
    Assert.True(
        rejected.Any(row => (row.GetProperty("reason").GetString() ?? string.Empty).Contains(
            "ФККО",
            StringComparison.OrdinalIgnoreCase)),
        "среди неразобранных значений нет причины, называющей столбец кодов ФККО: "
            + string.Join(
                "; ",
                rejected.Select(row => row.GetProperty("reason").GetString())));

    var confirmation = await stand.ConfirmReferenceImportAsync(IdOf(preview.RootElement), token);
    using var result = await ReferenceChecks.OkAsync(confirmation, "confirmReferenceImport");

    Assert.Equal(0, result.RootElement.GetProperty("appliedChanges").GetInt32());

    // Коды остались прежними — и после подтверждения, а не только после
    // разбора: критерий требует пройти оба шага.
    var card = await stand.GetAsync(
        $"{ImoltReferenceEditorStand.WasteGroupsPath}/{ImoltReferenceEditorStand.FkkoImportGroupId}");
    using var group = await ReferenceChecks.OkAsync(card, "getWasteGroup");

    var codes = group.RootElement
        .GetProperty("fkkoCodes")
        .EnumerateArray()
        .Select(code => code.GetString() ?? string.Empty)
        .ToList();

    Assert.True(
        codes.Count == 1 && codes[0] == ImoltReferenceEditorStand.FkkoImportCode,
        $"перечень кодов ФККО после импорта стал «{string.Join(", ", codes)}»");
  }

  /// Идентификатор предпросмотра: без него подтверждать нечего.
  private static string IdOf(JsonElement preview)
  {
    var id = preview.GetProperty("id").GetString();
    Assert.False(string.IsNullOrWhiteSpace(id), "предпросмотр импорта пришёл без идентификатора");

    return id!;
  }

  /// Расхождения предпросмотра по одной записи справочника.
  private static IReadOnlyList<JsonElement> ChangesOf(JsonElement preview, string entityId)
      => preview
          .GetProperty("changes")
          .EnumerateArray()
          .Where(change => change.GetProperty("entityId").GetString() == entityId)
          .ToList();

  /// Неразобранные строки предпросмотра. Поле необязательно по схеме, но
  /// критерии AC-045b и AC-045f требуют его непустым — отсутствие названо
  /// отдельно, иначе пустой перечень выглядел бы как «ошибок нет».
  private static IReadOnlyList<JsonElement> RejectedRowsOf(JsonElement preview)
  {
    Assert.True(
        preview.TryGetProperty("rejectedRows", out var rejected),
        "предпросмотр не назвал ни одной неразобранной строки: поля rejectedRows в ответе нет");

    var rows = rejected.EnumerateArray().ToList();
    Assert.NotEmpty(rows);

    return rows;
  }

  /// Денежная величина расхождения числом. Разбор терпим к разделителю:
  /// договор формата полей `currentValue` и `fileValue` не задаёт вовсе, и
  /// закрепление одной записи здесь превратило бы проверку критерия в
  /// проверку форматирования.
  private static decimal MoneyOf(string? value, string where)
  {
    Assert.False(string.IsNullOrWhiteSpace(value), $"{where}: величина не названа");

    var normalized = value!
        .Replace(" ", string.Empty, StringComparison.Ordinal)
        .Replace(" ", string.Empty, StringComparison.Ordinal)
        .Replace(',', '.');

    Assert.True(
        decimal.TryParse(normalized, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed),
        $"{where}: величина «{value}» числом не разбирается");

    return parsed;
  }

  [Fact(DisplayName = "импорт закрыт для участника без права на обоих шагах")]
  public async Task ImportIsClosedToParticipantsWithoutThePermission()
  {
    // AC-045g. Проверяются оба шага. Закрытая загрузка при открытом
    // подтверждении оставила бы справочник беззащитным: предпросмотр
    // выпускает тот, у кого право есть, а применяет его кто угодно.
    var book = WorkbookBuilder
        .WithHeaders(WorkbookBuilder.IdentifierColumn, WorkbookBuilder.TransportPriceColumn)
        .Row(
            WorkbookCell.Text(ImoltReferenceEditorStand.PreviewGroupId),
            WorkbookCell.Number(77.00m))
        .Build();

    var outsider = await stand.OutsiderTokenAsync();

    var upload = await stand.UploadReferenceAsync(book, "chuzhaya-kniga.xlsx", WasteGroupsKind, outsider);
    using var uploadRefusal = await ReferenceChecks.ProblemAsync(
        upload, HttpStatusCode.Forbidden, RoleRequired);

    // Предпросмотр выпускает менеджер данных — и именно его пытается
    // применить посторонний.
    using var preview = await UploadAsync(book, "gruppy-othodov-chuzhoe-podtverzhdenie.xlsx");
    var importId = preview.RootElement.GetProperty("id").GetString();

    var confirmation = await stand.ConfirmReferenceImportAsync(importId!, outsider);
    using var confirmRefusal = await ReferenceChecks.ProblemAsync(
        confirmation, HttpStatusCode.Forbidden, RoleRequired);

    // Ни один из двух отказов не должен был тронуть справочник.
    Assert.Equal(
        ImoltReferenceEditorStand.PreviewGroupPrice,
        await PriceAsync(ImoltReferenceEditorStand.PreviewGroupId));

    // Без маркера вовсе — отказ личности, а не права: сообщать не назвавшемуся,
    // что такое право существует, незачем.
    var anonymous = await stand.UploadReferenceAsync(book, "bez-markera.xlsx", WasteGroupsKind, token: null);
    Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
  }

  private async Task<JsonDocument> UploadAsync(byte[] book, string fileName)
  {
    var token = await stand.DataManagerTokenAsync();
    var response = await stand.UploadReferenceAsync(book, fileName, WasteGroupsKind, token);

    return await ReferenceChecks.SuccessAsync(response, "startReferenceImport", HttpStatusCode.Created);
  }

  private async Task<string> PriceAsync(string wasteGroupId)
  {
    var response = await stand.GetAsync($"{ImoltReferenceEditorStand.WasteGroupsPath}/{wasteGroupId}");
    using var group = await ReferenceChecks.OkAsync(response, "getWasteGroup");

    return group.RootElement.GetProperty("transportPricePerTonKm").GetProperty("amount").GetString()
        ?? string.Empty;
  }
}
