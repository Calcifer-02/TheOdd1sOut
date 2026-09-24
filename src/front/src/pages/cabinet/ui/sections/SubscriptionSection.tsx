/**
 * Раздел «Подписка»: состояние доступа и заявка на него (экраны Э-09, Э-10).
 *
 * Реализована форма разграничения — три состояния и переход между ними
 * заявкой, — а не политика доступа: что именно закрыто подпиской, заказчиком
 * не установлено, и назначать состав привилегий за него нельзя. По той же
 * причине здесь нет ни цены тарифа, ни срока пробного периода: числами их
 * никто не называл.
 *
 * Оплаты на экране нет: дизайн-договор запрещает рисовать оплату и корзину,
 * а договор API объявляет заявку намерением.
 *
 * @req: R-051
 * @supports: R-049, R-050, R-054
 * @adr: ADR-0006
 */
import { useState } from 'react';
import { Notice } from '@/shared/ui';
import { SubscriptionBadge, acceptsSubscriptionRequest, subscriptionExplanation } from '@/entities/participant';
import { SubscriptionRequestForm } from '@/features/subscription';
import type { SubscriptionStanding } from '@/shared/api/cabinet';

export function SubscriptionSection({
  subscription,
  onAccepted,
}: {
  subscription: SubscriptionStanding;
  onAccepted: (next: SubscriptionStanding) => void;
}) {
  const [accepted, setAccepted] = useState<string | null>(null);

  return (
    <section className="imolt-cabinet-section" aria-labelledby="imolt-cabinet-subscription">
      <div className="imolt-cabinet-heading">
        <h1 className="imolt-title" id="imolt-cabinet-subscription">
          Подписка
        </h1>
        <p className="imolt-lead">{subscriptionExplanation(subscription.state)}</p>
      </div>

      <div className="imolt-cabinet-panel">
        <div className="imolt-cabinet-state">
          <SubscriptionBadge subscription={subscription} />
        </div>
        <p className="imolt-lead">
          Состав доступа по подписке заказчиком пока не назван, поэтому сервис перечня привилегий не показывает. Условия
          называет менеджер.
        </p>
      </div>

      {accepted !== null && <Notice kind="done">{accepted}</Notice>}

      {acceptsSubscriptionRequest(subscription.state) && (
        <div className="imolt-cabinet-panel">
          <SubscriptionRequestForm
            onAccepted={(next, message) => {
              setAccepted(message ?? 'Заявка принята');
              onAccepted(next);
            }}
          />
        </div>
      )}
    </section>
  );
}
