/**
 * Оценка полигона числом со шкалой.
 *
 * Число без шкалы двусмысленно: «4» одинаково читается как «четыре из пяти» и
 * как «четыре отзыва». Поэтому шкала стоит и в видимом тексте, и в доступном
 * имени, а не выражается рядом картинок-звёзд: картинка из шрифта запрещена
 * дизайн-договором (разд. 4.6) и не читается вспомогательной технологией.
 *
 * @req: R-031
 * @adr: ADR-0008
 */
import { useStyles } from '@/shared/ui';
import { formatNumber } from '@/shared/lib/formatting';
import { MAX_RATING } from '../model/rating';
import { REVIEW_CSS } from './styles';

/** Оценка достоверности сведений о полигоне: число службы, а не подсчёт здесь. */
export function RatingValue({ rating }: { rating: number }) {
  useStyles('review', REVIEW_CSS);

  const text = `${formatNumber(rating)} из ${MAX_RATING}`;

  return (
    <span className="imolt-review-rating" aria-label={`Оценка ${text}`}>
      {text}
    </span>
  );
}
