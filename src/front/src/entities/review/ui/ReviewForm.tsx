/**
 * Форма отзыва о полигоне: оценка достоверности сведений и пояснение.
 *
 * Оценка обязательна, пояснение — нет: отзыв без оценки нечем учесть в
 * средней, и договор объявляет `rating` обязательным полем. Поэтому форма
 * останавливает отправку сама и называет причину, а не полагается на отказ
 * службы: пустой запрос ушёл бы впустую (R-031, схема `LandfillReviewInput`).
 *
 * Оценка выбирается переключателями, а не набором кнопок: значение ровно
 * одно, и клавиатура нативной группы работает без доделок.
 *
 * @req: R-031
 * @adr: ADR-0008
 */
import { useState } from 'react';
import { Button, Field, Notice, RadioPills, useStyles } from '@/shared/ui';
import { RATING_OPTIONS, RATING_SCALE_HINT } from '../model/rating';
import { REVIEW_CSS } from './styles';

/** Отзыв, готовый к отправке. Форма договора: оценка и необязательный текст. */
export type ReviewDraft = { rating: number; text?: string };

const RATING_REQUIRED = 'Укажите оценку: без неё отзыв не попадёт в среднюю';

export function ReviewForm({
  onSubmit,
  formId = 'review',
  sending,
  error,
  done,
}: {
  onSubmit: (draft: ReviewDraft) => void;
  /**
   * Приставка имён управлений. На витрине форм несколько, а одно имя группы
   * переключателей слило бы их в одну группу, и выбор в одной форме снимал бы
   * выбор в соседней.
   */
  formId?: string;
  sending?: boolean;
  /** заголовок отказа службы; код внутренним именем наружу не выносится */
  error?: string;
  done?: boolean;
}) {
  useStyles('review', REVIEW_CSS);

  const [rating, setRating] = useState('');
  const [text, setText] = useState('');
  const [missingRating, setMissingRating] = useState(false);

  const shownError = missingRating ? RATING_REQUIRED : error;

  return (
    <form
      className="imolt-review-form"
      aria-label="Новый отзыв о полигоне"
      onSubmit={event => {
        event.preventDefault();

        if (rating === '') {
          setMissingRating(true);
          return;
        }

        const trimmed = text.trim();
        onSubmit(trimmed === '' ? { rating: Number(rating) } : { rating: Number(rating), text: trimmed });
      }}
    >
      <RadioPills
        name={`${formId}-rating`}
        label="Оценка достоверности сведений"
        className="imolt-review-scale"
        options={RATING_OPTIONS}
        value={rating}
        onPick={picked => {
          setRating(picked);
          setMissingRating(false);
        }}
      />
      <p className="imolt-hint">{RATING_SCALE_HINT}</p>

      <Field
        id={`${formId}-text`}
        label="Что не сошлось с действительностью"
        hint="Необязательно"
        value={text}
        onChange={setText}
      />

      {shownError ? <Notice kind="error">{shownError}</Notice> : null}
      {done && !shownError ? <Notice kind="done">Отзыв принят</Notice> : null}

      <Button type="submit" kind="primary" disabled={sending}>
        Отправить отзыв
      </Button>
    </form>
  );
}
