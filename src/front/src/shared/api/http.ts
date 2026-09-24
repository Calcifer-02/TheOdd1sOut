/**
 * Общий обмен с расчётной частью: адрес, маркер доступа, отказ.
 *
 * Путь относительный — `/api` проксирует nginx мини-приложения, и ни адрес
 * службы, ни ключи в браузер не попадают (R-056, ADR-0008, инвариант 3).
 *
 * Обращения разложены по областям (`imolt.ts` — расчёт, `cabinet.ts` — доступ
 * и подписка, и так далее), а общая часть живёт здесь: иначе один файл
 * обращений стал бы местом, где правки разных экранов сталкиваются.
 *
 * Маркер доступа кладётся сюда сессией участника, а не читается отсюда: общий
 * слой не знает о сущностях, и обратное подключение сломало бы направление
 * слоёв.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */

const BASE = '/api';

/** Маркер доступа текущей сессии. Живёт в памяти вкладки, как и сама сессия. */
let bearer: string | null = null;

/** Записать маркер доступа. Вызывает сессия участника при опознании. */
export function setAccessToken(token: string | null): void {
  bearer = token;
}

/**
 * Отказ расчётной части в виде документа об ошибке (RFC 9457). Интерфейс
 * ветвится по коду причины, а не по тексту заголовка, и показывает заголовок,
 * а не код: код — внутреннее имя (ADR-0008, инвариант 4).
 */
export class ApiProblem extends Error {
  constructor(
    readonly type: string,
    readonly title: string,
    readonly status: number,
    readonly detail?: string,
  ) {
    super(title);
    this.name = 'ApiProblem';
  }
}

/** Обращение к точке договора. Путь — без приставки `/api`. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...((init?.headers as Record<string, string>) ?? {}) };

  // Составному телу тип назначает среда: в нём граница частей, и назначенный
  // руками `multipart/form-data` без границы служба разобрать не сможет.
  if (init?.body && !(init.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }

  let response: Response;

  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
  } catch {
    // Сеть не ответила вовсе: у отказа нет ни кода, ни документа, и выдавать
    // его за ответ службы нельзя.
    throw new ApiProblem('urn:imolt:problem:unreachable', 'Служба не отвечает', 0);
  }

  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as {
      type?: string;
      title?: string;
      detail?: string;
    } | null;

    throw new ApiProblem(
      problem?.type ?? 'urn:imolt:problem:unknown',
      problem?.title ?? 'Запрос не выполнен',
      response.status,
      problem?.detail,
    );
  }

  // Ответ без содержимого — законный исход операции, меняющей состояние.
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** Адрес файла, отданного договором без приставки службы. */
export function fileHref(path: string): string {
  return `${BASE}${path}`;
}
