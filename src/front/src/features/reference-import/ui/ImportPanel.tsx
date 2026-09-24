/**
 * Импорт справочника на рабочем месте: выбор книги, расхождения таблицей,
 * применение (R-045).
 *
 * Компонент только показывает: разбор книги и применение изменений делает
 * расчётная часть, а состояние импорта живёт в `model/import.ts`. Поэтому
 * его можно поставить в витрину в любом состоянии, не обращаясь к службе.
 *
 * @req: R-045
 * @adr: ADR-0008
 */
import { Button, Card, DataTable, EmptyState, Notice, Skeleton, Select, useStyles } from '@/shared/ui';
import type { ReferenceImportChange, ReferenceImportKind } from '@/shared/api/maintenance';
import { formatDate } from '@/shared/lib/formatting';
import { IMPORT_KINDS, type ImportState, fieldName, importKindName } from '../model/import';
import { IMPORT_CSS } from './styles';

export type ImportViewProps = {
  state: ImportState;
  /** Правка закрыта: права ведения справочников у участника нет (ADR-0007). */
  disabled?: boolean;
  onPickKind: (kind: ReferenceImportKind) => void;
  onPickFile: (file: File) => void;
  onApply: () => void;
  onRebuild: () => void;
  onClose: () => void;
};

/** Столбцы расхождений: запись, поле, что в справочнике и что в файле. */
const CHANGE_COLUMNS = [
  { key: 'entityId', title: 'Запись' },
  { key: 'field', title: 'Поле' },
  { key: 'currentValue', title: 'В справочнике', align: 'end' as const },
  { key: 'fileValue', title: 'В файле', align: 'end' as const },
];

/**
 * Значение приходит от службы строкой и показывается как есть: поле бывает
 * и ценой, и адресом, и перечислять их заново значило бы завести вторую
 * модель справочника. Пусто в справочнике — «не задано», а не пустая ячейка.
 */
export function changeValue(change: ReferenceImportChange, column: string): string {
  if (column === 'currentValue') {
    return change.currentValue ?? 'не задано';
  }

  return change.fileValue;
}

export function ImportPanel({
  state,
  disabled = false,
  onPickKind,
  onPickFile,
  onApply,
  onRebuild,
  onClose,
}: ImportViewProps) {
  useStyles('reference-import', IMPORT_CSS);

  const changes = state.preview?.changes ?? [];
  const rejected = state.preview?.rejectedRows ?? [];

  return (
    <Card className="imolt-import">
      <div className="imolt-import-head">
        <div>
          <h2 className="imolt-import-title">Импорт справочника из книги</h2>
          <span className="imolt-import-source">
            {state.fileName === null
              ? 'Книга разбирается службой: расхождения показываются до записи'
              : `${state.fileName} – ${importKindName(state.kind)}`}
          </span>
        </div>
        <Button kind="tertiary" size="s" onClick={onClose} ariaLabel="Закрыть импорт">
          Закрыть
        </Button>
      </div>

      {state.stage === 'idle' && (
        <div className="imolt-import-pick">
          <Select
            id="import-kind"
            label="Что загружается"
            value={state.kind}
            options={IMPORT_KINDS}
            onPick={onPickKind}
          />
          <div className="imolt-import-file">
            <label className="imolt-label" htmlFor="import-file">
              Книга Excel
            </label>
            <input
              id="import-file"
              type="file"
              accept=".xlsx"
              disabled={disabled}
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) {
                  onPickFile(file);
                }
              }}
            />
          </div>
        </div>
      )}

      {state.stage === 'parsing' && <Skeleton rows={3} label="Книга разбирается" />}

      {state.refusal !== null && (
        <Notice kind="error">
          {state.refusal.title}
          {state.refusal.detail ? `. ${state.refusal.detail}` : ''}
          {state.stale
            ? ' Справочник изменился после разбора книги, поэтому прежние расхождения применять нельзя.'
            : ''}
        </Notice>
      )}

      {state.stale && (
        <div className="imolt-import-actions">
          <Button onClick={onRebuild}>Собрать предпросмотр заново</Button>
        </div>
      )}

      {state.stage === 'applied' && state.result !== null && (
        <Notice kind="done">
          {`Применено изменений: ${state.result.appliedChanges}. Справочник обновлён ${formatDate(state.result.updatedAt)}.`}
        </Notice>
      )}

      {(state.stage === 'preview' || state.stage === 'applying') && (
        <>
          <span className="imolt-import-source">{`Расхождений: ${changes.length}. Справочник пока не изменён.`}</span>

          {changes.length === 0 ? (
            <EmptyState title="Расхождений нет" hint="Значения книги совпадают со справочником, применять нечего" />
          ) : (
            <DataTable
              caption="Расхождения между справочником и книгой"
              columns={CHANGE_COLUMNS}
              rows={changes}
              rowKey={(change: ReferenceImportChange) => `${change.entityId}:${change.field}`}
              cell={(change: ReferenceImportChange, column: string) =>
                column === 'entityId'
                  ? change.entityId
                  : column === 'field'
                    ? fieldName(change.field)
                    : changeValue(change, column)
              }
            />
          )}

          {rejected.length > 0 && (
            <>
              <span className="imolt-import-source">Строки, которые не применяются:</span>
              <ul className="imolt-import-rejected">
                {rejected.map(row => (
                  <li key={`${row.row}:${row.reason}`}>{`Строка ${row.row}: ${row.reason}`}</li>
                ))}
              </ul>
            </>
          )}

          <div className="imolt-import-actions">
            <Button
              onClick={onApply}
              disabled={disabled || state.stale || changes.length === 0 || state.stage === 'applying'}
            >
              {`Применить изменения: ${changes.length}`}
            </Button>
            <Button kind="secondary" onClick={onClose}>
              Отменить
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
