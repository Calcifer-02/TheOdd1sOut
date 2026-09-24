// Надстройка над заглушкой предложения: сессия участника и перечень
// сохранённых расчётов.
//
// Заглушка экрана предложения (./quote.ts) отвечает за две операции области
// «сделка» и о кабинете не знает. Перечень ранее выпущенных предложений
// строится по операции `listCalculations` области кабинета, и расширять чужую
// заглушку ради одного экрана значило бы смешать две области в одном файле.
// Поэтому надстройка ставится поверх уже установленной заглушки: свои две
// точки она отвечает сама, всё остальное отдаёт нижней.
//
// Тела ответов — формы договора
// (../../../back/Imolt.Api/contracts/openapi.yaml, схемы `Session` и
// `CalculationSummaryPage`). Ничего сверх договора надстройка не выдумывает:
// даты выпуска в перечне сохранённых расчётов нет, и здесь её тоже нет.
//
// Файл без «.test.» в имени в прогон не попадает: это общая оснастка.
import { PICKUP_ADDRESS, QUOTE_NUMBER, type Money, type StubResponse } from './quote';

/** Строка перечня сохранённых расчётов (схема `CalculationSummary`). */
export type CalculationSummary = {
  id: string;
  createdAt: string;
  pickupAddress: string;
  total: Money;
  quoteNumber?: string | null;
};

/** Стартовые параметры платформы: сервер разбирает их сам, клиент — никогда. */
export const СТАРТОВЫЕ_ПАРАМЕТРЫ = 'auth_date=1790000000&user=%7B%22id%22%3A812345%7D&hash=0f3c';

export const МАРКЕР = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.пример.пример';

/** Профиль опознанного участника в форме, которую обещает схема `Profile`. */
export const УЧАСТНИК = {
  id: '9d3a7c10-52f4-4a1b-9ad8-0f6c2b5e41aa',
  maxUserId: '812345',
  displayName: 'Иван',
  role: null,
  companyName: null,
  inn: null,
  registeredInAisOssig: null,
  subscription: { state: 'none' },
};

/** Номер предложения по второму расчёту перечня. */
export const ВТОРОЙ_НОМЕР = 'КП-2026-0918-007';

export const ВТОРОЙ_АДРЕС = 'г Москва, Дмитровское шоссе, д 108';

/** Расчёт с выпущенным предложением: его номер назвала служба. */
export const РАСЧЁТ_С_ПРЕДЛОЖЕНИЕМ: CalculationSummary = {
  id: '5f0a1c2b-77d9-4f61-9a6f-9c3d1b2a8e40',
  createdAt: '2026-09-24T12:00:00+03:00',
  pickupAddress: PICKUP_ADDRESS,
  total: { amount: '27450.00', currency: 'RUB' },
  quoteNumber: QUOTE_NUMBER,
};

/** Второй расчёт с предложением: перечень показывает не одну строку. */
export const ВТОРОЙ_РАСЧЁТ_С_ПРЕДЛОЖЕНИЕМ: CalculationSummary = {
  id: 'b7c4e2a1-11d3-4f61-9a6f-9c3d1b2a8e55',
  createdAt: '2026-09-18T09:12:00+03:00',
  pickupAddress: ВТОРОЙ_АДРЕС,
  total: { amount: '87840.00', currency: 'RUB' },
  quoteNumber: ВТОРОЙ_НОМЕР,
};

/** Расчёт без выпущенного предложения: номера у него нет вовсе. */
export const РАСЧЁТ_БЕЗ_ПРЕДЛОЖЕНИЯ: CalculationSummary = {
  id: 'c1a2b3d4-22e5-4f61-9a6f-9c3d1b2a8e66',
  createdAt: '2026-09-16T14:30:00+03:00',
  pickupAddress: 'г Москва, ул Ленинская Слобода, д 26',
  total: { amount: '15400.00', currency: 'RUB' },
  quoteNumber: null,
};

/** Отказ по сессии в том виде, в каком его отдаёт служба. */
export const НУЖНА_СЕССИЯ = {
  type: 'urn:imolt:problem:authentication-required',
  title: 'Нужна сессия участника',
  status: 401,
  detail: 'Откройте мини-приложение из переписки с чат-ботом',
};

export type HistoryStub = {
  /** Обращения к перечню в порядке отправки: пустой список — утверждение. */
  listed: { limit: string | null; offset: string | null }[];
  /** Подменить перечень, который отдаёт служба. */
  setItems(items: CalculationSummary[]): void;
  /** Подменить ответ перечня: отказ вместо страницы. */
  answerWith(answer: StubResponse): void;
  restore(): void;
};

const JSON_TYPE = 'application/json';

/** Ответ без зависимости от глобального `Response`: jsdom его не обещает. */
function makeResponse(status: number, body: unknown, contentType: string): Response {
  const text = JSON.stringify(body);

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    url: '',
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    json: async () => JSON.parse(text) as unknown,
    text: async () => text,
  } as unknown as Response;
}

function addressOf(input: unknown): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return String((input as { url?: string }).url ?? '');
}

/**
 * Ставит надстройку поверх текущего `fetch`. Вызывается после установки
 * заглушки предложения: обращения, которых надстройка не знает, уходят вниз.
 */
export function installHistoryStub(): HistoryStub {
  const inner = globalThis.fetch;
  const listed: HistoryStub['listed'] = [];

  let items: CalculationSummary[] = [РАСЧЁТ_С_ПРЕДЛОЖЕНИЕМ, ВТОРОЙ_РАСЧЁТ_С_ПРЕДЛОЖЕНИЕМ, РАСЧЁТ_БЕЗ_ПРЕДЛОЖЕНИЯ];
  let answer: StubResponse | null = null;

  globalThis.fetch = (async (input: unknown, init?: RequestInit): Promise<Response> => {
    const raw = addressOf(input);
    const address = new URL(raw, 'http://mini.app');
    const method = (init?.method ?? (input as { method?: string }).method ?? 'GET').toUpperCase();
    // Интерфейс ходит по относительному пути /api (ADR-0008, инвариант 3);
    // договор описывает маршруты без этой приставки.
    const path = address.pathname.replace(/^\/api/, '');

    if (method === 'POST' && path === '/v1/auth/sessions') {
      return makeResponse(201, { accessToken: МАРКЕР, expiresIn: 3600, profile: УЧАСТНИК }, JSON_TYPE);
    }

    if (method === 'GET' && path === '/v1/calculations') {
      listed.push({
        limit: address.searchParams.get('limit'),
        offset: address.searchParams.get('offset'),
      });

      if (answer !== null) {
        return makeResponse(answer.status, answer.body, answer.headers?.['content-type'] ?? JSON_TYPE);
      }

      return makeResponse(200, { items, total: items.length, limit: items.length, offset: 0 }, JSON_TYPE);
    }

    return inner(input as RequestInfo, init);
  }) as typeof globalThis.fetch;

  return {
    listed,

    setItems(next) {
      items = next;
    },

    answerWith(next) {
      answer = next;
    },

    restore() {
      globalThis.fetch = inner;
    },
  };
}
