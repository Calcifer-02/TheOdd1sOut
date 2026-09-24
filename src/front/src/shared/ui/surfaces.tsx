/**
 * Поверхности и подписи: карточка, число с подписью, отметка актуальности.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import { useId, type ReactNode } from 'react';
import { formatDate } from '@/shared/lib/formatting';

/**
 * Карточка: белая поверхность с необязательным заголовком и действиями.
 *
 * С заголовком это `section` с доступным именем — на экране таких блоков
 * несколько, и без имени они неразличимы при обходе по областям. Без
 * заголовка — обычный `div`: безымянная область только засоряет обход.
 *
 * Уровень заголовка задаётся снаружи, потому что глубина вложения известна
 * экрану, а не карточке; пропуск уровня ломает оглавление страницы.
 */
export function Card({
  title,
  actions,
  children,
  className,
  titleLevel = 3,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  titleLevel?: 2 | 3 | 4;
}) {
  const titleId = useId();
  const classes = className ? `imolt-card ${className}` : 'imolt-card';
  const Heading = `h${titleLevel}` as 'h2' | 'h3' | 'h4';

  if (title === undefined) {
    return (
      <div className={classes}>
        {actions && <div className="imolt-card-head">{actions}</div>}
        {children}
      </div>
    );
  }

  return (
    <section className={classes} aria-labelledby={titleId}>
      <div className="imolt-card-head">
        <Heading className="imolt-card-title" id={titleId}>
          {title}
        </Heading>
        {actions && <div className="imolt-card-actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/**
 * Число с подписью. Пара «имя — значение» выражена списком описаний: это её
 * родная разметка, и связь подписи со значением не приходится дорисовывать.
 */
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <dl className="imolt-stat">
      <dt className="imolt-stat-label">{label}</dt>
      <dd className="imolt-stat-value">{value}</dd>
      {hint && <dd className="imolt-stat-hint">{hint}</dd>}
    </dl>
  );
}

/** Предметный смысл отметки времени (карточка практики PRACT-027, шаг 1). */
const KINDS = {
  prices: { prefix: 'Цены на', subject: 'Цены' },
  statuses: { prefix: 'Статусы на', subject: 'Статусы' },
  updated: { prefix: 'Обновлено', subject: 'Обновление' },
  issued: { prefix: 'Выпущено', subject: 'Выпуск' },
} as const;

export type DateStampKind = keyof typeof KINDS;

type Moment = { date: string; time: string | null; zone: string | null };

/**
 * Разбор значения договора без обращения к часам машины: договор передаёт
 * либо дату в форме ГГГГ-ММ-ДД, либо момент со смещением в форме
 * ГГГГ-ММ-ДДTчч:мм±чч:мм. Преобразование в `Date` потеряло бы смещение
 * источника и подставило бы пояс браузера.
 */
function parseMoment(iso: string): Moment | null {
  const found = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(iso.trim());

  if (found === null) {
    return null;
  }

  return { date: found[1], time: found[2] ?? null, zone: found[3] ?? null };
}

/** Часовой пояс словами. `Z` договора — это UTC, и терять его нельзя. */
function zoneName(zone: string): string {
  return zone === 'Z' ? 'UTC' : `UTC${zone}`;
}

/** Разница в целых сутках между двумя датами договора. */
function daysBetween(from: string, to: string): number | null {
  const left = parseMoment(from);
  const right = parseMoment(to);

  if (left === null || right === null) {
    return null;
  }

  const MS_IN_DAY = 24 * 60 * 60 * 1000;

  // Счёт ведётся в UTC-полуночах: сутки календаря, а не часы браузера, иначе
  // переход на летнее время сдвинул бы разницу на единицу.
  const at = (text: string) => {
    const [year, month, day] = text.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };

  return Math.round((at(right.date) - at(left.date)) / MS_IN_DAY);
}

/** Согласование слова «день» с числом: «1 день», «2 дня», «11 дней». */
function dayWord(count: number): string {
  const tens = count % 100;
  const ones = count % 10;

  if (tens >= 11 && tens <= 14) {
    return 'дней';
  }
  if (ones === 1) {
    return 'день';
  }
  if (ones >= 2 && ones <= 4) {
    return 'дня';
  }

  return 'дней';
}

function relativeCaption(days: number): string {
  if (days === 0) {
    return 'сегодня';
  }
  if (days === 1) {
    return 'вчера';
  }
  if (days === -1) {
    return 'завтра';
  }

  return days > 1 ? `${days} ${dayWord(days)} назад` : `через ${-days} ${dayWord(-days)}`;
}

/**
 * Отметка актуальности данных (карточка практики PRACT-027).
 *
 * Точный момент стоит текстом и доступен без наведения: по нему принимают
 * решение, а подсказка по наведению недоступна ни клавиатуре, ни касанию.
 * Относительный возраст («вчера») точный момент не заменяет, а дополняет, и
 * появляется только когда экран назвал точку отсчёта `now`: собственных часов
 * компонент не читает, иначе одна и та же разметка давала бы разный текст от
 * запуска к запуску.
 */
export function DateStamp({
  iso,
  kind,
  now,
  className,
}: {
  iso: string | null | undefined;
  kind: DateStampKind;
  /** Дата отсчёта для относительной подписи, `ГГГГ-ММ-ДД`. */
  now?: string;
  className?: string;
}) {
  const classes = className ? `imolt-datestamp ${className}` : 'imolt-datestamp';
  const moment = iso === null || iso === undefined ? null : parseMoment(iso);

  // Отсутствие значения обозначается явно: пустая строка читалась бы как
  // «данные свежие» (PRACT-027, границы).
  if (moment === null) {
    return <span className={classes}>{KINDS[kind].subject}: дата неизвестна</span>;
  }

  const tail =
    moment.time === null ? '' : `, ${moment.time}${moment.zone === null ? '' : ` (${zoneName(moment.zone)})`}`;

  const exact = `${KINDS[kind].prefix} ${formatDate(moment.date)}${tail}`;
  const days = now === undefined ? null : daysBetween(moment.date, now);

  return (
    <span className={classes}>
      <time dateTime={iso ?? undefined}>{exact}</time>
      {days !== null && <span className="imolt-datestamp-age"> · {relativeCaption(days)}</span>}
    </span>
  );
}
