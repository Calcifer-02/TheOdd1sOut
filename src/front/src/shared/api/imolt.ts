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
import { ApiProblem, request } from './http';
import type {
  AddressSuggestion,
  AllocationEntry,
  AllocationState,
  AmountConversionItem,
  Calculation,
  CalculationRequest,
  DistanceMode,
  Page,
  PlacementOptionPage,
  Quantity,
  RouteSummary,
  SelectionEntry,
  SelectionState,
  Session,
  SessionRequest,
  SortField,
  SortOrder,
  WasteGroup,
} from './contracts';

export { ApiProblem };

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
  return request<Page<AddressSuggestion>>(`/v1/address-suggestions?${new URLSearchParams({ query, limit: '6' })}`);
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
export function setSelection(calculationId: string, entries: SelectionEntry[]): Promise<SelectionState> {
  return request<SelectionState>(`/v1/calculations/${calculationId}/selection`, {
    method: 'PUT',
    body: JSON.stringify({ entries }),
  });
}

/** @supports: R-030 */
export function setAllocation(calculationId: string, entries: AllocationEntry[]): Promise<AllocationState> {
  return request<AllocationState>(`/v1/calculations/${calculationId}/allocation`, {
    method: 'PUT',
    body: JSON.stringify({ entries }),
  });
}

/** @supports: R-032, R-034 */
export function getRoute(calculationId: string): Promise<RouteSummary> {
  return request<RouteSummary>(`/v1/calculations/${calculationId}/route`);
}
