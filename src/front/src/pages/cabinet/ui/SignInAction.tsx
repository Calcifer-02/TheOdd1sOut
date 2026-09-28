/**
 * Что участнику доступно прямо сейчас: ход опознания, когда приложение
 * открыто из переписки, иначе — причина и ссылка на чат-бота (экран Э-09).
 *
 * Спрашивать здесь нечего. Приложение открыли кнопкой из переписки — значит,
 * платформа передала стартовые параметры, и опознание идёт само: отдельное
 * соглашение на входе заказчик снял 28.09.2026, основанием служит соглашение
 * платформы MAX (R-054). Кабинет открывается, как только опознание прошло.
 *
 * Сам обмен ведёт карточка опознания над экраном — одна на всё приложение.
 * Здесь читается только его исход: второй обмен по той же строке параметров
 * завёл бы вторую сессию на ровном месте.
 *
 * Формы входа по телефону с кодом здесь нет: она относится к снятому решению
 * R-066, а личность даёт платформа MAX (ADR-0006).
 *
 * @supports: R-050, R-054, R-071
 * @adr: ADR-0006
 */
import { Notice } from '@/shared/ui';
import { useIdentification } from '@/features/identify-from-chat';
import { openedFromChat } from '@/shared/lib/platform';
import {
  CHAT_BOT_HREF,
  CHAT_BOT_LINK,
  ENTRY_OPENING,
  ENTRY_REFUSED_STEP,
  ENTRY_STEP,
  ENTRY_UNKNOWN,
} from '../model/entry';

export function SignInAction() {
  const identification = useIdentification();

  if (openedFromChat()) {
    if (identification.refusal !== null) {
      return (
        <>
          <Notice kind="error">{identification.refusal}</Notice>
          <p className="imolt-lead">{ENTRY_REFUSED_STEP}</p>
        </>
      );
    }

    // Состояние ожидания названо словами, а не пустым местом: участник должен
    // видеть, что кабинет откроется сам, и не искать кнопку (PRACT-038).
    return (
      <p className="imolt-lead" role="status">
        {ENTRY_OPENING}
      </p>
    );
  }

  return (
    <>
      <Notice kind="empty">{ENTRY_UNKNOWN}</Notice>
      <p className="imolt-lead">{ENTRY_STEP}</p>
      <a className="imolt-link imolt-cabinet-link" href={CHAT_BOT_HREF} target="_blank" rel="noopener noreferrer">
        {CHAT_BOT_LINK}
      </a>
    </>
  );
}
