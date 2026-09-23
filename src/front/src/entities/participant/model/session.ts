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
import { createSession } from '@/shared/api/imolt';
import type { Session } from '@/shared/api/contracts';
import { launchParameters } from '@/shared/lib/platform';

let current: Session | null = null;

/** Маркер доступа текущей сессии или `null`, если участник не опознан. */
export function accessToken(): string | null {
  return current?.accessToken ?? null;
}

/** Опознанный участник или `null`. */
export function participant(): Session | null {
  return current;
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

  return current;
}

/** Забыть сессию. Нужно проверкам: маркер живёт в памяти модуля. */
export function forget(): void {
  current = null;
}
