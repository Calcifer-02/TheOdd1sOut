/**
 * Состав предложения таблицей — представление рабочего места.
 *
 * Разметка настоящей таблицы, а не сетки из блоков: заголовок столбца,
 * связанный с ячейкой через `scope`, — единственный способ прочитать строку
 * диктором, а подпись `caption` называет, что именно сведено в таблицу.
 *
 * Столбца с ценой за тонна-километр здесь нет, хотя макет Э-07 его рисует:
 * тариф перевозки и тариф утилизации пользователю не раскрываются (R-058,
 * `AC-058a`), и расчётная часть их в ответе не присылает.
 *
 * Итог берётся из ответа службы и в браузере не пересчитывается: сумма строк
 * предпросмотра и сумма документа обязаны совпадать, а два места счёта рано
 * или поздно расходятся (R-037).
 *
 * @supports: R-037
 * @adr: ADR-0008
 */
import { Notice } from '@/shared/ui';
import { formatDistance, formatMoney, type Money } from '@/shared/lib/formatting';
import { quantityTextOf, type QuoteLine } from '../model/composition';

/** Прочерк в числовой ячейке: утилизация нужна не всегда (R-021). */
const NO_VALUE = '–';

export function QuoteLinesTable({ lines, total }: { lines: QuoteLine[]; total: Money | null }) {
  if (lines.length === 0) {
    return <Notice kind="empty">В расчёте не выбрано ни одного полигона</Notice>;
  }

  return (
    <table className="imolt-quote-table">
      <caption>Состав предложения</caption>

      <thead>
        <tr>
          <th scope="col">Отходы и полигон</th>
          <th scope="col" data-align="end">
            Количество
          </th>
          <th scope="col" data-align="end">
            Расстояние
          </th>
          <th scope="col" data-align="end">
            Перевозка
          </th>
          <th scope="col" data-align="end">
            Утилизация
          </th>
          <th scope="col" data-align="end">
            Итого
          </th>
        </tr>
      </thead>

      <tbody>
        {lines.map(line => (
          <tr key={line.id}>
            <th scope="row">
              <div className="imolt-quote-line-name">{line.wasteGroupName}</div>
              {line.landfillName !== null && (
                <div className="imolt-quote-line-place">
                  {line.landfillName}
                  {line.landfillAddress !== null && `, ${line.landfillAddress}`}
                </div>
              )}
            </th>
            <td data-align="end">{quantityTextOf(line)}</td>
            <td data-align="end">{line.distanceKm === null ? NO_VALUE : formatDistance(line.distanceKm)}</td>
            <td data-align="end">{formatMoney(line.transportCost)}</td>
            <td data-align="end">{line.disposalCost === null ? NO_VALUE : formatMoney(line.disposalCost)}</td>
            <td data-align="end" data-total="true">
              {formatMoney(line.totalCost)}
            </td>
          </tr>
        ))}
      </tbody>

      {total !== null && (
        <tfoot>
          <tr>
            <th scope="row" colSpan={5}>
              Итого
            </th>
            <td data-align="end">{formatMoney(total)}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
