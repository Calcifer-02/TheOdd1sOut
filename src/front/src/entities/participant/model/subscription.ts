/**
 * Состояние подписки участника словом, а не кодом.
 *
 * Что именно открывает подписка, заказчиком не установлено (вопрос Q-011):
 * поэтому здесь объявлена форма разграничения — три состояния и то, как они
 * называются пользователю, — а не политика доступа, которой никто не
 * назначал. Перечень привилегий и цена тарифа здесь не заводятся намеренно.
 *
 * Слова живут в одном месте: значок состояния, заголовок раздела подписки и
 * пояснение в кабинете обязаны называть одно и то же состояние одинаково.
 *
 * @supports: R-049, R-050, R-051
 * @adr: ADR-0006
 */
import type { SubscriptionState } from '@/shared/api/contracts';
import type { SubscriberRole } from '@/shared/api/cabinet';

/** Состояние подписки словом. Цвет сам по себе состояния не обозначает. */
const SUBSCRIPTION_WORD: Record<SubscriptionState, string> = {
  none: 'Подписки нет',
  pending: 'Ожидает подтверждения',
  active: 'Действует',
};

/**
 * Пояснение к состоянию: что участнику делать дальше. Оплата идёт вне
 * сервиса, и сказать об этом обязан сам экран, а не менеджер по телефону.
 */
const SUBSCRIPTION_EXPLANATION: Record<SubscriptionState, string> = {
  none: 'Оставьте заявку – менеджер свяжется и назовёт условия.',
  pending: 'Заявка принята. Оплата проходит вне сервиса: менеджер выставит счёт и откроет доступ.',
  active: 'Доступ открыт.',
};

/** Роль подписчика словом (глоссарий проекта). */
const ROLE_WORD: Record<SubscriberRole, string> = {
  carrier: 'Перевозчик',
  demolitionCompany: 'Демонтажная компания',
};

/** Состояние подписки словом для показа рядом со значком. */
export function subscriptionWord(state: SubscriptionState): string {
  return SUBSCRIPTION_WORD[state];
}

/**
 * Состояние подписки строкой рядом с именем участника. Отдельно от
 * `subscriptionWord`, потому что значок подписан коротко («Действует»), а
 * строка в шапке обязана называть предмет: «ожидает подтверждения» рядом с
 * именем не говорит, что именно ожидает.
 */
export function subscriptionLine(state: SubscriptionState): string {
  return state === 'none' ? 'подписки нет' : `подписка ${SUBSCRIPTION_WORD[state].toLowerCase()}`;
}

/** Что участнику делать дальше при этом состоянии подписки. */
export function subscriptionExplanation(state: SubscriptionState): string {
  return SUBSCRIPTION_EXPLANATION[state];
}

/** Роль подписчика словом. */
export function roleWord(role: SubscriberRole): string {
  return ROLE_WORD[role];
}

/** Перечень ролей для выбора при оформлении подписки (макет Э-09). */
export const SUBSCRIBER_ROLES: { value: SubscriberRole; label: string }[] = [
  { value: 'carrier', label: ROLE_WORD.carrier },
  { value: 'demolitionCompany', label: ROLE_WORD.demolitionCompany },
];

/**
 * Можно ли оставить заявку на подписку. Повторная заявка при уже поданной
 * ничего не меняет и только порождает вторую запись у менеджера.
 */
export function acceptsSubscriptionRequest(state: SubscriptionState): boolean {
  return state === 'none';
}
