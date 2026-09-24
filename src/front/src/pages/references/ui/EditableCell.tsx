/**
 * Редактируемое значение справочника: ячейка таблицы и поле карточки.
 *
 * Ячейка — это форма, а не текст, по которому можно кликнуть: у неё есть
 * подпись, доступное имя, отмена по `Escape`, сохранение по `Enter` и
 * кнопкой. Отказ службы показывается рядом с ячейкой, а значение при отказе
 * остаётся прежним: оптимистичная правка без отката показала бы цену,
 * которой в справочнике нет (R-042, ADR-0008).
 *
 * @req: R-042
 * @adr: ADR-0008
 */
import { useCallback, useState } from 'react';
import { Button } from '@/shared/ui';

export type EditableCellProps = {
  /**
   * Доступное имя значения: что правится и у какой записи. Позиция строки
   * именем не годится — таблица переставляется поиском (PRACT-021).
   */
  name: string;
  /** Значение, как его читает человек: уже отформатированное локалью. */
  value: string;
  /** Значение, с которого начинается правка: число договора без оформления. */
  draft: string;
  /** Правка закрыта: права ведения справочников нет либо идёт сохранение. */
  disabled?: boolean;
  /** Служба сейчас принимает именно это значение. */
  busy?: boolean;
  /** Отказ по этой ячейке: заголовок от службы либо разбор ввода. */
  refusal?: string | null;
  /** Сохранение. Истина — значение принято, ложь — осталось прежним. */
  onSave: (text: string) => Promise<boolean>;
  /** Снятие прежнего отказа при начале новой правки. */
  onStart?: () => void;
};

export function EditableCell({
  name,
  value,
  draft,
  disabled = false,
  busy = false,
  refusal = null,
  onSave,
  onStart,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  const start = useCallback(() => {
    setText(draft);
    setEditing(true);
    onStart?.();
  }, [draft, onStart]);

  const cancel = useCallback(() => {
    setEditing(false);
    setText('');
  }, []);

  if (!editing) {
    return (
      <>
        <button
          type="button"
          className="imolt-references-cell"
          aria-label={`${name}: ${value}`}
          disabled={disabled}
          onClick={start}
        >
          {value}
        </button>
        {refusal !== null && <span className="imolt-references-cell-error">{refusal}</span>}
      </>
    );
  }

  return (
    <form
      className="imolt-references-cell-form"
      onSubmit={event => {
        event.preventDefault();
        // Форма закрывается в обоих исходах: при отказе ячейка обязана
        // показать прежнее значение, а не набранное.
        void onSave(text).then(() => cancel());
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
        }
      }}
    >
      <input
        // Поле появляется по решению пользователя, и фокус обязан быть в нём:
        // иначе набор начинается мимо ячейки.
        autoFocus
        aria-label={name}
        inputMode="decimal"
        value={text}
        onChange={event => setText(event.target.value)}
      />
      <Button type="submit" size="s" disabled={busy} ariaLabel={`Сохранить ${name}`}>
        Сохранить
      </Button>
      <Button kind="tertiary" size="s" onClick={cancel} ariaLabel={`Отменить правку ${name}`}>
        Отменить
      </Button>
    </form>
  );
}
