// Заглушка расчётной части для проверок экрана расчёта мини-приложения.
//
// Подменяет глобальный fetch, разбирает путь и отвечает телами договора
// (../../back/Imolt.Api/contracts/openapi.yaml). Канонические данные взяты из
// примера `ConcreteCalculation`: адрес «г Москва, ул Годовикова, д 9»,
// группы `beton-lom` и `drevesina`, полигоны «Восток» и «Икша», дата
// актуальности 17.09.2026. Ничего сверх договора заглушка не выдумывает:
// поле, которого договор не обещает, сюда не попадает.
//
// Заглушка ведёт журнал обращений, поэтому проверка утверждает не только о
// разметке, но и о том, какой запрос ушёл наружу и — что важнее для AC-012d,
// AC-036e и AC-053c — какой не ушёл.
//
// Файл без «.test.» в имени в прогон не попадает: это общая оснастка.

/** Денежная сумма договора: строка с двумя знаками после точки. */
export type Money = { amount: string; currency: 'RUB' };

export type Unit = 't' | 'm3';

export type LandfillStatus = 'active' | 'blocked' | 'unconfirmed';

export type PlacementOption = {
  landfillId: string;
  landfillName: string;
  address: string;
  distanceKm: number;
  transportCost: Money;
  disposalCost: Money | null;
  totalCost: Money;
  status: LandfillStatus;
  statusUpdatedAt: string;
};

export type WasteGroup = {
  id: string;
  name: string;
  fkkoCodes: string[];
  transportPricePerTonKm: Money;
  densityTonPerCubicMeter: number;
  updatedAt: string;
};

export type AddressSuggestion = {
  id: string;
  value: string;
  coordinates: { latitude: number; longitude: number };
  area: 'moscow' | 'moscowRegion';
};

/** Обращение к расчётной части, записанное заглушкой. */
export type RecordedRequest = {
  method: string;
  /** адрес как его назвал интерфейс, без изменений */
  url: string;
  /** путь без префикса `/api`, например `/v1/calculations` */
  path: string;
  query: URLSearchParams;
  /** разобранное тело запроса; `undefined`, когда тела не было */
  body: unknown;
};

export type StubResponse = { status: number; body?: unknown; headers?: Record<string, string> };

export type Answer = StubResponse | ((request: RecordedRequest) => StubResponse);

/**
 * Точки, на которые опирается экран расчёта. Имена совпадают с маршрутами
 * договора; `:id` — идентификатор расчёта.
 */
export type RouteKey =
  | 'GET /v1/waste-groups'
  | 'GET /v1/address-suggestions'
  | 'POST /v1/amount-conversions'
  | 'POST /v1/calculations'
  | 'GET /v1/calculations/:id'
  | 'GET /v1/calculations/:id/options'
  | 'PUT /v1/calculations/:id/selection'
  | 'PUT /v1/calculations/:id/allocation'
  | 'GET /v1/calculations/:id/route'
  | 'POST /v1/calculations/:id/quotes'
  | 'POST /v1/pickup-requests';

// --- канонические данные договора -----------------------------------------

export const CALCULATION_ID = '5f0a1c2b-77d9-4f61-9a6f-9c3d1b2a8e40';

export const PICKUP_ADDRESS = 'г Москва, ул Годовикова, д 9';

export const ADDRESS_SUGGESTION_ID = 'dadata-77-godovikova-9';

export const FRESHNESS_DATE = '2026-09-17';

export const CONCRETE_GROUP: WasteGroup = {
  id: 'beton-lom',
  name: 'Лом бетона и железобетона',
  fkkoCodes: ['8 22 201 01 21 5'],
  transportPricePerTonKm: { amount: '12.00', currency: 'RUB' },
  densityTonPerCubicMeter: 2,
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

// Плотность 0,5 т/м³ — набор демонстрационных данных хранилища
// (../../back/Imolt.Database/Migrations/0002_demo_dataset.sql); на ней построен
// пересчёт 15 м³ → 7,5 т критерия AC-015c.
export const WOOD_GROUP: WasteGroup = {
  id: 'drevesina',
  name: 'Древесина от разборки',
  fkkoCodes: [],
  transportPricePerTonKm: { amount: '16.00', currency: 'RUB' },
  densityTonPerCubicMeter: 0.5,
  updatedAt: FRESHNESS_DATE,
};

export const WASTE_GROUPS: WasteGroup[] = [CONCRETE_GROUP, BRICK_GROUP, WOOD_GROUP];

export const GODOVIKOVA_SUGGESTION: AddressSuggestion = {
  id: ADDRESS_SUGGESTION_ID,
  value: PICKUP_ADDRESS,
  coordinates: { latitude: 55.8055, longitude: 37.6206 },
  area: 'moscow',
};

export const ADDRESS_SUGGESTIONS: AddressSuggestion[] = [GODOVIKOVA_SUGGESTION];

export const VOSTOK: PlacementOption = {
  landfillId: 'vostok-timohovo',
  landfillName: 'Комплекс переработки «Восток»',
  address: 'Московская обл., Богородский г. о., д. Тимохово',
  distanceKm: 45,
  transportCost: { amount: '10800.00', currency: 'RUB' },
  disposalCost: { amount: '9000.00', currency: 'RUB' },
  totalCost: { amount: '19800.00', currency: 'RUB' },
  status: 'active',
  statusUpdatedAt: FRESHNESS_DATE,
};

export const IKSHA: PlacementOption = {
  landfillId: 'iksha',
  landfillName: 'Площадка «Икша»',
  address: 'Московская обл., Дмитровский г. о., пос. Икша',
  distanceKm: 52,
  transportCost: { amount: '12480.00', currency: 'RUB' },
  disposalCost: { amount: '7600.00', currency: 'RUB' },
  totalCost: { amount: '20080.00', currency: 'RUB' },
  status: 'active',
  statusUpdatedAt: FRESHNESS_DATE,
};

// Заблокированный полигон макета «Калькулятор мобильный.dc.html»: плечо 88 км,
// тариф утилизации 600 ₽/т. Стоимости выведены формулой R-018 на 20 т бетона,
// а не назначены на месте: перевозка 20 x 12 x 88, утилизация 20 x 600.
export const ALEKSIN_BLOCKED: PlacementOption = {
  landfillId: 'aleksinskiy-karier',
  landfillName: 'Полигон «Алексинский карьер»',
  address: 'Московская обл., г. о. Клин',
  distanceKm: 88,
  transportCost: { amount: '21120.00', currency: 'RUB' },
  disposalCost: { amount: '12000.00', currency: 'RUB' },
  totalCost: { amount: '33120.00', currency: 'RUB' },
  status: 'blocked',
  statusUpdatedAt: FRESHNESS_DATE,
};

// Полигон с данными старше последнего обновления: статус подтверждён 03.09,
// цены и статусы сервиса — 17.09. На нём проверяется подпись «данные от 03.09».
export const LESNAYA_STALE: PlacementOption = {
  landfillId: 'lesnaya',
  landfillName: 'Полигон «Лесная»',
  address: 'Московская обл., г. о. Серпухов, д. Лесная',
  distanceKm: 98,
  transportCost: { amount: '23520.00', currency: 'RUB' },
  disposalCost: { amount: '6400.00', currency: 'RUB' },
  totalCost: { amount: '29920.00', currency: 'RUB' },
  status: 'active',
  statusUpdatedAt: '2026-09-03',
};

export const QUOTE_NUMBER = 'КП-2026-0917-014';

export const QUOTE_ID = '0b6a8f4e-3a1d-4f2e-9d55-2f1c8a0b7e31';

export const QUOTE_DOCUMENT_URL = `/v1/quotes/${QUOTE_ID}/document`;

export const EXTERNAL_MAP_URL = 'https://yandex.ru/maps/?rtext=55.8055%2C37.6206~55.7286%2C38.2153&rtt=auto';

/**
 * Ряд однотипных вариантов размещения. Нужен там, где критерий говорит о
 * числе полигонов, а не об их именах (AC-029b — двенадцать подходящих).
 * Имена заведомо служебные: выдавать их за полигоны реестра нельзя.
 */
export function placementOptionSeries(count: number): PlacementOption[] {
  const series: PlacementOption[] = [];

  for (let index = 1; index <= count; index += 1) {
    const transport = 10000 + index * 100;
    const disposal = 9000;
    // Номер дополняется нулём: «Полигон № 1» был бы частью «Полигон № 12», и
    // поиск карточки по названию стал бы неоднозначным.
    const number = String(index).padStart(2, '0');
    series.push({
      landfillId: `landfill-${number}`,
      landfillName: `Полигон № ${number}`,
      address: `Московская обл., площадка № ${number}`,
      distanceKm: 40 + index,
      transportCost: rubles(transport),
      disposalCost: rubles(disposal),
      totalCost: rubles(transport + disposal),
      status: 'active',
      statusUpdatedAt: FRESHNESS_DATE,
    });
  }

  return series;
}

export function rubles(amount: number): Money {
  return { amount: amount.toFixed(2), currency: 'RUB' };
}

/** Документ об отказе по RFC 9457 — форма `Problem` договора. */
export function problem(type: string, title: string, status: number, detail?: string): Record<string, unknown> {
  return detail === undefined ? { type, title, status } : { type, title, status, detail };
}

export const DISTANCE_SERVICE_UNAVAILABLE = problem(
  'urn:imolt:problem:distance-service-unavailable',
  'Не удалось рассчитать расстояния',
  503,
  'Повторите попытку',
);

// --- заглушка --------------------------------------------------------------

export type ApiStub = {
  /** все обращения в порядке отправки, включая неожиданные */
  requests: RecordedRequest[];
  /** обращения к одной точке в порядке отправки */
  sentTo(key: RouteKey): RecordedRequest[];
  /** тело последнего обращения к точке; бросает, если обращения не было */
  bodyOf(key: RouteKey): Record<string, unknown>;
  /** запрос последнего обращения к точке; бросает, если обращения не было */
  lastTo(key: RouteKey): RecordedRequest;
  /** подменить ответ точки на один прогон */
  answerWith(key: RouteKey, answer: Answer): void;
  /** полный список вариантов размещения, из которого заглушка режет страницы */
  setOptions(list: PlacementOption[] | ((request: RecordedRequest) => PlacementOption[])): void;
  /** пути, которых договор экрана не обещает */
  unexpected(): string[];
  restore(): void;
};

type StubInternals = {
  answers: Map<RouteKey, Answer>;
  options: (request: RecordedRequest) => PlacementOption[];
  lastCalculationRequest: Record<string, unknown> | undefined;
};

const JSON_TYPE = 'application/json';

const PROBLEM_TYPE = 'application/problem+json';

/** Ответ без зависимости от глобального `Response`: jsdom его не обещает. */
function makeResponse(status: number, body: unknown, headers: Record<string, string>): Response {
  const text = body === undefined ? '' : JSON.stringify(body);
  const lowered = new Map(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));

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

function routeKeyOf(method: string, path: string): RouteKey | undefined {
  const calculation = /^\/v1\/calculations\/[^/]+\/(options|selection|allocation|route|quotes)$/.exec(path);

  if (calculation) {
    return `${method} /v1/calculations/:id/${calculation[1]}` as RouteKey;
  }

  // Расчёт по идентификатору: им экран восстанавливается по ссылке.
  if (/^\/v1\/calculations\/[^/]+$/.test(path)) {
    return `${method} /v1/calculations/:id` as RouteKey;
  }

  return `${method} ${path}` as RouteKey;
}

function kopecks(money: Money): number {
  return Math.round(Number(money.amount) * 100);
}

function fromKopecks(value: number): Money {
  return { amount: (value / 100).toFixed(2), currency: 'RUB' };
}

function sumMoney(list: (Money | null)[]): Money {
  return fromKopecks(list.reduce<number>((total, item) => total + (item ? kopecks(item) : 0), 0));
}

function share(money: Money | null, part: number, whole: number): Money | null {
  return money === null ? null : fromKopecks(Math.round((kopecks(money) * part) / whole));
}

function page(items: unknown[], total: number, limit: number, offset: number, emptyReason: unknown) {
  return { items, total, limit, offset, emptyReason };
}

/**
 * Подменяет глобальный fetch на время проверки. Ответы по умолчанию — тела
 * договора; `answerWith` подменяет одну точку, `setOptions` — список вариантов.
 */
export function installApiStub(): ApiStub {
  const requests: RecordedRequest[] = [];
  const unexpectedPaths: string[] = [];
  const original = globalThis.fetch;

  const internals: StubInternals = {
    answers: new Map<RouteKey, Answer>(),
    options: () => [VOSTOK, IKSHA],
    lastCalculationRequest: undefined,
  };

  function currentOptions(): PlacementOption[] {
    return internals.options({
      method: 'GET',
      url: `/api/v1/calculations/${CALCULATION_ID}/options`,
      path: `/v1/calculations/${CALCULATION_ID}/options`,
      query: new URLSearchParams(),
      body: undefined,
    });
  }

  function groupTons(wasteGroupId: string): number {
    const items = (internals.lastCalculationRequest?.['items'] ?? []) as {
      wasteGroupId: string;
      quantity: { value: number; unit: Unit };
    }[];
    const item = items.find(candidate => candidate.wasteGroupId === wasteGroupId);

    if (!item) {
      return 0;
    }

    const group = WASTE_GROUPS.find(candidate => candidate.id === item.wasteGroupId);
    return item.quantity.unit === 't'
      ? item.quantity.value
      : item.quantity.value * (group?.densityTonPerCubicMeter ?? 1);
  }

  function calculationBody(request: RecordedRequest): Record<string, unknown> {
    const sent = (request.body ?? {}) as Record<string, unknown>;
    internals.lastCalculationRequest = sent;

    const sentItems = (sent['items'] ?? []) as {
      wasteGroupId: string;
      quantity: { value: number; unit: Unit };
    }[];
    const disposalRequired = sent['disposalRequired'] !== false;
    const list = currentOptions().map(option =>
      disposalRequired ? option : { ...option, disposalCost: null, totalCost: option.transportCost },
    );

    const items = sentItems.map(item => {
      const group = WASTE_GROUPS.find(candidate => candidate.id === item.wasteGroupId);
      return {
        wasteGroupId: item.wasteGroupId,
        wasteGroupName: group?.name ?? item.wasteGroupId,
        input: item.quantity,
        tons:
          item.quantity.unit === 't'
            ? item.quantity.value
            : item.quantity.value * (group?.densityTonPerCubicMeter ?? 1),
      };
    });

    return {
      id: CALCULATION_ID,
      createdAt: '2026-09-17T12:00:00+03:00',
      preliminary: true,
      pickupAddress: sent['pickupAddress'] ?? {
        suggestionId: ADDRESS_SUGGESTION_ID,
        value: PICKUP_ADDRESS,
        coordinates: GODOVIKOVA_SUGGESTION.coordinates,
        area: 'moscow',
      },
      disposalRequired,
      distanceFilter: sent['distanceFilter'] ?? { mode: 'atMost', km: 50 },
      dataFreshness: {
        pricesUpdatedAt: FRESHNESS_DATE,
        statusesUpdatedAt: FRESHNESS_DATE,
        landfillsWithStaleData: 0,
      },
      items,
      results: items.map(item => ({
        wasteGroupId: item.wasteGroupId,
        options: page(list.slice(0, 10), list.length, 10, 0, list.length === 0 ? 'filteredOutByDistance' : null),
      })),
    };
  }

  function selectionBody(request: RecordedRequest): Record<string, unknown> {
    const entries = ((request.body as Record<string, unknown>)?.['entries'] ?? []) as {
      wasteGroupId: string;
      landfillId: string;
    }[];
    const list = currentOptions();
    const chosen = entries
      .map(entry => list.find(option => option.landfillId === entry.landfillId))
      .filter((option): option is PlacementOption => option !== undefined);

    return {
      entries,
      selectedLandfills: entries.length,
      total: sumMoney(chosen.map(option => option.totalCost)),
      // Текст предупреждения приходит от расчётной части: макет Э-12 задаёт
      // именно эту формулировку, и интерфейс её не сочиняет.
      warnings: chosen
        .filter(option => option.status === 'blocked')
        .map(option => ({
          code: 'landfillBlocked',
          landfillId: option.landfillId,
          message: 'Полигон заблокирован. Он остаётся в выборе, решение за вами.',
        })),
    };
  }

  function allocationResponse(request: RecordedRequest): StubResponse {
    const entries = ((request.body as Record<string, unknown>)?.['entries'] ?? []) as {
      wasteGroupId: string;
      landfillId: string;
      quantity: { value: number; unit: Unit };
    }[];
    const list = currentOptions();
    const wasteGroupId = entries[0]?.wasteGroupId ?? CONCRETE_GROUP.id;
    const whole = groupTons(wasteGroupId);
    const distributed = entries.reduce((total, entry) => total + entry.quantity.value, 0);

    if (whole === 0 || Math.abs(distributed - whole) > 1e-9) {
      return {
        status: 422,
        headers: { 'content-type': PROBLEM_TYPE },
        body: problem(
          'urn:imolt:problem:allocation-mismatch',
          'Распределение не сходится с объёмом',
          422,
          `По группе «Лом бетона» распределено ${distributed} т из ${whole} т`,
        ),
      };
    }

    const parts = entries.map(entry => {
      const option = list.find(candidate => candidate.landfillId === entry.landfillId);
      const transportCost = share(option?.transportCost ?? null, entry.quantity.value, whole);
      const disposalCost = share(option?.disposalCost ?? null, entry.quantity.value, whole);

      return {
        wasteGroupId: entry.wasteGroupId,
        landfillId: entry.landfillId,
        quantity: entry.quantity,
        transportCost: transportCost ?? rubles(0),
        disposalCost,
        totalCost: sumMoney([transportCost, disposalCost]),
      };
    });

    return {
      status: 200,
      headers: { 'content-type': JSON_TYPE },
      body: {
        entries: parts,
        total: sumMoney(parts.map(part => part.totalCost)),
      },
    };
  }

  function defaultAnswer(key: RouteKey | undefined, request: RecordedRequest): StubResponse {
    const limit = Number(request.query.get('limit') ?? 10);
    const offset = Number(request.query.get('offset') ?? 0);

    switch (key) {
      case 'GET /v1/waste-groups': {
        const query = (request.query.get('query') ?? '').toLowerCase();
        const found = WASTE_GROUPS.filter(group => group.name.toLowerCase().includes(query));
        return ok(page(found.slice(offset, offset + limit), found.length, limit, offset, undefined));
      }

      case 'GET /v1/address-suggestions': {
        return ok(page(ADDRESS_SUGGESTIONS, ADDRESS_SUGGESTIONS.length, limit, 0, undefined));
      }

      case 'POST /v1/amount-conversions': {
        const sent = ((request.body as Record<string, unknown>)?.['items'] ?? []) as {
          wasteGroupId: string;
          quantity: { value: number; unit: Unit };
        }[];

        return ok({
          items: sent.map(item => {
            const group = WASTE_GROUPS.find(candidate => candidate.id === item.wasteGroupId);
            const density = group?.densityTonPerCubicMeter ?? 1;
            const tons = item.quantity.unit === 't' ? item.quantity.value : item.quantity.value * density;

            return {
              wasteGroupId: item.wasteGroupId,
              input: item.quantity,
              tons,
              cubicMeters: tons / density,
              densityTonPerCubicMeter: density,
            };
          }),
        });
      }

      case 'POST /v1/calculations':
        return { status: 201, headers: { 'content-type': JSON_TYPE }, body: calculationBody(request) };

      // Расчёт по ссылке отдаётся тем же телом, что и созданный: для
      // восстановления экрана важен состав, а не история его появления.
      case 'GET /v1/calculations/:id':
        return { status: 200, headers: { 'content-type': JSON_TYPE }, body: calculationBody(request) };

      case 'GET /v1/calculations/:id/options': {
        const list = internals.options(request);
        return ok(
          page(
            list.slice(offset, offset + limit),
            list.length,
            limit,
            offset,
            list.length === 0 ? 'filteredOutByDistance' : null,
          ),
        );
      }

      case 'PUT /v1/calculations/:id/selection':
        return ok(selectionBody(request));

      case 'PUT /v1/calculations/:id/allocation':
        return allocationResponse(request);

      case 'GET /v1/calculations/:id/route':
        return ok({
          access: { granted: true, reason: null },
          legs: currentOptions().map(option => ({
            landfillId: option.landfillId,
            distanceKm: option.distanceKm,
            durationMinutes: 70,
            externalMapUrl: EXTERNAL_MAP_URL,
            encumbrances: [],
          })),
          total: sumMoney(currentOptions().map(option => option.totalCost)),
        });

      case 'POST /v1/calculations/:id/quotes':
        return {
          status: 201,
          headers: { 'content-type': JSON_TYPE },
          body: {
            id: QUOTE_ID,
            number: QUOTE_NUMBER,
            issuedAt: '2026-09-17T12:04:00+03:00',
            validUntil: '2026-09-24',
            total: { amount: '39880.00', currency: 'RUB' },
            preliminary: true,
            documentUrl: QUOTE_DOCUMENT_URL,
          },
        };

      case 'POST /v1/pickup-requests':
        return {
          status: 201,
          headers: { 'content-type': JSON_TYPE },
          body: {
            id: '3c1f9a77-2b64-4f0a-8f2d-77b1c9e5a012',
            createdAt: '2026-09-17T12:10:00+03:00',
            state: 'accepted',
            message: 'Заявка принята, менеджер свяжется в течение рабочего дня',
          },
        };

      default:
        unexpectedPaths.push(`${request.method} ${request.path}`);
        return {
          status: 404,
          headers: { 'content-type': PROBLEM_TYPE },
          body: problem('urn:imolt:problem:not-found', 'Запись не найдена', 404),
        };
    }
  }

  function ok(body: unknown): StubResponse {
    return { status: 200, headers: { 'content-type': JSON_TYPE }, body };
  }

  globalThis.fetch = (async (input: unknown, init?: RequestInit): Promise<Response> => {
    const raw = addressOf(input);
    const address = new URL(raw, 'http://mini.app');
    const method = (init?.method ?? (input as { method?: string }).method ?? 'GET').toUpperCase();
    const rawBody = init?.body;

    const request: RecordedRequest = {
      method,
      url: raw,
      // Интерфейс ходит по относительному пути /api (ADR-0008, инвариант 3);
      // договор описывает маршруты без этого префикса.
      path: address.pathname.replace(/^\/api/, ''),
      query: address.searchParams,
      body: typeof rawBody === 'string' && rawBody.length > 0 ? JSON.parse(rawBody) : undefined,
    };

    requests.push(request);

    const key = routeKeyOf(method, request.path);
    const override = key === undefined ? undefined : internals.answers.get(key);
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
      internals.answers.set(key, answer);
    },

    setOptions(list) {
      internals.options = typeof list === 'function' ? list : () => list;
    },

    unexpected() {
      return [...unexpectedPaths];
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
