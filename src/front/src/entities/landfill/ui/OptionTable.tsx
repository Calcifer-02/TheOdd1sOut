/**
 * Таблица сравнения полигонов (сущность «полигон»).
 *
 * На рабочем месте столбцы видны одновременно, и решение принимается взглядом,
 * а не пролистыванием: это то самое место, где мобильная раскладка на широком
 * экране мешает прямо (карта пути пользователя, путь 1 этап 4, путь 2 этап 4).
 *
 * Семантику таблицы, сортировку по столбцу и отметку строк держит общий
 * `DataTable`; здесь — какие столбцы у полигона и что стоит в ячейке. Разбивка
 * цены обязательна: перевозка, утилизация и итог показываются отдельно
 * (R-019, дизайн-договор разд. 4.6).
 *
 * @req: R-019, R-023, R-024, R-027
 * @adr: ADR-0008
 */
import type { ReactNode } from 'react';
import type { PlacementOption, SortField, SortOrder } from '@/shared/api/contracts';
import { formatDistance, formatMoney } from '@/shared/lib/formatting';
import { Button, DataTable, Popover, useStyles, type TableColumn } from '@/shared/ui';
import { colors, space } from '@/shared/ui/tokens';
import { StatusBadge, badgeStatus } from './StatusBadge';

/**
 * Столбцы сравнения. Порядок — из макета «ux/Калькулятор.dc.html»; ключи
 * сортируемых столбцов совпадают с полями сортировки договора, поэтому
 * заголовок таблицы и переключатель сортировки говорят об одном и том же.
 */
const COLUMNS: TableColumn[] = [
  { key: 'landfill', title: 'Полигон' },
  { key: 'distance', title: 'Расстояние', align: 'end', sortable: true, width: '120px' },
  { key: 'transport', title: 'Перевозка', align: 'end', sortable: true, width: '140px' },
  { key: 'disposal', title: 'Утилизация', align: 'end', sortable: true, width: '140px' },
  { key: 'total', title: 'Итого', align: 'end', sortable: true, width: '140px' },
  { key: 'status', title: 'Статус', width: '160px' },
  { key: 'route', title: 'Маршрут', width: '120px' },
];

/** Прочерк вместо суммы: утилизация не заказана, и нуля здесь нет. */
const NO_VALUE = '–';

const OPTION_TABLE_CSS = `
.imolt-cell-landfill { display: flex; flex-direction: column; gap: ${space.xxs}px; min-width: 0; }
.imolt-cell-status { display: flex; flex-direction: column; align-items: flex-start; gap: ${space.xxs}px; }
.imolt-cell-route { position: relative; display: inline-flex; }
.imolt-table tr[data-selected='true'] { background: ${colors.accentRowHover}; }
`;

export function OptionTable({
  caption,
  options,
  statusesUpdatedAt,
  selectedIds,
  sort,
  order,
  onSort,
  onToggle,
  onRoute,
  openRouteFor,
  routeDetails,
  onCloseRoute,
  loading,
  empty,
}: {
  /** Подпись таблицы: без неё столбцы не читаются экранным диктором. */
  caption: string;
  options: PlacementOption[];
  /** Дата, на которую известны статусы: по ней видно устаревшие (R-048). */
  statusesUpdatedAt: string;
  selectedIds: string[];
  sort: SortField;
  order: SortOrder;
  onSort: (field: SortField) => void;
  onToggle: (option: PlacementOption) => void;
  onRoute: (option: PlacementOption) => void;
  /** Полигон, у которого открыто всплывающее окно маршрута. */
  openRouteFor?: string;
  routeDetails?: ReactNode;
  onCloseRoute: () => void;
  loading?: boolean;
  empty?: ReactNode;
}) {
  useStyles('landfill-option-table', OPTION_TABLE_CSS);

  function cell(option: PlacementOption, columnKey: string): ReactNode {
    if (columnKey === 'landfill') {
      return (
        <span className="imolt-cell-landfill">
          <span className="imolt-option-name">{option.landfillName}</span>
          <span className="imolt-option-address">{option.address}</span>
        </span>
      );
    }

    if (columnKey === 'distance') {
      return formatDistance(option.distanceKm);
    }

    if (columnKey === 'transport') {
      return formatMoney(option.transportCost);
    }

    if (columnKey === 'disposal') {
      return option.disposalCost ? formatMoney(option.disposalCost) : NO_VALUE;
    }

    if (columnKey === 'total') {
      return <span className="imolt-total">{formatMoney(option.totalCost)}</span>;
    }

    if (columnKey === 'status') {
      return (
        <span className="imolt-cell-status">
          <StatusBadge
            status={badgeStatus(option, statusesUpdatedAt)}
            statusUpdatedAt={option.statusUpdatedAt}
          />
        </span>
      );
    }

    // Маршрут открывается и нажатием, и наведением: на рабочем месте курсор
    // быстрее, но полагаться только на наведение нельзя — с клавиатуры его не
    // воспроизвести, а на касании его не бывает вовсе (разд. 4.5).
    return (
      <span
        className="imolt-cell-route"
        onMouseEnter={() => {
          if (openRouteFor !== option.landfillId) {
            onRoute(option);
          }
        }}
      >
        <Button
          kind="tertiary"
          size="s"
          ariaLabel={`Маршрут до полигона ${option.landfillName}`}
          onClick={() => onRoute(option)}
        >
          Маршрут
        </Button>
        <Popover
          title={`Маршрут до полигона ${option.landfillName}`}
          open={openRouteFor === option.landfillId}
          onClose={onCloseRoute}
        >
          {routeDetails}
        </Popover>
      </span>
    );
  }

  return (
    <DataTable<PlacementOption>
      caption={caption}
      columns={COLUMNS}
      rows={options}
      rowKey={(option) => option.landfillId}
      rowLabel={(option) => `полигон ${option.landfillName}`}
      cell={cell}
      sort={{ key: sort, direction: order }}
      onSort={(key) => onSort(key as SortField)}
      selectedKeys={selectedIds}
      onToggleRow={(key) => {
        const option = options.find((candidate) => candidate.landfillId === key);
        if (option) {
          onToggle(option);
        }
      }}
      loading={loading}
      empty={empty}
    />
  );
}
