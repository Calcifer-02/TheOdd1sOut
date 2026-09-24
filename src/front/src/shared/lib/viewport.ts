/**
 * Ширина окна как предметное решение, а не как набор правил вёрстки.
 *
 * Часть различий между узким и широким экраном оформлением не выражается:
 * на телефоне сравнение полигонов — карточки, на рабочем месте — таблица со
 * столбцами; на телефоне сводка выбора прилипает снизу, на рабочем месте —
 * справа. Это разные деревья разметки, и выбирать между ними должен код, а не
 * правило `display: none`, оставляющее в странице обе ветки сразу.
 *
 * Точки перелома — из дизайн-договора (`ux/ЗАПРОС_НА_ДИЗАЙН.md`, разд. 4.5):
 * 768 — таблица становится карточками, 1024 — сводка уходит под таблицу,
 * 1240 — предельная ширина содержимого.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import { useSyncExternalStore } from 'react';

/** Точки перелома дизайн-договора, разд. 4.5. */
export const BREAKPOINTS = {
  /** Ниже — карточки вместо таблицы и нижняя панель вместо правой колонки. */
  cards: 768,
  /** Ниже — сводка выбора уходит под таблицу. */
  sideSummary: 1024,
  /** Предельная ширина содержимого на широком экране. */
  container: 1240,
} as const;

export type Viewport = 'mobile' | 'tablet' | 'desktop';

const CARDS_QUERY = `(min-width: ${BREAKPOINTS.cards}px)`;

const SIDE_SUMMARY_QUERY = `(min-width: ${BREAKPOINTS.sideSummary}px)`;

function matches(query: string): boolean {
  // Среда без matchMedia — не ошибка: проверки идут в jsdom, а мини-приложение
  // открывается на телефоне. Узкий экран здесь безопаснее широкого.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia(query).matches;
}

function subscribeTo(query: string): (onChange: () => void) => () => void {
  return (onChange) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return () => undefined;
    }

    const media = window.matchMedia(query);
    media.addEventListener('change', onChange);

    return () => media.removeEventListener('change', onChange);
  };
}

/** Текущая ширина окна в предметных значениях, с подпиской на её смену. */
export function useViewport(): Viewport {
  const wide = useSyncExternalStore(
    subscribeTo(CARDS_QUERY),
    () => matches(CARDS_QUERY),
    () => false,
  );

  const wider = useSyncExternalStore(
    subscribeTo(SIDE_SUMMARY_QUERY),
    () => matches(SIDE_SUMMARY_QUERY),
    () => false,
  );

  if (wider) {
    return 'desktop';
  }

  return wide ? 'tablet' : 'mobile';
}

/**
 * Широкий экран — рабочее место: таблица, столбцы, боковая колонка. Узкий —
 * телефон у объекта сноса: карточки и одна колонка.
 */
export function isWide(viewport: Viewport): boolean {
  return viewport !== 'mobile';
}
