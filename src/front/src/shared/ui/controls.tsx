/**
 * Примитивы интерфейса по дизайн-договору (`ux/ЗАПРОС_НА_ДИЗАЙН.md`,
 * разд. 4.4). Нативный элемент выбирается первым: флажок — это `input`,
 * поле — `label` плюс `input`, переключатель — группа радиокнопок. Доступное
 * имя и клавиатура берутся из семантики, а не дорисовываются атрибутами.
 *
 * Предметных типов здесь нет: слой общий, и знать о полигонах он не должен.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import type { ReactNode } from 'react';

export function Notice({
  kind,
  children,
}: {
  kind: 'error' | 'warning' | 'empty' | 'done';
  children: ReactNode;
}) {
  return (
    <div className="imolt-notice" data-kind={kind} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

/** Поле ввода с подписью: плейсхолдер подпись не заменяет (разд. 4.4). */
export function Field({
  label,
  value,
  onChange,
  hint,
  error,
  inputMode,
  placeholder,
  id,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  inputMode?: 'text' | 'decimal' | 'tel';
  placeholder?: string;
  id: string;
  /** Дополнительный класс обёртки: ширина поля — дело строки, а не поля. */
  className?: string;
}) {
  return (
    <div className={className ? `imolt-grow ${className}` : 'imolt-grow'}>
      <label className="imolt-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="imolt-input"
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <p className="imolt-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
      {!error && hint && (
        <p className="imolt-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** Список подсказок: до шести строк, выбор — кнопкой, доступной клавиатурой. */
export function SuggestList<T>({
  items,
  label,
  render,
  onPick,
}: {
  items: T[];
  label: string;
  render: (item: T) => string;
  onPick: (item: T) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  // Роль списка выбора, а не набора кнопок: вспомогательная технология
  // объявляет число вариантов и текущий, а клавиатура работает без правок.
  return (
    <div className="imolt-suggest" role="listbox" aria-label={label}>
      {items.map((item, index) => (
        <button
          key={`${index}-${render(item)}`}
          type="button"
          role="option"
          aria-selected={false}
          onClick={() => onPick(item)}
        >
          {render(item)}
        </button>
      ))}
    </div>
  );
}

/**
 * Карточка полигона: перевозка, утилизация и итог названы раздельно (R-019),
 * выбор — нативный флажок с именем полигона в доступном имени (R-027).
 */

/** Выдвижная панель вместо модального окна: маршрут и заявка (PRACT-020). */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="imolt-sheet" role="dialog" aria-label={title}>
      <div className="imolt-bar-line">
        <strong>{title}</strong>
        <button type="button" className="imolt-button imolt-button--tertiary" onClick={onClose}>
          Закрыть
        </button>
      </div>
      {children}
    </div>
  );
}

/**
 * Взаимоисключающий выбор нативными переключателями: мера объёма и поле
 * сортировки. Кнопка с `aria-pressed` выражала бы независимые состояния,
 * а здесь выбирается ровно одно значение (дизайн-договор, разд. 4.4).
 */
export function RadioPills<T extends string>({
  name,
  label,
  options,
  value,
  onPick,
  className,
}: {
  name: string;
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onPick: (value: T) => void;
  className: string;
}) {
  return (
    <div className={className} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label key={option.value} className="imolt-pill" data-checked={option.value === value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onPick(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
