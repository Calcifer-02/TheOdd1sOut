/**
 * Подписка участника читается записью договора, а не кодом строкой (R-050).
 *
 * Зеркало договора во фронте объявляло `Profile.subscription` строкой, тогда
 * как служба отдаёт запись `{ state, activeUntil }`. Сравнение записи с кодом
 * всегда ложно, поэтому шапка сервиса писала «подписки нет» участнику с
 * действующей подпиской — молча и на всех экранах сразу.
 *
 * Проверка фальсифицируема: верните в `shared/api/contracts.ts` строку вместо
 * записи или сравните `profile.subscription` с кодом напрямую — проверка
 * назовёт состояние, которое шапка перестала показывать.
 *
 *   npx vitest run tests/SubscriptionShape.test.tsx
 *
 * @supports: R-050
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { forget, signIn, subscriptionLine } from '@/entities/participant';
import type { SubscriptionState } from '@/shared/api/contracts';
import { AppShell } from '@/widgets/app-shell';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';

const СТАРТОВЫЕ_ПАРАМЕТРЫ = 'user=%7B%22id%22%3A418419942%7D&auth_date=1790000000&hash=abc';

/** Ответ службы на обмен стартовых параметров: подписка приходит записью. */
function ответСессии(state: SubscriptionState, activeUntil: string | null) {
  return {
    accessToken: 'маркер-проверки',
    expiresIn: 86400,
    profile: {
      id: 'participant-1',
      maxUserId: '418419942',
      displayName: 'Пётр Кузнецов',
      role: 'carrier',
      subscription: { state, activeUntil },
    },
  };
}

async function опознать(state: SubscriptionState, activeUntil: string | null = null) {
  // Состояние подписки шапка называет на рабочем месте: на телефоне в строке
  // помещается только имя, а подписка показывается в кабинете.
  setViewportWidth(DESKTOP_WIDTH);

  globalThis.fetch = (async () =>
    new Response(JSON.stringify(ответСессии(state, activeUntil)), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })) as typeof globalThis.fetch;

  window.WebApp = { initData: СТАРТОВЫЕ_ПАРАМЕТРЫ };
  await signIn(true);
}

describe('состояние подписки в шапке сервиса', () => {
  it('у участника с действующей подпиской называет её действующей', async () => {
    await опознать('active', '2026-12-31');

    render(
      <AppShell>
        <p>содержимое</p>
      </AppShell>,
    );

    expect(screen.getByText(/Пётр Кузнецов/)).toHaveTextContent('подписка действует');

    forget();
    delete window.WebApp;
  });

  it('у участника без подписки не обещает подписки', async () => {
    await опознать('none');

    render(
      <AppShell>
        <p>содержимое</p>
      </AppShell>,
    );

    expect(screen.getByText(/Пётр Кузнецов/)).toHaveTextContent('подписки нет');

    forget();
    delete window.WebApp;
  });

  it('называет предмет ожидания, а не одно только ожидание', () => {
    // «Пётр Кузнецов · ожидает подтверждения» рядом с именем читается как
    // ожидание участника, а не его подписки.
    expect(subscriptionLine('pending')).toBe('подписка ожидает подтверждения');
  });
});
