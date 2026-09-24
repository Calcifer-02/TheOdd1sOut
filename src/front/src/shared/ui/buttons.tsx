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
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  kind?: ButtonKind;
  disabled?: boolean;
  size?: 'm' | 's';
  className?: string;
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
      <span className="imolt-button-label">{children}</span>
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
