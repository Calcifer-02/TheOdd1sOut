/**
 * Таблица сравнения: ядро широкого представления экранов.
 *
 * Разметка — настоящая `table` с подписью и заголовками столбцов: визуальная
 * сетка из `div` дала бы тот же вид, но отняла бы у вспомогательной технологии
 * связь ячейки со столбцом и переход по строкам (карточка практики PRACT-021,
 * граница «визуальная сетка сохраняет табличную семантику»).
 *
 * Идентичность строки — предметный ключ `rowKey`, а не её позиция: сортировка
 * и фильтр переставляют строки, и выбранной обязана остаться та же запись, а
 * не та же позиция (PRACT-021, шаг 2).
 *
 * Состояние таблицы — сортировка, выбор, порция — живёт у экрана: оно
 * передаётся ссылкой и восстанавливается из адреса, а таблица его только
 * показывает.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import type { ReactNode } from 'react';
import { EmptyState } from './feedback';

export type TableSort = { key: string; direction: 'asc' | 'desc' };

export type TableColumn = {
  key: string;
  title: string;
  /** `end` — числовой столбец: разряды выравниваются по правому краю. */
  align?: 'start' | 'end';
  sortable?: boolean;
  /** Ширина столбца правилом CSS, например `120px` или `20%`. */
  width?: string;
};

/** Стрелка направления сортировки. Смысл несёт `aria-sort`, это только вид. */
function SortMark({ direction }: { direction: 'asc' | 'desc' }) {
  return (
    <svg
      className="imolt-table-sort-mark"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={direction === 'asc' ? 'M6 10V2M2.8 5.2L6 2L9.2 5.2' : 'M6 2V10M2.8 6.8L6 10L9.2 6.8'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  rowLabel,
  cell,
  sort,
  onSort,
  selectedKeys,
  onToggleRow,
  empty,
  loading = false,
  loadingRows = 5,
  className,
}: {
  /** Подпись таблицы: её доступное имя. Обязательна. */
  caption: string;
  columns: TableColumn[];
  rows: T[];
  rowKey: (row: T) => string;
  /**
   * Имя строки для человека. Флажок выбора называется им, а не порядковым
   * номером: «выбрать строку 3» после сортировки указывает на другую запись.
   */
  rowLabel?: (row: T) => string;
  cell: (row: T, columnKey: string) => ReactNode;
  sort?: TableSort;
  onSort?: (columnKey: string) => void;
  selectedKeys?: readonly string[];
  onToggleRow?: (key: string, selected: boolean) => void;
  empty?: ReactNode;
  loading?: boolean;
  /** Сколько строк занимает место будущих данных при загрузке. */
  loadingRows?: number;
  className?: string;
}) {
  const selectable = onToggleRow !== undefined;
  const selected = new Set(selectedKeys ?? []);
  const span = columns.length + (selectable ? 1 : 0);

  return (
    <div className={className ? `imolt-table-scroll ${className}` : 'imolt-table-scroll'}>
      {/* Загрузка названа словом рядом с таблицей: серые полосы вместо строк
          вспомогательной технологии ничего не сообщают. */}
      <p className="imolt-visually-hidden" role="status">
        {loading ? `${caption}: идёт загрузка строк` : ''}
      </p>

      <table className="imolt-table" aria-busy={loading ? true : undefined}>
        <caption className="imolt-table-caption">{caption}</caption>
        <thead>
          <tr>
            {selectable && (
              <th scope="col" className="imolt-table-pick">
                <span className="imolt-visually-hidden">Выбор строки</span>
              </th>
            )}
            {columns.map((column) => {
              const active = sort !== undefined && sort.key === column.key;
              const order = !column.sortable
                ? undefined
                : active
                  ? sort.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none';

              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={order}
                  data-align={column.align ?? 'start'}
                  style={column.width === undefined ? undefined : { width: column.width }}
                >
                  {column.sortable && onSort ? (
                    <button
                      type="button"
                      className="imolt-table-sort"
                      onClick={() => onSort(column.key)}
                    >
                      {column.title}
                      {active && <SortMark direction={sort.direction} />}
                    </button>
                  ) : (
                    column.title
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: loadingRows }, (_, index) => (
              // Полосы ожидания — только вид, и в обходе они лишние: смысл уже
              // назван сообщением о загрузке выше.
              <tr key={`imolt-skeleton-${index}`} aria-hidden="true">
                {selectable && (
                  <td className="imolt-table-pick">
                    <span className="imolt-skeleton-bar" />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.key} data-align={column.align ?? 'start'}>
                    <span className="imolt-skeleton-bar" />
                  </td>
                ))}
              </tr>
            ))}

          {!loading && rows.length === 0 && (
            <tr>
              <td className="imolt-table-empty" colSpan={span}>
                {empty ?? (
                  <EmptyState
                    title="Ничего не найдено"
                    hint="Измените условия отбора или снимите фильтр"
                  />
                )}
              </td>
            </tr>
          )}

          {!loading &&
            rows.map((row) => {
              const key = rowKey(row);
              const picked = selected.has(key);
              const name = rowLabel ? rowLabel(row) : key;

              return (
                <tr key={key} data-selected={picked ? 'true' : undefined}>
                  {selectable && (
                    <td className="imolt-table-pick">
                      <input
                        type="checkbox"
                        className="imolt-check"
                        checked={picked}
                        aria-label={`Выбрать ${name}`}
                        onChange={(event) => onToggleRow(key, event.target.checked)}
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td key={column.key} data-align={column.align ?? 'start'}>
                      {cell(row, column.key)}
                    </td>
                  ))}
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
