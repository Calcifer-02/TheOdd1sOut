/**
 * Панель итога последнего обновления справочников (R-044, R-048).
 *
 * Отсутствие прогонов — не отказ обслуживания, а отсутствие записи: панель
 * говорит об этом словами службы и предлагает ручной ввод, а не рисует
 * прогон, которого не было. Отказ по сессии показывается так же честно:
 * имитировать вход мини-приложение не вправе (ADR-0006).
 *
 * @req: R-044
 * @adr: ADR-0008
 */
import { Button, Notice } from '@/shared/ui';
import { formatDate } from '@/shared/lib/formatting';
import type { Refusal, SyncRun } from '@/shared/api/maintenance';

/** Откуда пришло обновление. Перечень источников — из договора. */
const SOURCE_NAMES: Record<SyncRun['source'], string> = {
  telegram: 'канал «ОСИП цифровой контроллинг»',
  file: 'книга Excel',
  registry: 'официальный перечень',
};

/** Чем кончился прогон. Отказ сбора не равен отказу обслуживания. */
const OUTCOME_NAMES: Record<SyncRun['outcome'], string> = {
  succeeded: 'завершён',
  partial: 'часть источников не ответила',
  failed: 'не состоялся',
};

/**
 * Часы и минуты прогона в том поясе, в каком их назвала служба. Общего
 * средства для времени в модуле форматирования нет, а перевод строки в
 * `Date` подставил бы пояс машины — момент события сместился бы (PRACT-027).
 */
function timeOf(moment: string): string {
  const found = /T(\d{2}:\d{2})/.exec(moment);
  return found === null ? '' : found[1];
}

/** Строка о прогоне: когда, откуда, с каким исходом и сколько записей. */
export function syncRunSummary(run: SyncRun): string {
  const time = timeOf(run.startedAt);
  const when = time === '' ? formatDate(run.startedAt) : `${formatDate(run.startedAt)}, ${time}`;

  return `Обновление справочников: ${when}, ${OUTCOME_NAMES[run.outcome]}`;
}

export function syncRunDetail(run: SyncRun): string {
  const parts = [`Источник – ${SOURCE_NAMES[run.source]}`];

  if (run.updatedLandfills !== undefined) {
    parts.push(`обновлено полигонов: ${run.updatedLandfills}`);
  }

  if (run.recognizedMessages !== undefined) {
    parts.push(`распознано сообщений: ${run.recognizedMessages}`);
  }

  if (run.failureReason) {
    parts.push(run.failureReason);
  }

  return parts.join(' · ');
}

export type SyncRunPanelProps = {
  run: SyncRun | null;
  refusal: Refusal | null;
  /** Правка закрыта: права ведения справочников у участника нет. */
  disabled?: boolean;
  onManualStatus: () => void;
};

export function SyncRunPanel({ run, refusal, disabled = false, onManualStatus }: SyncRunPanelProps) {
  return (
    <section className="imolt-references-sync" aria-label="Обновление справочников">
      <div className="imolt-references-sync-text">
        {run !== null && (
          <>
            <span className="imolt-references-sync-title">{syncRunSummary(run)}</span>
            <span className="imolt-references-sync-detail">{syncRunDetail(run)}</span>
          </>
        )}

        {run === null && refusal !== null && (
          <Notice kind="warning">
            {refusal.title}
            {refusal.detail ? `. ${refusal.detail}` : ''}
          </Notice>
        )}

        {run === null && refusal === null && (
          <span className="imolt-references-sync-detail">Итог обновления загружается</span>
        )}
      </div>

      <Button kind="secondary" onClick={onManualStatus} disabled={disabled}>
        Задать статус вручную
      </Button>
    </section>
  );
}
