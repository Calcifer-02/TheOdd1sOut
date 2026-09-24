/**
 * Три факта предложения: адрес вывоза, дата актуальности цен и срок действия.
 *
 * Дата актуальности и срок действия — разные величины, и путать их нельзя:
 * первая говорит, когда обновлён справочник, вторая — до какого числа цена
 * остаётся в силе (глоссарий, «Срок действия цены»; R-038). Длительность срока
 * заказчиком не названа, поэтому берётся та дата, которую вернула служба.
 *
 * @supports: R-037, R-038
 * @adr: ADR-0008
 */
import { formatDate } from '@/shared/lib/formatting';

export function QuoteFacts({
  pickupAddress,
  pricesUpdatedAt,
  validUntil,
}: {
  pickupAddress: string;
  pricesUpdatedAt: string;
  /** Срок действия цены; `null` — предложение ещё не выпущено. */
  validUntil: string | null;
}) {
  return (
    <dl className="imolt-quote-facts">
      <div className="imolt-quote-fact">
        <dt>Адрес вывоза</dt>
        <dd>{pickupAddress}</dd>
      </div>

      <div className="imolt-quote-fact">
        <dt>Цены актуальны на</dt>
        <dd>
          <time dateTime={pricesUpdatedAt}>{formatDate(pricesUpdatedAt)}</time>
        </dd>
      </div>

      <div className="imolt-quote-fact">
        <dt>Срок действия</dt>
        <dd>
          {validUntil === null ? (
            'назначается при выпуске'
          ) : (
            <>
              до <time dateTime={validUntil}>{formatDate(validUntil)}</time>
            </>
          )}
        </dd>
      </div>
    </dl>
  );
}
