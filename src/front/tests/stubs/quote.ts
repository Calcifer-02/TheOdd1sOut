// Заглушка расчётной части для проверок экрана коммерческого предложения.
//
// Отвечает телами договора (src/back/Imolt.Api/contracts/openapi.yaml) на две
// операции области «сделка»: расчёт целиком и выпуск предложения. Числа сняты
// с работающей службы на каноническом расчёте договора — 20 т лома бетона и
// 15 м³ древесины с улицы Годовикова на «Восток» и «Икшу»; ничего сверх
// договора заглушка не выдумывает.
//
// Повторный выпуск заглушка ведёт так же, как служба
// (`DealScenarios.IssueAsync`): предложение по расчёту выпускается один раз, и
// второй запрос возвращает то же самое с прежним номером. Иначе проверка
// «повторное скачивание не даёт второго номера» подтверждала бы поведение
// выдумки, а не поведение сервиса.
//
// Заглушка ведёт журнал обращений: проверке важно не только то, что показано,
// но и то, какой запрос ушёл наружу, а какой — нет (AC-036e).
//
// Файл без «.test.» в имени в прогон не попадает: это общая оснастка.

/** Денежная сумма договора: строка с двумя знаками после точки. */
export type Money = { amount: string; currency: 'RUB' };

export type Unit = 't' | 'm3';

/** Обращение к расчётной части, записанное заглушкой. */
export type RecordedRequest = {
  method: string;
  url: string;
  /** путь без приставки `/api`, например `/v1/calculations/<id>` */
  path: string;
  query: URLSearchParams;
  body: unknown;
};

export type StubResponse = { status: number; body?: unknown; headers?: Record<string, string> };

export type Answer = StubResponse | ((request: RecordedRequest) => StubResponse);

/** Точки, на которые опирается экран предложения. */
export type QuoteRouteKey = 'GET /v1/calculations/:id' | 'POST /v1/calculations/:id/quotes';

// --- канонические данные договора -----------------------------------------

export const CALCULATION_ID = '5f0a1c2b-77d9-4f61-9a6f-9c3d1b2a8e40';

export const PICKUP_ADDRESS = 'г Москва, ул Годовикова, д 9';

export const FRESHNESS_DATE = '2026-09-17';

export const QUOTE_ID = '7589ad30-40b7-4054-8fcd-7ff20d3aaef7';

export const QUOTE_NUMBER = 'КП-2026-0924-001';

export const QUOTE_ISSUED_AT = '2026-09-24T12:04:00+03:00';

export const QUOTE_VALID_UNTIL = '2026-10-01';

export const QUOTE_DOCUMENT_URL = `/v1/quotes/${QUOTE_ID}/document`;

/** Итог предложения: сумма выбранных вариантов, как её называет служба. */
export const QUOTE_TOTAL: Money = { amount: '27450.00', currency: 'RUB' };

export const CONCRETE_GROUP = { id: 'beton-lom', name: 'Лом бетона и железобетона' };

export const WOOD_GROUP = { id: 'drevesina', name: 'Древесина от разборки' };

export const VOSTOK = {
  id: 'vostok-timohovo',
  name: 'Комплекс переработки «Восток»',
  address: 'Московская обл., Богородский г. о., д. Тимохово',
  distanceKm: 45,
};

export const IKSHA = {
  id: 'iksha',
  name: 'Площадка «Икша»',
  address: 'Московская обл., Дмитровский г. о., пос. Икша',
  distanceKm: 52,
};

function money(amount: string): Money {
  return { amount, currency: 'RUB' };
}

function option(
  landfill: typeof VOSTOK,
  transport: string,
  disposal: string | null,
  total: string,
): Record<string, unknown> {
  return {
    landfillId: landfill.id,
    landfillName: landfill.name,
    address: landfill.address,
    distanceKm: landfill.distanceKm,
    transportCost: money(transport),
    disposalCost: disposal === null ? null : money(disposal),
    totalCost: money(total),
    status: 'active',
    statusUpdatedAt: FRESHNESS_DATE,
  };
}

/** Вариант размещения лома бетона на «Востоке»: 20 т x 12 ₽/т·км x 45 км. */
export const CONCRETE_ON_VOSTOK = option(VOSTOK, '10800.00', '9000.00', '19800.00');

export const CONCRETE_ON_IKSHA = option(IKSHA, '12480.00', '7600.00', '20080.00');

/** Древесина на «Востоке»: 15 м³ пересчитаны службой в 7,5 т. */
export const WOOD_ON_VOSTOK = option(VOSTOK, '5400.00', '2250.00', '7650.00');

function baseCalculation(): Record<string, unknown> {
  return {
    id: CALCULATION_ID,
    createdAt: '2026-09-24T12:00:00+03:00',
    preliminary: true,
    pickupAddress: {
      suggestionId: 'dadata-77-godovikova-9',
      value: PICKUP_ADDRESS,
      coordinates: { latitude: 55.8055, longitude: 37.6206 },
      area: 'moscow',
    },
    disposalRequired: true,
    distanceFilter: { mode: 'atMost', km: 100 },
    items: [
      {
        wasteGroupId: CONCRETE_GROUP.id,
        wasteGroupName: CONCRETE_GROUP.name,
        input: { value: 20, unit: 't' as Unit },
        tons: 20,
      },
      {
        wasteGroupId: WOOD_GROUP.id,
        wasteGroupName: WOOD_GROUP.name,
        input: { value: 15, unit: 'm3' as Unit },
        tons: 7.5,
      },
    ],
    results: [
      {
        wasteGroupId: CONCRETE_GROUP.id,
        options: {
          items: [CONCRETE_ON_VOSTOK, CONCRETE_ON_IKSHA],
          total: 2,
          limit: 10,
          offset: 0,
          emptyReason: null,
        },
      },
      {
        wasteGroupId: WOOD_GROUP.id,
        options: {
          items: [WOOD_ON_VOSTOK],
          total: 1,
          limit: 10,
          offset: 0,
          emptyReason: null,
        },
      },
    ],
    dataFreshness: {
      pricesUpdatedAt: FRESHNESS_DATE,
      statusesUpdatedAt: FRESHNESS_DATE,
      landfillsWithStaleData: 0,
    },
  };
}

/**
 * Расчёт с выбором полигонов: лом бетона и древесина уходят на «Восток».
 * Итог выбора — 19 800 ₽ плюс 7 650 ₽, как его назвала служба.
 */
export function calculationWithSelection(): Record<string, unknown> {
  return {
    ...baseCalculation(),
    selection: {
      entries: [
        { wasteGroupId: CONCRETE_GROUP.id, landfillId: VOSTOK.id },
        { wasteGroupId: WOOD_GROUP.id, landfillId: VOSTOK.id },
      ],
      selectedLandfills: 2,
      total: money('27450.00'),
      warnings: [],
    },
    allocation: null,
  };
}

/**
 * Расчёт с распределением объёма: 20 т бетона разделены на 12 т и 8 т
 * (UC-004). Доли приходят уже с ценами, и предложение показывает две строки.
 */
export function calculationWithAllocation(): Record<string, unknown> {
  return {
    ...baseCalculation(),
    selection: null,
    allocation: {
      entries: [
        {
          wasteGroupId: CONCRETE_GROUP.id,
          landfillId: VOSTOK.id,
          quantity: { value: 12, unit: 't' as Unit },
          transportCost: money('6480.00'),
          disposalCost: money('5400.00'),
          totalCost: money('11880.00'),
        },
        {
          wasteGroupId: CONCRETE_GROUP.id,
          landfillId: IKSHA.id,
          quantity: { value: 8, unit: 't' as Unit },
          transportCost: money('4992.00'),
          disposalCost: money('3040.00'),
          totalCost: money('8032.00'),
        },
      ],
      total: money('19912.00'),
    },
  };
}

/** Расчёт без выбора: предложение по нему служба не выпускает (AC-036d). */
export function calculationWithoutSelection(): Record<string, unknown> {
  return { ...baseCalculation(), selection: null, allocation: null };
}

/** Документ об отказе по RFC 9457 — форма `Problem` договора. */
export function problem(
  type: string,
  title: string,
  status: number,
  detail?: string,
): Record<string, unknown> {
  return detail === undefined ? { type, title, status } : { type, title, status, detail };
}

export const CALCULATION_NOT_FOUND = problem(
  'urn:imolt:problem:not-found',
  'Запись не найдена',
  404,
  `Расчёт ${CALCULATION_ID} не найден`,
);

export const NOTHING_TO_QUOTE = problem(
  'urn:imolt:problem:validation',
  'Предложение не выпущено',
  422,
  'В расчёте не выбрано ни одного полигона: закреплять в предложении нечего',
);

// --- заглушка --------------------------------------------------------------

export type QuoteStub = {
  /** все обращения в порядке отправки, включая неожиданные */
  requests: RecordedRequest[];
  /** обращения к одной точке в порядке отправки */
  sentTo(key: QuoteRouteKey): RecordedRequest[];
  /** подменить ответ точки на один прогон */
  answerWith(key: QuoteRouteKey, answer: Answer): void;
  /** подменить расчёт, который отдаёт служба; `null` — расчёта нет */
  setCalculation(calculation: Record<string, unknown> | null): void;
  /** пути, которых договор экрана не обещает */
  unexpected(): string[];
  restore(): void;
};

const JSON_TYPE = 'application/json';

const PROBLEM_TYPE = 'application/problem+json';

/** Ответ без зависимости от глобального `Response`: jsdom его не обещает. */
function makeResponse(status: number, body: unknown, headers: Record<string, string>): Response {
  const text = body === undefined ? '' : JSON.stringify(body);
  const lowered = new Map(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    url: '',
    headers: { get: (name: string) => lowered.get(name.toLowerCase()) ?? null },
    json: async () => JSON.parse(text) as unknown,
    text: async () => text,
  } as unknown as Response;
}

function routeKeyOf(method: string, path: string): QuoteRouteKey | undefined {
  if (/^\/v1\/calculations\/[^/]+$/.test(path)) {
    return `${method} /v1/calculations/:id` as QuoteRouteKey;
  }

  if (/^\/v1\/calculations\/[^/]+\/quotes$/.test(path)) {
    return `${method} /v1/calculations/:id/quotes` as QuoteRouteKey;
  }

  return undefined;
}

/**
 * Подменяет глобальный fetch на время проверки. Ответы по умолчанию — тела
 * договора; `answerWith` подменяет одну точку, `setCalculation` — расчёт.
 */
export function installQuoteStub(): QuoteStub {
  const requests: RecordedRequest[] = [];
  const unexpectedPaths: string[] = [];
  const original = globalThis.fetch;
  const answers = new Map<QuoteRouteKey, Answer>();

  let calculation: Record<string, unknown> | null = calculationWithSelection();
  // Выпущенные предложения по расчётам: повторный выпуск возвращает прежнее,
  // как это делает служба (R-036).
  const issued = new Map<string, Record<string, unknown>>();

  function calculationIdOf(path: string): string {
    return path.split('/')[3] ?? '';
  }

  function quoteFor(calculationId: string): StubResponse {
    if (calculation === null) {
      return {
        status: 404,
        headers: { 'content-type': PROBLEM_TYPE },
        body: CALCULATION_NOT_FOUND,
      };
    }

    const already = issued.get(calculationId);

    if (already !== undefined) {
      return { status: 201, headers: { 'content-type': JSON_TYPE }, body: already };
    }

    const selection = calculation['selection'] as { entries?: unknown[] } | null | undefined;
    const allocation = calculation['allocation'] as { entries?: unknown[] } | null | undefined;
    const hasLines =
      (selection?.entries?.length ?? 0) > 0 || (allocation?.entries?.length ?? 0) > 0;

    if (!hasLines) {
      return { status: 422, headers: { 'content-type': PROBLEM_TYPE }, body: NOTHING_TO_QUOTE };
    }

    const quote = {
      id: QUOTE_ID,
      number: QUOTE_NUMBER,
      issuedAt: QUOTE_ISSUED_AT,
      validUntil: QUOTE_VALID_UNTIL,
      total: QUOTE_TOTAL,
      preliminary: true,
      documentUrl: QUOTE_DOCUMENT_URL,
    };

    issued.set(calculationId, quote);

    return { status: 201, headers: { 'content-type': JSON_TYPE }, body: quote };
  }

  function defaultAnswer(key: QuoteRouteKey | undefined, request: RecordedRequest): StubResponse {
    switch (key) {
      case 'GET /v1/calculations/:id':
        return calculation === null
          ? { status: 404, headers: { 'content-type': PROBLEM_TYPE }, body: CALCULATION_NOT_FOUND }
          : { status: 200, headers: { 'content-type': JSON_TYPE }, body: calculation };

      case 'POST /v1/calculations/:id/quotes':
        return quoteFor(calculationIdOf(request.path));

      default:
        unexpectedPaths.push(`${request.method} ${request.path}`);
        return {
          status: 404,
          headers: { 'content-type': PROBLEM_TYPE },
          body: problem('urn:imolt:problem:not-found', 'Запись не найдена', 404),
        };
    }
  }

  globalThis.fetch = (async (input: unknown, init?: RequestInit): Promise<Response> => {
    const raw =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : String((input as { url?: string }).url ?? '');
    const address = new URL(raw, 'http://mini.app');
    const method = (init?.method ?? (input as { method?: string }).method ?? 'GET').toUpperCase();
    const rawBody = init?.body;

    const request: RecordedRequest = {
      method,
      url: raw,
      // Интерфейс ходит по относительному пути /api (ADR-0008, инвариант 3);
      // договор описывает маршруты без этой приставки.
      path: address.pathname.replace(/^\/api/, ''),
      query: address.searchParams,
      body: typeof rawBody === 'string' && rawBody.length > 0 ? JSON.parse(rawBody) : undefined,
    };

    requests.push(request);

    const key = routeKeyOf(method, request.path);
    const override = key === undefined ? undefined : answers.get(key);
    const answer =
      override === undefined
        ? defaultAnswer(key, request)
        : typeof override === 'function'
          ? override(request)
          : override;

    return makeResponse(answer.status, answer.body, answer.headers ?? { 'content-type': JSON_TYPE });
  }) as typeof globalThis.fetch;

  return {
    requests,

    sentTo(key) {
      return requests.filter((request) => routeKeyOf(request.method, request.path) === key);
    },

    answerWith(key, answer) {
      answers.set(key, answer);
    },

    setCalculation(next) {
      calculation = next;
      issued.clear();
    },

    unexpected() {
      return [...unexpectedPaths];
    },

    restore() {
      globalThis.fetch = original;
    },
  };
}
