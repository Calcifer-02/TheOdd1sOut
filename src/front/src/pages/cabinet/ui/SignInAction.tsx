/**
 * Что участнику доступно прямо сейчас: согласие и обмен, когда приложение
 * открыто из переписки, иначе — причина и ссылка на чат-бота (экран Э-09).
 *
 * Блок один на оба представления входа. Раскладка у телефона и рабочего
 * места разная и выражена разными деревьями (R-085), а сам порядок действия
 * от ширины окна не зависит: вторая копия этого порядка рано или поздно
 * перестала бы спрашивать согласие.
 *
 * Формы входа по телефону с кодом здесь нет: она относится к снятому решению
 * R-066, а личность даёт платформа MAX (ADR-0006).
 *
 * @supports: R-050, R-054, R-071
 * @adr: ADR-0006
 */
import { Notice } from '@/shared/ui';
import { openedFromChat } from '@/shared/lib/platform';
import { SignInPrompt } from '@/features/identify-from-chat';
import {
  CHAT_BOT_HREF,
  CHAT_BOT_LINK,
  ENTRY_CONSENT,
  ENTRY_STEP,
  ENTRY_UNKNOWN,
  OPEN_CABINET_ACTION,
} from '../model/entry';

export function SignInAction() {
  if (openedFromChat()) {
    return (
      <>
        <p className="imolt-lead">{ENTRY_CONSENT}</p>
        <SignInPrompt actionLabel={OPEN_CABINET_ACTION} onSignedIn={() => undefined} />
      </>
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
