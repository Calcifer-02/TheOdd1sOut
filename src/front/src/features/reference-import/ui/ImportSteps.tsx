/**
 * Импорт справочника на телефоне: те же два шага договора, но по одному на
 * экране, и расхождения карточками, а не таблицей (R-045).
 *
 * Мобильного макета у редактора цен нет: карта пути называет ситуацию
 * менеджера данных рабочим местом. Представление дописано в том же стиле,
 * потому что заказчик требует оба представления у каждого экрана; предметная
 * часть при этом общая — она живёт в `model/import.ts`.
 *
 * @req: R-045
 * @adr: ADR-0008
 */
import { Button, Card, EmptyState, Notice, Select, Skeleton, useStyles } from '@/shared/ui';
import { formatDate } from '@/shared/lib/formatting';
import { IMPORT_KINDS, fieldName, importKindName } from '../model/import';
import { changeValue, type ImportViewProps } from './ImportPanel';
import { IMPORT_CSS } from './styles';

/** Какой шаг договора идёт сейчас: разбор книги либо применение расхождений. */
function stepLabel(stage: ImportViewProps['state']['stage']): string {
  if (stage === 'applied') {
    return 'Импорт завершён';
  }

  return stage === 'preview' || stage === 'applying' ? 'Шаг 2 из 2' : 'Шаг 1 из 2';
}

export function ImportSteps({
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
  const additions = state.preview?.additions ?? [];

  return (
    <Card className="imolt-import">
      <span className="imolt-import-step">{stepLabel(state.stage)}</span>
      <h2 className="imolt-import-title">Импорт справочника из книги</h2>

      {state.stage === 'idle' && (
        <>
          <span className="imolt-import-source">
            Сначала служба покажет расхождения, и только потом они применятся.
          </span>
          <Select
            id="import-kind-mobile"
            label="Что загружается"
            value={state.kind}
            options={IMPORT_KINDS}
            onPick={onPickKind}
          />
          <div className="imolt-import-file">
            <label className="imolt-label" htmlFor="import-file-mobile">
              Книга Excel
            </label>
            <input
              id="import-file-mobile"
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
        </>
      )}

      {state.stage === 'parsing' && <Skeleton rows={2} label="Книга разбирается" />}

      {state.refusal !== null && (
        <Notice kind="error">
          {state.refusal.title}
          {state.refusal.detail ? `. ${state.refusal.detail}` : ''}
          {state.stale
            ? ' Справочник изменился после разбора книги, поэтому прежние расхождения применять нельзя.'
            : ''}
        </Notice>
      )}

      {state.stale && <Button onClick={onRebuild}>Собрать предпросмотр заново</Button>}

      {state.stage === 'applied' && state.result !== null && (
        <Notice kind="done">
          {`Применено изменений: ${state.result.appliedChanges}.`}
          {state.result.addedEntities > 0 ? ` Заведено записей: ${state.result.addedEntities}.` : ''}
          {` Справочник обновлён ${formatDate(state.result.updatedAt)}.`}
        </Notice>
      )}

      {(state.stage === 'preview' || state.stage === 'applying') && (
        <>
          <span className="imolt-import-source">
            {`${state.fileName ?? 'Книга'} – ${importKindName(state.kind)}. Расхождений: ${changes.length}.`}
            {additions.length > 0 ? ` Будет заведено записей: ${additions.length}.` : ''}
            {' Справочник пока не изменён.'}
          </span>

          {changes.length === 0 ? (
            <EmptyState title="Расхождений нет" hint="Значения книги совпадают со справочником, применять нечего" />
          ) : (
            <div className="imolt-import-cards">
              {changes.map(change => (
                <div className="imolt-import-card" key={`${change.entityId}:${change.field}`}>
                  <strong>{change.entityId}</strong>
                  <span className="imolt-import-source">{fieldName(change.field)}</span>
                  <dl>
                    <div>
                      <dt>В справочнике</dt>
                      <dd>{changeValue(change, 'currentValue')}</dd>
                    </div>
                    <div>
                      <dt>В файле</dt>
                      <dd>{changeValue(change, 'fileValue')}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          )}

          {rejected.length > 0 && (
            <ul className="imolt-import-rejected">
              {rejected.map(row => (
                <li key={`${row.row}:${row.reason}`}>{`Строка ${row.row}: ${row.reason}`}</li>
              ))}
            </ul>
          )}

          <Button
            onClick={onApply}
            disabled={disabled || state.stale || changes.length === 0 || state.stage === 'applying'}
          >
            {`Применить изменения: ${changes.length}`}
          </Button>
        </>
      )}

      <Button kind="secondary" onClick={onClose}>
        Закрыть импорт
      </Button>
    </Card>
  );
}
