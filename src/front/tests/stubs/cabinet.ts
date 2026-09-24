// Заглушка расчётной части для проверок кабинета, входа и подписки.
//
// Подменяет глобальный fetch, разбирает путь и отвечает телами договора
// (../../../back/Imolt.Api/contracts/openapi.yaml). Ничего сверх договора она не
// выдумывает: поля, которого договор не обещает, здесь нет, а тексты ответов
// взяты из самой службы (Imolt.Deals/Adapters/AccessStores.cs,
// Application/AccessScenarios.cs).
//
// Заглушка ведёт журнал обращений, поэтому проверка утверждает не только о
// разметке, но и о том, какой запрос ушёл наружу и — что важнее для
// AC-054a и AC-054c — какой не ушёл.
//
// Заглушка держит состояние подписчика: заявка на подписку переводит его
// подписку в «ожидает», как это делает служба (AC-051a). Иначе проверка
// перехода состояния проверяла бы саму себя.
//
// Файл без «.test.» в имени в прогон не попадает: это общая оснастка.

/** Денежная сумма договора: строка с двумя знаками после точки. */
export type Money = { amount: string; currency: 'RUB' };

export type SubscriptionState = { state: 'none' | 'pending' | 'active'; activeUntil?: string | null };

export type Profile = {
  id: string;
  maxUserId: string;
  displayName: string | null;
  role: 'carrier' | 'demolitionCompany' | null;
  companyName: string | null;
  inn: string | null;
  registeredInAisOssig: boolean | null;
  subscription: SubscriptionState;
};

export type CalculationSummary = {
  id: string;
  createdAt: string;
  pickupAddress: string;
  total: Money;
  quoteNumber?: string | null;
};

export type DocumentService = {
  id: string;
  name: string;
  priceFrom: Money | null;
  priceOnRequest: boolean;
};

/** Обращение к расчётной части, записанное заглушкой. */
export type RecordedRequest = {
  method: string;
  /** путь без префикса `/api`, например `/v1/profile` */
  path: string;
  query: URLSearchParams;
  /** разобранное тело запроса; `undefined`, когда тела не было */
  body: unknown;
};

export type StubResponse = { status: number; body?: unknown; headers?: Record<string, string> };

export type Answer = StubResponse | ((request: RecordedRequest) => StubResponse);

/** Точки, на которые опирается кабинет. Имена совпадают с маршрутами договора. */
export type RouteKey =
  | 'POST /v1/auth/sessions'
  | 'GET /v1/profile'
  | 'POST /v1/subscription-requests'
  | 'GET /v1/calculations'
  | 'GET /v1/document-services'
  | 'POST /v1/document-service-orders';

// --- канонические данные договора -----------------------------------------

/** Строка стартовых параметров: сервер разбирает её сам, клиент — никогда. */
export const СТАРТОВЫЕ_ПАРАМЕТРЫ = 'auth_date=1790000000&user=%7B%22id%22%3A812345%7D&hash=0f3c';

export const МАРКЕР = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.пример.пример';

export const АДРЕС_ВЫВОЗА = 'г Москва, ул Годовикова, д 9';

/** Участник до заявки: сервис знает о нём только учётную запись платформы. */
export const НОВЫЙ_УЧАСТНИК: Profile = {
  id: '9d3a7c10-52f4-4a1b-9ad8-0f6c2b5e41aa',
  maxUserId: '812345',
  displayName: 'Иван',
  role: null,
  companyName: null,
  inn: null,
  registeredInAisOssig: null,
  subscription: { state: 'none' },
};

export const РАСЧЁТЫ: CalculationSummary[] = [
  {
    id: '5f0a1c2b-77d9-4f61-9a6f-9c3d1b2a8e40',
    createdAt: '2026-09-18T09:12:00+03:00',
    pickupAddress: АДРЕС_ВЫВОЗА,
    total: { amount: '39880.00', currency: 'RUB' },
    quoteNumber: 'КП-2026-0041',
  },
  {
    id: 'a1d2c3b4-0000-4f61-9a6f-9c3d1b2a8e41',
    createdAt: '2026-09-16T14:30:00+03:00',
    pickupAddress: 'г Москва, Дмитровское шоссе, д 108',
    total: { amount: '87840.00', currency: 'RUB' },
    quoteNumber: null,
  },
];

/** Каталог услуг дословно из примера договора к операции listDocumentServices. */
export const УСЛУГИ: DocumentService[] = [
  {
    id: 'ossig-mo',
    name: 'Разрешение на перемещение ОССиГ (Московская область)',
    priceFrom: { amount: '50000.00', currency: 'RUB' },
    priceOnRequest: false,
  },
  {
    id: 'laboratory',
    name: 'Лабораторные исследования и паспорта отходов',
    priceFrom: null,
    priceOnRequest: true,
  },
];

const JSON_TYPE = 'application/json';

const PROBLEM_TYPE = 'application/problem+json';

/** Документ об ошибке (RFC 9457) в том виде, в каком его отдаёт служба. */
export function отказ(type: string, title: string, status: number, detail?: string): unknown {
  return { type: `urn:imolt:problem:${type}`, title, status, detail };
}

export type CabinetStub = {
  requests: RecordedRequest[];
  /** Обращения к точке договора: пустой список — тоже утверждение. */
  sentTo(key: RouteKey): RecordedRequest[];
  lastTo(key: RouteKey): RecordedRequest;
  bodyOf(key: RouteKey): Record<string, unknown>;
  answerWith(key: RouteKey, answer: Answer): void;
  setProfile(profile: Profile): void;
  setCalculations(items: CalculationSummary[], total?: number): void;
  setServices(items: DocumentService[]): void;
  restore(): void;
};

function routeKeyOf(method: string, path: string): RouteKey | undefined {
  const key = `${method} ${path}`;

  return (
    [
      'POST /v1/auth/sessions',
      'GET /v1/profile',
      'POST /v1/subscription-requests',
      'GET /v1/calculations',
      'GET /v1/document-services',
      'POST /v1/document-service-orders',
    ] as RouteKey[]
  ).find(candidate => candidate === key);
}

function makeResponse(status: number, body: unknown, headers: Record<string, string>): Response {
  if (status === 204 || body === undefined) {
    return new Response(null, { status, headers });
  }

  return new Response(JSON.stringify(body), { status, headers });
}

export function installCabinetStub(): CabinetStub {
  const requests: RecordedRequest[] = [];
  const original = globalThis.fetch;
  const answers = new Map<RouteKey, Answer>();

  let profile: Profile = { ...НОВЫЙ_УЧАСТНИК };
  let calculations: CalculationSummary[] = [...РАСЧЁТЫ];
  let calculationsTotal = РАСЧЁТЫ.length;
  let services: DocumentService[] = [...УСЛУГИ];

  function page(items: unknown[], total: number, query: URLSearchParams): unknown {
    const limit = Number.parseInt(query.get('limit') ?? '10', 10);
    const offset = Number.parseInt(query.get('offset') ?? '0', 10);

    return { items: items.slice(offset, offset + limit), total, limit, offset };
  }

  function defaultAnswer(key: RouteKey | undefined, request: RecordedRequest): StubResponse {
    if (key === 'POST /v1/auth/sessions') {
      const body = (request.body ?? {}) as { personalDataConsent?: boolean };

      // Без согласия сессии нет: служба отвечает 422, а не заводит учётную
      // запись и отказывает потом (AC-054b).
      if (body.personalDataConsent !== true) {
        return {
          status: 422,
          headers: { 'content-type': PROBLEM_TYPE },
          body: отказ('consent-required', 'Нужно согласие на обработку персональных данных', 422),
        };
      }

      return {
        status: 201,
        headers: { 'content-type': JSON_TYPE },
        body: { accessToken: МАРКЕР, expiresIn: 86400, profile },
      };
    }

    if (key === 'GET /v1/profile') {
      return { status: 200, headers: { 'content-type': JSON_TYPE }, body: profile };
    }

    if (key === 'POST /v1/subscription-requests') {
      const body = (request.body ?? {}) as {
        role?: Profile['role'];
        companyName?: string;
        inn?: string;
        registeredInAisOssig?: boolean;
      };

      profile = {
        ...profile,
        role: body.role ?? null,
        companyName: body.companyName ?? null,
        inn: body.inn ?? null,
        registeredInAisOssig: body.registeredInAisOssig ?? null,
        subscription: { state: 'pending' },
      };

      return {
        status: 201,
        headers: { 'content-type': JSON_TYPE },
        body: {
          id: 'c0ffee00-0000-4f61-9a6f-9c3d1b2a8e42',
          createdAt: '2026-09-24T10:00:00+03:00',
          subscription: { state: 'pending' },
          message: 'Заявка принята. Оплата подписки оформляется вне сервиса: менеджер свяжется с вами.',
        },
      };
    }

    if (key === 'GET /v1/calculations') {
      return {
        status: 200,
        headers: { 'content-type': JSON_TYPE },
        body: page(calculations, calculationsTotal, request.query),
      };
    }

    if (key === 'GET /v1/document-services') {
      return {
        status: 200,
        headers: { 'content-type': JSON_TYPE },
        body: page(services, services.length, request.query),
      };
    }

    if (key === 'POST /v1/document-service-orders') {
      const body = (request.body ?? {}) as { serviceId?: string; personalDataConsent?: boolean };

      if (body.personalDataConsent !== true) {
        return {
          status: 422,
          headers: { 'content-type': PROBLEM_TYPE },
          body: отказ('consent-required', 'Нужно согласие на обработку персональных данных', 422),
        };
      }

      return {
        status: 201,
        headers: { 'content-type': JSON_TYPE },
        body: {
          id: 'or-1',
          serviceId: body.serviceId,
          createdAt: '2026-09-24T10:05:00+03:00',
          state: 'accepted',
          message: 'Заказ принят, менеджер свяжется в течение рабочего дня',
        },
      };
    }

    // Точка, которой кабинет не пользуется: молчаливый ответ скрыл бы лишнее
    // обращение, а проверка обязана его заметить.
    return {
      status: 404,
      headers: { 'content-type': PROBLEM_TYPE },
      body: отказ('not-found', 'Запись не найдена', 404),
    };
  }

  globalThis.fetch = (async (input: unknown, init?: RequestInit): Promise<Response> => {
    const raw = addressOf(input);
    const address = new URL(raw, 'http://mini.app');
    const method = (init?.method ?? 'GET').toUpperCase();
    const rawBody = init?.body;

    const request: RecordedRequest = {
      method,
      // Интерфейс ходит по относительному пути /api (ADR-0008, инвариант 3);
      // договор описывает маршруты без этого префикса.
      path: address.pathname.replace(/^\/api/, ''),
      query: address.searchParams,
      body: typeof rawBody === 'string' && rawBody.length > 0 ? JSON.parse(rawBody) : undefined,
    };

    requests.push(request);

    const key = routeKeyOf(method, request.path);
    const override = key === undefined ? undefined : answers.get(key);
    const answer = answerOf(override, key, request, defaultAnswer);

    return makeResponse(answer.status, answer.body, answer.headers ?? { 'content-type': JSON_TYPE });
  }) as typeof globalThis.fetch;

  return {
    requests,

    sentTo(key) {
      return requests.filter(request => routeKeyOf(request.method, request.path) === key);
    },

    lastTo(key) {
      const found = this.sentTo(key);
      if (found.length === 0) {
        throw new Error(`Обращения к «${key}» не было`);
      }
      return found[found.length - 1] as RecordedRequest;
    },

    bodyOf(key) {
      return (this.lastTo(key).body ?? {}) as Record<string, unknown>;
    },

    answerWith(key, answer) {
      answers.set(key, answer);
    },

    setProfile(next) {
      profile = next;
    },

    setCalculations(items, total) {
      calculations = items;
      calculationsTotal = total ?? items.length;
    },

    setServices(items) {
      services = items;
    },

    restore() {
      globalThis.fetch = original;
    },
  };
}

/**
 * Адрес обращения: `fetch` принимает строку, `URL` или объект запроса.
 * Вложенные условные выражения читаются хуже ветвления и запрещены правилом
 * кода, а разбор здесь — три отдельных случая, а не одно условие.
 */
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
 * Ответ на обращение: подменённый заглушкой, вычисленный подменой или ответ
 * договора по умолчанию.
 */
function answerOf<TKey>(
  override: StubResponse | ((request: RecordedRequest) => StubResponse) | undefined,
  key: TKey | undefined,
  request: RecordedRequest,
  fallback: (key: TKey | undefined, request: RecordedRequest) => StubResponse,
): StubResponse {
  if (override === undefined) {
    return fallback(key, request);
  }

  if (typeof override === 'function') {
    return override(request);
  }

  return override;
}
