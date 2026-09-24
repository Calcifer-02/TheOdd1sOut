/**
 * Ответ интерфейса на состояние данных: загрузка, пустой результат,
 * всплывающее окно (дизайн-договор, разд. 4.4).
 *
 * Все три состояния объявлены словом, а не только видом: серые полосы без
 * подписи для вспомогательной технологии — просто пустота, а пустой результат
 * без причины неотличим от отказа.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './buttons';
import { layout, space } from './tokens';

/** Место будущих строк на время загрузки. */
export function Skeleton({ rows = 3, label = 'Идёт загрузка' }: { rows?: number; label?: string }) {
  return (
    <div className="imolt-skeleton-list" role="status" aria-busy="true">
      {/* Полосы — только вид; смысл несёт подпись, иначе состояние теряется. */}
      <span className="imolt-visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="imolt-skeleton" aria-hidden="true" />
      ))}
    </div>
  );
}

/**
 * Пустой результат. Подсказка обязательна по смыслу, а не по типу: «ничего не
 * найдено» без указания, что снять, оставляет пользователя в тупике (Э-12).
 */
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="imolt-empty" role="status">
      <p className="imolt-empty-title">{title}</p>
      {hint && <p className="imolt-empty-hint">{hint}</p>}
      {action && <div className="imolt-empty-action">{action}</div>}
    </div>
  );
}

/** Место окна в координатах окна браузера. */
type PopoverPlace = { top: number; left: number; maxHeight: number };

/**
 * Куда встать вынесенному окну рядом с вызвавшим его управлением.
 *
 * Окно больше своего управления в разы — замер живого стенда 24.09.2026 дал
 * 360 × 400 у окна маршрута против 78 × 48 у ячейки таблицы, — поэтому левый
 * край равняется по управлению, но прижимается полем страницы, а сторона
 * выбирается по свободному месту: у нижней строки таблицы окно, поставленное
 * снизу, ушло бы за край окна браузера (R-033).
 */
function placeNear(anchor: DOMRect, box: DOMRect, view: { width: number; height: number }): PopoverPlace {
  const gap = space.xs;
  const edge = layout.gutter;

  const rightmost = Math.max(edge, view.width - box.width - edge);
  const left = Math.min(Math.max(anchor.left, edge), rightmost);

  const under = Math.max(view.height - anchor.bottom - gap - edge, 0);
  const over = Math.max(anchor.top - gap - edge, 0);

  if (box.height <= under || under >= over) {
    return { top: anchor.bottom + gap, left, maxHeight: under };
  }

  return { top: Math.max(edge, anchor.top - gap - box.height), left, maxHeight: over };
}

/**
 * Всплывающее окно: детали рядом с тем, что их вызвало.
 *
 * Не модальное намеренно — дизайн-договор запрещает модальное окно для
 * маршрута (разд. 4.6). Поэтому здесь нет ни `aria-modal`, ни ловушки фокуса:
 * страница за окном остаётся доступной. Закрытие — Escape и щелчок вне; фокус
 * возвращается на вызвавший элемент, иначе клавиатура окажется в начале
 * страницы.
 *
 * Свойство `detached` выносит окно из своей разметки в корень страницы и
 * ставит по месту вызвавшего управления. Оно нужно там, где предок обрезает
 * содержимое: в области прокрутки таблицы сравнения окно маршрута оказалось
 * шире ячейки в четыре с половиной раза и выше самой области в полтора, и
 * «overflow: auto» резал его справа и снизу (замер живого стенда 24.09.2026,
 * R-033). Без `detached` окно остаётся в потоке разметки — там, где предок
 * ничего не обрезает, это и дешевле, и точнее.
 */
export function Popover({
  title,
  open,
  onClose,
  children,
  className,
  detached = false,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Вынести окно в корень страницы: предок обрезает содержимое. */
  detached?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLSpanElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [place, setPlace] = useState<PopoverPlace | null>(null);

  // Обработчик закрытия держится ссылкой: экран передаёт его новой стрелкой
  // на каждой отрисовке, и зависимость от самой функции перезапускала бы
  // подписку, а вместе с ней и перевод фокуса.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) {
      return;
    }

    const back = document.activeElement as HTMLElement | null;
    const host = mark.current?.parentElement ?? null;

    // Окно, открытое наведением, вызвано не фокусом: активным элементом
    // остаётся `document.body`, и считать «вне окна» от него значит не
    // закрывать окно нигде. Тогда вызвавшим управлением считается оправа
    // кнопки, рядом с которой окно стоит (разд. 4.5).
    opener.current = back === document.body ? host : back;
    box.current?.focus();

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        close.current();
      }
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;

      // Нажатие по вызвавшей кнопке не закрывается здесь: она сама переключит
      // окно, и двойное действие оставило бы окно открытым.
      if (box.current?.contains(target) || opener.current?.contains(target)) {
        return;
      }

      close.current();
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
      back?.focus();
    };
  }, [open]);

  // Место считается до отрисовки на экране: вынесенное окно стоит в
  // координатах окна браузера, и кадр со значениями по умолчанию был бы виден
  // как прыжок из левого верхнего угла.
  useLayoutEffect(() => {
    if (!open || !detached) {
      return;
    }

    function put() {
      const host = mark.current?.parentElement;
      const dialog = box.current;

      if (!host || !dialog) {
        return;
      }

      const view = { width: window.innerWidth, height: window.innerHeight };

      setPlace(placeNear(host.getBoundingClientRect(), dialog.getBoundingClientRect(), view));
    }

    put();

    // Прокрутка предка и смена размера окна двигают вызвавшее управление, а
    // окно стоит в координатах окна браузера: без пересчёта оно оторвалось бы
    // от кнопки. Слушатель прокрутки — на этапе перехвата: прокрутка области
    // таблицы до окна браузера не всплывает.
    window.addEventListener('scroll', put, true);
    window.addEventListener('resize', put);

    return () => {
      window.removeEventListener('scroll', put, true);
      window.removeEventListener('resize', put);
    };
  }, [open, detached]);

  if (!open) {
    return null;
  }

  const style: CSSProperties | undefined =
    place === null ? undefined : { top: place.top, left: place.left, maxHeight: place.maxHeight };

  const dialog = (
    <div
      ref={box}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={className ? `imolt-popover ${className}` : 'imolt-popover'}
      data-detached={detached ? 'true' : undefined}
      style={style}
    >
      <div className="imolt-popover-head">
        <p className="imolt-popover-title" id={titleId}>
          {title}
        </p>
        <Button kind="tertiary" size="s" ariaLabel={`Закрыть «${title}»`} onClick={onClose}>
          Закрыть
        </Button>
      </div>
      {children}
    </div>
  );

  if (!detached) {
    return dialog;
  }

  return (
    <>
      {/* Метка места: сама она ничего не показывает и в раскладку не входит, но
          по её оправе видно, где стоит вызвавшее управление. Иначе вынесенному
          окну не от чего считать координаты: при открытии наведением фокус
          остаётся на странице, а не на кнопке. */}
      <span ref={mark} className="imolt-popover-mark" aria-hidden="true" />
      {createPortal(dialog, document.body)}
    </>
  );
}
