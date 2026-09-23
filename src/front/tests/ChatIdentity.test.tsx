/**
 * Опознание участника, пришедшего из переписки с чат-ботом (R-071).
 *
 * Проверка фальсифицируема: она падает, если карточка появится без стартовых
 * параметров платформы, если согласие на обработку персональных данных
 * подставится за пользователя, если строка стартовых параметров уйдёт
 * разобранной, а не как есть, и если отказ службы останется без объяснения.
 *
 *   npx vitest run tests/ChatIdentity.test.tsx
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatIdentity } from '@/features/identify-from-chat';
import { forget } from '@/entities/participant';

/** Строка стартовых параметров: сервер разбирает её сам, клиент — никогда. */
const СТАРТОВЫЕ = 'auth_date=1790000000&user=%7B%22id%22%3A812345%7D&hash=0f3c';

type Обращение = { url: string; body: unknown };

let обращения: Обращение[];
let ответ: { status: number; body: unknown };

beforeEach(() => {
  обращения = [];
  ответ = {
    status: 201,
    body: {
      accessToken: 'маркер',
      expiresIn: 3600,
      profile: { id: 'p-1', maxUserId: '812345', displayName: 'Пётр', subscription: 'none' },
    },
  };

  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    обращения.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined });

    return new Response(JSON.stringify(ответ.body), {
      status: ответ.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
});

afterEach(() => {
  forget();
  delete window.WebApp;
  vi.restoreAllMocks();
});

/** @ac: AC-071a */
describe('опознание из переписки', () => {
  it('без стартовых параметров платформы карточка не показывается', () => {
    render(<ChatIdentity />);

    expect(
      screen.queryByText(/Открыто из чат-бота/),
      'карточка опознания показана приложению, открытому не из переписки',
    ).toBeNull();
  });

  it('согласие не подставляется за участника', async () => {
    window.WebApp = { initData: СТАРТОВЫЕ };
    render(<ChatIdentity />);

    const кнопка = screen.getByRole('button', { name: 'Получать извещения в чате' });

    expect(кнопка, 'кнопка доступна до отметки согласия').toBeDisabled();
    expect(обращения, 'сессия создана без согласия участника').toEqual([]);
  });

  /** @ac: AC-071a */
  it('после согласия участник опознан и извещён об этом', async () => {
    const пользователь = userEvent.setup();
    window.WebApp = { initData: СТАРТОВЫЕ };
    render(<ChatIdentity />);

    await пользователь.click(screen.getByRole('checkbox'));
    await пользователь.click(screen.getByRole('button', { name: 'Получать извещения в чате' }));

    expect(await screen.findByText(/Извещения о заявке придут в чат/)).toBeInTheDocument();
    expect(обращения).toHaveLength(1);
    expect(обращения[0]?.url).toContain('/v1/auth/sessions');

    const тело = обращения[0]?.body as { initData: string; personalDataConsent: boolean };

    // Строка уходит как есть: подпись проверяется только по исходной строке,
    // и разобранный браузером объект личностью не считается (ADR-0006).
    expect(тело.initData, 'стартовые параметры ушли не исходной строкой').toBe(СТАРТОВЫЕ);
    expect(тело.personalDataConsent).toBe(true);
  });

  /** @ac: AC-071b */
  it('несошедшаяся подпись объясняется участнику, а не молчит', async () => {
    const пользователь = userEvent.setup();
    window.WebApp = { initData: СТАРТОВЫЕ };
    ответ = {
      status: 401,
      body: {
        type: 'urn:imolt:problem:identity-refused',
        title: 'Личность не подтверждена',
        status: 401,
      },
    };

    render(<ChatIdentity />);
    await пользователь.click(screen.getByRole('checkbox'));
    await пользователь.click(screen.getByRole('button', { name: 'Получать извещения в чате' }));

    // Показывается заголовок отказа, а не код причины: код — внутреннее имя.
    const отказ = await screen.findByRole('alert');
    expect(отказ).toHaveTextContent('Личность не подтверждена');
    expect(отказ.textContent, 'код причины вышел на экран').not.toContain('urn:imolt');
  });
});
