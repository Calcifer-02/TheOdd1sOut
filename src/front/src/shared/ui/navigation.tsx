/**
 * Переключение выборки: вкладки, чипы фильтров и показ следующей порции.
 *
 * Разные компоненты сделаны разными ролями намеренно. Вкладка выбирает ровно
 * одно значение из нескольких — это `tablist` со стрелками. Чип включает и
 * выключает условие независимо от соседей — это кнопка с `aria-pressed`.
 * Подменить одно другим значит соврать вспомогательной технологии о числе
 * доступных состояний (дизайн-договор, разд. 4.4).
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import { useRef, type KeyboardEvent } from 'react';
import { formatNumber } from '@/shared/lib/formatting';
import { Button } from './buttons';

/**
 * Вкладки: выбор одного значения из нескольких.
 *
 * Стрелка сразу переносит и фокус, и выбор: вкладок немного, содержимое уже
 * загружено, и раздельное «перевёл фокус, теперь нажми пробел» здесь было бы
 * лишним шагом.
 */
export function Tabs<T extends string>({
  label,
  value,
  options,
  onPick,
  panelId,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; badge?: string }[];
  onPick: (value: T) => void;
  /** Идентификатор области, которой управляют вкладки, если она есть. */
  panelId?: string;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);

  function move(event: KeyboardEvent<HTMLDivElement>, next: number) {
    event.preventDefault();

    const buttons = box.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.item(next)?.focus();
    onPick(options[next].value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const at = options.findIndex((option) => option.value === value);

    if (at === -1 || options.length === 0) {
      return;
    }

    if (event.key === 'ArrowRight') {
      move(event, (at + 1) % options.length);
    } else if (event.key === 'ArrowLeft') {
      move(event, (at - 1 + options.length) % options.length);
    } else if (event.key === 'Home') {
      move(event, 0);
    } else if (event.key === 'End') {
      move(event, options.length - 1);
    }
  }

  return (
    <div
      ref={box}
      role="tablist"
      aria-label={label}
      className={className ? `imolt-tabs ${className}` : 'imolt-tabs'}
      onKeyDown={onKeyDown}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          className="imolt-tab"
          aria-selected={option.value === value}
          aria-controls={panelId}
          // Обход по Tab заходит в набор вкладок один раз и попадает на
          // выбранную; между вкладками ходят стрелками.
          tabIndex={option.value === value ? 0 : -1}
          onClick={() => onPick(option.value)}
        >
          {option.label}
          {option.badge !== undefined && <span className="imolt-tab-badge">{option.badge}</span>}
        </button>
      ))}
    </div>
  );
}

/** Чип фильтра: условие включено или выключено, соседи на это не влияют. */
export function Chip({
  label,
  pressed,
  onToggle,
  disabled = false,
  expanded,
  id,
  className,
}: {
  label: string;
  pressed: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** Чип открывает всплывающее окно с полем: состояние окна объявляется здесь. */
  expanded?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      className={className ? `imolt-chip ${className}` : 'imolt-chip'}
      aria-pressed={pressed}
      aria-haspopup={expanded === undefined ? undefined : 'dialog'}
      aria-expanded={expanded}
      disabled={disabled}
      onClick={onToggle}
    >
      {label}
    </button>
  );
}

/**
 * Показ следующей порции строк.
 *
 * Счётчик стоит рядом с кнопкой, а не вместо неё: число показанных против
 * общего меняет решение пользователя — снимать ли фильтр (PRACT-024). Когда
 * показано всё, кнопки нет: действие без последствия обещает то, чего не будет.
 */
export function Pager({
  total,
  shown,
  onMore,
  label = 'Показать ещё',
  loading = false,
}: {
  total: number;
  shown: number;
  onMore: () => void;
  label?: string;
  loading?: boolean;
}) {
  const complete = shown >= total;

  return (
    <div className="imolt-pager">
      <p className="imolt-pager-count" role="status">
        Показано {formatNumber(shown)} из {formatNumber(total)}
      </p>
      {!complete && (
        <Button kind="secondary" size="s" loading={loading} onClick={onMore}>
          {label}
        </Button>
      )}
    </div>
  );
}
