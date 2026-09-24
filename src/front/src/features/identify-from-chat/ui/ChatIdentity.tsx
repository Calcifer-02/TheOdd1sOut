/**
 * Опознание участника, пришедшего из переписки с чат-ботом (R-071).
 *
 * Карточка показывается только тогда, когда приложение открыто из переписки и
 * платформа передала стартовые параметры. Открытому по прямой ссылке
 * приложению она не нужна и не показывается: главный путь расчёта проходится
 * без личности (ADR-0009).
 *
 * Согласие и сам обмен живут в `SignInPrompt`: тот же порядок нужен кабинету,
 * а копия логики согласия — прямой путь к экрану, который однажды перестанет
 * его спрашивать (R-054).
 *
 * @req: R-071
 * @adr: ADR-0009
 */
import { useState } from 'react';
import { Notice } from '@/shared/ui';
import { openedFromChat } from '@/shared/lib/platform';
import type { Profile } from '@/shared/api/contracts';
import { SignInPrompt } from './SignInPrompt';

export function ChatIdentity() {
  const [profile, setProfile] = useState<Profile | null>(null);

  if (!openedFromChat()) {
    return null;
  }

  if (profile !== null) {
    return (
      <div className="imolt-band">
        <Notice kind="done">
          Извещения о заявке придут в чат{profile.displayName ? `, ${profile.displayName}` : ''}
        </Notice>
      </div>
    );
  }

  return (
    <div className="imolt-band">
      <section className="imolt-card" aria-labelledby="imolt-chat-identity">
        <h2 className="imolt-section" id="imolt-chat-identity">
          Открыто из чат-бота
        </h2>
        <p className="imolt-lead">
          Разрешите обработку персональных данных, чтобы получать извещения о заявке в чат и
          видеть свои прежние расчёты.
        </p>
        <SignInPrompt
          actionLabel="Получать извещения в чате"
          onSignedIn={(session) => setProfile(session.profile)}
        />
      </section>
    </div>
  );
}
