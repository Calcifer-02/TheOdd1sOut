/**
 * Обращения к расчётной части по договору API.
 *
 * Путь относительный — `/api` проксирует nginx мини-приложения, и ни адрес
 * службы, ни ключи в браузер не попадают (R-056, ADR-0008, инвариант 3).
 * Формы ответов объявлены отдельным модулем: здесь поведение, там словарь.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import type {
  AddressSuggestion,
  AllocationEntry,
  AllocationState,
  AmountConversionItem,
  Calculation,
  CalculationRequest,
  DistanceMode,
  Page,
  PickupRequest,
  PickupRequestInput,
  PlacementOptionPage,
  Quantity,
  Quote,
  RouteSummary,
  SelectionEntry,
  SelectionState,
  Session,
  SessionRequest,
  SortField,
  SortOrder,
  WasteGroup,
} from './contracts';

const BASE = '/api';

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

/**
 * Обмен стартовых параметров платформы на маркер доступа (R-049, R-071).
 *
 * Строка параметров уходит как есть: подпись проверяется только по исходной
 * строке, и разобранный браузером объект личностью не считается (ADR-0006).
 * Согласие на обработку персональных данных приходит параметром, а не
 * подставляется здесь истиной (R-054).
 *
 * @supports: R-049, R-071
 */
export function createSession(input: SessionRequest): Promise<Session> {
  return request<Session>('/v1/auth/sessions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** @supports: R-013 */
export function searchWasteGroups(query: string): Promise<Page<WasteGroup>> {
  const parameters = new URLSearchParams({ limit: '10' });
  if (query) {
    parameters.set('query', query);
  }

  return request<Page<WasteGroup>>(`/v1/waste-groups?${parameters}`);
}

/** @supports: R-012 */
export function suggestAddresses(query: string): Promise<Page<AddressSuggestion>> {
  return request<Page<AddressSuggestion>>(
    `/v1/address-suggestions?${new URLSearchParams({ query, limit: '6' })}`,
  );
}

/**
 * Пересчёт меры делает служба, а не браузер: коэффициент плотности — часть
 * справочника, и второго места его применения быть не должно (ADR-0008,
 * инвариант 2; описание операции в договоре).
 *
 * @supports: R-015
 */
export function convertAmounts(
  items: { wasteGroupId: string; quantity: Quantity }[],
): Promise<{ items: AmountConversionItem[] }> {
  return request<{ items: AmountConversionItem[] }>('/v1/amount-conversions', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

/** @supports: R-014, R-018, R-021 */
export function createCalculation(body: CalculationRequest): Promise<Calculation> {
  return request<Calculation>('/v1/calculations', { method: 'POST', body: JSON.stringify(body) });
}

/** @supports: R-058 */
export function getCalculation(id: string): Promise<Calculation> {
  return request<Calculation>(`/v1/calculations/${id}`);
}

/** @supports: R-023, R-024, R-025, R-029 */
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

/** @supports: R-027 */
export function setSelection(
  calculationId: string,
  entries: SelectionEntry[],
): Promise<SelectionState> {
  return request<SelectionState>(`/v1/calculations/${calculationId}/selection`, {
    method: 'PUT',
    body: JSON.stringify({ entries }),
  });
}

/** @supports: R-030 */
export function setAllocation(
  calculationId: string,
  entries: AllocationEntry[],
): Promise<AllocationState> {
  return request<AllocationState>(`/v1/calculations/${calculationId}/allocation`, {
    method: 'PUT',
    body: JSON.stringify({ entries }),
  });
}

/** @supports: R-032, R-034 */
export function getRoute(calculationId: string): Promise<RouteSummary> {
  return request<RouteSummary>(`/v1/calculations/${calculationId}/route`);
}

/** @supports: R-036 */
export function createQuote(calculationId: string): Promise<Quote> {
  return request<Quote>(`/v1/calculations/${calculationId}/quotes`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/** @supports: R-053 */
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
