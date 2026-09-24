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
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './buttons';

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
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="imolt-empty" role="status">
      <p className="imolt-empty-title">{title}</p>
      {hint && <p className="imolt-empty-hint">{hint}</p>}
      {action && <div className="imolt-empty-action">{action}</div>}
    </div>
  );
}

/**
 * Всплывающее окно: детали рядом с тем, что их вызвало.
 *
 * Не модальное намеренно — дизайн-договор запрещает модальное окно для
 * маршрута (разд. 4.6). Поэтому здесь нет ни `aria-modal`, ни ловушки фокуса:
 * страница за окном остаётся доступной. Закрытие — Escape и щелчок вне; фокус
 * возвращается на вызвавший элемент, иначе клавиатура окажется в начале
 * страницы.
 */
export function Popover({
  title,
  open,
  onClose,
  children,
  className,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

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
    opener.current = back;
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

  if (!open) {
    return null;
  }

  return (
    <div
      ref={box}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={className ? `imolt-popover ${className}` : 'imolt-popover'}
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
}
