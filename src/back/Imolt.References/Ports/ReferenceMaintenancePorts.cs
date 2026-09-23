using Imolt.References.Contracts;
using Imolt.References.Domain;
using Imolt.Shared;

namespace Imolt.References.Ports;

/// Ведение справочников: правка цен, тарифов и статусов, импорт из книги и
/// итог последнего обновления (R-042, R-044, R-045, R-048).
///
/// Порты объявлены отдельно от портов чтения намеренно: читающая сторона
/// справочников нужна расчёту и сделке, а ведение — только редактору. Общий
/// порт заставил бы расчёт зависеть от операций, которых он не вызывает.
///
/// @supports: R-042, R-044, R-045
/// @adr: ADR-0001
public interface IReferenceEditor
{
  /// Меняет только переданные поля; пустота означает «не трогать».
  /// Пусто в ответе — записи нет (R-042).
  Task<WasteGroup?> UpdateWasteGroupAsync(
      string wasteGroupId,
      WasteGroupUpdate update,
      CancellationToken cancellationToken);

  /// Тариф задаётся по паре «полигон и группа отходов»; несуществующая пара
  /// не заводится, а отвергается (R-042).
  Task<LandfillTariff?> SetTariffAsync(
      string landfillId,
      string wasteGroupId,
      Money disposalPricePerTon,
      CancellationToken cancellationToken);

  /// Ручная установка статуса — объявленный запасной путь к автоматическому
  /// обновлению (R-044). Источник записывается как ручной: иначе позже не
  /// отличить подтверждённое человеком от полученного из канала.
  Task<LandfillStatusState?> SetStatusAsync(
      string landfillId,
      string status,
      string? reason,
      CancellationToken cancellationToken);
}

/// Текущее значение одного поля одной записи справочника: то, с чем
/// сравнивается файл и по чему считается отпечаток предпросмотра.
public sealed record ImportedValue(string EntityId, string Field, string? Current);

/// Сохранённый предпросмотр импорта вместе с отпечатком справочника на момент
/// разбора (R-045).
public sealed record StoredImport(
    string Id,
    string Kind,
    IReadOnlyList<ReferenceImportChange> Changes,
    string SnapshotHash,
    bool Applied);

/// Хранилище импорта: чтение текущих значений, применение разобранного и
/// журнал предпросмотров.
///
/// @supports: R-045
/// @adr: ADR-0001
public interface IReferenceImports
{
  Task<IReadOnlyList<ImportedValue>> CurrentAsync(
      string kind,
      IReadOnlyCollection<string> entityIds,
      CancellationToken cancellationToken);

  /// Применение идёт одной транзакцией: половина применённой книги хуже
  /// неприменённой — по ней не видно, что именно уже записано.
  Task<int> ApplyAsync(
      string kind,
      IReadOnlyList<ReferenceImportChange> changes,
      CancellationToken cancellationToken);

  /// Предпросмотр сохраняется целиком, вместе с неразобранными строками:
  /// менеджер данных вправе вернуться к нему и увидеть то же, что видел.
  Task SaveAsync(
      ReferenceImportPreview preview,
      string snapshotHash,
      CancellationToken cancellationToken);

  Task<StoredImport?> FindAsync(string importId, CancellationToken cancellationToken);

  Task MarkAppliedAsync(
      string importId,
      int appliedChanges,
      DateTimeOffset appliedAt,
      CancellationToken cancellationToken);
}

/// Читатель книги. Отделён портом, потому что библиотека разбора — вариант
/// адаптера, а не правило проекта: карточка практики PRACT-033 прямо
/// запрещает делать имя библиотеки нормой.
///
/// @supports: R-045
/// @adr: ADR-0001
public interface IWorkbookReader
{
  /// Разбирает первый лист книги. Отказ структурного уровня — исключение, а
  /// не пустая книга: пустой ответ читался бы как «в файле нет строк».
  Workbook Read(Stream content);
}

/// Прогоны обновления справочных данных (R-044, R-046, R-048).
///
/// @supports: R-044, R-048
/// @adr: ADR-0002
public interface ISyncRuns
{
  Task RecordAsync(SyncRun run, CancellationToken cancellationToken);

  Task<SyncRun?> LatestAsync(CancellationToken cancellationToken);
}

/// Книга не принята до разбора: не та сигнатура, слишком велика, слишком
/// много строк. Отличается от нарушенного правила предметной области тем, что
/// до предметной записи дело не дошло (R-045).
///
/// @supports: R-045
public sealed class WorkbookRefusedException(string message, bool unsupportedMedia) : Exception(message)
{
  /// Формат файла против его содержимого: первое — 415, второе — 422.
  /// Различие видно пользователю: одному надо сохранить файл иначе, другому —
  /// сократить его.
  public bool UnsupportedMedia { get; } = unsupportedMedia;
}

/// Предпросмотр применять нельзя: справочник изменился после разбора либо
/// предпросмотр уже применён (R-045).
///
/// @supports: R-045
public sealed class StalePreviewException(string message) : Exception(message)
{
}
