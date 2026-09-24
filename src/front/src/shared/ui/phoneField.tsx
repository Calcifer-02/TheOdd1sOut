/**
 * Поле ввода телефона: человек набирает цифры, поле держит вид
 * «+7 999 123 45 67».
 *
 * Обычное текстовое поле принимает что угодно, и номер приходит менеджеру
 * записанным семью разными способами. Договор заявки на вывоз допускает ровно
 * одну запись — «+7» и десять цифр, — поэтому вид собирает поле, а не человек:
 * разделители расставляются сами, а стирать их вручную не приходится.
 *
 * Наружу уходит именно запись договора, а не видимая строка. Пробелы —
 * оформление; уйди они за пределы поля, каждый экран вычищал бы их у себя, и
 * второе место сборки номера разошлось бы с этим (ADR-0008, инвариант 1).
 *
 * Разбор и сборка вынесены в чистые функции: правило номера проверяется без
 * отрисовки, а в обработчике события остаётся только каретка.
 *
 * Предметных типов здесь нет: слой общий, и о заявке на вывоз он не знает —
 * запись договора названа в комментарии, а не подключена типом.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import { useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { fonts } from './tokens';
import { useStyles } from './useStyles';

const PHONE_FIELD_CSS = `
/* Номер — число, и разряды в нём обязаны стоять столбиком: в пропорциональной
   гарнитуре группа «111» уже группы «999», и набранное дёргается на каждом
   знаке (разд. 4.2: числа набираются гарнитурой с табличными цифрами). */
.imolt-input--phone {
  font-family: ${fonts.numeric};
  font-variant-numeric: tabular-nums;
}
`;

/** Длина номера с кодом страны: «7» и десять цифр. */
export const PHONE_LENGTH = 11;

/** Группы цифр после кода страны: «+7 999 123 45 67». */
const PHONE_GROUPS = [3, 3, 2, 2];

/** Куда целилась клавиша стирания: «back» — Backspace, «forward» — Delete. */
export type PhoneErase = 'back' | 'forward';

/** Итог правки: значение наружу, видимая строка и место каретки в ней. */
export type PhoneEditResult = { value: string; view: string; caret: number };

/**
 * Цифры номера в каноническом виде: строка начинается с кода страны «7», всё
 * остальное отброшено.
 *
 * Правило кода названо заказчиком: набранная первой «8» — междугородный выход,
 * первая «7» — сам код, обе дают «+7». Номер, начатый сразу с «9», тоже
 * получает код: человек набирает свой номер без него, и заставлять его
 * вспоминать код незачем.
 */
export function phoneDigits(raw: string): string {
  const typed = raw.replace(/\D/g, '');

  if (typed.length === 0) {
    return '';
  }

  const head = typed.slice(0, 1);
  const rest = head === '7' || head === '8' ? typed.slice(1) : typed;

  // Двенадцатая цифра не принимается: длиннее номера в российском плане
  // нумерации нет, а лишняя цифра тихо уехала бы в заявку.
  return `7${rest}`.slice(0, PHONE_LENGTH);
}

/** Видимая строка «+7 999 123 45 67» из канонических цифр. */
export function phoneView(digits: string): string {
  if (digits.length === 0) {
    return '';
  }

  let view = `+${digits.slice(0, 1)}`;
  let at = 1;

  for (const size of PHONE_GROUPS) {
    if (at >= digits.length) {
      break;
    }

    view += ` ${digits.slice(at, at + size)}`;
    at += size;
  }

  return view;
}

/** Значение наружу: «+7» и цифры без разделителей. */
export function phoneValue(digits: string): string {
  if (digits.length === 0) {
    return '';
  }

  return `+${digits}`;
}

/** Номер дописан: после «+7» набраны все десять цифр. */
export function isPhoneComplete(value: string): boolean {
  return phoneDigits(value).length === PHONE_LENGTH;
}

/** Сколько цифр стоит в строке до этого места. */
function digitsBefore(text: string, at: number): number {
  return (text.slice(0, at).match(/\d/g) ?? []).length;
}

/** Место сразу за n-й цифрой видимой строки. */
function caretAfter(view: string, n: number): number {
  if (n <= 0) {
    return 0;
  }

  let seen = 0;

  for (let at = 0; at < view.length; at += 1) {
    if (/\d/.test(view[at])) {
      seen += 1;

      if (seen === n) {
        return at + 1;
      }
    }
  }

  return view.length;
}

/**
 * На сколько цифр вид опережает набранное: код страны, дописанный к номеру с
 * «9», сдвигает все цифры вправо, и каретка обязана сдвинуться вместе с ними.
 */
function countryShift(typed: string): number {
  const head = typed.slice(0, 1);

  if (head === '' || head === '7' || head === '8') {
    return 0;
  }

  return 1;
}

/**
 * Правка поля: набранное или вставленное превращается в значение, видимую
 * строку и место каретки.
 *
 * Функция чистая и живёт отдельно от обработчика события: правило номера
 * проверяется без отрисовки, и проверка говорит о правиле, а не о разметке.
 *
 * Здесь же решается стирание разделителя. Браузер убрал бы пробел, цифры
 * остались бы прежними, поле собрало бы ту же строку — и клавиша не сделала бы
 * ничего. Поэтому стёртый разделитель читается как промах по соседней цифре:
 * Backspace убирает цифру слева от каретки, Delete — справа.
 */
export function phoneEdit(previous: string, raw: string, caret: number, erase: PhoneErase): PhoneEditResult {
  const was = phoneDigits(previous);
  let typed = raw.replace(/\D/g, '');
  let before = digitsBefore(raw, caret);

  if (raw.length < phoneView(was).length && phoneDigits(typed) === was) {
    const from = erase === 'forward' ? before : Math.max(before - 1, 0);

    typed = typed.slice(0, from) + typed.slice(from + 1);
    before = from;
  }

  const digits = phoneDigits(typed);
  const view = phoneView(digits);
  const at = Math.min(before + countryShift(typed), digits.length);

  return { value: phoneValue(digits), view, caret: caretAfter(view, at) };
}

/** Какое пояснение описывает поле: отказ важнее подсказки. */
function describedBy(id: string, error: string | undefined, hint: string | undefined): string | undefined {
  if (error) {
    return `${id}-error`;
  }

  if (hint) {
    return `${id}-hint`;
  }

  return undefined;
}

/**
 * Поле телефона с подписью. Устройство — как у обычного поля: подпись `label`
 * плюс `input`, подсказка и отказ отдельными абзацами, доступное имя из
 * семантики, а не из атрибута.
 */
export function PhoneField({
  id,
  label,
  value,
  onChange,
  hint,
  error,
  incomplete = 'Номер не дописан: после «+7» нужны десять цифр',
  placeholder = '+7 999 123 45 67',
  className,
}: {
  id: string;
  /** Подпись поля: из неё берётся доступное имя. Плейсхолдер её не заменяет. */
  label: string;
  /**
   * Номер в записи договора: «+7» и цифры. Пустая строка — не набрано ничего,
   * недобранная — номер в работе. Запись приводится к каноническому виду при
   * показе, поэтому «8 999…» снаружи полю не повредит.
   */
  value: string;
  /** Набранное в той же записи: экрану не нужно ни собирать её, ни чистить. */
  onChange: (value: string) => void;
  hint?: string;
  /** Отказ от экрана: показывается всегда и важнее слова о недописанном. */
  error?: string;
  /**
   * Слово о недописанном номере. Поле показывает его само — но только после
   * ухода фокуса: во время набора номер незакончен на каждом знаке, и отказ
   * на каждом знаке читался бы как придирка.
   */
  incomplete?: string;
  placeholder?: string;
  /** Дополнительный класс обёртки: ширина поля — дело строки, а не поля. */
  className?: string;
}) {
  useStyles('phone-field', PHONE_FIELD_CSS);

  const field = useRef<HTMLInputElement>(null);
  /** Место каретки, которое нужно вернуть после перерисовки; `null` — нечего. */
  const pendingCaret = useRef<number | null>(null);
  const erase = useRef<PhoneErase>('back');
  /** Поле уже покидали: до этого недописанный номер отказом не считается. */
  const [touched, setTouched] = useState(false);

  const digits = phoneDigits(value);
  const view = phoneView(digits);

  // Пустое поле молчит и после ухода: это разговор об обязательности поля, а
  // не о виде номера, и ведёт его форма.
  const unfinished = touched && digits.length > 0 && digits.length < PHONE_LENGTH;
  const unfinishedText = unfinished ? incomplete : undefined;
  const shown = error ?? unfinishedText;

  useLayoutEffect(() => {
    const at = pendingCaret.current;

    pendingCaret.current = null;

    if (at === null) {
      return;
    }

    // Перерисовка ставит в поле собранную строку, и браузер уводит каретку в
    // её конец. Правка середины иначе продолжалась бы с хвоста номера.
    field.current?.setSelectionRange(at, at);
  });

  function remember(event: KeyboardEvent<HTMLInputElement>) {
    // Какая клавиша стирала, обработчик изменения уже не видит, а разделитель
    // под Backspace и под Delete убирает разные цифры.
    erase.current = event.key === 'Delete' ? 'forward' : 'back';
  }

  function change(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const next = phoneEdit(value, input.value, input.selectionStart ?? input.value.length, erase.current);

    erase.current = 'back';

    // Строка приводится к виду сразу, не дожидаясь ответа родителя: пока его
    // нет, в поле остаётся набранное с лишними знаками. Присваивание без
    // сравнения само сбросило бы каретку в конец, поэтому оно под условием.
    if (input.value !== next.view) {
      input.value = next.view;
    }

    input.setSelectionRange(next.caret, next.caret);
    pendingCaret.current = next.caret;

    onChange(next.value);
  }

  return (
    <div className={className ? `imolt-grow ${className}` : 'imolt-grow'}>
      <label className="imolt-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        ref={field}
        type="tel"
        className="imolt-input imolt-input--phone"
        value={view}
        placeholder={placeholder}
        inputMode="tel"
        // Память браузера предлагала бы ранее набранные строки мимо вида поля:
        // в проекте она выключена у всех полей ввода (BUG-004).
        autoComplete="off"
        aria-invalid={shown ? 'true' : undefined}
        aria-describedby={describedBy(id, shown, hint)}
        onKeyDown={remember}
        onBlur={() => setTouched(true)}
        onChange={change}
      />
      {shown && (
        <p className="imolt-error" id={`${id}-error`} role="alert">
          {shown}
        </p>
      )}
      {!shown && hint && (
        <p className="imolt-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}
