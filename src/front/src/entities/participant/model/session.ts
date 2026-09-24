/**
 * Сессия участника: обмен стартовых параметров платформы на маркер доступа.
 *
 * Маркер держится только в памяти вкладки. В хранилище браузера он не
 * кладётся намеренно: приложение открывается из переписки заново каждый раз,
 * и стартовые параметры дают новый маркер дешевле, чем стоил бы маркер,
 * переживающий закрытие вкладки (R-056, AR-006).
 *
 * Согласие на обработку персональных данных спрашивается до обмена, а не
 * подставляется истиной: сессия заводит учётную запись, а учётная запись —
 * персональные данные (R-054).
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0009
 */
import { useSyncExternalStore } from 'react';
import { createSession } from '@/shared/api/imolt';
import { setAccessToken } from '@/shared/api/http';
import type { Session } from '@/shared/api/contracts';
import { launchParameters } from '@/shared/lib/platform';

let current: Session | null = null;

/**
 * Кто ждёт смены сессии. Опознание происходит в одном месте экрана, а
 * показывает его другое — кабинет: без извещения он остался бы с видом
 * неопознанного участника до следующей перерисовки по другой причине.
 */
const listeners = new Set<() => void>();

function announce(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}

/** Маркер доступа текущей сессии или `null`, если участник не опознан. */
export function accessToken(): string | null {
  return current?.accessToken ?? null;
}

/** Опознанный участник или `null`. */
export function participant(): Session | null {
  return current;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);

  return () => {
    listeners.delete(onChange);
  };
}

/**
 * Текущая сессия с подпиской на её появление и утрату. Снимок — сам объект
 * сессии: он заменяется целиком, а не правится по месту.
 */
export function useParticipant(): Session | null {
  return useSyncExternalStore(subscribe, participant, () => null);
}

/**
 * Обмен стартовых параметров на сессию. Вызывается только после явного
 * согласия участника: без него операция договора отвечает отказом, и
 * подставлять согласие за пользователя нельзя.
 */
export async function signIn(personalDataConsent: boolean): Promise<Session> {
  const initData = launchParameters();

  if (initData === null) {
    throw new Error('Стартовых параметров нет: приложение открыто не из переписки');
  }

  current = await createSession({ initData, personalDataConsent });

  // Маркер отдаётся общему слою обмена: иначе каждое обращение подставляло бы
  // заголовок доступа само, и одно из них рано или поздно забыло бы.
  setAccessToken(current.accessToken);
  announce();

  return current;
}

/** Забыть сессию. Нужно проверкам: маркер живёт в памяти модуля. */
export function forget(): void {
  current = null;
  setAccessToken(null);
  announce();
}
