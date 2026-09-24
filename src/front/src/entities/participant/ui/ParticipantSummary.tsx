/**
 * Участник одной строкой: значок-силуэт, имя и состояние подписки под ним.
 *
 * Показывается и до опознания. Своего входа у сервиса нет — личность даёт
 * платформа MAX (ADR-0006), — поэтому неопознанное состояние это рабочая
 * заглушка профиля, а не приглашение к входу, которого не будет: строка
 * «Участник не опознан» сообщала об отсутствии вместо того, чтобы показать
 * предмет (BUG-007).
 *
 * Заглушка и опознанный участник собраны одной разметкой: значок, имя, вторая
 * строка. Разные формы дёргали бы вёрстку шапки в тот момент, когда платформа
 * отдала личность, — а происходит это уже после первой отрисовки.
 *
 * Слово о подписке берётся у `subscriptionLine`: шапка и кабинет обязаны
 * называть одно состояние одинаково, и второго места с этими словами в
 * проекте нет (R-050).
 *
 * @supports: R-049, R-050
 * @adr: ADR-0006
 */
import { useStyles } from '@/shared/ui';
import { colors, fonts, space } from '@/shared/ui/tokens';
import type { ParticipantProfile } from '@/shared/api/cabinet';
import { subscriptionLine } from '../model/subscription';

const PARTICIPANT_SUMMARY_CSS = `
.imolt-participant-summary {
  display: inline-flex;
  align-items: center;
  gap: ${space.xs}px;
  min-width: 0;
  font-family: ${fonts.ui};
  text-align: left;
}

.imolt-participant-summary svg { color: ${colors.iconDefault}; flex: none; }

/* Имя и состояние идут колонкой: две строки в одну занимают ширину, которой
   в шапке нет, а перенос по словам рвал бы имя участника. */
.imolt-participant-summary-lines { display: grid; min-width: 0; }

.imolt-participant-summary-name {
  font-size: 13px;
  line-height: 18px;
  font-weight: 600;
  color: ${colors.textPrimary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.imolt-participant-summary-note {
  font-size: 12px;
  line-height: 16px;
  color: ${colors.textSecondary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
`;

/**
 * Силуэт участника: линейный значок, цвет — из текущего (разд. 4.3). Значок
 * сопровождает имя, а не заменяет его, поэтому скрыт от вспомогательной
 * технологии: вслух он повторил бы уже сказанное.
 */
function ParticipantIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4.2 16.4C4.2 13.5 6.8 11.9 10 11.9C13.2 11.9 15.8 13.5 15.8 16.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export type ParticipantSummaryProps = {
  /**
   * Профиль опознанного участника или `null` — заглушка гостя. Профиль, а не
   * сессия: маркеру доступа в разметке делать нечего, а показывать здесь
   * нечего, кроме реквизитов профиля.
   */
  profile: ParticipantProfile | null;
  /**
   * Сжатый вид: только значок и имя. На телефоне строка о подписке в шапке не
   * помещается, и состояние подписки называет кабинет.
   */
  compact?: boolean;
};

export function ParticipantSummary({ profile, compact = false }: ParticipantSummaryProps) {
  useStyles('participant-summary', PARTICIPANT_SUMMARY_CSS);

  // Гость — участник без входа: расчёт и предложение доступны и ему
  // (глоссарий проекта, ADR-0006), поэтому имя у заглушки утвердительное.
  const name = profile === null ? 'Гость' : (profile.displayName ?? 'Участник');

  // Состояние подписки — запись `{ state, activeUntil }`, а не код строкой:
  // сравнение самой записи с кодом молча давало ложь у любого участника с
  // действующей подпиской.
  const note = profile === null ? 'Личность даёт платформа MAX' : subscriptionLine(profile.subscription.state);

  return (
    <span className="imolt-participant-summary">
      <ParticipantIcon />
      <span className="imolt-participant-summary-lines">
        <span className="imolt-participant-summary-name">{name}</span>
        {!compact && <span className="imolt-participant-summary-note">{note}</span>}
      </span>
    </span>
  );
}
