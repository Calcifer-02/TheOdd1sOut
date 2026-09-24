/**
 * Состояние подписки участника словом и значком (сущность «участник»).
 *
 * Значок сам по себе состояния не обозначает: рядом всегда слово, а у
 * действующей подписки — дата, до которой она действует (практика PRACT-029).
 *
 * @supports: R-049, R-051
 * @adr: ADR-0008
 */
import { useStyles } from '@/shared/ui';
import { colors, fonts, radius, space } from '@/shared/ui/tokens';
import { formatDate } from '@/shared/lib/formatting';
import type { SubscriptionStanding } from '@/shared/api/cabinet';
import { subscriptionWord } from '../model/subscription';

const SUBSCRIPTION_BADGE_CSS = `
.imolt-participant-badge {
  display: inline-flex;
  align-items: center;
  gap: ${space.xxs}px;
  min-height: 24px;
  padding: 0 ${space.xs}px;
  border-radius: ${radius.badge}px;
  font-family: ${fonts.ui};
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
}
.imolt-participant-badge[data-state='active'] {
  background: ${colors.statusActiveBg};
  color: ${colors.statusActiveText};
}
.imolt-participant-badge[data-state='pending'] {
  background: ${colors.statusStaleBg};
  color: ${colors.statusStaleText};
}
.imolt-participant-badge[data-state='none'] {
  background: ${colors.statusUnknownBg};
  color: ${colors.statusUnknownText};
}
.imolt-participant-until {
  font-size: 12px;
  line-height: 16px;
  color: ${colors.textSecondary};
}
`;

/** Значок состояния: смысл несёт слово рядом, а не очертание само по себе. */
function StateIcon({ state }: { state: SubscriptionStanding['state'] }) {
  if (state === 'active') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3.5 8.5L6.5 11.5L12.5 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (state === 'pending') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 5.2V8.4L10.2 9.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.4 8H10.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function SubscriptionBadge({ subscription }: { subscription: SubscriptionStanding }) {
  useStyles('participant-badge', SUBSCRIPTION_BADGE_CSS);

  return (
    <>
      <span className="imolt-participant-badge" data-state={subscription.state}>
        <StateIcon state={subscription.state} />
        {subscriptionWord(subscription.state)}
      </span>
      {subscription.state === 'active' && subscription.activeUntil && (
        <span className="imolt-participant-until">
          до <time dateTime={subscription.activeUntil}>{formatDate(subscription.activeUntil)}</time>
        </span>
      )}
    </>
  );
}
