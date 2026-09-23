/**
 * Обращения к расчётной части по договору API.
 *
 * Формы взяты из `src/back/Imolt.Api/contracts/openapi.yaml`: интерфейс не
 * заводит своей модели расчёта (ADR-0008, инвариант 2). Путь относительный —
 * `/api` проксирует nginx мини-приложения, и ни адрес службы, ни ключи в
 * браузер не попадают (R-056, инвариант 3).
 *
 * @supports: R-012, R-013, R-018, R-023, R-030, R-032, R-036, R-053
 * @adr: ADR-0008
 */
import type { Money, Unit } from './formatting';
import type { DistanceMode, SortField, SortOrder } from './viewState';

const BASE = '/api';

export type Coordinates = { latitude: number; longitude: number };

export type ServiceArea = 'moscow' | 'moscowRegion';

export type AddressSuggestion = {
  id: string;
  value: string;
  coordinates: Coordinates;
  area: ServiceArea;
};

export type WasteGroup = {
  id: string;
  name: string;
  fkkoCodes: string[];
  transportPricePerTonKm: Money;
  densityTonPerCubicMeter: number;
  updatedAt: string;
};

export type LandfillStatus = 'active' | 'blocked' | 'unconfirmed';

export type PlacementOption = {
  landfillId: string;
  landfillName: string;
  address: string;
  distanceKm: number;
  transportCost: Money;
  disposalCost?: Money | null;
  totalCost: Money;
  status: LandfillStatus;
  statusUpdatedAt: string;
};

export type EmptyReason = 'noLandfillsForWasteGroup' | 'filteredOutByDistance' | null;

export type PlacementOptionPage = {
  items: PlacementOption[];
  total: number;
  limit: number;
  offset: number;
  emptyReason?: EmptyReason;
};

export type Quantity = { value: number; unit: Unit };

export type CalculationItem = {
  wasteGroupId: string;
  wasteGroupName: string;
  input: Quantity;
  tons: number;
};

export type DataFreshness = {
  pricesUpdatedAt: string;
  statusesUpdatedAt: string;
  landfillsWithStaleData?: number;
};

export type SelectionEntry = { wasteGroupId: string; landfillId: string };

export type SelectionWarning = {
  code: 'landfillBlocked' | 'landfillDataStale';
  landfillId: string;
  message: string;
};

export type SelectionState = {
  entries: SelectionEntry[];
  selectedLandfills: number;
  total: Money;
  warnings: SelectionWarning[];
};

export type AllocationEntry = {
  wasteGroupId: string;
  landfillId: string;
  quantity: Quantity;
};

export type AllocationPricedEntry = AllocationEntry & {
  transportCost: Money;
  disposalCost?: Money | null;
  totalCost: Money;
};

export type AllocationState = {
  entries: AllocationPricedEntry[];
  total: Money;
};

export type PickupAddress = {
  suggestionId?: string;
  value: string;
  coordinates: Coordinates;
  area?: ServiceArea;
};

export type Calculation = {
  id: string;
  createdAt: string;
  preliminary: boolean;
  pickupAddress: PickupAddress;
  disposalRequired: boolean;
  distanceFilter?: { mode: DistanceMode; km: number };
  items: CalculationItem[];
  results: { wasteGroupId: string; options: PlacementOptionPage }[];
  selection?: SelectionState;
  allocation?: AllocationState;
  dataFreshness: DataFreshness;
};

export type Access = {
  granted: boolean;
  reason?: 'subscriptionRequired' | 'authenticationRequired' | null;
};

export type RouteLeg = {
  landfillId: string;
  distanceKm: number;
  durationMinutes?: number | null;
  externalMapUrl?: string | null;
  encumbrances?: { kind: string; title: string }[];
};

export type RouteSummary = { access: Access; legs: RouteLeg[]; total: Money };

export type Quote = {
  id: string;
  number: string;
  issuedAt: string;
  validUntil: string;
  total: Money;
  preliminary: boolean;
  documentUrl: string;
};

export type PickupRequestInput = {
  calculationId?: string;
  landfillId?: string;
  contactName: string;
  phone: string;
  personalDataConsent: boolean;
};

export type PickupRequest = {
  id: string;
  createdAt: string;
  state: 'accepted';
  message?: string;
};

export type Page<T> = { items: T[]; total: number; limit: number; offset: number };

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json', ...init?.headers } : init?.headers,
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

  return (await response.json()) as T;
}

export function searchWasteGroups(query: string): Promise<Page<WasteGroup>> {
  const parameters = new URLSearchParams({ limit: '10' });
  if (query) {
    parameters.set('query', query);
  }

  return request<Page<WasteGroup>>(`/v1/waste-groups?${parameters}`);
}

export function suggestAddresses(query: string): Promise<Page<AddressSuggestion>> {
  return request<Page<AddressSuggestion>>(
    `/v1/address-suggestions?${new URLSearchParams({ query, limit: '6' })}`,
  );
}

export type CalculationRequest = {
  pickupAddress: PickupAddress;
  items: { wasteGroupId: string; quantity: Quantity }[];
  disposalRequired: boolean;
  distanceFilter: { mode: DistanceMode; km: number };
};

export type AmountConversionItem = {
  wasteGroupId: string;
  input: Quantity;
  tons: number;
  cubicMeters: number;
  densityTonPerCubicMeter: number;
};

/**
 * Пересчёт меры делает служба, а не браузер: коэффициент плотности — часть
 * справочника, и второго места его применения быть не должно (ADR-0008,
 * инвариант 2; описание операции в договоре).
 */
export function convertAmounts(
  items: { wasteGroupId: string; quantity: Quantity }[],
): Promise<{ items: AmountConversionItem[] }> {
  return request<{ items: AmountConversionItem[] }>('/v1/amount-conversions', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export function createCalculation(body: CalculationRequest): Promise<Calculation> {
  return request<Calculation>('/v1/calculations', { method: 'POST', body: JSON.stringify(body) });
}

export function getCalculation(id: string): Promise<Calculation> {
  return request<Calculation>(`/v1/calculations/${id}`);
}

export function listPlacementOptions(
  calculationId: string,
  query: {
    wasteGroupId: string;
    sort: SortField;
    order: SortOrder;
    distanceMode: DistanceMode;
    distanceKm: number;
    limit: number;
    offset: number;
  },
): Promise<PlacementOptionPage> {
  const parameters = new URLSearchParams({
    wasteGroupId: query.wasteGroupId,
    sort: query.sort,
    order: query.order,
    distanceMode: query.distanceMode,
    distanceKm: String(query.distanceKm),
    limit: String(query.limit),
    offset: String(query.offset),
  });

  return request<PlacementOptionPage>(`/v1/calculations/${calculationId}/options?${parameters}`);
}

export function setSelection(
  calculationId: string,
  entries: SelectionEntry[],
): Promise<SelectionState> {
  return request<SelectionState>(`/v1/calculations/${calculationId}/selection`, {
    method: 'PUT',
    body: JSON.stringify({ entries }),
  });
}

export function setAllocation(
  calculationId: string,
  entries: AllocationEntry[],
): Promise<AllocationState> {
  return request<AllocationState>(`/v1/calculations/${calculationId}/allocation`, {
    method: 'PUT',
    body: JSON.stringify({ entries }),
  });
}

export function getRoute(calculationId: string): Promise<RouteSummary> {
  return request<RouteSummary>(`/v1/calculations/${calculationId}/route`);
}

export function createQuote(calculationId: string): Promise<Quote> {
  return request<Quote>(`/v1/calculations/${calculationId}/quotes`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function createPickupRequest(body: PickupRequestInput): Promise<PickupRequest> {
  return request<PickupRequest>('/v1/pickup-requests', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Адрес файла предложения: договор отдаёт путь без приставки службы. */
export function documentHref(quote: Quote): string {
  return `${BASE}${quote.documentUrl}`;
}
