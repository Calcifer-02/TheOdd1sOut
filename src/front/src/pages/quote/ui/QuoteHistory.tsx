/**
 * Ранее выпущенные предложения: таблица на рабочем месте и карточки на
 * телефоне.
 *
 * Разметки две, а не одна со скрытой веткой: спрятанная правилом оформления
 * таблица осталась бы в дереве доступности и читалась бы вслух на телефоне
 * (R-085, AC-085a; дизайн-договор, разд. 4.5). Предметная часть у них общая и
 * живёт в `../model/useQuoteHistory`.
 *
 * Строка ведёт на своё предложение — адресом этого же экрана с расчётом
 * строки: возврат к выпущенному документу обязан работать ссылкой (AC-036h).
 *
 * @supports: R-036, R-049, R-085
 * @adr: ADR-0006
 */
import type { ReactNode } from 'react';
import { DataTable, Notice } from '@/shared/ui';
import { formatDate, formatMoney } from '@/shared/lib/formatting';
import type { QuoteHistoryRow, QuoteHistoryState } from '../model/useQuoteHistory';
import { QUOTE_LABELS } from '../model/view';

const COLUMNS = [
  { key: 'number', title: QUOTE_LABELS.historyNumber },
  { key: 'createdAt', title: QUOTE_LABELS.historyDate },
  { key: 'address', title: QUOTE_LABELS.historyAddress },
  { key: 'total', title: QUOTE_LABELS.historyTotal, align: 'end' as const },
  { key: 'open', title: QUOTE_LABELS.historyOpen },
];

/** Имя ссылки для человека: номер без предмета не говорит, что откроется. */
function openLabel(row: QuoteHistoryRow): string {
  return `Открыть предложение ${row.number}: ${row.pickupAddress}`;
}

/**
 * Состояние перечня, кроме готового: загрузка и названная причина отсутствия.
 * Вид у обоих представлений один — это строка текста, а не раскладка.
 */
function HistoryState({ history }: { history: Exclude<QuoteHistoryState, { kind: 'ready' }> }) {
  if (history.kind === 'loading') {
    return (
      <p className="imolt-lead" role="status">
        {QUOTE_LABELS.historyLoading}
      </p>
    );
  }

  return <Notice kind="empty">{history.reason}</Notice>;
}

/** Ячейка строки перечня. Столбцы разобраны ветвлением, а не одним условием. */
function historyCell(row: QuoteHistoryRow, columnKey: string): ReactNode {
  if (columnKey === 'number') {
    return row.number;
  }

  if (columnKey === 'createdAt') {
    return <time dateTime={row.createdAt}>{formatDate(row.createdAt)}</time>;
  }

  if (columnKey === 'address') {
    return row.pickupAddress;
  }

  if (columnKey === 'total') {
    return <span className="imolt-quote-history-sum">{formatMoney(row.total)}</span>;
  }

  return (
    <a className="imolt-link" href={row.href} aria-label={openLabel(row)}>
      {QUOTE_LABELS.historyOpen}
    </a>
  );
}

/** Перечень таблицей: рабочее место сравнивает строки столбцами. */
export function QuoteHistoryTable({ history }: { history: QuoteHistoryState }) {
  return (
    <section className="imolt-card" aria-label={QUOTE_LABELS.history}>
      <h2 className="imolt-card-title">{QUOTE_LABELS.history}</h2>

      {history.kind === 'ready' ? (
        <DataTable<QuoteHistoryRow>
          caption={QUOTE_LABELS.history}
          columns={COLUMNS}
          rows={history.rows}
          rowKey={row => row.calculationId}
          empty={<Notice kind="empty">{QUOTE_LABELS.historyEmpty}</Notice>}
          cell={historyCell}
        />
      ) : (
        <HistoryState history={history} />
      )}
    </section>
  );
}

/** Содержимое перечня на телефоне: причина, пустота или карточки. */
function HistoryCards({ history }: { history: QuoteHistoryState }) {
  if (history.kind !== 'ready') {
    return <HistoryState history={history} />;
  }

  if (history.rows.length === 0) {
    return <Notice kind="empty">{QUOTE_LABELS.historyEmpty}</Notice>;
  }

  return (
    <ul className="imolt-quote-history-list">
      {history.rows.map(row => (
        <li className="imolt-quote-history-card" key={row.calculationId}>
          <div className="imolt-quote-history-line">
            <a className="imolt-link" href={row.href} aria-label={openLabel(row)}>
              {row.number}
            </a>
            <span className="imolt-quote-history-sum">{formatMoney(row.total)}</span>
          </div>
          <span className="imolt-quote-history-meta">
            <time dateTime={row.createdAt}>{formatDate(row.createdAt)}</time>
            {` · ${row.pickupAddress}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Перечень карточками: на телефоне столбцы не читаются. */
export function QuoteHistoryCards({ history }: { history: QuoteHistoryState }) {
  return (
    <section className="imolt-card" aria-label={QUOTE_LABELS.history}>
      <h2 className="imolt-card-title">{QUOTE_LABELS.history}</h2>
      <HistoryCards history={history} />
    </section>
  );
}
