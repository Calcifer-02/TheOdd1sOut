/**
 * Тарифы утилизации полигона парами «группа отходов — цена за тонну».
 *
 * Список описаний, а не таблица внутри таблицы: пара «название — значение»
 * — это ровно `dl`, и вспомогательная технология читает её связями, а не
 * порядком строк.
 *
 * @supports: R-040, R-048
 * @adr: ADR-0008
 */
import { DateStamp } from '@/shared/ui';
import { formatMoney } from '@/shared/lib/formatting';
import type { TariffRow } from '../model/tariffs';

export function LandfillTariffs({
  rows,
  withDates,
}: {
  rows: TariffRow[];
  /** показывать дату актуальности каждого тарифа (в карточке полигона) */
  withDates?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="imolt-tariffs-none">Тариф по выбранной группе не задан</p>;
  }

  return (
    <dl className="imolt-tariffs">
      {rows.map((row) => (
        <div key={row.wasteGroupId} className="imolt-tariffs-row">
          <dt>{row.name}</dt>
          <dd>
            {/* Цена отдельным узлом: рядом с ней может стоять дата тарифа, и
                значение должно оставаться цельным для чтения и поиска. */}
            <span className="imolt-tariffs-price">{`${formatMoney(row.disposalPricePerTon)}/т`}</span>
            {withDates ? <DateStamp iso={row.updatedAt} kind="updated" /> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
