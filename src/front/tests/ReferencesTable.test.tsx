/**
 * Шапка таблиц редактора цен: заголовок столбца называет то, что стоит в
 * ячейке, вместе с мерой.
 *
 * Заказчик прочитал шапку «Полигон и юридическое лицо | Лом бетона и
 * железобетона | Древесина от разборки | Лом кирпичной кладки | Статус |
 * Цены актуальны» как несоответствие заголовков содержимому: под именем
 * группы отходов стоит тариф утилизации в рублях за тонну, под «Ценами
 * актуальны» — дата, а под «Ценой перевозки за тонна-километр» — сумма без
 * названной меры. Проверка называет каждый заголовок дословно, потому что
 * меру и предмет столбца человек читает, а не угадывает.
 *
 * Проверки фальсифицируемы: верните столбцу группы отходов одно её имя,
 * снимите меру у цены перевозки, назовите столбец даты признаком «Цены
 * актуальны» — падает именно та проверка, которая об этом говорит.
 *
 *   npx vitest run tests/ReferencesTable.test.tsx
 *
 * Критерия приёмки на шапку редактора в пакете аналитики нет: AC-042c и
 * AC-044a описывают поведение расчётной части. Поэтому ссылка на требования.
 *
 * @supports: R-039, R-042, R-058
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReferencesPage } from '@/pages/references';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';
import { installMaintenanceStub, type MaintenanceStub } from './stubs/maintenance';

const ТАРИФ_ИКША = 'Тариф утилизации, Площадка «Икша», Лом бетона и железобетона';

const ЦЕНА_БЕТОН = 'Цена перевозки, Лом бетона и железобетона';

let служба: MaintenanceStub;

beforeEach(() => {
  служба = installMaintenanceStub();
  setViewportWidth(DESKTOP_WIDTH);
});

afterEach(() => {
  служба.restore();
});

/** Ожидание таблицы вкладки: её ячейка с ценой — форма правки, а не текст. */
function ячейкаЦены(имя: string): Promise<HTMLElement> {
  return screen.findByRole('button', { name: new RegExp(`^${имя}:`) });
}

function заголовок(имя: string): HTMLElement {
  return screen.getByRole('columnheader', { name: имя });
}

describe('шапка таблицы полигонов', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '#/references?tab=landfills');
  });

  it('называет меру тарифа утилизации в столбце каждой группы отходов', async () => {
    render(<ReferencesPage />);
    await ячейкаЦены(ТАРИФ_ИКША);

    // Под именем группы отходов стоит цена за тонну: одно имя группы этого
    // не называло, и столбец читался как признак, а не как тариф.
    expect(заголовок('Лом бетона и железобетона, ₽/т')).toBeInTheDocument();
    expect(заголовок('Древесина от разборки, ₽/т')).toBeInTheDocument();
    expect(заголовок('Лом кирпичной кладки, ₽/т')).toBeInTheDocument();
  });

  it('называет столбцы записи, статуса и даты актуальности цен', async () => {
    render(<ReferencesPage />);
    await ячейкаЦены(ТАРИФ_ИКША);

    expect(заголовок('Полигон и юридическое лицо')).toBeInTheDocument();
    expect(заголовок('Статус полигона')).toBeInTheDocument();
    expect(заголовок('Дата актуальности цен')).toBeInTheDocument();

    // «Цены актуальны» обещало признак, а в ячейке стоит дата.
    expect(screen.queryByRole('columnheader', { name: 'Цены актуальны' })).toBeNull();
  });
});

describe('шапка таблицы групп отходов', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '#/references?tab=wasteGroups');
  });

  it('называет меру цены перевозки и дату актуальности цены', async () => {
    render(<ReferencesPage />);
    await ячейкаЦены(ЦЕНА_БЕТОН);

    // Мера — рубли за тонна-километр: сокращение взято из глоссария проекта.
    expect(заголовок('Цена перевозки, ₽/т-км')).toBeInTheDocument();
    expect(заголовок('Дата актуальности цены')).toBeInTheDocument();

    expect(screen.queryByRole('columnheader', { name: 'Цена перевозки за тонна-километр' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Актуально' })).toBeNull();
  });
});
