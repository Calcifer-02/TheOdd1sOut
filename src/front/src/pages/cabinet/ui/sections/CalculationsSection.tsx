/**
 * Раздел «Расчёты»: сохранённые расчёты участника (экран Э-10).
 *
 * Порядок состояний — загрузка, отказ, пусто, строки — общий для обоих
 * представлений: различаются они только тем, чем показаны строки. Вторая
 * копия этого порядка рядом с карточками разошлась бы с первой.
 *
 * @supports: R-008, R-049
 * @adr: ADR-0008
 */
import { EmptyState, Notice, Pager, Skeleton } from '@/shared/ui';
import { CALCULATOR_PATH, hashOf } from '@/shared/lib/routing';
import type { CalculationsState } from '../../model/cabinet';
import { CalculationsCards } from './CalculationsCards';
import { CalculationsTable } from './CalculationsTable';

export function CalculationsSection({ state, wide }: { state: CalculationsState; wide: boolean }) {
  const empty = !state.loading && state.failure === null && state.items.length === 0;

  return (
    <section className="imolt-cabinet-section" aria-labelledby="imolt-cabinet-calculations">
      <div className="imolt-cabinet-head">
        <div className="imolt-cabinet-heading">
          <h1 className="imolt-title" id="imolt-cabinet-calculations">
            Расчёты
          </h1>
          <p className="imolt-lead">Сохранённые расчёты и выпущенные коммерческие предложения</p>
        </div>
        <a className="imolt-link imolt-cabinet-link" href={hashOf(CALCULATOR_PATH)}>
          Новый расчёт
        </a>
      </div>

      {state.failure !== null && <Notice kind="error">{state.failure}</Notice>}

      {state.loading && state.items.length === 0 && (
        <Skeleton rows={3} label="Расчёты загружаются" />
      )}

      {empty && (
        <EmptyState
          title="Сохранённых расчётов пока нет"
          hint="Выполните расчёт – он останется здесь вместе с итогом и предложением."
        />
      )}

      {state.items.length > 0 &&
        (wide ? (
          <CalculationsTable rows={state.items} />
        ) : (
          <CalculationsCards rows={state.items} />
        ))}

      {/* Счётчик показанного против общего остаётся и когда показано всё:
          число расчётов меняет решение участника, а не только кнопка
          (карточка практики PRACT-024). */}
      {state.items.length > 0 && (
        <Pager
          total={state.total}
          shown={state.items.length}
          onMore={state.showMore}
          loading={state.loading}
          label="Показать ещё расчёты"
        />
      )}
    </section>
  );
}
