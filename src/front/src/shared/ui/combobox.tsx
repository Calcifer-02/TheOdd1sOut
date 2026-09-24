/**
 * Закрытый список с поиском: значением поля становится только запись
 * справочника (дизайн-договор, разд. 4.4; R-013).
 *
 * Обычное поле ввода рядом со списком подсказок принимает любую строку, а
 * браузер вдобавок предлагает ранее набранные значения и держит их до конца
 * сессии: пользователь видит «выпадающий список, в который можно дописать
 * своё», и в расчёт уходит тип отходов, которого в справочнике нет (BUG-004).
 * Память браузера выключает `autoComplete="off"`, а произвольную строку
 * отсекает правило «ушёл, ничего не выбрав, — строка вернулась к выбранной
 * записи или опустела».
 *
 * Разметка — по образцу WAI-ARIA combobox со списком: у поля роль `combobox`
 * со ссылками `aria-controls` и `aria-activedescendant`, у списка — `listbox`
 * со строками `option`. Стрелки, Enter и Escape обслуживаются здесь же: роль
 * обещает вспомогательной технологии именно такое поведение, и обещание
 * нельзя оставить невыполненным.
 *
 * Открыт ли список и какая строка подсвечена — состояние показа, а не
 * предмета, поэтому оно живёт здесь, а запись справочника и строка поиска
 * приходят снаружи. Иначе запоздавший ответ справочника снова раскрывал бы
 * список уже после выбора.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import { useId, useState, type KeyboardEvent } from 'react';
import { colors, fonts, layout, radius, space, stroke, zIndex } from './tokens';
import { useStyles } from './useStyles';

const COMBOBOX_CSS = `
/* Список висит над содержимым, а не раздвигает его: иначе форма прыгает на
   каждую букву, и палец уезжает с уже выбранной строки (разд. 4.4). */
.imolt-combobox-box { position: relative; }

.imolt-combobox-list {
  position: absolute;
  top: calc(100% + ${space.xxs}px);
  left: 0;
  right: 0;
  z-index: ${zIndex.popover};
  list-style: none;
  margin: 0;
  padding: ${space.xxs}px;
  border: ${stroke.hairline}px solid ${colors.borderDefault};
  border-radius: ${radius.field}px;
  background: ${colors.bgSurface};
  box-shadow: ${layout.shadow};
  max-height: ${layout.touchTarget * 6}px;
  overflow-y: auto;
}

.imolt-combobox-option {
  display: flex;
  align-items: center;
  min-height: ${layout.touchTarget}px;
  padding: ${space.xs}px ${space.s}px;
  border-radius: ${radius.badge}px;
  font-family: ${fonts.ui};
  font-size: 14px;
  line-height: 20px;
  color: ${colors.textPrimary};
  cursor: pointer;
}

/* Наведение — только там, где указатель есть. На сенсорном экране правило
   наведения залипает после касания, и строка остаётся подсвеченной, хотя
   палец уже убран (BUG-008). */
@media (hover: hover) {
  .imolt-combobox-option:hover { background: ${colors.accentRowHover}; }
}

/* Подсвеченная строка — та, которую подтвердит Enter. При выборе с клавиатуры
   она единственный ориентир, поэтому видна и рамкой, а не только заливкой
   (разд. 4.5: состояние не выражается одним цветом). */
.imolt-combobox-option[data-active='true'] {
  background: ${colors.accentRowHover};
  box-shadow: inset 0 0 0 ${stroke.emphasis}px ${colors.link};
}

/* Уже выбранная запись справочника: при повторном открытии списка видно, на
   чём человек остановился. */
.imolt-combobox-option[aria-selected='true'] { font-weight: 600; }
`;

export function Combobox<T>({
  id,
  label,
  listLabel,
  items,
  query,
  selected,
  render,
  onQuery,
  onPick,
  onDismiss,
  onOpen,
  placeholder,
  hint,
  error,
  className,
}: {
  id: string;
  /** Подпись поля. Плейсхолдером она не подменяется (разд. 4.4). */
  label: string;
  /** Доступное имя списка: у поля и у списка имена разные. */
  listLabel: string;
  items: T[];
  /** Строка поиска — то, что видно в поле. */
  query: string;
  /** Выбранная запись справочника; `null` — не выбрано ничего. */
  selected: T | null;
  render: (item: T) => string;
  onQuery: (value: string) => void;
  onPick: (item: T) => void;
  /**
   * Пользователь ушёл из поля или нажал Escape, ничего не выбрав. Закрытый
   * список обязан вернуть строку к выбранной записи или к пустой — иначе
   * произвольный текст остаётся в поле и читается как значение (R-013,
   * BUG-004). Поле со свободным вводом — адрес вывоза, где перечня не
   * существует, — обработчик не передаёт.
   */
  onDismiss?: () => void;
  /**
   * Список открывается. Справочник показывается целиком: типов отходов
   * немного, и человек обязан видеть, из чего выбирает, а не пустоту
   * (R-013).
   */
  onOpen?: () => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  className?: string;
}) {
  useStyles('combobox', COMBOBOX_CSS);

  const listId = useId();
  const [open, setOpen] = useState(false);
  /** Подсвеченная строка списка; -1 — не подсвечено ничего. */
  const [active, setActive] = useState(-1);

  // Пустой список не объявляется раскрытым: «открыто, но ничего нет» —
  // неправда для вспомогательной технологии.
  const expanded = open && items.length > 0;
  const activeId = expanded && active >= 0 ? `${listId}-${active}` : undefined;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  function show() {
    setOpen(true);
    setActive(-1);
    onOpen?.();
  }

  function hide() {
    setOpen(false);
    setActive(-1);
  }

  function pick(item: T) {
    hide();
    onPick(item);
  }

  function dismiss() {
    hide();
    onDismiss?.();
  }

  /** Следующая подсвеченная строка: с непомеченной начинается с края списка. */
  function step(from: number, direction: 1 | -1): number {
    if (from < 0) {
      return direction > 0 ? 0 : items.length - 1;
    }

    return (from + direction + items.length) % items.length;
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
      return;
    }

    const direction = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;

    if (direction !== 0) {
      // Стрелка в поле ввода иначе уводит каретку в начало или конец строки.
      event.preventDefault();

      if (!open) {
        show();
        return;
      }

      if (items.length > 0) {
        setActive(step(active, direction));
      }

      return;
    }

    if (event.key === 'Enter' && expanded && active >= 0) {
      // Enter подтверждает подсвеченную строку, а не отправляет форму.
      event.preventDefault();
      pick(items[active]);
    }
  }

  return (
    <div className={className ? `imolt-grow ${className}` : 'imolt-grow'}>
      <label className="imolt-label" htmlFor={id}>
        {label}
      </label>
      <div className="imolt-combobox-box">
        <input
          id={id}
          type="text"
          role="combobox"
          className="imolt-input"
          value={query}
          placeholder={placeholder}
          // Память браузера предлагала бы ранее набранные строки, которых в
          // справочнике нет, и список перестал бы быть закрытым (BUG-004).
          autoComplete="off"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          onFocus={show}
          onBlur={dismiss}
          onKeyDown={onKeyDown}
          onChange={event => {
            setOpen(true);
            setActive(-1);
            onQuery(event.target.value);
          }}
        />
        {expanded && (
          <ul className="imolt-combobox-list" id={listId} role="listbox" aria-label={listLabel}>
            {items.map((item, index) => (
              <li
                key={`${index}-${render(item)}`}
                id={`${listId}-${index}`}
                className="imolt-combobox-option"
                role="option"
                aria-selected={selected !== null && render(item) === render(selected)}
                data-active={index === active}
                // Нажатие по строке не уводит фокус из поля: иначе первым
                // сработал бы уход из поля, вернул бы прежнее значение, и
                // выбор пришёл бы в уже закрытый список.
                onMouseDown={event => event.preventDefault()}
                onClick={() => pick(item)}
              >
                {render(item)}
              </li>
            ))}
          </ul>
        )}
      </div>
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
