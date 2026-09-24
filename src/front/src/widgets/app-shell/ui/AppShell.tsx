/**
 * Оболочка приложения: шапка, переходы между экранами, основное содержимое.
 *
 * Оболочка одна на все экраны, а выглядит по-разному: на рабочем месте — шапка
 * с горизонтальными переходами, на телефоне — шапка и нижняя панель, потому
 * что верх экрана телефона до большого пальца не достаёт.
 *
 * Два представления — два дерева разметки, а не одно с `display: none`:
 * скрытая правилом стиля ветка остаётся в дереве доступности, и обход по
 * переходам находил бы их дважды (R-085, AC-085a).
 *
 * О содержимом экранов оболочка не знает: она получает его потомком и ни к
 * одному экрану не подключается. Иначе новый экран заставлял бы править
 * оболочку, а оболочка — знать порядок загрузки чужих данных.
 *
 * @supports: R-058
 * @adr: ADR-0008
 */
import { useRef, type ReactNode } from 'react';
import { participant, subscriptionLine } from '@/entities/participant';
import { hashOf, useRoute } from '@/shared/lib/routing';
import { isWide, useViewport } from '@/shared/lib/viewport';
import { useStyles } from '@/shared/ui';
import { NAVIGATION_LABEL, SECTIONS } from '../model/navigation';
import { SHELL_CSS } from './shellStyles';

/**
 * Значки разделов для нижней панели. Линейные, 20 px, цвет — из текущего
 * (разд. 4.3); значок сопровождает подпись, а не заменяет её, поэтому он
 * скрыт от вспомогательной технологии.
 */
function navIcon(path: string): ReactNode {
  const paths: Record<string, string[]> = {
    '/': ['M4 3h12v14H4z', 'M7 7h6', 'M7 11h2', 'M7 14h6'],
    '/landfills': ['M10 2.5C7.2 2.5 5 4.7 5 7.4C5 11 10 17 10 17C10 17 15 11 15 7.4C15 4.7 12.8 2.5 10 2.5Z'],
    '/quote': ['M5 2.5h6l4 4V17.5H5V2.5Z', 'M10.8 2.8v4h4'],
    '/cabinet': ['M10 4a3 3 0 1 0 0 6a3 3 0 0 0 0-6Z', 'M4 17c0-3 2.7-4.6 6-4.6s6 1.6 6 4.6'],
    '/references': ['M3 4h14v12H3z', 'M3 8h14', 'M8 8v8'],
  };

  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {(paths[path] ?? []).map((shape) => (
        <path
          key={shape}
          d={shape}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

/**
 * Состояние участника. Текст читается сам по себе: «Гость» рядом с именем
 * сервиса не объясняет, что именно гостевое (R-058).
 *
 * Собственного входа у сервиса нет — личность даёт платформа (ADR-0006), —
 * поэтому неопознанный участник показывается как рабочее состояние, а не как
 * приглашение к входу, которого не будет.
 */
function participantText(narrow: boolean): string {
  const session = participant();

  if (session === null) {
    return narrow ? 'Гость' : 'Участник не опознан';
  }

  const name = session.profile.displayName ?? 'Участник';

  if (narrow) {
    return name;
  }

  // Состояние подписки — запись `{ state, activeUntil }`, а не код строкой:
  // сравнение самой записи с кодом молча давало ложь у любого участника с
  // действующей подпиской. Слово берётся у сущности, чтобы шапка и кабинет не
  // называли одно состояние по-разному.
  return `${name} · ${subscriptionLine(session.profile.subscription.state)}`;
}

/** Горизонтальные переходы в шапке рабочего места. */
function TopNav({ current }: { current: string }) {
  return (
    <nav className="imolt-shell-nav" aria-label={NAVIGATION_LABEL}>
      {SECTIONS.map((section) => (
        <a
          key={section.path}
          className="imolt-shell-link"
          href={hashOf(section.path)}
          aria-current={section.path === current ? 'page' : undefined}
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}

/** Нижняя панель переходов телефона: цели касания у большого пальца. */
function BottomNav({ current }: { current: string }) {
  return (
    <nav className="imolt-shell-tabbar" aria-label={NAVIGATION_LABEL}>
      {SECTIONS.map((section) => (
        <a
          key={section.path}
          className="imolt-shell-tab"
          href={hashOf(section.path)}
          aria-current={section.path === current ? 'page' : undefined}
        >
          {navIcon(section.path)}
          <span>{section.label}</span>
        </a>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  useStyles('app-shell', SHELL_CSS);

  const viewport = useViewport();
  const route = useRoute();
  const main = useRef<HTMLElement>(null);

  const narrow = !isWide(viewport);

  // Сессия живёт в памяти модуля и о своей смене не извещает. Оболочка
  // перечитывает её при каждой отрисовке, а отрисовка случается на смене
  // адреса: участник опознаётся в кабинете, и возврат на любой экран
  // показывает уже новое состояние.
  const state = participantText(narrow);

  return (
    <div className={narrow ? 'imolt-shell imolt-shell--narrow' : 'imolt-shell'}>
      <button type="button" className="imolt-skip" onClick={() => main.current?.focus()}>
        Перейти к содержимому
      </button>

      <header className="imolt-shell-header">
        <div className="imolt-shell-head-line">
          <span className="imolt-shell-brand">ИМОЛТ</span>
          {!narrow && <TopNav current={route.path} />}
          <p className="imolt-shell-participant">
            <span className="imolt-visually-hidden">Состояние участника: </span>
            {state}
          </p>
        </div>
      </header>

      <main className="imolt-shell-main" ref={main} tabIndex={-1}>
        <div className="imolt-shell-container">{children}</div>
      </main>

      {narrow && <BottomNav current={route.path} />}
    </div>
  );
}
