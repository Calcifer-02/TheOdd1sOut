/**
 * Модальное окно: разговор поверх страницы, пока он не закончен.
 *
 * Отдельный примитив, а не свойство всплывающего окна: у `Popover` из
 * `feedback.tsx` другое назначение — подсказка рядом с управлением, при
 * которой страница за окном остаётся рабочей. Здесь наоборот: страница
 * перехвачена целиком, фокус заперт внутри, прокрутка под окном
 * заблокирована. Смешивать эти два поведения в одном компоненте нельзя —
 * каждый его вызов пришлось бы читать вместе со свойствами, чтобы понять,
 * уйдёт ли из него фокус.
 *
 * Решение заказчика от 24.09.2026: маршрут до полигона показывается модальным
 * окном поверх страницы (R-033). Прежний запрет дизайн-договора на модальное
 * окно для маршрута снят тем же решением.
 *
 * Окно уходит порталом в корень страницы. Внутри области прокрутки таблицы
 * сравнения («overflow: auto») окно резалось справа и снизу — замер живого
 * стенда 24.09.2026 при ширине окна 1496: окно 360 × 400 в ячейке 78 × 48
 * внутри области 776 × 254.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Управления, до которых доходит обход по Tab. Тот же перечень объявлен у
 * полосы управлений (`buttons.tsx`): там он нужен перемещению стрелками, здесь
 * — запиранию фокуса. Оба списка описывают одно — что такое достижимое
 * управление, — но разъехаться не могут: перечень задан ролями элементов, а не
 * именами классов проекта.
 */
const FOCUSABLE = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Крестик закрытия. Сам по себе действия не называет — имя даёт кнопка. */
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Модальное окно. Показывается, пока стоит в разметке: собственного признака
 * «открыто» у него нет — состояние держит экран, как у выдвижной панели.
 *
 * Закрытие — крестиком, нажатием по подложке и клавишей Escape; после каждого
 * фокус возвращается на управление, которое окно открыло, иначе клавиатура
 * окажется в начале страницы.
 */
export function Modal({
  title,
  onClose,
  children,
  className,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Обработчик закрытия держится ссылкой: экран передаёт его новой стрелкой на
  // каждой отрисовке, и зависимость от самой функции перезапускала бы
  // подписку, а вместе с ней и перевод фокуса.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;

    box.current?.focus();

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        close.current();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const dialog = box.current;

      if (dialog === null) {
        return;
      }

      // Фокус заперт внутри окна: под окном страница перехвачена подложкой, и
      // обход по Tab, ушедший за окно, оставил бы клавиатуру на управлениях,
      // до которых указателем не дотянуться (разд. 4.5).
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];

      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    const body = document.body;
    const overflow = body.style.overflow;
    const padding = body.style.paddingRight;
    const top = window.scrollY;

    // Полоса прокрутки исчезает вместе с самой прокруткой, и содержимое
    // страницы под окном прыгает вправо на её ширину. Ширина полосы не
    // объявлена ни одним токеном: её знает только браузер — это разница между
    // окном браузера и шириной корня страницы (разд. 4.6).
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = 'hidden';

    if (scrollbar > 0) {
      body.style.paddingRight = `${scrollbar}px`;
    }

    return () => {
      body.style.overflow = overflow;
      body.style.paddingRight = padding;

      // Возврат к прежнему месту страницы: часть браузеров на мобильных
      // платформах при снятии блокировки уводит страницу к началу.
      window.scrollTo?.(0, top);
    };
  }, []);

  return createPortal(
    <div
      className="imolt-modal-backdrop"
      // Нажатие «вне окна» считается по самой подложке, а не по активному
      // элементу: подложка накрывает страницу целиком, и промах мимо окна
      // всегда попадает в неё.
      onMouseDown={event => {
        if (event.target !== event.currentTarget) {
          return;
        }

        // Нажатие по подложке само по себе переводит фокус на неё, и фокус,
        // возвращённый закрытием на вызвавшую кнопку, тут же уходил бы на
        // страницу. Подложка фокуса не принимает — брать его ей незачем.
        event.preventDefault();
        onClose();
      }}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={className ? `imolt-modal ${className}` : 'imolt-modal'}
      >
        <div className="imolt-modal-head">
          <h2 className="imolt-modal-title" id={titleId}>
            {title}
          </h2>
          {/* Крестик назван словами: значок без доступного имени для
              вспомогательной технологии остаётся безымянной кнопкой
              (разд. 4.5). */}
          <button
            type="button"
            className="imolt-modal-close"
            aria-label={`Закрыть «${title}»`}
            onClick={() => onClose()}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="imolt-modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
