/**
 * Раздел витрины: заголовок и образцы одного компонента.
 *
 * Общий для всех разделов, чтобы витрина не расходилась сама с собой:
 * одинаковая рамка вокруг образцов — признак того, что смотрят на компонент,
 * а не на его оправу.
 *
 * @supports: R-084
 */
import type { ReactNode } from 'react';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const anchor = `vitrina-${title.replaceAll(' ', '-')}`;

  return (
    <section className="imolt-card" aria-labelledby={anchor}>
      <h2 className="imolt-section" id={anchor}>
        {title}
      </h2>
      {children}
    </section>
  );
}
