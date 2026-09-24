/**
 * Раскладка формы расчёта на широком экране: подвал формы, вертикаль полей и
 * карточки-объяснения (R-058, BUG-005, BUG-006, BUG-011).
 *
 * Про раскладку нельзя спросить роль или доступное имя — её несёт оформление,
 * поэтому проверка читает вычисленное значение свойства у узла, найденного по
 * подписи поля. Сравниваются не числа из макета, а отношения: флажок и кнопка
 * одной высоты, адрес и строка типа отходов одной колонки. Числа принадлежат
 * токенам, и переписывать их сюда значило бы завести второй источник.
 *
 * Проверки фальсифицируемы: верните подвалу прижатый к верху флажок, сузьте
 * адрес отдельной шириной, оставьте карточку объяснения из одного текста —
 * они упадут.
 *
 *   npx vitest run tests/CalculatorFormLayout.test.tsx
 *
 * @supports: R-058
 * @bug: BUG-005, BUG-006, BUG-011
 */
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import type { ApiStub } from './apiStub';
import { installApiStub } from './apiStub';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';

let stub: ApiStub;

beforeEach(() => {
  stub = installApiStub();
  // Ширина ставится до отрисовки: после неё представление уже выбрано.
  setViewportWidth(DESKTOP_WIDTH);
});

afterEach(() => {
  stub.restore();
});

/** Строка согласия с флажком: сам флажок найден по доступному имени. */
function строкаФлажка(name: string): HTMLElement {
  const флажок = screen.getByRole('checkbox', { name });
  const строка = флажок.closest('.imolt-consent');

  if (строка === null) {
    throw new Error(`Флажок «${name}» стоит вне строки согласия`);
  }

  return строка as HTMLElement;
}

/**
 * Ячейка формы, в которой стоит поле с такой подписью. Найти её можно только
 * по классу раскладки: у контейнера сетки нет ни роли, ни доступного имени, а
 * проверяется здесь именно он.
 */
function ячейкаФормы(label: string): HTMLElement {
  const ячейка = screen.getByLabelText(label).closest('.imolt-desk-address, .imolt-desk-line');

  if (ячейка === null) {
    throw new Error(`Поле «${label}» стоит вне строки формы расчёта`);
  }

  return ячейка as HTMLElement;
}

/** @supports: R-058 */
describe('подвал формы расчёта на широком экране', () => {
  it('ставит флажок утилизации и кнопку расчёта в один ряд', () => {
    render(<App />);

    const строка = строкаФлажка('Нужна утилизация на полигоне');
    const кнопка = screen.getByRole('button', { name: 'Рассчитать' });

    expect(строка.parentElement).toBe(кнопка.parentElement);
  });

  it('даёт флажку и кнопке одинаковую высоту цели нажатия', () => {
    // Разная высота соседних целей нажатия нарушает разд. 4.5 и видна как
    // разная толщина строки подвала (BUG-005).
    render(<App />);

    const строка = строкаФлажка('Нужна утилизация на полигоне');
    const кнопка = screen.getByRole('button', { name: 'Рассчитать' });
    const высота = window.getComputedStyle(кнопка).minHeight;

    expect(высота).not.toBe('');
    expect(window.getComputedStyle(строка).minHeight).toBe(высота);
  });
});

/** @supports: R-058 */
describe('вертикаль формы расчёта на широком экране', () => {
  it('ставит адрес вывоза и тип отходов в одну колонку сетки', () => {
    // Иначе поля начинаются на одной линии, а заканчиваются на разных, и
    // форма читается лесенкой (BUG-011).
    render(<App />);

    const колонки = window.getComputedStyle(ячейкаФормы('Тип отходов')).gridTemplateColumns;

    expect(колонки).not.toBe('');
    expect(window.getComputedStyle(ячейкаФормы('Адрес вывоза')).gridTemplateColumns).toBe(колонки);
  });
});

/** @supports: R-058 */
describe('карточки-объяснения до первого расчёта', () => {
  /** Список объяснений по его доступному имени. */
  function объяснения(): HTMLElement {
    return screen.getByRole('list', { name: 'Что даёт расчёт' });
  }

  it('несёт рисунок в каждой карточке, а не один текст', () => {
    // Карточка из заголовка и абзаца читается как незаконченная (BUG-006).
    render(<App />);

    const карточки = within(объяснения()).getAllByRole('listitem');

    expect(карточки.length).toBeGreaterThan(2);
    expect(карточки.filter(карточка => карточка.querySelector('svg') === null)).toEqual([]);
  });

  it('оставляет название преимущества словом, а не рисунком', () => {
    // Рисунок сопровождает подпись и потому скрыт от вспомогательной
    // технологии: объявленный, он читался бы вместо названия (разд. 4.5).
    render(<App />);

    const рисунки = [...объяснения().querySelectorAll('svg')];

    expect(рисунки).toHaveLength(3);
    expect(рисунки.filter(рисунок => рисунок.getAttribute('aria-hidden') !== 'true')).toEqual([]);
    expect(within(объяснения()).getByText('Цена видна сразу')).toBeInTheDocument();
  });

  it('рисует контуром в цвете карточки, а не своим', () => {
    // Собственный цвет рисунка разошёлся бы с текстом рядом и с ролями
    // токенов (ADR-0008, инвариант 1).
    render(<App />);

    const рисунки = [...объяснения().querySelectorAll('svg')];

    expect(рисунки.filter(рисунок => рисунок.getAttribute('stroke') !== 'currentColor')).toEqual([]);
    expect(рисунки.filter(рисунок => рисунок.getAttribute('fill') !== 'none')).toEqual([]);
  });
});

describe('строка типа отходов и меры объёма', () => {
  /** Строка формы: найдена от поля объёма вверх по разметке. */
  function строка(): HTMLElement {
    const поле = screen.getByRole('textbox', { name: 'Объём' });
    const узел = поле.closest('.imolt-desk-line');

    expect(узел, 'строка типа отходов не найдена').not.toBeNull();

    return узел as HTMLElement;
  }

  // У кубометров под полем объёма появляется пересчёт в тонны. При
  // выравнивании строки по нижнему краю он растил её на высоту подсказки и
  // уводил «Тип отходов» вниз — поля переставали стоять на одной линии.
  it('выравнивает поля строки по верху, а не по нижнему краю', () => {
    render(<App />);

    expect(getComputedStyle(строка()).alignItems).toBe('start');
  });

  it('сдвигает меру объёма на высоту подписи, чтобы она встала в строку поля', () => {
    render(<App />);

    const мера = строка().querySelector('.imolt-units');

    expect(мера, 'переключатель меры не найден').not.toBeNull();
    expect(getComputedStyle(мера as HTMLElement).marginTop).not.toBe('0px');
  });

  // Подсказка пересчёта появляется при смене меры на кубометры. Если место под
  // неё не занято заранее, появление строки сдвигает всё, что ниже
  // (замечание заказчика от 24.09.2026).
  it('держит место под подсказкой до её появления', () => {
    render(<App />);

    const блок = screen.getByRole('textbox', { name: 'Объём' }).closest('.imolt-grow') as HTMLElement;
    const место = блок.querySelector('.imolt-hint');

    expect(место, 'строка подсказки не заняла место до смены меры').not.toBeNull();

    // Пустая строка только держит место: диктор объявил бы пустое пояснение.
    expect(место).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('textbox', { name: 'Объём' })).not.toHaveAttribute('aria-describedby');
  });

  it('держит подсказку пересчёта под полем объёма, а не между полями', () => {
    render(<App />);

    const блок = screen.getByRole('textbox', { name: 'Объём' }).closest('.imolt-grow');
    const поля = [...строка().querySelectorAll('.imolt-grow')];

    // Подсказка принадлежит полю объёма: соседнее поле о ней не знает и
    // потому от неё не двигается.
    expect(поля[0]).not.toBe(блок);
    expect(блок?.classList.contains('imolt-field--amount')).toBe(true);
  });
});
