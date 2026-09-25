/**
 * Передаваемое состояние выборки живёт в адресе (ADR-0008, инвариант 5;
 * карточка практики PRACT-016).
 *
 * В адрес кладётся только предметное: какой расчёт открыт, какая группа
 * отходов показана, как отсортирован список и каким пределом расстояния он
 * ограничен. Раскрытые панели, черновик формы и прочее представление в адрес
 * не попадают — по ссылке восстанавливается предмет разговора, а не поза окна.
 *
 * Неизвестный или испорченный параметр не роняет соседние: разбор мягкий и
 * подставляет значение по умолчанию только для испорченного параметра.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */

export type SortField = 'total' | 'transport' | 'disposal' | 'distance';

export type SortOrder = 'asc' | 'desc';

export type DistanceMode = 'atMost' | 'atLeast';

export type ViewState = {
  calculationId?: string;
  wasteGroupId?: string;
  sort: SortField;
  order: SortOrder;
  distanceMode: DistanceMode;
  distanceKm: number;
  /**
   * Открытое окно маршрута: `selection` — по всему выбору,
   * идентификатор полигона — по одной строке таблицы. Окно живёт в
   * адресе, потому что его содержимое — предмет разговора: ссылка на
   * маршрут обязана открыть его же, а перезагрузка — не закрывать
   * (замечание заказчика от 25.09.2026; ADR-0008, инвариант 5).
   */
  route?: string;
};

const SORT_FIELDS: SortField[] = ['total', 'transport', 'disposal', 'distance'];

const SORT_ORDERS: SortOrder[] = ['asc', 'desc'];

const DISTANCE_MODES: DistanceMode[] = ['atMost', 'atLeast'];

/** Предел расстояния по умолчанию — 50 километров, режим «не далее» (R-026). */
export const DEFAULT_VIEW_STATE: ViewState = {
  sort: 'total',
  order: 'asc',
  distanceMode: 'atMost',
  distanceKm: 50,
};

function pick<T extends string>(allowed: T[], value: string | null, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Разбор адреса в состояние. Всё, чего нет или что испорчено, — по умолчанию. */
export function parseViewState(hash: string): ViewState {
  const query = hash.slice(hash.indexOf('?') + 1);
  const parameters = new URLSearchParams(hash.includes('?') ? query : '');

  const km = Number.parseInt(parameters.get('km') ?? '', 10);

  return {
    calculationId: parameters.get('calc') ?? undefined,
    wasteGroupId: parameters.get('group') ?? undefined,
    sort: pick(SORT_FIELDS, parameters.get('sort'), DEFAULT_VIEW_STATE.sort),
    order: pick(SORT_ORDERS, parameters.get('order'), DEFAULT_VIEW_STATE.order),
    distanceMode: pick(DISTANCE_MODES, parameters.get('mode'), DEFAULT_VIEW_STATE.distanceMode),
    distanceKm: Number.isFinite(km) && km >= 0 && km <= 1000 ? km : DEFAULT_VIEW_STATE.distanceKm,
    route: parameters.get('route') ?? undefined,
  };
}

/**
 * Сборка адреса из состояния. Значения по умолчанию не пишутся: адрес пустого
 * экрана должен оставаться пустым, иначе ссылка обрастает шумом.
 */
export function viewStateToHash(state: ViewState): string {
  const parameters = new URLSearchParams();

  if (state.calculationId) {
    parameters.set('calc', state.calculationId);
  }
  if (state.wasteGroupId) {
    parameters.set('group', state.wasteGroupId);
  }
  if (state.sort !== DEFAULT_VIEW_STATE.sort) {
    parameters.set('sort', state.sort);
  }
  if (state.order !== DEFAULT_VIEW_STATE.order) {
    parameters.set('order', state.order);
  }
  if (state.route) {
    parameters.set('route', state.route);
  }

  if (state.distanceMode !== DEFAULT_VIEW_STATE.distanceMode) {
    parameters.set('mode', state.distanceMode);
  }
  if (state.distanceKm !== DEFAULT_VIEW_STATE.distanceKm) {
    parameters.set('km', String(state.distanceKm));
  }

  const query = parameters.toString();
  return query ? `#?${query}` : '#';
}
