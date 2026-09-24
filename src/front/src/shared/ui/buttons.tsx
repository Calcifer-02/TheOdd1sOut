/**
 * Действия общего слоя: кнопка и полоса управлений (дизайн-договор, разд. 4.4).
 *
 * Нативный элемент выбран первым: кнопка — это `button`, поэтому пробел,
 * Enter и объявление роли достаются без единого атрибута. Вид действия
 * называется ролью (`kind`), а не цветом: лаймовое главное действие на экране
 * одно, и держать это правило можно только там, где вид объявлен словом.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import { useRef, type KeyboardEvent, type ReactNode } from 'react';

/** Вид действия. Оранжевого среди них нет: он принадлежит марке (разд. 4.1). */
export type ButtonKind = 'primary' | 'secondary' | 'tertiary' | 'danger';

export function Button({
  children,
  onClick,
  type = 'button',
  kind = 'primary',
  disabled = false,
  size = 'm',
  className,
  ariaLabel,
  loading = false,
  reserve,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  kind?: ButtonKind;
  disabled?: boolean;
  size?: 'm' | 's';
  className?: string;
  /**
   * Подпись, под которую резервируется место, когда кнопка меняет подпись
   * вместе с состоянием: переключателю порядка сортировки передают вторую его
   * подпись, и ширина управления перестаёт зависеть от текущей — иначе каждое
   * нажатие двигает соседей по полосе (R-024, R-085). Резерв скрыт от
   * вспомогательной технологии, доступным именем остаётся текущая подпись.
   */
  reserve?: string;
  /**
   * Доступное имя, когда подпись — значок. Без него кнопка-значок остаётся
   * безымянной для вспомогательной технологии (разд. 4.5).
   */
  ariaLabel?: string;
  /**
   * Действие идёт. Подпись остаётся в разметке, чтобы ширина кнопки не
   * прыгала, а рядом появляется признак ожидания (разд. 4.4).
   */
  loading?: boolean;
}) {
  const classes = ['imolt-button', `imolt-button--${kind}`, `imolt-button--${size}`, className]
    .filter(name => name !== undefined && name !== '')
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      // Нажатие во время ожидания повторило бы уже идущее действие.
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-busy={loading ? true : undefined}
      onClick={onClick}
    >
      {reserve === undefined ? (
        <span className="imolt-button-label">{children}</span>
      ) : (
        <span className="imolt-button-label imolt-button-label--reserve">
          <span>{children}</span>
          <span className="imolt-button-reserve" aria-hidden="true">
            {reserve}
          </span>
        </span>
      )}
      {loading && (
        <>
          <span className="imolt-spinner" aria-hidden="true" />
          {/* Ожидание названо словом: один визуальный признак его не выражает. */}
          <span className="imolt-visually-hidden">идёт выполнение</span>
        </>
      )}
    </button>
  );
}

/** Управления, до которых доходят стрелками, а не только обходом по Tab. */
const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Полоса управлений: группа действий над содержимым экрана.
 *
 * Роль `toolbar` обещает вспомогательной технологии перемещение стрелками, и
 * обещание выполняется здесь же. Обход по Tab при этом сохранён: отбирать у
 * клавиатуры привычный способ дойти до соседней кнопки нельзя.
 */
/**
 * Управление, которому стрелки принадлежат самому: поле ввода, многострочное
 * поле, список выбора и редактируемая область. Перехватывать их полосе
 * управлений нельзя (WAI-ARIA, образец `toolbar`).
 */
function typingTarget(node: Element | null): boolean {
  if (node === null) {
    return false;
  }

  const tag = node.tagName.toLowerCase();

  if (tag === 'textarea' || tag === 'select') {
    return true;
  }

  if (tag === 'input') {
    const type = (node as HTMLInputElement).type;

    // Флажок и переключатель стрелками текст не правят, и полоса вправе их
    // перебирать; всё остальное — ввод.
    return type !== 'checkbox' && type !== 'radio' && type !== 'button';
  }

  return node.getAttribute('contenteditable') === 'true';
}

export function Toolbar({
  ariaLabel,
  children,
  className,
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;

    if (step === 0 || box.current === null) {
      return;
    }

    // В поле ввода и в списке выбора стрелки уже заняты: они двигают каретку и
    // перебирают значения. Полоса управлений перехватывала их и уводила фокус
    // на соседнюю кнопку — в редакторе цен поиск живёт внутри полосы, и текст
    // в нём нельзя было править стрелками.
    if (typingTarget(document.activeElement)) {
      return;
    }

    const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const at = items.indexOf(document.activeElement as HTMLElement);

    if (at === -1) {
      return;
    }

    event.preventDefault();
    items[(at + step + items.length) % items.length].focus();
  }

  return (
    <div
      ref={box}
      role="toolbar"
      aria-label={ariaLabel}
      className={className ? `imolt-toolbar ${className}` : 'imolt-toolbar'}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
