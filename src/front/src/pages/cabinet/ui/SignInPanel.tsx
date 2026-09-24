/**
 * Кабинет без сессии: рабочее состояние, а не отказ (экран Э-09).
 *
 * Своей аутентификации у сервиса нет и не будет: личность даёт платформа MAX,
 * пароля не заводится (ADR-0006). Поэтому формы входа по телефону с кодом
 * здесь нет — она относится к снятому решению R-066. Экран, открытый не из
 * переписки, честно говорит, откуда кабинет открывается, и даёт ссылку на
 * чат-бота.
 *
 * Когда приложение открыто из переписки, но обмена ещё не было, тот же экран
 * предлагает опознание: согласие и обмен ведёт общая возможность, а не вторая
 * копия того же порядка (R-054).
 *
 * @req: R-050
 * @supports: R-049, R-054, R-071
 * @adr: ADR-0006
 */
import { Notice } from '@/shared/ui';
import { openedFromChat } from '@/shared/lib/platform';
import { SignInPrompt } from '@/features/identify-from-chat';

/**
 * Переписка с чат-ботом сервиса. Учётная запись бота названа в решении
 * ADR-0009; отсюда открывается мини-приложение.
 */
const CHAT_BOT_HREF = 'https://max.ru/t782_hakaton_max_bot';

export function SignInPanel() {
  const fromChat = openedFromChat();

  return (
    <section className="imolt-card imolt-cabinet-signin" aria-labelledby="imolt-cabinet-signin">
      <h1 className="imolt-title" id="imolt-cabinet-signin">
        Кабинет открывается из переписки
      </h1>
      <p className="imolt-lead">
        Расчёт и коммерческое предложение работают без входа. Кабинет показывает сохранённые
        расчёты, подписку и заказ документации, поэтому ему нужно знать, кто пришёл. Личность даёт
        платформа MAX – отдельного пароля у сервиса нет.
      </p>

      {fromChat ? (
        <>
          <p className="imolt-lead">
            Приложение открыто из переписки. Разрешите обработку персональных данных, чтобы открыть
            кабинет.
          </p>
          <SignInPrompt actionLabel="Открыть кабинет" onSignedIn={() => undefined} />
        </>
      ) : (
        <>
          <Notice kind="empty">
            Приложение открыто не из переписки, поэтому сервис не знает, кто пришёл, и чужих данных
            не показывает.
          </Notice>
          <p className="imolt-lead">
            Напишите чат-боту ИМОЛТ и откройте мини-приложение кнопкой из переписки.
          </p>
          <a
            className="imolt-cabinet-link"
            href={CHAT_BOT_HREF}
            target="_blank"
            rel="noopener noreferrer"
          >
            Открыть чат-бота ИМОЛТ
          </a>
        </>
      )}
    </section>
  );
}
