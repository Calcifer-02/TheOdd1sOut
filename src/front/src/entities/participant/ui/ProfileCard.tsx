/**
 * Профиль участника: кто пришёл и что о нём знает сервис (сущность «участник»).
 *
 * Показываются только те реквизиты, которые отдаёт договор. Телефона и почты
 * в схеме `Profile` нет, и рисовать их пустыми полями нельзя: пустое поле
 * читается как «не заполнено», а на деле сервис их не хранит (R-051).
 *
 * Признак регистрации в АИС ОССиГ показан утверждением, а не отметкой для
 * правки: операции изменения профиля договор не объявляет, и отметка, которая
 * ничего не меняет, обманывает участника. Признак задаётся заявкой на
 * подписку.
 *
 * @supports: R-049, R-051
 * @adr: ADR-0008
 */
import { useStyles } from '@/shared/ui';
import { colors, fonts, space } from '@/shared/ui/tokens';
import type { ParticipantProfile } from '@/shared/api/cabinet';
import { roleWord } from '../model/subscription';

const PROFILE_CARD_CSS = `
.imolt-participant-profile { display: grid; gap: ${space.s}px; }
.imolt-participant-name { font-size: 20px; line-height: 26px; font-weight: 700; }
.imolt-participant-role { font-size: 13px; line-height: 18px; color: ${colors.textSecondary}; }
.imolt-participant-facts { display: grid; gap: ${space.xs}px; margin: 0; }
.imolt-participant-fact {
  display: flex;
  justify-content: space-between;
  gap: ${space.s}px;
  font-size: 13px;
  line-height: 18px;
}
.imolt-participant-fact dt { color: ${colors.textSecondary}; }
.imolt-participant-fact dd {
  margin: 0;
  font-family: ${fonts.numeric};
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
`;

/** Признак словом: «да» и «нет» различимы, а «не указано» — третье состояние. */
function markWord(value: boolean | null | undefined): string {
  if (value === true) {
    return 'да';
  }

  return value === false ? 'нет' : 'не указано';
}

export function ProfileCard({ profile }: { profile: ParticipantProfile }) {
  useStyles('participant-profile', PROFILE_CARD_CSS);

  const name = profile.companyName ?? profile.displayName ?? 'Участник';
  const facts: { term: string; value: string }[] = [];

  if (profile.inn) {
    facts.push({ term: 'ИНН', value: profile.inn });
  }

  facts.push({
    term: 'Транспорт зарегистрирован в АИС ОССиГ',
    value: markWord(profile.registeredInAisOssig),
  });

  return (
    <div className="imolt-participant-profile">
      <div>
        <div className="imolt-participant-name">{name}</div>
        <div className="imolt-participant-role">
          {profile.role ? roleWord(profile.role) : 'Роль назначается заявкой на подписку'}
        </div>
      </div>

      <dl className="imolt-participant-facts">
        {facts.map(fact => (
          <div className="imolt-participant-fact" key={fact.term}>
            <dt>{fact.term}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
