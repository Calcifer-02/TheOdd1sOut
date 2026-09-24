/**
 * Распределение объёма группы между выбранными полигонами (R-030).
 *
 * Панель ничего не считает и не отправляет: она показывает доли и объяснение
 * несходимости, а решение о том, когда доли уходят наружу, принимает модель
 * экрана. Так одно правило сходимости обслуживает оба представления.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import type { ApiProblem } from '@/shared/api/http';
import { Field, Notice } from '@/shared/ui';

/** Строка распределения: какому полигону сколько тонн назначено. */
export type AllocationRow = { landfillId: string; landfillName: string; share: string };

export function AllocationPanel({
  rows,
  mismatch,
  problem,
  onChange,
}: {
  rows: AllocationRow[];
  /** Объяснение несошедшихся долей; `null`, когда доли сошлись. */
  mismatch: string | null;
  /** Отказ расчётной части по распределению. */
  problem: ApiProblem | null;
  onChange: (landfillId: string, share: string) => void;
}) {
  return (
    <section className="imolt-card imolt-allocation" aria-label="Распределение объёма">
      <strong>Распределение объёма</strong>
      {rows.map((row) => (
        <div className="imolt-allocation-row" key={row.landfillId}>
          <Field
            id={`allocation-${row.landfillId}`}
            label={row.landfillName}
            value={row.share}
            inputMode="decimal"
            onChange={(value) => onChange(row.landfillId, value)}
          />
          <span className="imolt-hint">т</span>
        </div>
      ))}
      {mismatch && (
        <p className="imolt-error" role="alert">
          {mismatch}
        </p>
      )}
      {problem && (
        <Notice kind="error">
          <strong>{problem.title}</strong>
          {problem.detail && <span>{problem.detail}</span>}
        </Notice>
      )}
    </section>
  );
}
