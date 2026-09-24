/**
 * Полоса состояния подписки над содержимым кабинета (экран Э-10).
 *
 * Состояние названо словом и значком, а не одним цветом: цвет сам по себе
 * состояния не обозначает (практика PRACT-029). Что закрыто подпиской, полоса
 * не перечисляет — состав доступа заказчиком не установлен.
 *
 * @supports: R-049, R-051
 * @adr: ADR-0008
 */
import { SubscriptionBadge, subscriptionExplanation } from '@/entities/participant';
import type { SubscriptionStanding } from '@/shared/api/cabinet';

export function SubscriptionBanner({ subscription }: { subscription: SubscriptionStanding }) {
  if (subscription.state === 'active') {
    return null;
  }

  return (
    <div className="imolt-cabinet-panel">
      <div className="imolt-cabinet-state">
        <SubscriptionBadge subscription={subscription} />
      </div>
      <p className="imolt-lead">{subscriptionExplanation(subscription.state)}</p>
    </div>
  );
}
