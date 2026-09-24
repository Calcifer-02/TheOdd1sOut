/**
 * Сохранённые расчёты карточками: телефон (экран Э-10, узкий экран).
 *
 * Таблица на телефоне превращается в одну колонку с горизонтальной прокруткой
 * и перестаёт читаться, поэтому у узкого экрана другая разметка, а не другое
 * оформление той же таблицы (дизайн-договор, разд. 4.5).
 *
 * @supports: R-008, R-049
 * @adr: ADR-0008
 */
import { formatDate, formatMoney } from '@/shared/lib/formatting';
import type { CalculationSummary } from '@/shared/api/cabinet';
import { calculationHref } from '../../model/cabinet';

export function CalculationsCards({ rows }: { rows: CalculationSummary[] }) {
  return (
    <ul className="imolt-calc-list" aria-label="Сохранённые расчёты">
      {rows.map(row => (
        <li className="imolt-calc-card" key={row.id}>
          <div className="imolt-calc-line">
            <span className="imolt-calc-address">{row.pickupAddress}</span>
            <span className="imolt-calc-total">{formatMoney(row.total)}</span>
          </div>
          <div className="imolt-calc-divider" />
          <div className="imolt-calc-line">
            <span className="imolt-calc-meta">
              <time dateTime={row.createdAt}>{formatDate(row.createdAt)}</time>
              {row.quoteNumber ? ` · предложение ${row.quoteNumber}` : ' · предложение не выпущено'}
            </span>
            <a
              className="imolt-link imolt-cabinet-link"
              href={calculationHref(row.id)}
              aria-label={`Открыть расчёт: ${row.pickupAddress}`}
            >
              Открыть
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
