// Заглушка расчётной части для проверок редактора цен и справочников (Э-11).
// Подменяет глобальный fetch, разбирает путь и отвечает телами договора
// (../../../back/Imolt.Api/contracts/openapi.yaml) данными поднятой службы;
// поля, которого договор не обещает, здесь нет.
// Справочник заглушка хранит и меняет так же, как служба: правка тарифа
// двигает дату актуальности цен (R-048), а импорт пишет прогон обновления
// (AC-044d). Иначе проверялась бы заглушка, а не интерфейс.
//
// Файл без «.test.» в имени в прогон не попадает: это общая оснастка.

/** Денежная сумма договора: строка с двумя знаками после точки. */
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

export type WasteGroup = {
  id: string;
  name: string;
  fkkoCodes: string[];
  transportPricePerTonKm: Money;
  densityTonPerCubicMeter: number;
  updatedAt: string;
};

export type RecordedRequest = {
  method: string;
  url: string;
  /** путь без приставки `/api`, например `/v1/landfills` */
  path: string;
  query: URLSearchParams;
  /** разобранное тело; у составного тела — имя файла и вид справочника */
  body: unknown;
};

export type StubResponse = { status: number; body?: unknown; headers?: Record<string, string> };

export type Answer = StubResponse | ((request: RecordedRequest) => StubResponse);

/** Точки, на которые опирается редактор. `:id` — идентификатор записи. */
export type RouteKey =
  | 'GET /v1/landfills'
  | 'GET /v1/waste-groups'
  | 'GET /v1/data-freshness'
  | 'GET /v1/sync-runs/latest'
  | 'PATCH /v1/waste-groups/:id'
  | 'PUT /v1/landfills/:id/tariffs/:wasteGroupId'
  | 'PUT /v1/landfills/:id/status'
  | 'POST /v1/reference-imports'
  | 'POST /v1/reference-imports/:id/confirmation';

// --- канонические данные ---------------------------------------------------

/** Дата актуальности справочника до правки. */
export const FRESHNESS_DATE = '2026-09-17';

/** Дата правки: день, в который менеджер данных правит справочник. */
export const EDIT_DATE = '2026-09-18';

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

export const WOOD_GROUP: WasteGroup = {
  id: 'drevesina',
  name: 'Древесина от разборки',
  fkkoCodes: [],
  transportPricePerTonKm: { amount: '16.00', currency: 'RUB' },
  densityTonPerCubicMeter: 0.5,
  updatedAt: FRESHNESS_DATE,
};

export const WASTE_GROUPS: WasteGroup[] = [CONCRETE_GROUP, WOOD_GROUP, BRICK_GROUP];

export const IKSHA: Landfill = {
  id: 'iksha',
  name: 'Площадка «Икша»',
  address: 'Московская обл., Дмитровский г. о., пос. Икша',
  coordinates: { latitude: 56.1556, longitude: 37.4906 },
  status: 'active',
  statusUpdatedAt: FRESHNESS_DATE,
  tariffs: [
    {
      wasteGroupId: 'beton-lom',
      disposalPricePerTon: { amount: '380.00', currency: 'RUB' },
      updatedAt: FRESHNESS_DATE,
    },
    {
      wasteGroupId: 'kirpich-lom',
      disposalPricePerTon: { amount: '360.00', currency: 'RUB' },
      updatedAt: FRESHNESS_DATE,
    },
  ],
};

export const VOSTOK: Landfill = {
  id: 'vostok-timohovo',
  name: 'Комплекс переработки «Восток»',
  legalEntity: 'ООО «Восток»',
  address: 'Московская обл., Богородский г. о., д. Тимохово',
  coordinates: { latitude: 55.7286, longitude: 38.2153 },
  status: 'active',
  statusUpdatedAt: FRESHNESS_DATE,
  tariffs: [
    {
      wasteGroupId: 'beton-lom',
      disposalPricePerTon: { amount: '450.00', currency: 'RUB' },
      updatedAt: FRESHNESS_DATE,
    },
    {
      wasteGroupId: 'drevesina',
      disposalPricePerTon: { amount: '300.00', currency: 'RUB' },
      updatedAt: FRESHNESS_DATE,
    },
    {
      wasteGroupId: 'kirpich-lom',
      disposalPricePerTon: { amount: '420.00', currency: 'RUB' },
      updatedAt: FRESHNESS_DATE,
    },
  ],
};

export const LANDFILLS: Landfill[] = [IKSHA, VOSTOK];

/** Предпросмотр импорта тарифов: ключ тарифа составной — «полигон/группа». */
export const IMPORT_ID = '3f8a1d92-1c44-4c8f-9c41-0b3c6f2d7a15';

export const IMPORT_CHANGES = [
  {
    entityId: 'iksha/beton-lom',
    field: 'disposalPricePerTon',
    currentValue: '380.00',
    fileValue: '480.00',
  },
];

/** Итог последнего прогона обновления — пример договора для `SyncRun`. */
export const SYNC_RUN = {
  startedAt: `${EDIT_DATE}T07:15:00+03:00`,
  finishedAt: `${EDIT_DATE}T07:15:42+03:00`,
  source: 'telegram',
  outcome: 'succeeded',
  recognizedMessages: 14,
  updatedLandfills: 12,
};

/** Документ об отказе по RFC 9457 — форма `Problem` договора. */
export function problem(type: string, title: string, status: number, detail?: string): Record<string, unknown> {
  return detail === undefined ? { type, title, status } : { type, title, status, detail };
}

/** Отказ по праву ведения справочников — дословно из `ProblemResponses`. */
export const ROLE_REQUIRED = problem(
  'urn:imolt:problem:role-required',
  'Операция доступна менеджеру данных',
  403,
  'Ведение справочников закреплено за владельцем данных: обратитесь к нему за правом',
);

/** Отказ по сессии — дословно с поднятой службы. */
export const AUTHENTICATION_REQUIRED = problem(
  'urn:imolt:problem:authentication-required',
  'Нужна сессия участника',
  401,
  'Операция доступна участнику с сессией: откройте мини-приложение в MAX',
);

/** Отказ по устаревшему предпросмотру импорта. */
export const STALE_PREVIEW = problem(
  'urn:imolt:problem:stale-preview',
  'Предпросмотр устарел',
  409,
  'Справочник изменился после разбора файла, разберите его заново',
);

// --- заглушка --------------------------------------------------------------

export type MaintenanceStub = {
  requests: RecordedRequest[];
  sentTo(key: RouteKey): RecordedRequest[];
  lastTo(key: RouteKey): RecordedRequest;
  bodyOf(key: RouteKey): Record<string, unknown>;
  answerWith(key: RouteKey, answer: Answer): void;
  /** Текущий справочник заглушки: им проверяется, что правка дошла. */
  landfills(): Landfill[];
  wasteGroups(): WasteGroup[];
  /** пути, которых договор экрана не обещает */
  unexpected(): string[];
  restore(): void;
};

const JSON_TYPE = 'application/json';

const PROBLEM_TYPE = 'application/problem+json';

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
  const tariff = /^\/v1\/landfills\/[^/]+\/tariffs\/[^/]+$/.exec(path);
  if (tariff) {
    return 'PUT /v1/landfills/:id/tariffs/:wasteGroupId';
  }

  const status = /^\/v1\/landfills\/[^/]+\/status$/.exec(path);
  if (status) {
    return 'PUT /v1/landfills/:id/status';
  }

  const confirmation = /^\/v1\/reference-imports\/[^/]+\/confirmation$/.exec(path);
  if (confirmation) {
    return 'POST /v1/reference-imports/:id/confirmation';
  }

  const group = /^\/v1\/waste-groups\/[^/]+$/.exec(path);
  if (group && method === 'PATCH') {
    return 'PATCH /v1/waste-groups/:id';
  }

  return `${method} ${path}` as RouteKey;
}

/** Ключи записи из пути: они предметные, а не позиционные. */
function segmentsOf(path: string): string[] {
  return path.split('/').filter(part => part !== '');
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function installMaintenanceStub(): MaintenanceStub {
  const requests: RecordedRequest[] = [];
  const unexpectedPaths: string[] = [];
  const original = globalThis.fetch;
  const answers = new Map<RouteKey, Answer>();

  let landfills = copy(LANDFILLS);
  let wasteGroups = copy(WASTE_GROUPS);
  let freshness = {
    pricesUpdatedAt: FRESHNESS_DATE,
    statusesUpdatedAt: FRESHNESS_DATE,
    landfillsWithStaleData: 0,
  };
  let syncRun: Record<string, unknown> | null = copy(SYNC_RUN);

  function ok(body: unknown): StubResponse {
    return { status: 200, headers: { 'content-type': JSON_TYPE }, body };
  }

  function refuse(document: Record<string, unknown>): StubResponse {
    return {
      status: document['status'] as number,
      headers: { 'content-type': PROBLEM_TYPE },
      body: document,
    };
  }

  function page(items: unknown[]): Record<string, unknown> {
    return { items, total: items.length, limit: 100, offset: 0 };
  }

  function setTariff(request: RecordedRequest): StubResponse {
    const parts = segmentsOf(request.path);
    const landfillId = parts[2];
    const wasteGroupId = parts[4];
    const landfill = landfills.find(item => item.id === landfillId);
    const price = (request.body as { disposalPricePerTon?: Money } | undefined)?.disposalPricePerTon;

    if (landfill === undefined || price === undefined) {
      return refuse(problem('urn:imolt:problem:not-found', 'Запись не найдена', 404));
    }

    const tariff: LandfillTariff = {
      wasteGroupId,
      disposalPricePerTon: price,
      updatedAt: EDIT_DATE,
    };

    landfill.tariffs = landfill.tariffs.some(item => item.wasteGroupId === wasteGroupId)
      ? landfill.tariffs.map(item => (item.wasteGroupId === wasteGroupId ? tariff : item))
      : [...landfill.tariffs, tariff];

    // Правка цены двигает дату актуальности цен — AC-048c.
    freshness = { ...freshness, pricesUpdatedAt: EDIT_DATE };

    return ok(tariff);
  }

  function patchWasteGroup(request: RecordedRequest): StubResponse {
    const wasteGroupId = segmentsOf(request.path)[2];
    const group = wasteGroups.find(item => item.id === wasteGroupId);
    const update = (request.body ?? {}) as Partial<WasteGroup>;

    if (group === undefined) {
      return refuse(problem('urn:imolt:problem:not-found', 'Запись не найдена', 404));
    }

    // Непереданные поля правка не трогает — AC-042b.
    if (update.transportPricePerTonKm !== undefined) {
      group.transportPricePerTonKm = update.transportPricePerTonKm;
    }
    if (update.densityTonPerCubicMeter !== undefined) {
      group.densityTonPerCubicMeter = update.densityTonPerCubicMeter;
    }
    if (update.name !== undefined) {
      group.name = update.name;
    }

    group.updatedAt = EDIT_DATE;
    freshness = { ...freshness, pricesUpdatedAt: EDIT_DATE };

    return ok(group);
  }

  function setStatus(request: RecordedRequest): StubResponse {
    const landfillId = segmentsOf(request.path)[2];
    const landfill = landfills.find(item => item.id === landfillId);
    const sent = (request.body ?? {}) as { status?: LandfillStatus; reason?: string };

    if (landfill === undefined || sent.status === undefined) {
      return refuse(problem('urn:imolt:problem:not-found', 'Запись не найдена', 404));
    }

    landfill.status = sent.status;
    landfill.statusUpdatedAt = EDIT_DATE;
    freshness = { ...freshness, statusesUpdatedAt: EDIT_DATE };

    return ok({
      landfillId,
      status: sent.status,
      statusUpdatedAt: EDIT_DATE,
      source: 'manual',
      ...(sent.reason === undefined ? {} : { reason: sent.reason }),
    });
  }

  function startImport(): StubResponse {
    return {
      status: 201,
      headers: { 'content-type': JSON_TYPE },
      body: {
        id: IMPORT_ID,
        kind: 'tariffs',
        changes: copy(IMPORT_CHANGES),
        rejectedRows: [],
        // Книга тарифов записей не заводит: заводит их только справочник
        // полигонов (R-046).
        additions: [],
      },
    };
  }

  function confirmImport(): StubResponse {
    for (const change of IMPORT_CHANGES) {
      const [landfillId, wasteGroupId] = change.entityId.split('/');
      const landfill = landfills.find(item => item.id === landfillId);
      const tariff = landfill?.tariffs.find(item => item.wasteGroupId === wasteGroupId);

      if (tariff !== undefined) {
        tariff.disposalPricePerTon = { amount: change.fileValue, currency: 'RUB' };
        tariff.updatedAt = EDIT_DATE;
      }
    }

    freshness = { ...freshness, pricesUpdatedAt: EDIT_DATE };
    syncRun = {
      startedAt: `${EDIT_DATE}T09:20:00+03:00`,
      finishedAt: `${EDIT_DATE}T09:20:03+03:00`,
      source: 'file',
      outcome: 'succeeded',
      updatedLandfills: IMPORT_CHANGES.length,
    };

    return ok({
      id: IMPORT_ID,
      appliedChanges: IMPORT_CHANGES.length,
      addedEntities: 0,
      updatedAt: `${EDIT_DATE}T09:20:03+03:00`,
    });
  }

  function defaultAnswer(key: RouteKey | undefined, request: RecordedRequest): StubResponse {
    switch (key) {
      case 'GET /v1/landfills':
        return ok(page(landfills));

      case 'GET /v1/waste-groups':
        return ok(page(wasteGroups));

      case 'GET /v1/data-freshness':
        return ok(freshness);

      case 'GET /v1/sync-runs/latest':
        return syncRun === null
          ? refuse(
              problem(
                'urn:imolt:problem:not-found',
                'Запись не найдена',
                404,
                'Прогонов обновления справочников ещё не было',
              ),
            )
          : ok(syncRun);

      case 'PUT /v1/landfills/:id/tariffs/:wasteGroupId':
        return setTariff(request);

      case 'PATCH /v1/waste-groups/:id':
        return patchWasteGroup(request);

      case 'PUT /v1/landfills/:id/status':
        return setStatus(request);

      case 'POST /v1/reference-imports':
        return startImport();

      case 'POST /v1/reference-imports/:id/confirmation':
        return confirmImport();

      default:
        unexpectedPaths.push(`${request.method} ${request.path}`);
        return refuse(problem('urn:imolt:problem:not-found', 'Запись не найдена', 404));
    }
  }

  /** Тело запроса: json — разобранным, составное — именем файла и видом. */
  function bodyOfRequest(raw: BodyInit | null | undefined): unknown {
    if (typeof raw === 'string' && raw.length > 0) {
      return JSON.parse(raw) as unknown;
    }

    if (typeof FormData !== 'undefined' && raw instanceof FormData) {
      const file = raw.get('file');

      return {
        kind: raw.get('kind'),
        fileName: file instanceof File ? file.name : null,
      };
    }

    return undefined;
  }

  globalThis.fetch = (async (input: unknown, init?: RequestInit): Promise<Response> => {
    const rawUrl = addressOf(input);
    const address = new URL(rawUrl, 'http://mini.app');
    const method = (init?.method ?? (input as { method?: string }).method ?? 'GET').toUpperCase();

    const request: RecordedRequest = {
      method,
      url: rawUrl,
      path: address.pathname.replace(/^\/api/, ''),
      query: address.searchParams,
      body: bodyOfRequest(init?.body),
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

    landfills: () => landfills,

    wasteGroups: () => wasteGroups,

    unexpected: () => [...unexpectedPaths],

    restore() {
      globalThis.fetch = original;
      landfills = copy(LANDFILLS);
      wasteGroups = copy(WASTE_GROUPS);
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
