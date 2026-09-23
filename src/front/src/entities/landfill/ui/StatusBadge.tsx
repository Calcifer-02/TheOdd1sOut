/**
 * Состояние полигона словом и значком (сущность «полигон»).
 *
 * Значок сам по себе состояния не обозначает: рядом всегда слово, а рядом со
 * словом — дата, на которую состояние известно (практика PRACT-029, R-048).
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import type { LandfillStatus, PlacementOption } from '@/shared/api/contracts';
import { formatShortDate } from '@/shared/lib/formatting';

/** Значок статуса. Сам по себе смысла не несёт — рядом всегда слово. */
function StatusIcon({ status }: { status: BadgeStatus }) {
  const stroke = 'currentColor';

  if (status === 'active') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3.5 8.5L6.5 11.5L12.5 5"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (status === 'blocked') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" stroke={stroke} strokeWidth="1.5" />
        <path d="M4.2 11.8L11.8 4.2" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (status === 'stale') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" stroke={stroke} strokeWidth="1.5" />
        <path d="M8 5.2V8.4L10.2 9.8" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke={stroke} strokeWidth="1.5" />
      <path d="M8 5.4V5.5" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 7.4V10.6" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export type BadgeStatus = LandfillStatus | 'stale';

const STATUS_WORD: Record<BadgeStatus, string> = {
  active: 'Активен',
  blocked: 'Заблокирован',
  unconfirmed: 'Не подтверждён',
  stale: 'Данные устарели',
};

/**
 * Состояние полигона словом и значком: цвет сам по себе состояния не
 * обозначает (карточка практики PRACT-029). Рядом — дата, на которую
 * состояние известно (R-048).
 */
export function StatusBadge({ status, statusUpdatedAt }: { status: BadgeStatus; statusUpdatedAt: string }) {
  return (
    <>
      <span className="imolt-badge" data-status={status}>
        <StatusIcon status={status} />
        {STATUS_WORD[status]}
      </span>
      <span className="imolt-freshness">данные от {formatShortDate(statusUpdatedAt)}</span>
    </>
  );
}

/**
 * Состояние полигона с учётом свежести данных: полигон принимает отходы, но
 * подтверждение старше последнего обновления справочника. Правило
 * показа, а не расчёта: обе даты приходят от службы (R-048).
 */
export function badgeStatus(option: PlacementOption, statusesUpdatedAt: string): BadgeStatus {
  if (option.status === 'active' && option.statusUpdatedAt < statusesUpdatedAt) {
    return 'stale';
  }

  return option.status;
}
