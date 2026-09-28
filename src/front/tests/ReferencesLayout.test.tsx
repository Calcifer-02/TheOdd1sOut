/**
 * Раскладка редактора цен и справочников: одна левая вертикаль и полоса
 * отбора в обоих представлениях (BUG-003, BUG-011).
 *
 * Жалоба та же, что на справочнике полигонов: подпись таблицы отбита внутрь
 * плашки, а заголовок экрана, пояснение и полоса отбора начинаются от края —
 * вертикали не совпадают. На телефоне место таблицы занимают карточки, и
 * вертикаль обязана совпадать с ними. Вторым пакетом замечаний добавлено
 * чтение полосы отбора: вкладки, поле поиска и счётчик стояли в одной
 * строке, и счётчик читался частью поля, хотя относится к выборке.
 *
 * Проверки фальсифицируемы: снимите поле у заголовочного блока, верните
 * карточку вокруг таблицы, отбейте панель обновления на другое расстояние,
 * поставьте счётчик сбоку от поля или посчитайте им длину строки поиска —
 * упадёт именно та проверка, которая об этом говорит.
 *
 *   npx vitest run tests/ReferencesLayout.test.tsx
 *
 * Критерия приёмки на раскладку редактора в пакете аналитики нет: проверки
 * держат найденные дефекты, и трасс-цель у них — их номера.
 *
 * @bug: BUG-003, BUG-011, BUG-034
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReferencesPage } from '@/pages/references';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';
import { installThemeStyles, leftInset } from './layout';
import { installMaintenanceStub, type MaintenanceStub } from './stubs/maintenance';

const ТАРИФ_ИКША = 'Тариф утилизации, Площадка «Икша», Лом бетона и железобетона';

let служба: MaintenanceStub;
let снятьОформление: () => void;

beforeAll(() => {
  снятьОформление = installThemeStyles();
});

afterAll(() => {
  снятьОформление();
});

beforeEach(() => {
  служба = installMaintenanceStub();
});

afterEach(() => {
  служба.restore();
});

/** Корень экрана: вертикали считаются от его края, а не от края окна. */
function экран(): Element {
  const узел = document.querySelector('.imolt-references');
  if (узел === null) {
    throw new Error('Экран редактора не отрисован');
  }
  return узел;
}

/**
 * Боковое поле узла в числах. Отсутствие правила и объявленный ноль читаются
 * по-разному — «0» и «0px», — а означают одно и то же.
 */
function боковоеПоле(узел: Element): { слева: number; справа: number } {
  const стиль = getComputedStyle(узел);

  return {
    слева: Number.parseFloat(стиль.paddingLeft) || 0,
    справа: Number.parseFloat(стиль.paddingRight) || 0,
  };
}

function узел(селектор: string): Element {
  const найденный = document.querySelector(селектор);
  if (найденный === null) {
    throw new Error(`На экране нет узла ${селектор}`);
  }
  return найденный;
}

describe('левая вертикаль редактора цен', () => {
  it('на рабочем месте держит заголовок, панель обновления и подпись таблицы на одной вертикали', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    render(<ReferencesPage />);

    await screen.findByRole('button', { name: new RegExp(`^${ТАРИФ_ИКША}:`) });

    const корень = экран();
    const вертикаль = leftInset(узел('caption'), корень);

    // Подпись таблицы отбита внутрь плашки общим правилом: нулевая вертикаль
    // означала бы, что сравнивать не с чем.
    expect(вертикаль).toBeGreaterThan(0);

    expect({
      заголовок: leftInset(screen.getByRole('heading', { level: 1 }), корень),
      пояснение: leftInset(screen.getByText(/из официального перечня/), корень),
      обновление: leftInset(узел('.imolt-references-sync-text'), корень),
    }).toEqual({
      заголовок: вертикаль,
      пояснение: вертикаль,
      обновление: вертикаль,
    });

    // Блок выборки идёт от края, как полоса отбора и таблица под ним
    // (замечание заказчика от 26.09.2026): боковой отбивки у него нет ни
    // своей, ни внешней.
    const выборка = узел('.imolt-references-selection');
    expect(leftInset(выборка, корень)).toBe(0);
    expect(боковоеПоле(выборка).слева).toBe(0);
    expect(боковоеПоле(выборка).справа).toBe(0);
  });

  it('на рабочем месте ставит название полигона и юридическое лицо разными строками ячейки', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    render(<ReferencesPage />);

    await screen.findByRole('button', { name: new RegExp(`^${ТАРИФ_ИКША}:`) });

    // Подряд идущие надписи в ячейке слились бы в одну строку, и название
    // полигона читалось бы вместе с юридическим лицом одним словом.
    const имя = узел('.imolt-references-cell-name');
    expect(getComputedStyle(имя).flexDirection).toBe('column');
    expect(имя.querySelector('.imolt-references-card-name')).not.toBeNull();
    expect(имя.querySelector('.imolt-references-card-entity')).not.toBeNull();
  });

  it('на телефоне ведёт блоки экрана от края, а текст плашек — от их собственного поля', async () => {
    // Заказчик 28.09.2026: «у импорта из excel, полигонов, групп отходов
    // поплыла верстка и у поиска по полигону тоже padding лишний на
    // телефоне». Замер живого стенда на ширине 390 до правки: вкладки и
    // карточки шли 16..359, а заголовок, счётчик и поле поиска — 28..347.
    render(<ReferencesPage />);

    await screen.findByRole('button', { name: 'Править полигон: Площадка «Икша»' });

    const корень = экран();

    // Таблицы на телефоне нет, и отбивать блоки внутрь не подо что: вкладки и
    // плашки записей идут от края экрана, а поля экрана держит оболочка.
    expect({
      заголовок: leftInset(screen.getByRole('heading', { level: 1 }), корень),
      пояснение: leftInset(screen.getByText(/Менеджер данных ИМОЛТ/), корень),
      вкладки: leftInset(узел('.imolt-tabs'), корень),
      выборка: leftInset(узел('.imolt-references-selection'), корень),
      карточки: leftInset(узел('.imolt-references-cards'), корень),
    }).toEqual({ заголовок: 0, пояснение: 0, вкладки: 0, выборка: 0, карточки: 0 });

    // Боковое поле блока выборки складывалось с собственным полем строки
    // ввода, и поиск стоял правее всего остального на экране.
    expect(боковоеПоле(узел('.imolt-references-selection')).слева).toBe(0);
    expect(боковоеПоле(узел('.imolt-references-selection')).справа).toBe(0);
  });

  it('на телефоне ставит текст всех плашек на одну вертикаль', async () => {
    render(<ReferencesPage />);

    await screen.findByRole('button', { name: 'Править полигон: Площадка «Икша»' });

    const корень = экран();
    const вертикаль = leftInset(узел('.imolt-references-card .imolt-references-card-name'), корень);

    // Плашки отбивают текст внутрь своим полем: нулевая вертикаль означала бы,
    // что сравнивать не с чем.
    expect(вертикаль).toBeGreaterThan(0);

    expect(leftInset(узел('.imolt-references-sync-text'), корень)).toBe(вертикаль);

    // Шаги импорта — такая же плашка экрана, и поле у неё то же: с полем
    // плашки рабочего места её текст стоял правее соседей.
    await userEvent.setup().click(screen.getByRole('button', { name: 'Импорт из Excel' }));

    const шаги = await screen.findByText('Импорт справочника из книги');
    const плашка = шаги.closest('.imolt-import');

    expect(плашка, 'шаги импорта не открылись').not.toBeNull();
    expect(getComputedStyle(плашка as Element).paddingLeft).toBe(`${вертикаль}px`);
  });
});

describe('полоса отбора редактора цен', () => {
  it('на рабочем месте ставит счётчик выборки над полем поиска, а не сбоку', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    render(<ReferencesPage />);

    await screen.findByRole('button', { name: new RegExp(`^${ТАРИФ_ИКША}:`) });

    const поле = screen.getByRole('textbox', { name: 'Поиск по полигону или юрлицу' });
    const выборка = поле.closest('.imolt-references-selection');
    expect(выборка).not.toBeNull();

    // Счётчик — первый в блоке выборки, поле идёт за ним. Сбоку от поля он
    // читался его частью, хотя считает показанные записи.
    expect((выборка as Element).firstElementChild).toBe(узел('.imolt-references-count'));
    expect(getComputedStyle(выборка as Element).display).toBe('grid');

    // Сама полоса тоже идёт строками: вкладки, счётчик и поле разной высоты
    // в одной строке читались как три решения подряд.
    expect(getComputedStyle(screen.getByRole('toolbar', { name: 'Отбор записей справочника' })).display).toBe('grid');
  });

  it('на телефоне ставит счётчик выборки над тем же полем поиска', async () => {
    render(<ReferencesPage />);

    await screen.findByRole('button', { name: 'Править полигон: Площадка «Икша»' });

    const выборка = узел('.imolt-references-selection');

    expect(выборка.firstElementChild).toBe(узел('.imolt-references-count'));
    expect(выборка.querySelector('label[for="references-query-mobile"]')).not.toBeNull();
  });

  it('счётчик считает показанные записи из найденных, а не длину строки поиска', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    const пользователь = userEvent.setup();
    render(<ReferencesPage />);

    await screen.findByRole('button', { name: new RegExp(`^${ТАРИФ_ИКША}:`) });

    expect(узел('.imolt-references-count').textContent).toBe('Показано полигонов: 2 из 2');

    await пользователь.type(screen.getByRole('textbox', { name: 'Поиск по полигону или юрлицу' }), 'Икша');

    // Показано стало меньше, найдено службой — столько же: счётчик описывает
    // выборку, а не содержимое поля.
    await waitFor(() => expect(узел('.imolt-references-count').textContent).toBe('Показано полигонов: 1 из 2'));
  });
});

describe('порядок списка в редакторе цен', () => {
  // Управление порядком — одно на три экрана: вторая его реализация
  // разошлась бы с первой молча (R-088, AC-088c).
  it('выбранное поле уходит в запрос справочника', async () => {
    const пользователь = userEvent.setup();
    setViewportWidth(DESKTOP_WIDTH);
    render(<ReferencesPage />);

    await screen.findByRole('button', { name: new RegExp(`^${ТАРИФ_ИКША}:`) });
    await пользователь.click(screen.getByRole('radio', { name: 'По тарифу' }));

    await waitFor(() => {
      expect(служба.lastTo('GET /v1/landfills').query.get('sort')).toBe('tariff');
    });
  });

  it('направление переключается тем же управлением', async () => {
    const пользователь = userEvent.setup();
    setViewportWidth(DESKTOP_WIDTH);
    render(<ReferencesPage />);

    await screen.findByRole('button', { name: new RegExp(`^${ТАРИФ_ИКША}:`) });
    await пользователь.click(screen.getByRole('button', { name: 'По возрастанию' }));

    await waitFor(() => {
      expect(служба.lastTo('GET /v1/landfills').query.get('order')).toBe('desc');
    });
  });
});
