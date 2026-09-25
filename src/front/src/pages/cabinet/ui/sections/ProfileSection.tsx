/**
 * Раздел «Профиль»: реквизиты участника (экран Э-10).
 *
 * Показывается то, что отдаёт договор, и ничего сверх: почты схема `Profile`
 * не хранит, и пустое поле для неё означало бы «не заполнено» там, где сервис
 * её вовсе не знает (R-051).
 *
 * @supports: R-049, R-051
 * @adr: ADR-0008
 */
import { ProfileCard, SubscriptionBadge } from '@/entities/participant';
import type { ParticipantProfile } from '@/shared/api/cabinet';

export function ProfileSection({ profile }: { profile: ParticipantProfile }) {
  return (
    <section className="imolt-cabinet-section" aria-labelledby="imolt-cabinet-profile">
      <div className="imolt-cabinet-heading">
        <h1 className="imolt-title" id="imolt-cabinet-profile">
          Профиль
        </h1>
        <p className="imolt-lead">Реквизиты приходят из заявки на подписку – сервис их не запрашивает отдельно.</p>
      </div>

      <div className="imolt-cabinet-panel">
        <ProfileCard profile={profile} />
        <div className="imolt-cabinet-state">
          <SubscriptionBadge subscription={profile.subscription} />
        </div>
      </div>
    </section>
  );
}
