/**
 * Раздел витрины: компоненты справочника полигонов и отзывов (R-084).
 *
 * Состояния стоят рядом, а не показываются по очереди: разница между «оценок
 * пока нет» и «средняя 3,5» или между отказом службы и пустым списком видна
 * только при сравнении на одной странице.
 *
 * Данные взяты из примеров договора (`openapi.yaml`, операция
 * `createLandfillReview`) и раздела 7 запроса на дизайн: витрина не выдумывает
 * чисел.
 *
 * @supports: R-084
 */
import { useState } from 'react';
import { RatingValue, ReviewForm, ReviewList, ReviewSummary, type ReviewDraft } from '@/entities/review';
import type { Review } from '@/shared/api/references';
import { Section } from '../ui/Section';

/** Отзыв из примера договора: расхождение тарифа с действительностью. */
const TARIFF_MISMATCH: Review = {
  id: 'review-tariff-mismatch',
  landfillId: 'vostok-timohovo',
  rating: 2,
  text: 'тариф на месте оказался 520 ₽/т вместо 480 ₽/т',
  createdAt: '2026-09-17T12:20:00+03:00',
};

/** Отзыв без пояснения: договор разрешает оценку без текста. */
const RATING_ONLY: Review = {
  id: 'review-rating-only',
  landfillId: 'vostok-timohovo',
  rating: 5,
  text: null,
  createdAt: '2026-09-16T09:05:00+03:00',
};

const REVIEWS = [TARIFF_MISMATCH, RATING_ONLY];

/** Средняя по этим двум оценкам. На экране её считает служба, а не браузер. */
const AVERAGE_RATING = 3.5;

export function LandfillsSection() {
  // Витрина показывает живой компонент, а не снимок: отправка без оценки
  // обязана останавливаться здесь так же, как на экране.
  const [accepted, setAccepted] = useState<ReviewDraft | null>(null);

  return (
    <>
      <Section title="Оценка полигона">
        <div className="imolt-split">
          <RatingValue rating={TARIFF_MISMATCH.rating} />
          <RatingValue rating={RATING_ONLY.rating} />
          <RatingValue rating={AVERAGE_RATING} />
        </div>
      </Section>

      <Section title="Сводка отзывов">
        <ReviewSummary averageRating={AVERAGE_RATING} total={REVIEWS.length} />
        <ReviewSummary averageRating={null} total={0} />
      </Section>

      <Section title="Отзывы: список">
        <ReviewList reviews={REVIEWS} />
      </Section>

      <Section title="Отзывы: загрузка">
        <ReviewList reviews={[]} loading />
      </Section>

      <Section title="Отзывы: пусто">
        <ReviewList reviews={[]} />
      </Section>

      <Section title="Отзывы: отказ службы">
        <ReviewList reviews={[]} error="Запись не найдена" />
      </Section>

      <Section title="Новый отзыв">
        <ReviewForm formId="showcase-review" onSubmit={setAccepted} />
        {accepted === null ? null : (
          <p className="imolt-hint">
            {`Форма отдала оценку ${accepted.rating}${accepted.text ? ` и пояснение: ${accepted.text}` : ' без пояснения'}`}
          </p>
        )}
      </Section>

      <Section title="Новый отзыв: отправка идёт">
        <ReviewForm formId="showcase-review-sending" onSubmit={() => undefined} sending />
      </Section>

      <Section title="Новый отзыв: отказ службы">
        <ReviewForm formId="showcase-review-failed" onSubmit={() => undefined} error="Требуется вход через MAX" />
      </Section>

      <Section title="Новый отзыв: отзыв принят">
        <ReviewForm formId="showcase-review-done" onSubmit={() => undefined} done />
      </Section>
    </>
  );
}
