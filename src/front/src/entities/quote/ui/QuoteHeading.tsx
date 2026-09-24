/**
 * Шапка коммерческого предложения: марка сервиса, номер и дата выпуска.
 *
 * Номер приходит от расчётной части и закрепляется один раз: повторное
 * обращение по тому же расчёту возвращает прежний номер, и второго здесь не
 * появляется (R-036). Пока предложение не выпущено, номера нет — вместо него
 * сказано словом, что он присваивается при выпуске, а не показан прочерк.
 *
 * @supports: R-036
 * @adr: ADR-0008
 */
import { formatDate } from '@/shared/lib/formatting';

export function QuoteHeading({
  number,
  issuedAt,
}: {
  /** Номер выпущенного предложения; `null` — предложение ещё не выпущено. */
  number: string | null;
  issuedAt: string | null;
}) {
  return (
    <header className="imolt-quote-brand">
      <div>
        <div className="imolt-quote-mark">ИМОЛТ</div>
        <div className="imolt-quote-tagline">
          Вывоз и утилизация отходов строительства и сноса. Москва и Московская область
        </div>
      </div>

      <div className="imolt-quote-number">
        {number === null ? (
          <span>Номер присваивается при выпуске</span>
        ) : (
          <>
            <div>№ {number}</div>
            {issuedAt !== null && (
              <span>
                от <time dateTime={issuedAt}>{formatDate(issuedAt)}</time>
              </span>
            )}
          </>
        )}
      </div>
    </header>
  );
}
