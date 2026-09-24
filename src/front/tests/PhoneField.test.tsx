/**
 * Поле ввода телефона: правило номера и поведение при правке.
 *
 * Правило проверяется чистыми функциями разбора и сборки — без отрисовки, —
 * а поведение поля живой разметкой: доступное имя, выключенная память
 * браузера, стирание и место каретки разметкой не выражаются.
 *
 * Проверки фальсифицируемы: снимите приведение первой «8» или «7» к коду
 * страны, перестаньте дописывать код к номеру с «9», пропустите в значение
 * буквы и знаки, разведите разбор трёх записей одного номера, примите
 * двенадцатую цифру, дайте клавише стирания убрать разделитель вместо цифры,
 * уберите возврат каретки после переформатирования, включите память браузера
 * или покажите слово о недописанном номере во время набора — они упадут.
 *
 *   npx vitest run tests/PhoneField.test.tsx
 *
 * Критерия приёмки на ввод телефона в реестре нет: AC-053b говорит об отказе
 * службы на номер не по образцу договора, а не о наборе в поле (разрыв назван
 * в отчёте). Поэтому якорь обслуживающий.
 *
 * @supports: R-053
 */
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PhoneField, isPhoneComplete } from '@/shared/ui';
import { phoneDigits, phoneEdit, phoneValue, phoneView } from '@/shared/ui/phoneField';

/** Образец телефона из договора заявки: «+7» и десять цифр. */
const CONTRACT_PHONE = /^\+7[0-9]{10}$/;

/** Один и тот же номер, записанный тремя способами. */
const SAME_NUMBER = ['8 (999) 123-45-67', '+7 999 1234567', '9991234567'];

/** Живое поле: без собственного состояния набранное в поле не остаётся. */
function LivePhone({ start = '', onValue }: { start?: string; onValue?: (value: string) => void }) {
  const [value, setValue] = useState(start);

  return (
    <PhoneField
      id="pickup-phone"
      label="Телефон"
      value={value}
      onChange={next => {
        setValue(next);
        onValue?.(next);
      }}
    />
  );
}

function phoneInput(): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>('Телефон');
}

/** Видимая строка из любой записи номера. */
function shownFor(raw: string): string {
  return phoneView(phoneDigits(raw));
}

describe('правило номера телефона', () => {
  it('номер начат с «8» — поле даёт код страны «+7»', () => {
    expect(shownFor('8')).toBe('+7');
    expect(phoneDigits('89991234567')).toBe('79991234567');
  });

  it('номер начат с «7» — поле даёт код страны «+7»', () => {
    expect(shownFor('7')).toBe('+7');
    expect(phoneDigits('79991234567')).toBe('79991234567');
  });

  it('номер начат с «9» — код страны дописывается сам', () => {
    expect(shownFor('9')).toBe('+7 9');
    expect(phoneDigits('9991234567')).toBe('79991234567');
  });

  it('в записи буквы и знаки — разбор отбрасывает их, а не отказывает', () => {
    expect(phoneDigits('телефон 8 (999) 123-45-67 доб. ')).toBe('79991234567');
    expect(shownFor('abc')).toBe('');
  });

  it('три записи одного номера — разбор даёт один результат', () => {
    const разбор = SAME_NUMBER.map(запись => phoneValue(phoneDigits(запись)));

    expect(new Set(разбор).size, `записи разошлись: ${разбор.join(', ')}`).toBe(1);
    expect(разбор[0]).toBe('+79991234567');
  });

  it('набрано больше одиннадцати цифр — лишние не принимаются', () => {
    expect(phoneDigits('8999123456789')).toBe('79991234567');
    expect(shownFor('89991234567890')).toBe('+7 999 123 45 67');
  });

  it('номер разобран — сборка даёт вид «+7 999 123 45 67»', () => {
    expect(shownFor('89991234567')).toBe('+7 999 123 45 67');
    expect(shownFor('8999123')).toBe('+7 999 123');
  });

  it('номер короче одиннадцати цифр — дописанным не считается', () => {
    expect(isPhoneComplete('+79991234567')).toBe(true);
    expect(isPhoneComplete('+7999123')).toBe(false);
    expect(isPhoneComplete('')).toBe(false);
  });

  it('правка середины номера — каретка остаётся у набранной цифры', () => {
    // Вставка «0» в середину готового номера: седьмое место видимой строки —
    // сразу за пробелом перед «123».
    const правка = phoneEdit('+79991234567', '+7 999 0123 45 67', 8, 'back');

    expect(правка.view).toBe('+7 999 012 34 56');
    expect(правка.caret).toBe(8);
  });

  it('стёрт разделитель — правка убирает соседнюю цифру', () => {
    // Backspace перед «123» убрал пробел: цифры не изменились, и промах
    // читается как попытка стереть цифру слева.
    const назад = phoneEdit('+79991234567', '+7 999123 45 67', 6, 'back');

    expect(назад.value).toBe('+7991234567');

    // Delete на том же месте целится в цифру справа от каретки.
    const вперёд = phoneEdit('+79991234567', '+7 999123 45 67', 6, 'forward');

    expect(вперёд.value).toBe('+7999234567');
  });
});

describe('поле ввода телефона', () => {
  it('поле показано — доступное имя равно подписи, а набор объявлен телефонным', () => {
    render(<LivePhone />);

    expect(screen.getByRole('textbox', { name: 'Телефон' })).toBe(phoneInput());
    expect(phoneInput()).toHaveAttribute('inputmode', 'tel');
  });

  it('поле показано — память браузера выключена', () => {
    render(<LivePhone />);

    expect(phoneInput()).toHaveAttribute('autocomplete', 'off');
  });

  it('набор начат с «8» — поле даёт вид «+7 999 123 45 67» и запись договора', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];

    render(<LivePhone onValue={value => seen.push(value)} />);
    await user.type(phoneInput(), '89991234567');

    expect(phoneInput()).toHaveValue('+7 999 123 45 67');
    expect(seen.at(-1)).toMatch(CONTRACT_PHONE);
  });

  it('набор начат с «9» — код страны появляется с первой цифры', async () => {
    const user = userEvent.setup();

    render(<LivePhone />);
    await user.type(phoneInput(), '9');

    expect(phoneInput()).toHaveValue('+7 9');
  });

  it('в поле набраны буквы и знаки — поле остаётся пустым', async () => {
    const user = userEvent.setup();

    render(<LivePhone />);
    await user.type(phoneInput(), 'а-б(в) +');

    expect(phoneInput()).toHaveValue('');
  });

  it('вставка из буфера — три записи дают один результат', async () => {
    const user = userEvent.setup();

    for (const запись of SAME_NUMBER) {
      const { unmount } = render(<LivePhone />);

      await user.click(phoneInput());
      await user.paste(запись);

      expect(phoneInput(), `вставка «${запись}» разошлась с остальными`).toHaveValue('+7 999 123 45 67');
      unmount();
    }
  });

  it('набрана двенадцатая цифра — поле её не принимает', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];

    render(<LivePhone onValue={value => seen.push(value)} />);
    await user.type(phoneInput(), '899912345678');

    expect(phoneInput()).toHaveValue('+7 999 123 45 67');
    expect(seen.at(-1)).toBe('+79991234567');
  });

  it('клавиша стирания нажата на разделителе — поле убирает цифру', async () => {
    const user = userEvent.setup();

    render(<LivePhone start="+79991234567" />);
    await user.type(phoneInput(), '{Backspace}', { initialSelectionStart: 7, initialSelectionEnd: 7 });

    expect(phoneInput()).toHaveValue('+7 991 234 56 7');
  });

  it('правка середины номера — каретка не уезжает в конец', async () => {
    const user = userEvent.setup();

    render(<LivePhone start="+79991234567" />);
    await user.type(phoneInput(), '0', { initialSelectionStart: 7, initialSelectionEnd: 7 });

    expect(phoneInput()).toHaveValue('+7 999 012 34 56');
    expect(phoneInput().selectionStart, 'каретка уехала в конец номера').toBe(8);
  });

  it('номер не дописан — при наборе поле молчит, после ухода называет', async () => {
    const user = userEvent.setup();

    render(<LivePhone />);
    await user.type(phoneInput(), '999123');

    expect(screen.queryByRole('alert'), 'отказ на каждом знаке читается как придирка').toBeNull();

    await user.tab();

    expect(screen.getByRole('alert')).toHaveTextContent('Номер не дописан');
    expect(phoneInput()).toHaveAttribute('aria-invalid', 'true');
  });

  it('номер дописан после ухода — слово о недописанном снимается', async () => {
    const user = userEvent.setup();

    render(<LivePhone />);
    await user.type(phoneInput(), '999123');
    await user.tab();
    await user.type(phoneInput(), '4567');
    await user.tab();

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
