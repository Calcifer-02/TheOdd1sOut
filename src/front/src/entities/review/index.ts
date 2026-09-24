/**
 * Публичный вход сущности «отзыв о полигоне». Подключаться к внутренним путям
 * слайса запрещено: граница держится проверкой, а не договорённостью
 * (PRACT-012).
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
export { RatingValue } from './ui/RatingValue';
export { ReviewSummary } from './ui/ReviewSummary';
export { ReviewList } from './ui/ReviewList';
export { ReviewForm, type ReviewDraft } from './ui/ReviewForm';
