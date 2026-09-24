// Заглушка расчётной части для проверок справочника полигонов.
//
// Подменяет глобальный fetch, разбирает путь и отвечает телами договора
// (src/back/Imolt.Api/contracts/openapi.yaml, схемы Landfill, LandfillCard,
// WasteGroup, LandfillReviewPage, DataFreshness). Канонические данные сняты с
// поднятой службы: `curl http://localhost:18080/v1/landfills` и
// `/v1/waste-groups` на 24.09.2026. Ничего сверх договора заглушка не
// выдумывает: координат, которых у службы нет, здесь тоже нет.
//
// Полигон в состоянии «заблокирован» или «данные устарели» проверка делает из
// настоящей записи, меняя её статус и дату: выдуманный полигон принёс бы с
// собой выдуманные координаты и тарифы.
//
// Заглушка ведёт журнал обращений, поэтому проверка утверждает не только о
// разметке, но и о том, какой запрос ушёл наружу и какой не ушёл.
//
// Файл без «.test.» в имени в прогон не попадает: это общая оснастка.

export type Money = { amount: string; currency: 'RUB' };

export type LandfillStatus = 'active' | 'blocked' | 'unconfirmed';

export type LandfillTariff = {
  wasteGroupId: string;
  disposalPricePerTon: Money;
  updatedAt: string;
};

export type Landfill = {
  id: string;
  name: string;
  legalEntity?: string;
  address: string;
  coordinates: { latitude: number; longitude: number };
  status: LandfillStatus;
  statusUpdatedAt: string;
  tariffs: LandfillTariff[];
};

export type LandfillCard = Landfill & {
  legalEntityHistory?: { legalEntity: string; since: string; until?: string | null }[];
};

export type WasteGroup = {
  id: string;
  name: string;
  fkkoCodes: string[];
  transportPricePerTonKm: Money;
  densityTonPerCubicMeter: number;
  updatedAt: string;
};

export type Review = {
  id: string;
  landfillId: string;
  rating: number;
  text?: string | null;
  createdAt: string;
};

/** Обращение к расчётной части, записанное заглушкой. */
export type RecordedRequest = {
  method: string;
  url: string;
  /** путь без приставки `/api`, например `/v1/landfills` */
  path: string;
  query: URLSearchParams;
  body: unknown;
};

export type StubResponse = { status: number; body?: unknown; headers?: Record<string, string> };

export type Answer = StubResponse | ((request: RecordedRequest) => StubResponse);

/** Точки договора, на которые опирается справочник полигонов. */
export type RouteKey =
  | 'GET /v1/waste-groups'
  | 'GET /v1/landfills'
  | 'GET /v1/landfills/:id'
  | 'GET /v1/landfills/:id/reviews'
  | 'POST /v1/landfills/:id/reviews'
  | 'GET /v1/data-freshness';

// --- канонические данные договора -----------------------------------------

export const FRESHNESS_DATE = '2026-09-17';

/** Дата подтверждения статуса, отставшая от актуальности на 14 суток. */
export const STALE_DATE = '2026-09-03';

export const CONCRETE_GROUP: WasteGroup = {
  id: 'beton-lom',
  name: 'Лом бетона и железобетона',
  fkkoCodes: ['8 22 201 01 21 5'],
  transportPricePerTonKm: { amount: '12.00', currency: 'RUB' },
  densityTonPerCubicMeter: 2,
  updatedAt: FRESHNESS_DATE,
};

export const WOOD_GROUP: WasteGroup = {
  id: 'drevesina',
  name: 'Древесина от разборки',
  fkkoCodes: [],
  transportPricePerTonKm: { amount: '16.00', currency: 'RUB' },
  densityTonPerCubicMeter: 0.5,
  updatedAt: FRESHNESS_DATE,
};

export const BRICK_GROUP: WasteGroup = {
  id: 'kirpich-lom',
  name: 'Лом кирпичной кладки',
  fkkoCodes: ['8 23 101 01 21 5'],
  transportPricePerTonKm: { amount: '14.00', currency: 'RUB' },
  densityTonPerCubicMeter: 1.5,
  updatedAt: FRESHNESS_DATE,
};

export const WASTE_GROUPS: WasteGroup[] = [CONCRETE_GROUP, WOOD_GROUP, BRICK_GROUP];

/** Полигон с юридическим лицом и его историей: ответ службы без изменений. */
export const VOSTOK: LandfillCard = {
  id: 'vostok-timohovo',
  name: 'Комплекс переработки «Восток»',
  legalEntity: 'ООО «Восток»',
  address: 'Московская обл., Богородский г. о., д. Тимохово',
  coordinates: { latitude: 55.7286, longitude: 38.2153 },
  status: 'active',
  statusUpdatedAt: FRESHNESS_DATE,
  tariffs: [
    { wasteGroupId: 'beton-lom', disposalPricePerTon: { amount: '450.00', currency: 'RUB' }, updatedAt: FRESHNESS_DATE },
    { wasteGroupId: 'drevesina', disposalPricePerTon: { amount: '300.00', currency: 'RUB' }, updatedAt: FRESHNESS_DATE },
    { wasteGroupId: 'kirpich-lom', disposalPricePerTon: { amount: '420.00', currency: 'RUB' }, updatedAt: FRESHNESS_DATE },
  ],
  legalEntityHistory: [
    { legalEntity: 'ООО «Тимохово»', since: '2023-01-01', until: '2026-02-28' },
    { legalEntity: 'ООО «Восток»', since: '2026-03-01' },
  ],
};

/** Полигон без юридического лица: договор этого поля не требует. */
export const IKSHA: LandfillCard = {
  id: 'iksha',
  name: 'Площадка «Икша»',
  address: 'Московская обл., Дмитровский г. о., пос. Икша',
  coordinates: { latitude: 56.1556, longitude: 37.4906 },
  status: 'active',
  statusUpdatedAt: FRESHNESS_DATE,
  tariffs: [
    { wasteGroupId: 'beton-lom', disposalPricePerTon: { amount: '380.00', currency: 'RUB' }, updatedAt: FRESHNESS_DATE },
    { wasteGroupId: 'kirpich-lom', disposalPricePerTon: { amount: '360.00', currency: 'RUB' }, updatedAt: FRESHNESS_DATE },
  ],
};

export const LANDFILLS: LandfillCard[] = [IKSHA, VOSTOK];

export const DATA_FRESHNESS = {
  pricesUpdatedAt: FRESHNESS_DATE,
  statusesUpdatedAt: FRESHNESS_DATE,
  landfillsWithStaleData: 0,
};

/** Документ об отказе по RFC 9457 — форма `Problem` договора. */
export function problem(
  type: string,
  title: string,
  status: number,
  detail?: string,
): Record<string, unknown> {
  return detail === undefined ? { type, title, status } : { type, title, status, detail };
}

export const REGISTRY_UNAVAILABLE = problem(
  'urn:imolt:problem:upstream-unavailable',
  'Справочник полигонов временно недоступен',
  503,
  'Повторите попытку',
);

/*
 * Код причины и заголовок — те же, что у службы (`Problems.AuthenticationRequired`,
 * `ProblemResponses`). Заглушка, отвечающая своими словами, проверяет не службу,
 * а саму себя: ветвление экрана по коду причины на ней не срабатывало.
 */
export const SESSION_REQUIRED = problem(
  'urn:imolt:problem:authentication-required',
  'Нужна сессия участника',
  401,
);

/** Отзыв, разобранный из тела запроса: служба возвращает его с номером и моментом. */
export function acceptedReview(landfillId: string, body: unknown, index: number): Review {
  const sent = (body ?? {}) as { rating?: number; text?: string };

  return {
    id: `review-${index}`,
    landfillId,
    rating: Number(sent.rating),
    text: sent.text ?? null,
    createdAt: '2026-09-17T12:20:00+03:00',
  };
}

// --- заглушка --------------------------------------------------------------

export type ReferencesStub = {
  /** все обращения в порядке отправки, включая неожиданные */
  requests: RecordedRequest[];
  /** обращения к одной точке в порядке отправки */
  sentTo(key: RouteKey): RecordedRequest[];
  /** запрос последнего обращения к точке; бросает, если обращения не было */
  lastTo(key: RouteKey): RecordedRequest;
  /** тело последнего обращения к точке */
  bodyOf(key: RouteKey): Record<string, unknown>;
  /** подменить ответ точки на один прогон */
  answerWith(key: RouteKey, answer: Answer): void;
  /** полный реестр, из которого заглушка режет страницы и ведёт отбор */
  setLandfills(list: LandfillCard[]): void;
  /** отзывы полигона со средней оценкой службы */
  setReviews(landfillId: string, reviews: Review[], averageRating: number | null): void;
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

function landfillIdOf(path: string): string {
  const reviews = /^\/v1\/landfills\/([^/]+)\/reviews$/.exec(path);
  if (reviews) {
    return decodeURIComponent(reviews[1]);
  }

  const card = /^\/v1\/landfills\/([^/]+)$/.exec(path);
  return card ? decodeURIComponent(card[1]) : '';
}

function routeKeyOf(method: string, path: string): RouteKey | undefined {
  if (/^\/v1\/landfills\/[^/]+\/reviews$/.test(path)) {
    return `${method} /v1/landfills/:id/reviews` as RouteKey;
  }

  if (/^\/v1\/landfills\/[^/]+$/.test(path)) {
    return `${method} /v1/landfills/:id` as RouteKey;
  }

  return `${method} ${path}` as RouteKey;
}

function page(items: unknown[], total: number, limit: number, offset: number) {
  return { items, total, limit, offset };
}

/**
 * Подменяет глобальный fetch на время проверки. Ответы по умолчанию — тела
 * договора; `answerWith` подменяет одну точку, `setLandfills` — реестр.
 */
export function installReferencesStub(): ReferencesStub {
  const requests: RecordedRequest[] = [];
  const unexpectedPaths: string[] = [];
  const original = globalThis.fetch;
  const answers = new Map<RouteKey, Answer>();
  const reviewPages = new Map<string, { items: Review[]; averageRating: number | null }>();

  let registry: LandfillCard[] = LANDFILLS;
  let acceptedCount = 0;

  function ok(body: unknown): StubResponse {
    return { status: 200, headers: { 'content-type': JSON_TYPE }, body };
  }

  function notFound(): StubResponse {
    return {
      status: 404,
      headers: { 'content-type': PROBLEM_TYPE },
      body: problem('urn:imolt:problem:not-found', 'Запись не найдена', 404),
    };
  }

  function selected(request: RecordedRequest): LandfillCard[] {
    const query = (request.query.get('query') ?? '').toLowerCase();
    const wasteGroupId = request.query.get('wasteGroupId') ?? '';

    return registry
      .filter((landfill) => landfill.name.toLowerCase().includes(query))
      .filter(
        (landfill) =>
          wasteGroupId === '' ||
          landfill.tariffs.some((tariff) => tariff.wasteGroupId === wasteGroupId),
      );
  }

  function defaultAnswer(key: RouteKey | undefined, request: RecordedRequest): StubResponse {
    const limit = Number(request.query.get('limit') ?? 10);
    const offset = Number(request.query.get('offset') ?? 0);
    const landfillId = landfillIdOf(request.path);

    switch (key) {
      case 'GET /v1/waste-groups': {
        const query = (request.query.get('query') ?? '').toLowerCase();
        const found = WASTE_GROUPS.filter((group) => group.name.toLowerCase().includes(query));
        return ok(page(found.slice(offset, offset + limit), found.length, limit, offset));
      }

      case 'GET /v1/landfills': {
        const found = selected(request);
        // Список отдаёт запись реестра: истории юридических лиц в ней нет,
        // она приходит только карточкой (схема LandfillCard).
        const items = found.slice(offset, offset + limit).map(({ legalEntityHistory, ...rest }) => {
          void legalEntityHistory;
          return rest;
        });

        return ok(page(items, found.length, limit, offset));
      }

      case 'GET /v1/landfills/:id': {
        const found = registry.find((landfill) => landfill.id === landfillId);
        return found ? ok(found) : notFound();
      }

      case 'GET /v1/landfills/:id/reviews': {
        if (!registry.some((landfill) => landfill.id === landfillId)) {
          return notFound();
        }

        const stored = reviewPages.get(landfillId) ?? { items: [], averageRating: null };
        return ok({
          ...page(stored.items.slice(offset, offset + limit), stored.items.length, limit, offset),
          averageRating: stored.averageRating,
        });
      }

      case 'POST /v1/landfills/:id/reviews': {
        if (!registry.some((landfill) => landfill.id === landfillId)) {
          return notFound();
        }

        acceptedCount += 1;
        const review = acceptedReview(landfillId, request.body, acceptedCount);
        const stored = reviewPages.get(landfillId) ?? { items: [], averageRating: null };
        const items = [review, ...stored.items];
        // Средняя оценка — работа службы: интерфейс её не считает, и заглушка
        // обязана вести себя так же.
        const average = items.reduce((sum, item) => sum + item.rating, 0) / items.length;

        reviewPages.set(landfillId, { items, averageRating: average });

        return { status: 201, headers: { 'content-type': JSON_TYPE }, body: review };
      }

      case 'GET /v1/data-freshness':
        return ok(DATA_FRESHNESS);

      default:
        unexpectedPaths.push(`${request.method} ${request.path}`);
        return notFound();
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

    setLandfills(list) {
      registry = list;
    },

    setReviews(landfillId, reviews, averageRating) {
      reviewPages.set(landfillId, { items: reviews, averageRating });
    },

    unexpected() {
      return [...unexpectedPaths];
    },

    restore() {
      globalThis.fetch = original;
    },
  };
}
