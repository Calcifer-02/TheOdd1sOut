/**
 * Опознание участника, пришедшего из переписки с чат-ботом (R-071).
 *
 * Карточка ничего не спрашивает. Приложение открыли кнопкой из переписки —
 * значит, платформа уже передала стартовые параметры, и профиль подтягивается
 * сам: отдельное соглашение на входе заказчик снял 28.09.2026, основанием
 * служит соглашение платформы MAX (R-054).
 *
 * Поэтому на экране видно только неудачу. Удачное опознание называет оболочка
 * приложения — она показывает, кто пришёл, — а вторая надпись о том же на
 * каждом экране была бы шумом.
 *
 * Открытому по прямой ссылке приложению опознание не нужно и не начинается:
 * главный путь расчёта проходится без личности (ADR-0009).
 *
 * @req: R-071
 * @adr: ADR-0009
 */
import { useEffect } from 'react';
import { Notice } from '@/shared/ui';
import { identifyAsync, useIdentification } from '../model/identification';

export function ChatIdentity() {
  const identification = useIdentification();

  useEffect(() => {
    void identifyAsync();
  }, []);

  if (identification.refusal === null) {
    return null;
  }

  return (
    <div className="imolt-band">
      <Notice kind="error">{identification.refusal}</Notice>
    </div>
  );
}
