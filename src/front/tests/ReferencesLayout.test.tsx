/**
 * Раскладка редактора цен и справочников: одна левая вертикаль в обоих
 * представлениях (BUG-003, BUG-011).
 *
 * Жалоба та же, что на справочнике полигонов: подпись таблицы отбита внутрь
 * плашки, а заголовок экрана, пояснение и полоса отбора начинаются от края —
 * вертикали не совпадают. На телефоне место таблицы занимают карточки, и
 * вертикаль обязана совпадать с ними.
 *
 * Проверки фальсифицируемы: снимите поле у заголовочного блока, верните
 * карточку вокруг таблицы или отбейте панель обновления на другое
 * расстояние — упадёт именно та проверка, которая об этом говорит.
 *
 *   npx vitest run tests/ReferencesLayout.test.tsx
 *
 * Критерия приёмки на раскладку редактора в пакете аналитики нет, поэтому
 * ссылка на требования.
 *
 * @supports: R-042, R-085
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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
      отбор: leftInset(screen.getByRole('toolbar', { name: 'Отбор записей справочника' }), корень),
    }).toEqual({
      заголовок: вертикаль,
      пояснение: вертикаль,
      обновление: вертикаль,
      отбор: вертикаль,
    });
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

  it('на телефоне держит заголовок, вкладки и карточку записи на одной вертикали', async () => {
    render(<ReferencesPage />);

    await screen.findByRole('button', { name: 'Править полигон: Площадка «Икша»' });

    const корень = экран();
    const вертикаль = leftInset(узел('.imolt-references-card .imolt-references-card-name'), корень);

    expect(вертикаль).toBeGreaterThan(0);

    expect({
      заголовок: leftInset(screen.getByRole('heading', { level: 1 }), корень),
      вкладки: leftInset(screen.getByRole('tablist', { name: 'Справочник' }), корень),
      // У поля меряется подпись: собственное поле ввода — часть управления,
      // а на вертикали экрана стоит блок поля целиком.
      поиск: leftInset(узел('label[for="references-query-mobile"]'), корень),
      обновление: leftInset(узел('.imolt-references-sync-text'), корень),
    }).toEqual({
      заголовок: вертикаль,
      вкладки: вертикаль,
      поиск: вертикаль,
      обновление: вертикаль,
    });
  });
});
