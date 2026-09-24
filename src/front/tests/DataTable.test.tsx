/**
 * Таблица сравнения как модель состояния: сортировка, выбор строк, загрузка и
 * пустой результат (карточка практики PRACT-021).
 *
 * Ближайшая фальсифицируемая проверка практики названа ею прямо: изменить
 * порядок строк после выбора и убедиться, что выбранной осталась та же
 * запись. Здесь она и стоит.
 *
 * Проверки фальсифицируемы: замените предметный ключ строки её позицией,
 * перестаньте объявлять направление сортировки через `aria-sort`, назовите
 * флажок строки номером вместо полигона, уберите подпись таблицы или показ
 * пустого результата — они упадут.
 *
 *   npx vitest run tests/DataTable.test.tsx
 *
 * Таблица сравнения — широкое представление экрана (AC-085a); отдельного
 * критерия на сортировку и выбор в реестре нет, разрыв назван в отчёте.
 *
 * @ac: AC-085a
 * @supports: R-084
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type TableColumn, type TableSort } from '@/shared/ui';

/** Строки из раздела 7 дизайн-договора: выдуманных величин в проверке нет. */
type Полигон = { id: string; name: string; distanceKm: number; total: number };

const ВОСТОК: Полигон = {
  id: 'vostok',
  name: 'Комплекс переработки «Восток»',
  distanceKm: 45,
  total: 19800,
};

const ИКША: Полигон = {
  id: 'iksha',
  name: 'Площадка «Икша»',
  distanceKm: 52,
  total: 20080,
};

const ЛЕСНАЯ: Полигон = {
  id: 'lesnaya',
  name: 'Полигон «Лесная»',
  distanceKm: 98,
  total: 29920,
};

const СТОЛБЦЫ: TableColumn[] = [
  { key: 'name', title: 'Полигон', sortable: true },
  { key: 'distance', title: 'Расстояние', align: 'end', sortable: true },
  { key: 'total', title: 'Итого', align: 'end', sortable: true },
  { key: 'status', title: 'Статус' },
];

function ячейка(row: Полигон, columnKey: string) {
  if (columnKey === 'name') {
    return row.name;
  }
  if (columnKey === 'distance') {
    return String(row.distanceKm);
  }
  if (columnKey === 'total') {
    return String(row.total);
  }

  return 'Активен';
}

/** Общая часть отрисовки: меняется только то, что проверка называет. */
function таблица(props: {
  rows: Полигон[];
  sort?: TableSort;
  onSort?: (key: string) => void;
  selectedKeys?: string[];
  onToggleRow?: (key: string, selected: boolean) => void;
  loading?: boolean;
}) {
  return (
    <DataTable
      caption="Полигоны для лома бетона, 20 т"
      columns={СТОЛБЦЫ}
      rowKey={(row: Полигон) => row.id}
      rowLabel={(row: Полигон) => row.name}
      cell={ячейка}
      {...props}
    />
  );
}

/** Названия полигонов в том порядке, в каком они стоят в теле таблицы. */
function порядокСтрок(): string[] {
  const body = screen.getAllByRole('rowgroup')[1];

  return within(body)
    .getAllByRole('row')
    .map(row => within(row).getAllByRole('cell')[1].textContent ?? '');
}

describe('таблица сравнения', () => {
  it('подпись таблицы служит её доступным именем', () => {
    render(таблица({ rows: [ВОСТОК, ИКША] }));

    expect(screen.getByRole('table', { name: 'Полигоны для лома бетона, 20 т' })).toBeInTheDocument();
  });

  it('заголовок столбца объявлен областью действия для своих ячеек', () => {
    render(таблица({ rows: [ВОСТОК] }));

    for (const title of ['Полигон', 'Расстояние', 'Итого', 'Статус']) {
      expect(screen.getByRole('columnheader', { name: new RegExp(title, 'u') })).toHaveAttribute('scope', 'col');
    }
  });

  it('сортировка по столбцу объявляет своё направление заголовку', () => {
    const { rerender } = render(
      таблица({
        rows: [ВОСТОК, ИКША],
        sort: { key: 'distance', direction: 'asc' },
        onSort: () => undefined,
      }),
    );

    expect(screen.getByRole('columnheader', { name: /Расстояние/u })).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByRole('columnheader', { name: /Итого/u })).toHaveAttribute('aria-sort', 'none');
    // Несортируемый столбец направления не объявляет: «none» у него означало бы
    // «сейчас не отсортирован, но можно», а нажать там не на что.
    expect(screen.getByRole('columnheader', { name: 'Статус' })).not.toHaveAttribute('aria-sort');

    rerender(
      таблица({
        rows: [ИКША, ВОСТОК],
        sort: { key: 'distance', direction: 'desc' },
        onSort: () => undefined,
      }),
    );

    expect(screen.getByRole('columnheader', { name: /Расстояние/u })).toHaveAttribute('aria-sort', 'descending');
  });

  it('нажатие на заголовок с клавиатуры просит экран пересортировать строки', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();

    render(таблица({ rows: [ВОСТОК, ИКША], sort: { key: 'total', direction: 'asc' }, onSort }));

    screen.getByRole('button', { name: /Расстояние/u }).focus();
    await user.keyboard('{Enter}');

    expect(onSort).toHaveBeenCalledWith('distance');
  });

  it('флажок строки называет полигон, а не её положение в списке', () => {
    render(таблица({ rows: [ВОСТОК, ИКША], selectedKeys: [], onToggleRow: () => undefined }));

    expect(screen.getByRole('checkbox', { name: 'Выбрать Комплекс переработки «Восток»' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /строк[ауи]\s*1/iu })).toBeNull();
  });

  it('выбранная строка остаётся выбранной после смены порядка строк', () => {
    const { rerender } = render(
      таблица({
        rows: [ВОСТОК, ИКША, ЛЕСНАЯ],
        selectedKeys: ['iksha'],
        onToggleRow: () => undefined,
      }),
    );

    expect(порядокСтрок()[0]).toBe(ВОСТОК.name);
    expect(screen.getByRole('checkbox', { name: `Выбрать ${ИКША.name}` })).toBeChecked();

    // Сортировка по убыванию расстояния переставляет строки: первой становится
    // другая запись, а выбранной обязана остаться прежняя.
    rerender(
      таблица({
        rows: [ЛЕСНАЯ, ИКША, ВОСТОК],
        selectedKeys: ['iksha'],
        onToggleRow: () => undefined,
      }),
    );

    expect(порядокСтрок()[0]).toBe(ЛЕСНАЯ.name);
    expect(screen.getByRole('checkbox', { name: `Выбрать ${ИКША.name}` })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: `Выбрать ${ЛЕСНАЯ.name}` })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: `Выбрать ${ВОСТОК.name}` })).not.toBeChecked();
  });

  it('снятие флажка называет экрану ключ строки и новое состояние', async () => {
    const user = userEvent.setup();
    const onToggleRow = vi.fn();

    render(таблица({ rows: [ВОСТОК, ИКША], selectedKeys: ['vostok'], onToggleRow }));

    await user.click(screen.getByRole('checkbox', { name: `Выбрать ${ВОСТОК.name}` }));
    expect(onToggleRow).toHaveBeenCalledWith('vostok', false);

    await user.click(screen.getByRole('checkbox', { name: `Выбрать ${ИКША.name}` }));
    expect(onToggleRow).toHaveBeenCalledWith('iksha', true);
  });

  it('загрузка объявлена занятостью таблицы и не показывает строк данных', () => {
    render(таблица({ rows: [], loading: true }));

    expect(screen.getByRole('table', { name: 'Полигоны для лома бетона, 20 т' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('идёт загрузка строк');

    // Полосы ожидания скрыты от обхода: в дереве доступности остаётся только
    // заголовок таблицы.
    const body = screen.getAllByRole('rowgroup')[1];
    expect(within(body).queryAllByRole('row')).toHaveLength(0);
  });

  it('пустой результат показан внутри таблицы и назван причиной', () => {
    render(таблица({ rows: [] }));

    const таблицаСравнения = screen.getByRole('table', { name: 'Полигоны для лома бетона, 20 т' });

    // Пустой результат стоит внутри таблицы, под её заголовками: снаружи он
    // читался бы как сообщение обо всей странице.
    expect(within(таблицаСравнения).getByText('Ничего не найдено')).toBeInTheDocument();
    expect(within(таблицаСравнения).getByText(/снимите фильтр/u)).toBeInTheDocument();
    expect(таблицаСравнения).not.toHaveAttribute('aria-busy');
  });
});
