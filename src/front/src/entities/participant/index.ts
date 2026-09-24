/**
 * Публичный вход сущности «участник»: сессия, полученная у платформы,
 * состояние подписки и реквизиты профиля.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0009
 */
export { accessToken, participant, signIn, forget, useParticipant } from './model/session';
export {
  subscriptionWord,
  subscriptionLine,
  subscriptionExplanation,
  roleWord,
  acceptsSubscriptionRequest,
  SUBSCRIBER_ROLES,
} from './model/subscription';
export {
  accessExplanation,
  accessRefusalLine,
  runRefusalReason,
  READING_OPEN,
  IDENTITY_FROM_MAX,
  PRICE_EDITING_CLOSED,
  RIGHT_FROM_OWNER,
} from './model/access';
export { SubscriptionBadge } from './ui/SubscriptionBadge';
export { ProfileCard } from './ui/ProfileCard';
export { ParticipantSummary } from './ui/ParticipantSummary';
export type { ParticipantSummaryProps } from './ui/ParticipantSummary';
