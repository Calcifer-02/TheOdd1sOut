/**
 * Опознание участника, пришедшего из переписки с чат-ботом (R-071).
 *
 * Карточка показывается только тогда, когда приложение открыто из переписки и
 * платформа передала стартовые параметры. Открытому по прямой ссылке
 * приложению она не нужна и не показывается: главный путь расчёта проходится
 * без личности (ADR-0009).
 *
 * Согласие спрашивается до обмена, а не подставляется истиной: сессия заводит
 * учётную запись, а учётная запись — персональные данные (R-054). Кнопка
 * названа наблюдаемым результатом, а не операцией: участник соглашается
 * получать извещения, а не «создать сессию» (практика PRACT-038).
 *
 * @req: R-071
 * @adr: ADR-0009
 */
import { useState } from 'react';
import { ApiProblem } from '@/shared/api/imolt';
import { Notice } from '@/shared/ui';
import { openedFromChat } from '@/shared/lib/platform';
import { signIn } from '@/entities/participant';
import type { Profile } from '@/shared/api/contracts';

export function ChatIdentity() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [consent, setConsent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!openedFromChat()) {
    return null;
  }

  if (profile !== null) {
    return (
      <Notice kind="done">
        Извещения о заявке придут в чат{profile.displayName ? `, ${profile.displayName}` : ''}
      </Notice>
    );
  }

  const connect = async () => {
    setFailure(null);
    setSending(true);

    try {
      const session = await signIn(consent);
      setProfile(session.profile);
    } catch (error) {
      // Показывается заголовок отказа, а не код причины: код — внутреннее имя
      // (ADR-0008, инвариант 4).
      setFailure(error instanceof ApiProblem ? error.title : 'Опознать участника не удалось');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="imolt-card" aria-labelledby="imolt-chat-identity">
      <h2 id="imolt-chat-identity">Открыто из чат-бота</h2>
      <p>
        Разрешите обработку персональных данных, чтобы получать извещения о заявке в чат и видеть
        свои прежние расчёты.
      </p>
      <label>
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />{' '}
        Согласен на обработку персональных данных
      </label>
      <button type="button" onClick={connect} disabled={!consent || sending}>
        Получать извещения в чате
      </button>
      {failure !== null && <Notice kind="error">{failure}</Notice>}
    </section>
  );
}
