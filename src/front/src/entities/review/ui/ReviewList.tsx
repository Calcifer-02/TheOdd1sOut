/**
 * Отзывы о полигоне списком: оценка, момент и текст.
 *
 * Момент отзыва показан точно, а не относительной подписью: «три дня назад»
 * зависит от часов читателя и теряет часовой пояс источника. Видимый текст —
 * дата по локали, машиночитаемое значение с поясом остаётся в атрибуте
 * `datetime` (карточка практики PRACT-027).
 *
 * Список сам отвечает за свои состояния: загрузку, пустоту и отказ. Иначе
 * каждый экран воспроизводил бы их заново и расходился в формулировках.
 *
 * @req: R-031
 * @adr: ADR-0008
 */
import { EmptyState, Notice, Skeleton, useStyles } from '@/shared/ui';
import type { Review } from '@/shared/api/references';
import { formatDate } from '@/shared/lib/formatting';
import { RatingValue } from './RatingValue';
import { REVIEW_CSS } from './styles';

export function ReviewList({
  reviews,
  loading,
  error,
}: {
  reviews: Review[];
  loading?: boolean;
  /** заголовок отказа службы; код наружу не показывается */
  error?: string;
}) {
  useStyles('review', REVIEW_CSS);

  if (loading) {
    return <Skeleton rows={2} label="Отзывы загружаются" />;
  }

  if (error) {
    return <Notice kind="error">{error}</Notice>;
  }

  if (reviews.length === 0) {
    return (
      <EmptyState
        title="Отзывов пока нет"
        hint="Расхождение тарифа или статуса с действительностью заметно раньше всего на месте."
      />
    );
  }

  return (
    <ul className="imolt-review-list" aria-label="Отзывы о полигоне">
      {reviews.map((review) => (
        <li key={review.id} className="imolt-review-item">
          <div className="imolt-review-item-head">
            <RatingValue rating={review.rating} />
            {/* Точный момент остаётся в значении атрибута вместе с поясом. */}
            <time className="imolt-review-item-date" dateTime={review.createdAt}>
              {formatDate(review.createdAt)}
            </time>
          </div>
          {review.text ? <p className="imolt-review-item-text">{review.text}</p> : null}
        </li>
      ))}
    </ul>
  );
}
