/**
 * Сводка отзывов полигона: средняя оценка и число отзывов.
 *
 * Средняя оценка приходит от службы и здесь не считается: второго места
 * подсчёта быть не должно, иначе значения разойдутся (AC-031a). У полигона без
 * отзывов средней оценки нет, и показывать вместо неё ноль нельзя — ноль
 * читался бы как худшая оценка (AC-031b).
 *
 * @req: R-031
 * @adr: ADR-0008
 */
import { useStyles } from '@/shared/ui';
import { formatNumber } from '@/shared/lib/formatting';
import { RatingValue } from './RatingValue';
import { REVIEW_CSS } from './styles';

export function ReviewSummary({
  averageRating,
  total,
}: {
  /** средняя оценка службы; `null` — отзывов нет */
  averageRating: number | null;
  total: number;
}) {
  useStyles('review', REVIEW_CSS);

  return (
    <div className="imolt-review-summary">
      <span className="imolt-review-summary-label">Средняя оценка достоверности</span>
      {averageRating === null ? (
        <span className="imolt-review-summary-none">Оценок пока нет</span>
      ) : (
        <RatingValue rating={averageRating} />
      )}
      <span className="imolt-review-summary-count">Отзывов: {formatNumber(total)}</span>
    </div>
  );
}
