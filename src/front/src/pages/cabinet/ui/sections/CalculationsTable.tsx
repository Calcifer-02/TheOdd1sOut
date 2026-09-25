/**
 * Сохранённые расчёты таблицей: рабочее место (экран Э-10, широкий экран).
 *
 * За рабочим местом менеджер перевозчика сравнивает десяток строк сразу, и
 * ему нужна таблица со столбцами, а не карточки (карта пути пользователя,
 * путь 2, этап 4).
 *
 * @supports: R-049
 * @adr: ADR-0008
 */
import { DataTable } from '@/shared/ui';
import { formatDate, formatMoney } from '@/shared/lib/formatting';
import type { CalculationSummary } from '@/shared/api/cabinet';
import { calculationHref } from '../../model/cabinet';

const COLUMNS = [
  { key: 'address', title: 'Адрес вывоза' },
  { key: 'createdAt', title: 'Дата' },
  { key: 'total', title: 'Итого', align: 'end' as const },
  { key: 'quote', title: 'Предложение' },
  { key: 'open', title: 'Расчёт' },
];

export function CalculationsTable({ rows }: { rows: CalculationSummary[] }) {
  return (
    <DataTable<CalculationSummary>
      caption="Сохранённые расчёты"
      columns={COLUMNS}
      rows={rows}
      rowKey={row => row.id}
      cell={(row, columnKey) => {
        if (columnKey === 'address') {
          return row.pickupAddress;
        }

        if (columnKey === 'createdAt') {
          return <time dateTime={row.createdAt}>{formatDate(row.createdAt)}</time>;
        }

        if (columnKey === 'total') {
          return <span className="imolt-calc-total">{formatMoney(row.total)}</span>;
        }

        if (columnKey === 'quote') {
          // Ноль и отсутствие читаются по-разному: у расчёта без выпущенного
          // предложения номера нет, и выдумывать прочерк за номер нельзя.
          return row.quoteNumber ?? 'не выпущено';
        }

        return (
          <a
            className="imolt-link imolt-cabinet-link"
            href={calculationHref(row.id)}
            aria-label={`Открыть расчёт: ${row.pickupAddress}`}
          >
            Открыть
          </a>
        );
      }}
    />
  );
}
