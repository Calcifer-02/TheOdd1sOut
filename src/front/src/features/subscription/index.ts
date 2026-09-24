/**
 * Публичный вход возможности «заявка на подписку».
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0006
 */
export { SubscriptionRequestForm } from './ui/SubscriptionRequestForm';
export {
  EMPTY_SUBSCRIPTION_DRAFT,
  readyToSend,
  subscriptionDraftErrors,
  subscriptionRequestOf,
  type SubscriptionDraft,
  type SubscriptionDraftErrors,
} from './model/draft';
