/**
 * Управления формы общего слоя: флажок и выбор из списка (разд. 4.4).
 *
 * Оба — нативные элементы. Флажок рисуется правилом стиля, но остаётся
 * `input[type=checkbox]`: состояние «отмечено» объявляется платформой, а
 * пробел работает без обработчика. Выбор — `select`: на телефоне он открывает
 * системный список, до которого нарисованному списку далеко.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import type { ReactNode } from 'react';

/**
 * Флажок с подписью. Подпись связана через `htmlFor`, а не обёрнута вокруг:
 * подпись бывает составной («Согласен с [политикой]»), и вложенная ссылка
 * внутри `label` перехватывала бы нажатие по флажку.
 */
export function Checkbox({
  id,
  label,
  checked,
  onChange,
  disabled = false,
  className,
}: {
  id: string;
  label: ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <span className={className ? `imolt-consent ${className}` : 'imolt-consent'}>
      <input
        id={id}
        type="checkbox"
        className="imolt-check"
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
      />
      <label className="imolt-check-label" htmlFor={id}>
        {label}
      </label>
    </span>
  );
}

/**
 * Выбор одного значения из списка. Подпись обязательна и плейсхолдером не
 * подменяется (разд. 4.4); пояснение и отказ связаны с полем через
 * `aria-describedby`, иначе их читает только зрячий пользователь.
 */
export function Select<T extends string>({
  id,
  label,
  value,
  options,
  onPick,
  hint,
  error,
  disabled = false,
  className,
}: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onPick: (value: T) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={className ? `imolt-grow ${className}` : 'imolt-grow'}>
      <label className="imolt-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="imolt-select"
        value={value}
        disabled={disabled}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        onChange={event => onPick(event.target.value as T)}
      >
        {options.map(option => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
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
