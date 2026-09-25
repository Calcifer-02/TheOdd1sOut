using Imolt.References.Contracts;
using Imolt.References.Domain;
using Imolt.References.Ports;
using Imolt.Shared;

namespace Imolt.References.Application;

/// Импорт справочника из книги: разбор с предпросмотром и отдельное
/// применение (R-045).
///
/// Два шага — не удобство, а требование обратимости. Книга перезаписывает
/// цены, которые уходят в коммерческие предложения; молча применённая, она не
/// откатывается взглядом. Поэтому разбор ничего не меняет, а применение
/// работает по уже показанному списку расхождений, а не по файлу заново.
///
/// Между шагами справочник мог измениться. Отпечаток затронутых значений,
/// снятый при разборе и пересчитанный при применении, ловит именно этот
/// случай: применить предпросмотр, опирающийся на устаревшие значения, —
/// значит тихо отменить чужую правку.
///
/// @req: R-045, R-046
/// @adr: ADR-0005
public sealed class ReferenceImportScenarios(
    IReferenceImports imports,
    IWorkbookReader reader,
    ISyncRuns syncRuns,
    IClock clock)
{
  public async Task<ReferenceImportPreview> StartAsync(
      string? kind,
      Stream? file,
      CancellationToken cancellationToken)
  {
    // Негодный вид — 422, а не 400: договор объявляет для этой операции
    // только 415 и 422, и отвечать кодом, которого он здесь не обещает,
    // значит расходиться с ним ради привычной классификации ошибок.
    if (!ReferenceImportKind.Known(kind))
    {
      throw new WorkbookRefusedException(
          $"Вид справочника «{kind}» не объявлен договором: ожидались wasteGroups, landfills либо tariffs",
          unsupportedMedia: false);
    }

    var content = await ReadAsync(
        file ?? throw new ArgumentOutOfRangeException(nameof(file), "файл книги обязателен"),
        cancellationToken);

    // Сигнатура проверяется до разбора: расширение имени ни о чём не
    // говорит, а разбор произвольных байтов библиотекой — лишняя поверхность.
    if (!WorkbookLimits.LooksLikeWorkbook(content))
    {
      throw new WorkbookRefusedException(
          "Файл не является книгой Excel: ожидался формат XLSX", unsupportedMedia: true);
    }

    using var stream = new MemoryStream(content, writable: false);
    var workbook = reader.Read(stream);

    if (workbook.Rows.Count > WorkbookLimits.MaximalRows)
    {
      throw new WorkbookRefusedException(
          $"В листе больше {WorkbookLimits.MaximalRows} строк: разделите книгу",
          unsupportedMedia: false);
    }

    var schema = WorkbookSchema.For(kind!);
    var interpreted = WorkbookInterpreter.Interpret(workbook, schema);

    if (interpreted.MissingHeaders.Count > 0)
    {
      throw new WorkbookRefusedException(
          "В листе нет обязательных столбцов: " + string.Join(", ", interpreted.MissingHeaders),
          unsupportedMedia: false);
    }

    var entityIds = interpreted.Candidates.Select(candidate => candidate.EntityId).Distinct().ToList();
    var current = await imports.CurrentAsync(kind!, entityIds, cancellationToken);
    var known = current
        .GroupBy(value => value.EntityId, StringComparer.Ordinal)
        .ToDictionary(
            group => group.Key,
            group => group.ToDictionary(value => value.Field, value => value.Current, StringComparer.Ordinal),
            StringComparer.Ordinal);

    var changes = new List<ReferenceImportChange>();
    var rejections = interpreted.Rejections
        .Select(rejection => new ReferenceImportRejectedRow(rejection.Row, rejection.Reason))
        .ToList();
    var unknown = new HashSet<string>(StringComparer.Ordinal);
    var additions = new List<string>();
    var added = new HashSet<string>(StringComparer.Ordinal);

    // Запись, которой в справочнике нет, разбирается целиком, а не построчно:
    // завести можно только ту, у которой книга принесла все обязательные
    // поля, и решается это по всем её столбцам сразу (R-046).
    var offered = interpreted.Candidates
        .GroupBy(candidate => candidate.EntityId, StringComparer.Ordinal)
        .ToDictionary(
            group => group.Key,
            group => group.Select(candidate => candidate.Field).ToHashSet(StringComparer.Ordinal),
            StringComparer.Ordinal);

    foreach (var candidate in interpreted.Candidates)
    {
      if (!known.TryGetValue(candidate.EntityId, out var fields))
      {
        if (!Addable(schema, offered[candidate.EntityId]))
        {
          // Запись называется один раз, сколько бы её столбцов ни пришло:
          // повторённая причина не добавляет сведений, а список отказов делает
          // нечитаемым.
          if (unknown.Add(candidate.EntityId))
          {
            rejections.Add(new ReferenceImportRejectedRow(
                RowOf(workbook, candidate.EntityId),
                Refusal(schema, offered[candidate.EntityId])));
          }

          continue;
        }

        if (added.Add(candidate.EntityId))
        {
          additions.Add(candidate.EntityId);
        }

        // Текущего значения у поля заводимой записи нет вовсе, и пустота
        // здесь не «поле не заполнено», а «записи ещё нет».
        changes.Add(new ReferenceImportChange(candidate.EntityId, candidate.Field, null, candidate.Value));

        continue;
      }

      var currentValue = fields.GetValueOrDefault(candidate.Field);

      // Совпадение не расхождение. Иначе применение книги, повторённой
      // дважды, отчиталось бы о тех же изменениях во второй раз.
      if (string.Equals(currentValue, candidate.Value, StringComparison.Ordinal))
      {
        continue;
      }

      changes.Add(new ReferenceImportChange(
          candidate.EntityId, candidate.Field, currentValue, candidate.Value));
    }

    var preview = new ReferenceImportPreview(
        Guid.NewGuid().ToString(),
        kind!,
        changes,
        rejections.OrderBy(rejection => rejection.Row).ToList(),
        additions);

    await imports.SaveAsync(preview, Snapshot(changes, additions), cancellationToken);

    return preview;
  }

  public async Task<ReferenceImportResult?> ConfirmAsync(string importId, CancellationToken cancellationToken)
  {
    var stored = await imports.FindAsync(importId, cancellationToken);

    if (stored is null)
    {
      return null;
    }

    // Повторное применение — тот же случай, что и устаревший предпросмотр:
    // справочник уже не тот, на котором предпросмотр считался. Отдельного
    // кода для него договор не объявляет, и выдумывать его не за чем.
    if (stored.Applied)
    {
      throw new StalePreviewException(
          "Этот предпросмотр уже применён: разберите файл заново, если нужно повторить");
    }

    var entityIds = stored.Changes.Select(change => change.EntityId).Distinct().ToList();
    var current = await imports.CurrentAsync(stored.Kind, entityIds, cancellationToken);

    // Заводимая запись обязана отсутствовать и на этом шаге. Появилась —
    // значит её завели другим способом, и применить предпросмотр поверх
    // значило бы молча переписать чужую запись (R-046).
    if (stored.Additions.Any(id => current.Any(value =>
        string.Equals(value.EntityId, id, StringComparison.Ordinal))))
    {
      throw new StalePreviewException(
          "Запись, которую собирался завести импорт, уже есть в справочнике: разберите файл заново");
    }

    var actual = current
        .Where(value => stored.Changes.Any(change =>
            string.Equals(change.EntityId, value.EntityId, StringComparison.Ordinal)
            && string.Equals(change.Field, value.Field, StringComparison.Ordinal)))
        .Select(value => (value.EntityId, value.Field, value.Current));

    if (!string.Equals(ImportSnapshot.Of(actual), stored.SnapshotHash, StringComparison.Ordinal))
    {
      throw new StalePreviewException(
          "Справочник изменился после разбора файла, разберите его заново");
    }

    var startedAt = clock.Now;
    var applied = await imports.ApplyAsync(
        stored.Kind, stored.Changes, stored.Additions, cancellationToken);
    var finishedAt = clock.Now;

    await imports.MarkAppliedAsync(importId, applied.Changes, finishedAt, cancellationToken);

    // Применённый импорт — и есть обновление справочника в версии 1: службы
    // сбора в составе нет (ADR-0002), а источник `file` договор объявляет.
    await syncRuns.RecordAsync(
        new SyncRun(startedAt, finishedAt, "file", "succeeded", 0, LandfillsOf(stored), null),
        cancellationToken);

    return new ReferenceImportResult(importId, applied.Changes, applied.Added, finishedAt);
  }

  /// Отпечаток снимается по тем же парам «запись и поле», которые импорт
  /// собирается изменить, и по их значениям до правки. Заводимые записи в
  /// него не входят: у них нет текущих значений, и сторожит их не отпечаток,
  /// а отдельная проверка отсутствия при подтверждении (R-046).
  private static string Snapshot(
      IReadOnlyList<ReferenceImportChange> changes,
      IReadOnlyCollection<string> additions)
      => ImportSnapshot.Of(changes
          .Where(change => !additions.Contains(change.EntityId, StringComparer.Ordinal))
          .Select(change => (change.EntityId, change.Field, change.CurrentValue)));

  /// Годится ли запись к заведению: вид справочника вообще заводит новые
  /// записи, и книга принесла все обязательные поля.
  private static bool Addable(WorkbookSchema schema, IReadOnlyCollection<string> offered)
      => schema.RequiredForNew.Count > 0 && schema.RequiredForNew.All(offered.Contains);

  /// Почему запись не применяется. Причину читает менеджер данных и по ней
  /// правит книгу, поэтому недостающие столбцы называются поимённо.
  private static string Refusal(WorkbookSchema schema, IReadOnlyCollection<string> offered)
      => schema.RequiredForNew.Count == 0
          ? ImportRejections.UnknownEntity
          : ImportRejections.IncompleteNewEntity
              + string.Join(", ", schema.RequiredForNew.Where(field => !offered.Contains(field)));

  /// Сколько полигонов затронуто. У тарифа запись названа парой «полигон и
  /// группа», и считать надо полигоны, а не пары: иначе десять тарифов одного
  /// объекта выглядят как десять обновлённых объектов.
  private static int LandfillsOf(StoredImport stored) => stored.Kind switch
  {
    ReferenceImportKind.Landfills => stored.Changes.Select(change => change.EntityId).Distinct(StringComparer.Ordinal).Count(),
    ReferenceImportKind.Tariffs => stored.Changes
        .Select(change => change.EntityId.Split('/')[0])
        .Distinct(StringComparer.Ordinal)
        .Count(),
    _ => 0,
  };

  /// Номер строки, где запись встретилась. Отказ без номера строки заставляет
  /// менеджера данных искать её глазами по всей книге.
  private static int RowOf(Workbook workbook, string entityId)
  {
    var key = entityId.Split('/')[0];

    foreach (var row in workbook.Rows)
    {
      if (row.Cells.Any(cell => string.Equals(cell.Text.Trim(), key, StringComparison.Ordinal)))
      {
        return row.Number;
      }
    }

    return 0;
  }

  /// Чтение с пределом: без него один файл занимает память службы целиком.
  /// Предел проверяется по ходу чтения, а не по заявленной длине — заявить
  /// можно что угодно.
  private static async Task<byte[]> ReadAsync(Stream file, CancellationToken cancellationToken)
  {
    using var buffer = new MemoryStream();
    var chunk = new byte[81920];
    int read;

    while ((read = await file.ReadAsync(chunk, cancellationToken)) > 0)
    {
      if (buffer.Length + read > WorkbookLimits.MaximalBytes)
      {
        throw new WorkbookRefusedException(
            $"Книга больше {WorkbookLimits.MaximalBytes / (1024 * 1024)} МиБ",
            unsupportedMedia: true);
      }

      buffer.Write(chunk, 0, read);
    }

    return buffer.ToArray();
  }
}
