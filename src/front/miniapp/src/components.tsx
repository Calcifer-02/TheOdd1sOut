/**
 * Компоненты экрана расчёта по дизайн-договору (`ux/ЗАПРОС_НА_ДИЗАЙН.md`,
 * разд. 4.4). Нативный элемент выбирается первым: флажок — это `input`,
 * вкладка — кнопка с ролью, поле — `label` плюс `input`. Доступное имя и
 * клавиатура берутся из семантики, а не дорисовываются атрибутами.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import type { ReactNode } from 'react';
import type { LandfillStatus, PlacementOption } from './api';
import { formatDistance, formatMoney, formatShortDate } from './formatting';

/** Значок статуса. Сам по себе смысла не несёт — рядом всегда слово. */
function StatusIcon({ status }: { status: BadgeStatus }) {
  const stroke = 'currentColor';

  if (status === 'active') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3.5 8.5L6.5 11.5L12.5 5"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (status === 'blocked') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" stroke={stroke} strokeWidth="1.5" />
        <path d="M4.2 11.8L11.8 4.2" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (status === 'stale') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" stroke={stroke} strokeWidth="1.5" />
        <path d="M8 5.2V8.4L10.2 9.8" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke={stroke} strokeWidth="1.5" />
      <path d="M8 5.4V5.5" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 7.4V10.6" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export type BadgeStatus = LandfillStatus | 'stale';

const STATUS_WORD: Record<BadgeStatus, string> = {
  active: 'Активен',
  blocked: 'Заблокирован',
  unconfirmed: 'Не подтверждён',
  stale: 'Данные устарели',
};

/**
 * Состояние полигона словом и значком: цвет сам по себе состояния не
 * обозначает (карточка практики PRACT-029). Рядом — дата, на которую
 * состояние известно (R-048).
 */
export function StatusBadge({ status, statusUpdatedAt }: { status: BadgeStatus; statusUpdatedAt: string }) {
  return (
    <>
      <span className="imolt-badge" data-status={status}>
        <StatusIcon status={status} />
        {STATUS_WORD[status]}
      </span>
      <span className="imolt-freshness">данные от {formatShortDate(statusUpdatedAt)}</span>
    </>
  );
}

/**
 * Состояние полигона с учётом свежести данных: полигон принимает отходы, но
 * подтверждение старше последнего обновления справочника. Правило
 * показа, а не расчёта: обе даты приходят от службы (R-048).
 */
export function badgeStatus(option: PlacementOption, statusesUpdatedAt: string): BadgeStatus {
  if (option.status === 'active' && option.statusUpdatedAt < statusesUpdatedAt) {
    return 'stale';
  }

  return option.status;
}

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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  inputMode?: 'text' | 'decimal' | 'tel';
  placeholder?: string;
  id: string;
}) {
  return (
    <div className="imolt-grow">
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
export function OptionCard({
  option,
  status,
  selected,
  onToggle,
  onRoute,
}: {
  option: PlacementOption;
  status: BadgeStatus;
  selected: boolean;
  onToggle: () => void;
  onRoute: () => void;
}) {
  return (
    <li
      className="imolt-option"
      data-selected={selected ? 'true' : 'false'}
      data-blocked={option.status === 'blocked' ? 'true' : 'false'}
    >
      <div className="imolt-option-head">
        <input
          type="checkbox"
          className="imolt-check"
          checked={selected}
          onChange={onToggle}
          aria-label={`Выбрать полигон ${option.landfillName}`}
        />
        <div className="imolt-grow">
          <div className="imolt-option-name">{option.landfillName}</div>
          <div className="imolt-option-address">
            {option.address} · {formatDistance(option.distanceKm)}
          </div>
        </div>
        <div className="imolt-total">{formatMoney(option.totalCost)}</div>
      </div>

      <div className="imolt-split">
        <StatusBadge status={status} statusUpdatedAt={option.statusUpdatedAt} />
      </div>

      <div className="imolt-option-head">
        <div className="imolt-split imolt-grow">
          <span>перевозка {formatMoney(option.transportCost)}</span>
          {option.disposalCost && <span>утилизация {formatMoney(option.disposalCost)}</span>}
        </div>
        <button type="button" className="imolt-button imolt-button--tertiary" onClick={onRoute}>
          Маршрут
        </button>
      </div>
    </li>
  );
}

/** Нижняя панель: сколько выбрано, на какую сумму и что с этим делать. */
export function SummaryBar({
  selectedCount,
  total,
  onDownload,
  onPickup,
  downloadLabel,
}: {
  selectedCount: number;
  total: string;
  onDownload: () => void;
  onPickup: () => void;
  downloadLabel: string;
}) {
  return (
    <div className="imolt-bar" aria-label={`Выбрано полигонов: ${selectedCount}`}>
      <div className="imolt-bar-line">
        <span>Выбрано {selectedCount}</span>
        <span className="imolt-total">{total}</span>
      </div>
      <div className="imolt-bar-actions">
        <button type="button" className="imolt-button imolt-button--secondary" onClick={onPickup}>
          Заявка на вывоз
        </button>
        <button type="button" className="imolt-button" onClick={onDownload}>
          {downloadLabel}
        </button>
      </div>
    </div>
  );
}

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
