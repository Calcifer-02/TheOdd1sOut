import { LANDFILL_SORTS, type LandfillSort } from '@/shared/api/references';

/**
 * Состояние отбора справочника полигонов живёт в адресе страницы.
 *
 * Выборка — предмет разговора: «посмотри тарифы по лому бетона» передаётся
 * ссылкой, а не пересказом последовательности нажатий (ADR-0008, инвариант 5).
 * Поэтому группа отходов, строка поиска, предел показа и открытая карточка
 * читаются из адреса и записываются обратно.
 *
 * Разбор мягкий и по каждому параметру отдельно: испорченное значение
 * отбрасывается само по себе и не уносит с собой соседние. Пользователь чаще
 * приходит по ссылке из переписки, чем из интерфейса, и обрезанный адрес не
 * должен оставлять его с пустым экраном.
 *
 * @supports: R-039, R-040
 * @adr: ADR-0008
 */

/** Адрес экрана справочника полигонов. */
export const LANDFILLS_PATH = '/landfills';

/** Сколько записей показывается сразу; «Показать ещё» добавляет столько же. */
export const PAGE_SIZE = 10;

/** Предел, за которым запрос перестаёт быть страницей и становится выгрузкой. */
const MAX_LIMIT = 200;

/** Наибольшая длина строки поиска: договор ограничивает её двумястами знаками. */
const MAX_QUERY_LENGTH = 200;

/** Вид идентификатора справочника: «beton-lom», «vostok-timohovo». */
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

const SORT_VALUES: LandfillSort[] = LANDFILL_SORTS.map(sort => sort.value);

export type LandfillsFilters = {
  /** поиск по названию полигона; пустая строка — поиск не задан */
  query: string;
  /** отбор по принимаемой группе отходов; пустая строка — отбора нет */
  wasteGroupId: string;
  /** открытая карточка полигона; пустая строка — открыт список */
  landfillId: string;
  /** поле порядка списка; порядок считает служба, а не экран (R-088) */
  sort: LandfillSort;
  /** направление порядка */
  order: 'asc' | 'desc';
  limit: number;
};

function textOf(raw: string | null): string {
  return raw === null ? '' : raw.trim().slice(0, MAX_QUERY_LENGTH);
}

/** Идентификатор справочника или пустая строка: чужой вид значения не берётся. */
function identifierOf(raw: string | null): string {
  const value = raw === null ? '' : raw.trim();
  return ID_PATTERN.test(value) ? value : '';
}

function limitOf(raw: string | null): number {
  const value = Number.parseInt(raw ?? '', 10);

  if (!Number.isFinite(value) || value < PAGE_SIZE) {
    return PAGE_SIZE;
  }

  // Предел кратен странице: произвольное число из адреса сделало бы «Показать
  // ещё» непредсказуемым шагом. Слишком большой предел обрезается, а не
  // отбрасывается: иначе список схлопнулся бы обратно к первой странице.
  return Math.min(Math.ceil(value / PAGE_SIZE) * PAGE_SIZE, MAX_LIMIT);
}

/** Разбор адреса в отбор. Негодное значение параметра просто опускается. */
export function parseFilters(query: URLSearchParams): LandfillsFilters {
  return {
    query: textOf(query.get('q')),
    wasteGroupId: identifierOf(query.get('group')),
    landfillId: identifierOf(query.get('landfill')),
    sort: sortOf(query.get('sort')),
    order: query.get('order') === 'desc' ? 'desc' : 'asc',
    limit: limitOf(query.get('limit')),
  };
}

/** Поле порядка из адреса; чужое значение не берётся. */
function sortOf(raw: string | null): LandfillSort {
  const value = raw === null ? '' : raw.trim();

  return SORT_VALUES.includes(value as LandfillSort) ? (value as LandfillSort) : 'name';
}

/** Сборка адреса. Значение по умолчанию не пишется: ссылка не обрастает шумом. */
export function filtersQuery(filters: LandfillsFilters): URLSearchParams {
  const parameters = new URLSearchParams();

  if (filters.query) {
    parameters.set('q', filters.query);
  }
  if (filters.wasteGroupId) {
    parameters.set('group', filters.wasteGroupId);
  }
  if (filters.sort !== 'name') {
    parameters.set('sort', filters.sort);
  }
  if (filters.order !== 'asc') {
    parameters.set('order', filters.order);
  }
  if (filters.limit !== PAGE_SIZE) {
    parameters.set('limit', String(filters.limit));
  }
  if (filters.landfillId) {
    parameters.set('landfill', filters.landfillId);
  }

  return parameters;
}
