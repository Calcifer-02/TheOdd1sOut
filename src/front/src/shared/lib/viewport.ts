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
 * Выбранное представление видно в адресе страницы и закрепляется им: ссылка
 * называет, что на ней показано, а закрепить телефонное представление можно
 * и на широком мониторе, где ширина его никогда не выберет (R-085, AC-085c).
 * Подключение к `./routing` направлено в одну сторону: адрес о представлении
 * не знает, иначе два отрезка общего слоя замкнулись бы в кольцо.
 *
 * @req: R-085
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { VIEW_PARAM, replaceRoute, useRoute, withViewParam } from './routing';

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
  return onChange => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return () => undefined;
    }

    const media = window.matchMedia(query);
    media.addEventListener('change', onChange);

    return () => media.removeEventListener('change', onChange);
  };
}

/**
 * Представления, которыми экран называется в адресе, — те же значения, что и
 * в коде: второго словаря для человека здесь не заводится, иначе перевод
 * между ним и `Viewport` пришлось бы держать в согласии вручную.
 */
const PINNABLE_VIEWS: Viewport[] = ['mobile', 'tablet', 'desktop'];

/** Представление из адреса. Незнакомое значение не действует и не мешает. */
function viewportOf(value: string | null): Viewport | null {
  return PINNABLE_VIEWS.includes(value as Viewport) ? (value as Viewport) : null;
}

/** Представление, которое выбирает одна ширина окна. */
function viewportByWidth(wide: boolean, wider: boolean): Viewport {
  if (wider) {
    return 'desktop';
  }

  return wide ? 'tablet' : 'mobile';
}

/**
 * Текущее представление экрана: закреплённое адресом, иначе — выбранное
 * шириной окна. С подпиской и на адрес, и на ширину.
 *
 * Здесь и принимается решение о представлении: экраны его не выбирают, а
 * спрашивают готовое и рисуют свою ветку.
 *
 * @req: R-085
 */
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

  const byWidth = viewportByWidth(wide, wider);
  const route = useRoute();
  const pinned = viewportOf(route.query.get(VIEW_PARAM));

  // Представление, выбранное шириной до текущей отрисовки. Адрес подписывается
  // на пересечении точки перелома, а не при каждой отрисовке: иначе параметр
  // садился бы на всякую ссылку, ничего о смене представления не сообщая.
  const previousByWidth = useRef(byWidth);

  useEffect(() => {
    const crossed = previousByWidth.current !== byWidth;
    // Своей подписью считается пустое место или значение, называвшее
    // представление до пересечения: закрепление, поставленное человеком,
    // ширина окна не перетирает.
    const ours = pinned === null || pinned === previousByWidth.current;

    previousByWidth.current = byWidth;

    if (!crossed || !ours) {
      return;
    }

    // Замена записи, а не новая: «назад» обязан возвращать на предыдущий этап
    // пути, а не перебирать промежуточные ширины окна (R-085, AC-085c).
    //
    // Цикла «адрес меняет представление, представление меняет адрес» нет:
    // запись делает только смена ширины, а смена адреса ширину не трогает —
    // повторный проход по этому действию застаёт `crossed === false`.
    replaceRoute(route.path, withViewParam(route.query, byWidth));
  }, [byWidth, pinned, route]);

  return pinned ?? byWidth;
}

/**
 * Широкий экран — рабочее место: таблица, столбцы, боковая колонка. Узкий —
 * телефон у объекта сноса: карточки и одна колонка.
 *
 * @req: R-085
 */
export function isWide(viewport: Viewport): boolean {
  return viewport !== 'mobile';
}
