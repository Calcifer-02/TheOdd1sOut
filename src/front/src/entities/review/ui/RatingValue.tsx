/**
 * Оценка полигона числом со шкалой, собранная кругом.
 *
 * Число без шкалы двусмысленно: «4» одинаково читается как «четыре из пяти» и
 * как «четыре отзыва». Поэтому шкала стоит и в видимом тексте, и в доступном
 * имени, а не выражается рядом картинок-звёзд: картинка из шрифта запрещена
 * дизайн-договором (разд. 4.6) и не читается вспомогательной технологией.
 *
 * Круг нужен, чтобы оценка читалась как единая величина, а не как начало
 * строки: набранная в строку, она прижималась к левому краю и терялась рядом с
 * датой отзыва. Внутри круга число и шкала стоят по центру, поэтому круг можно
 * поставить куда угодно, и выравнивание останется верным.
 *
 * Доступное имя объявлено целиком у круга (`role="img"`), а его части от
 * вспомогательной технологии скрыты: иначе число и шкала читались бы двумя
 * кусками, между которыми нет связи.
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
    <span className="imolt-review-rating" role="img" aria-label={`Оценка ${text}`}>
      <span className="imolt-review-rating-value" aria-hidden="true">
        {formatNumber(rating)}
      </span>
      <span className="imolt-review-rating-scale" aria-hidden="true">
        из {MAX_RATING}
      </span>
    </span>
  );
}
