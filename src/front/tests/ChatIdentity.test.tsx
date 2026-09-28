/**
 * Опознание участника, пришедшего из переписки с чат-ботом (R-071).
 *
 * Заказчик 28.09.2026: «на главном экране уведомление "открыто из чат-бота",
 * это лишнее соглашение, если приложение открыли, значит согласны и профиль
 * подтягивается сразу и сам, без подтверждений, это есть в соглашении max».
 *
 * Проверка фальсифицируема: она падает, если обмен пойдёт без стартовых
 * параметров платформы, если на входе снова появится вопрос к участнику, если
 * строка стартовых параметров уйдёт разобранной, а не как есть, если в теле
 * запроса снова окажется признак согласия и если отказ службы останется без
 * объяснения.
 *
 *   npx vitest run tests/ChatIdentity.test.tsx
 *
 * @ac: AC-071a, AC-071b
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatIdentity, forgetIdentification } from '@/features/identify-from-chat';
import { forget, participant } from '@/entities/participant';

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
  forgetIdentification();
  delete window.WebApp;
  vi.restoreAllMocks();
});

/** @ac: AC-071a */
describe('опознание из переписки', () => {
  it('без стартовых параметров платформы обмена не начинает', () => {
    render(<ChatIdentity />);

    expect(обращения, 'сессия заведена приложению, открытому не из переписки').toEqual([]);
    expect(document.body.textContent, 'приложение без переписки показало карточку опознания').toBe('');
  });

  /** @ac: AC-071a */
  it('открытое из переписки приложение опознаёт участника само и молча', async () => {
    window.WebApp = { initData: СТАРТОВЫЕ };
    render(<ChatIdentity />);

    await waitFor(() => expect(participant(), 'участник не опознан').not.toBeNull());

    expect(обращения).toHaveLength(1);
    expect(обращения[0]?.url).toContain('/v1/auth/sessions');

    const тело = обращения[0]?.body as { initData: string; personalDataConsent?: boolean };

    // Строка уходит как есть: подпись проверяется только по исходной строке,
    // и разобранный браузером объект личностью не считается (ADR-0006).
    expect(тело.initData, 'стартовые параметры ушли не исходной строкой').toBe(СТАРТОВЫЕ);

    // Признака согласия в запросе нет: договор его больше не объявляет, а
    // основанием обработки служит соглашение платформы MAX.
    expect(тело.personalDataConsent, 'признак согласия вернулся в запрос').toBeUndefined();

    // Спрашивать нечего, и показывать удачное опознание тоже: кто пришёл,
    // называет оболочка приложения.
    expect(screen.queryByRole('checkbox'), 'на входе снова спрашивают согласие').toBeNull();
    expect(screen.queryByRole('button'), 'на входе снова ждут нажатия').toBeNull();
    expect(document.body.textContent, 'удачное опознание показано второй надписью').toBe('');
  });

  /** @ac: AC-071b */
  it('несошедшаяся подпись объясняется участнику, а не молчит', async () => {
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

    // Показывается заголовок отказа, а не код причины: код — внутреннее имя.
    const отказ = await screen.findByRole('alert');
    expect(отказ).toHaveTextContent('Личность не подтверждена');
    expect(отказ.textContent, 'код причины вышел на экран').not.toContain('urn:imolt');
  });
});
