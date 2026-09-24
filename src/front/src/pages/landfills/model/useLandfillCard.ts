/**
 * Предметная часть карточки полигона: подробности, отзывы и новый отзыв.
 *
 * Средняя оценка после отправки отзыва перечитывается у службы, а не
 * досчитывается здесь: подсчёт в браузере стал бы вторым источником числа и
 * разошёлся бы с ответом службы (AC-031a).
 *
 * @supports: R-031, R-040, R-041
 * @adr: ADR-0008
 */
import { useCallback, useEffect, useState } from 'react';
import { createReview, getLandfill, listReviews, type LandfillCard, type ReviewPage } from '@/shared/api/references';
import type { ReviewDraft } from '@/entities/review';
import { accessRefusalLine } from '@/entities/participant';
import { problemTitle } from './useLandfillsScreen';

/** Сколько отзывов показывается в карточке сразу. */
const REVIEWS_SHOWN = 10;

export type LandfillCardState = {
  card: LandfillCard | null;
  reviews: ReviewPage | null;
  loading: boolean;
  /** заголовок отказа при чтении карточки */
  failure: string;
  /** заголовок отказа при чтении отзывов */
  reviewsFailure: string;
  /** идёт отправка отзыва */
  sending: boolean;
  /** заголовок отказа при отправке отзыва */
  sendFailure: string;
  /** отзыв принят службой */
  sent: boolean;
  submitReview: (draft: ReviewDraft) => void;
  retry: () => void;
};

export function useLandfillCard(landfillId: string): LandfillCardState {
  const [card, setCard] = useState<LandfillCard | null>(null);
  const [reviews, setReviews] = useState<ReviewPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState('');
  const [reviewsFailure, setReviewsFailure] = useState('');
  const [sending, setSending] = useState(false);
  const [sendFailure, setSendFailure] = useState('');
  const [sent, setSent] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSent(false);
    setSendFailure('');

    void (async () => {
      try {
        const found = await getLandfill(landfillId);

        if (!cancelled) {
          setCard(found);
          setFailure('');
        }
      } catch (error) {
        if (!cancelled) {
          setCard(null);
          setFailure(problemTitle(error));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [landfillId, attempt]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const page = await listReviews(landfillId, { limit: REVIEWS_SHOWN });

        if (!cancelled) {
          setReviews(page);
          setReviewsFailure('');
        }
      } catch (error) {
        if (!cancelled) {
          setReviews(null);
          setReviewsFailure(problemTitle(error));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [landfillId, attempt]);

  const submitReview = useCallback(
    (draft: ReviewDraft) => {
      setSending(true);
      setSendFailure('');

      void (async () => {
        try {
          await createReview(landfillId, draft);
          const page = await listReviews(landfillId, { limit: REVIEWS_SHOWN });

          setReviews(page);
          setSent(true);
        } catch (error) {
          // Отказ по личности или по праву без причины читается как
          // противоречие: мини-приложение уже открыто, а экран советует его
          // открыть. Причину называет сущность «участник» — она же объясняет
          // это в редакторе цен, и второй редакции текста в проекте нет
          // (BUG-012, ADR-0006).
          const объяснение = accessRefusalLine(error);

          setSendFailure(объяснение === '' ? problemTitle(error) : `${problemTitle(error)}. ${объяснение}`);
        } finally {
          setSending(false);
        }
      })();
    },
    [landfillId],
  );

  return {
    card,
    reviews,
    loading,
    failure,
    reviewsFailure,
    sending,
    sendFailure,
    sent,
    submitReview,
    retry: () => setAttempt(value => value + 1),
  };
}
