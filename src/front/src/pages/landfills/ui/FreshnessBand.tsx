/**
 * Полоса актуальности над справочником: на какой день показаны цены и статусы.
 *
 * Дата — не украшение: по ней видно, на чём считается бюджет сноса (R-048,
 * AC-048a). Точный момент остаётся машиночитаемым — это работа `DateStamp`, а
 * относительной подписью он не подменяется (карточка практики PRACT-027).
 *
 * Число полигонов с устаревшими данными приходит от службы: браузер его не
 * досчитывает, иначе появилось бы второе значение того же числа.
 *
 * @req: R-048
 * @adr: ADR-0008
 */
import { DateStamp } from '@/shared/ui';
import type { DataFreshness } from '@/shared/api/references';
import { formatNumber } from '@/shared/lib/formatting';
import { STALE_AFTER_DAYS } from '../model/freshness';

export function FreshnessBand({ freshness }: { freshness: DataFreshness | null }) {
  if (freshness === null) {
    return null;
  }

  const stale = freshness.landfillsWithStaleData ?? 0;

  return (
    <div className="imolt-landfills-band" role="status" aria-label="Актуальность данных">
      <DateStamp iso={freshness.pricesUpdatedAt} kind="prices" />
      <DateStamp iso={freshness.statusesUpdatedAt} kind="statuses" />
      {stale > 0 ? (
        <span className="imolt-landfills-stale">
          {`Данные устарели у полигонов: ${formatNumber(stale)}. Порог – ${STALE_AFTER_DAYS} суток`}
        </span>
      ) : null}
    </div>
  );
}
