// Выбор типа отходов на экране расчёта: закрытый список справочника с
// поиском (R-013, BUG-004).
//
// Требование называет источник значения: «пользователь выбирает тип отходов
// из справочника». Поле со свободным вводом этого не даёт — оно принимает
// любую строку, а браузер вдобавок предлагает ранее набранные значения из
// своей памяти, и заказчик видит список, «в который можно дописать своё».
// Проверки здесь закрепляют три следствия закрытого списка: набранное мимо
// справочника значением не становится, память браузера выключена, выбор
// доступен с клавиатуры.
//
// Представлений у экрана два, а правило одно, поэтому ключевые проверки
// повторены и для рабочего места: правило, проверенное на одном экране,
// молча расходится на втором.
//
// Проверки фальсифицируемы: верните вместо списка обычное поле с подсказками,
// оставьте произвольный текст в поле после ухода из него, снимите
// «autocomplete», отберите у списка обслуживание стрелок и Enter — они упадут.
//
//   npx vitest run tests/WasteTypeChoice.test.tsx
//
// @supports: R-013
// @ac: AC-013c
// @bug: BUG-004
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import type { ApiStub } from './apiStub';
import { CONCRETE_GROUP, WASTE_GROUPS, installApiStub } from './apiStub';
import { chooseAddress, chooseWasteGroup, enterQuantity } from './flows';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';

/** Строка, которой в справочнике групп отходов нет и быть не может. */
const МИМО_СПРАВОЧНИКА = 'щебень со стройки соседа';

let stub: ApiStub;

beforeEach(() => {
  stub = installApiStub();
});

afterEach(() => {
  stub.restore();
});

/** Поле типа отходов первой строки формы. */
function полеТипаОтходов(): HTMLInputElement {
  return screen.getByLabelText('Тип отходов') as HTMLInputElement;
}

/** @ac: AC-013c */
describe('тип отходов, набранный мимо справочника', () => {
  it('в поле не остаётся: после ухода строка пустеет', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(полеТипаОтходов(), МИМО_СПРАВОЧНИКА);
    await user.tab();

    expect(полеТипаОтходов()).toHaveValue('');
  });

  it('прежде выбранную запись справочника не вытесняет', async () => {
    // Человек начал править строку и передумал: тип отходов меняется только
    // выбором из списка, и прежнее значение обязано вернуться (R-013).
    const user = userEvent.setup();
    render(<App />);

    await chooseWasteGroup(user);
    await user.clear(полеТипаОтходов());
    await user.type(полеТипаОтходов(), МИМО_СПРАВОЧНИКА);
    await user.tab();

    expect(полеТипаОтходов()).toHaveValue(CONCRETE_GROUP.name);
  });

  it('в расчёт не уходит: запроса расчётная часть не получает', async () => {
    const user = userEvent.setup();
    render(<App />);

    await chooseAddress(user);
    await user.type(полеТипаОтходов(), МИМО_СПРАВОЧНИКА);
    await enterQuantity(user, '20');
    await user.click(screen.getByRole('button', { name: 'Рассчитать' }));

    expect(
      stub.sentTo('POST /v1/calculations'),
      'расчёт опирается на запись справочника, а не на набранную строку',
    ).toHaveLength(0);
  });
});

/** @supports: R-013 */
describe('память браузера в полях экрана расчёта', () => {
  it('в поле типа отходов выключена', () => {
    // Иначе браузер предлагает ранее набранные строки, которых в справочнике
    // нет, и держит их до конца сессии (BUG-004).
    render(<App />);

    expect(полеТипаОтходов()).toHaveAttribute('autocomplete', 'off');
  });

  it('в поле адреса вывоза выключена', () => {
    render(<App />);

    expect(screen.getByLabelText('Адрес вывоза')).toHaveAttribute('autocomplete', 'off');
  });
});

/** @ac: AC-013c */
describe('список типов отходов при открытии', () => {
  it('показывает справочник целиком, а не пустоту', async () => {
    // Типов немного, и человек обязан видеть, из чего выбирает: пустой
    // список под пустым полем не объясняет, что от него хотят (R-013).
    const user = userEvent.setup();
    render(<App />);

    await user.click(полеТипаОтходов());

    const строки = await screen.findAllByRole('option');

    expect(строки.map((строка) => строка.textContent)).toEqual(
      WASTE_GROUPS.map((группа) => группа.name),
    );
  });

  it('называет себя списком с поиском и до открытия свёрнут', () => {
    render(<App />);

    expect(полеТипаОтходов()).toHaveAttribute('role', 'combobox');
    expect(полеТипаОтходов()).toHaveAttribute('aria-expanded', 'false');
  });

  it('раскрывшись, связывает поле со списком и подсвеченной строкой', async () => {
    // Без этих связей вспомогательная технология не знает ни о числе
    // вариантов, ни о том, какой из них подтвердит Enter (разд. 4.5).
    const user = userEvent.setup();
    render(<App />);

    await user.click(полеТипаОтходов());
    await screen.findAllByRole('option');
    await user.keyboard('{ArrowDown}');

    const список = screen.getByRole('listbox');
    const первая = within(список).getAllByRole('option')[0];

    expect(полеТипаОтходов()).toHaveAttribute('aria-expanded', 'true');
    expect(полеТипаОтходов().getAttribute('aria-controls')).toBe(список.id);
    expect(полеТипаОтходов().getAttribute('aria-activedescendant')).toBe(первая.id);
  });
});

/** @ac: AC-013c */
describe('выбор типа отходов с клавиатуры', () => {
  it('стрелкой вниз и Enter подставляет запись справочника', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(полеТипаОтходов(), 'лом');
    await screen.findByRole('option', { name: CONCRETE_GROUP.name });
    await user.keyboard('{ArrowDown}{Enter}');

    expect(полеТипаОтходов()).toHaveValue(CONCRETE_GROUP.name);
  });

  it('по Escape закрывает список и возвращает строку', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(полеТипаОтходов(), 'лом');
    await screen.findByRole('option', { name: CONCRETE_GROUP.name });
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(полеТипаОтходов()).toHaveValue('');
  });
});

/** @ac: AC-013c */
describe('закрытый список типов отходов на широком экране', () => {
  beforeEach(() => {
    // Ширина ставится до отрисовки: после неё представление уже выбрано.
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('набранное мимо справочника из поля убирает', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(полеТипаОтходов(), МИМО_СПРАВОЧНИКА);
    await user.tab();

    expect(полеТипаОтходов()).toHaveValue('');
  });

  it('выключает память браузера в том же поле', () => {
    render(<App />);

    expect(полеТипаОтходов()).toHaveAttribute('autocomplete', 'off');
  });

  it('подставляет выбранную запись справочника', async () => {
    const user = userEvent.setup();
    render(<App />);

    await chooseWasteGroup(user);

    expect(полеТипаОтходов()).toHaveValue(CONCRETE_GROUP.name);
  });
});
