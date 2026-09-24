/**
 * Состав предложения карточками — представление телефона.
 *
 * Та же строка, что и в таблице, но иным деревом разметки: на ширине 390
 * шесть столбцов не читаются, а прятать половину правилом `display: none`
 * нельзя — скрытая ветка остаётся в дереве доступности (дизайн-договор,
 * разд. 4.5). Числа при этом те же самые: состав считается один раз
 * (`../model/composition`).
 *
 * @supports: R-037
 * @adr: ADR-0008
 */
import { Notice } from '@/shared/ui';
import { formatDistance, formatMoney } from '@/shared/lib/formatting';
import { quantityTextOf, type QuoteLine } from '../model/composition';

export function QuoteLineCards({ lines }: { lines: QuoteLine[] }) {
  if (lines.length === 0) {
    return <Notice kind="empty">В расчёте не выбрано ни одного полигона</Notice>;
  }

  return (
    <ul className="imolt-quote-cards" aria-label="Состав предложения">
      {lines.map((line) => (
        <li className="imolt-quote-card" key={line.id}>
          <div className="imolt-quote-card-head">
            <div>
              <div className="imolt-quote-line-name">{line.wasteGroupName}</div>
              {line.landfillName !== null && (
                <div className="imolt-quote-line-place">{line.landfillName}</div>
              )}
            </div>
            <div className="imolt-quote-card-sum">{formatMoney(line.totalCost)}</div>
          </div>

          <dl className="imolt-quote-card-facts">
            <div>
              <dt>Количество</dt>
              <dd>{quantityTextOf(line)}</dd>
            </div>

            {line.distanceKm !== null && (
              <div>
                <dt>Расстояние</dt>
                <dd>{formatDistance(line.distanceKm)}</dd>
              </div>
            )}

            <div>
              <dt>Перевозка</dt>
              <dd>{formatMoney(line.transportCost)}</dd>
            </div>

            {line.disposalCost !== null && (
              <div>
                <dt>Утилизация</dt>
                <dd>{formatMoney(line.disposalCost)}</dd>
              </div>
            )}
          </dl>
        </li>
      ))}
    </ul>
  );
}
