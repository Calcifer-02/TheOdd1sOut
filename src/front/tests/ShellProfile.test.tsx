/**
 * Профиль участника в шапке сервиса: вход в кабинет и заглушка гостя
 * (BUG-009, BUG-007, R-049, ADR-0006).
 *
 * Проверяется поведение, а не разметка: чем профиль является для клавиатуры и
 * вспомогательной технологии, куда он ведёт, чем помечен открытый кабинет, и
 * совпадает ли форма заглушки с формой опознанного участника — подмена не
 * должна дёргать вёрстку шапки.
 *
 * Проверки фальсифицируемы: верните профилю вид абзаца, снимите `href` или
 * `aria-current`, соберите заглушку гостя другой разметкой, покажите на
 * телефоне вторую строку, уберите правило наведения из оформления оболочки —
 * они упадут.
 *
 *   npx vitest run tests/ShellProfile.test.tsx
 *
 * @supports: R-049
 */
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { forget, signIn } from '@/entities/participant';
import { AppShell } from '@/widgets/app-shell';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';

const СТАРТОВЫЕ_ПАРАМЕТРЫ = 'user=%7B%22id%22%3A418419942%7D&auth_date=1790000000&hash=abc';

function отрисовать() {
  return render(
    <AppShell>
      <p>Содержимое экрана расчёта</p>
    </AppShell>,
  );
}

/** Профиль в шапке: ссылка, доступное имя которой называет её назначение. */
function профиль(): HTMLElement {
  return screen.getByRole('link', { name: /Кабинет участника/u });
}

/**
 * Форма поддерева: узлы и их классы подряд. Сравнение строк ловит подмену
 * разметки, которой текстовая проверка не видит.
 */
function форма(node: Element): string {
  return [...node.querySelectorAll('*')]
    .map(element => `${element.tagName.toLowerCase()}.${element.getAttribute('class') ?? '—'}`)
    .join(' ');
}

/** Опознание участника платформой: обмен стартовых параметров на сессию. */
async function опознать(): Promise<void> {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        accessToken: 'маркер-проверки',
        expiresIn: 86400,
        profile: {
          id: 'participant-1',
          maxUserId: '418419942',
          displayName: 'Пётр Кузнецов',
          role: 'carrier',
          subscription: { state: 'active', activeUntil: '2026-12-31' },
        },
      }),
      { status: 201, headers: { 'content-type': 'application/json' } },
    )) as typeof globalThis.fetch;

  window.WebApp = { initData: СТАРТОВЫЕ_ПАРАМЕТРЫ };

  // Опознание меняет состояние вне React: обёртка нужна, чтобы отрисовка
  // ответа на него случилась до проверки.
  await act(async () => {
    await signIn(true);
  });
}

beforeEach(() => {
  window.history.replaceState(null, '', '#/');
});

afterEach(() => {
  forget();
  delete window.WebApp;
});

describe('профиль участника в шапке', () => {
  it('нажатием на профиль открывается кабинет, а не остаётся текст', () => {
    setViewportWidth(DESKTOP_WIDTH);
    отрисовать();

    const вход = профиль();

    expect(вход).toHaveAttribute('href', '#/cabinet');

    // Абзац фокус не принимает: проверка держит именно достижимость с
    // клавиатуры, а не наличие подходящего класса.
    вход.focus();
    expect(вход).toHaveFocus();
  });

  it('открытый кабинет помечает профиль текущим разделом', () => {
    window.history.replaceState(null, '', '#/cabinet');
    setViewportWidth(DESKTOP_WIDTH);
    отрисовать();

    expect(профиль()).toHaveAttribute('aria-current', 'page');
  });

  it('на другом экране профиль текущим разделом не помечен', () => {
    window.history.replaceState(null, '', '#/landfills');
    setViewportWidth(DESKTOP_WIDTH);
    отрисовать();

    expect(профиль()).not.toHaveAttribute('aria-current');
  });

  it('профиль отвечает на наведение', () => {
    setViewportWidth(DESKTOP_WIDTH);
    отрисовать();

    // Наведение в jsdom не воспроизводится, поэтому проверяется правило,
    // попавшее в страницу: без отклика цель не читается как нажимаемая
    // (дизайн-договор, разд. 4.4).
    const оформление = document.head.querySelector('style[data-imolt="app-shell"]');
    expect(оформление?.textContent ?? '').toContain('.imolt-shell-profile:hover');
  });
});

describe('заглушка профиля до опознания', () => {
  it('неопознанный участник назван гостем и объяснён платформой', () => {
    setViewportWidth(DESKTOP_WIDTH);
    отрисовать();

    const вход = профиль();

    expect(within(вход).getByText('Гость')).toBeInTheDocument();
    expect(within(вход).getByText('Личность даёт платформа MAX')).toBeInTheDocument();
    expect(screen.queryByText('Участник не опознан')).toBeNull();
  });

  it('значок профиля скрыт от вспомогательной технологии', () => {
    setViewportWidth(DESKTOP_WIDTH);
    отрисовать();

    const значок = профиль().querySelector('svg');

    expect(значок).not.toBeNull();
    expect(значок).toHaveAttribute('aria-hidden', 'true');
  });

  it('опознание подменяет заглушку, не меняя формы профиля', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    отрисовать();

    const доОпознания = форма(профиль());
    expect(доОпознания).toContain('svg');

    await опознать();

    const вход = профиль();

    expect(within(вход).getByText('Пётр Кузнецов')).toBeInTheDocument();
    expect(within(вход).getByText('подписка действует')).toBeInTheDocument();
    expect(форма(вход), 'опознание переставило разметку шапки').toBe(доОпознания);
  });
});

describe('профиль на телефоне', () => {
  it('узкое окно сжимает профиль до значка с именем', () => {
    отрисовать();

    const вход = профиль();

    expect(within(вход).getByText('Гость')).toBeInTheDocument();
    expect(within(вход).queryByText('Личность даёт платформа MAX')).toBeNull();
    expect(вход.querySelector('svg')).not.toBeNull();
  });

  it('узкое окно сжимает и опознанного участника — без строки о подписке', async () => {
    отрисовать();
    await опознать();

    const вход = профиль();

    expect(within(вход).getByText('Пётр Кузнецов')).toBeInTheDocument();
    expect(within(вход).queryByText('подписка действует')).toBeNull();
  });
});
