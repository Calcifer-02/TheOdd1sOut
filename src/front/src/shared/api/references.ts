/**
 * Обращения к справочникам: реестр полигонов, группы отходов, отзывы и дата
 * актуальности данных.
 *
 * Отдельный модуль области, а не строки в общем файле обращений: справочник
 * читают два экрана — справочник полигонов и редактор цен, — и один файл на
 * всех стал бы местом, где их правки сталкиваются (пояснение в `http.ts`).
 *
 * Формы ответов списаны со схем `src/back/Imolt.Api/contracts/openapi.yaml`
 * (`Landfill`, `LandfillCard`, `LandfillTariff`, `LandfillReview`): интерфейс
 * своей модели справочника не заводит (ADR-0008, инвариант 2). Поля, которого
 * договор не обещает, здесь нет.
 *
 * @supports: R-031, R-039, R-040, R-041, R-048
 * @adr: ADR-0008
 */
import { ApiProblem, request } from './http';
import type { Coordinates, DataFreshness, LandfillStatus, Page, WasteGroup } from './contracts';
import type { Money } from '@/shared/lib/formatting';

// Общие формы договора переэкспортируются отсюда, чтобы потребитель
// справочника подключал один модуль области, а не собирал тип из двух мест.
export type { Coordinates, DataFreshness, LandfillStatus, Money, Page, WasteGroup };

// Отказ службы приходит из общей части обмена: ветвиться по нему потребителю
// справочника нужно там же, где он читает справочник.
export { ApiProblem };

/** Тариф утилизации полигона по одной группе отходов (схема `LandfillTariff`). */
export type LandfillTariff = {
  wasteGroupId: string;
  disposalPricePerTon: Money;
  /** дата, на которую тариф известен (R-048) */
  updatedAt: string;
};

/** Запись реестра полигонов (схема `Landfill`). */
export type Landfill = {
  id: string;
  name: string;
  /** юридическое лицо; договор поля не требует — у части записей его нет */
  legalEntity?: string;
  address: string;
  coordinates: Coordinates;
  status: LandfillStatus;
  /** дата, на которую статус известен (R-048) */
  statusUpdatedAt: string;
  tariffs: LandfillTariff[];
};

/** Смена юридического лица полигона (R-041). */
export type LegalEntityPeriod = {
  legalEntity: string;
  since: string;
  /** не заполнено у действующего юридического лица */
  until?: string | null;
};

/**
 * Карточка полигона (схема `LandfillCard`): запись реестра и история смены
 * юридического лица. Карточка — это полигон со всем, что о нём известно,
 * поэтому тип расширяет `Landfill`, а не повторяет его поля.
 */
export type LandfillCard = Landfill & { legalEntityHistory?: LegalEntityPeriod[] };

/**
 * Отзыв о полигоне (схема `LandfillReview`). Оценка относится к достоверности
 * сведений о полигоне, а не к качеству услуги (R-031).
 */
export type Review = {
  id: string;
  landfillId: string;
  /** целое от 1 до 5 — границы задаёт договор */
  rating: number;
  text?: string | null;
  /** момент с часовым поясом, формат `date-time` */
  createdAt: string;
};

/**
 * Страница отзывов (схема `LandfillReviewPage`). Средняя оценка считается
 * службой: второго места её подсчёта быть не должно, а у полигона без отзывов
 * она пуста, а не равна нулю (AC-031a, AC-031b).
 */
export type ReviewPage = Page<Review> & { averageRating: number | null };

/** Отбор и страница ответа. Незаданное в строку запроса не попадает. */
function searchParams(query: Record<string, string | number | undefined>): URLSearchParams {
  const parameters = new URLSearchParams();

  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      parameters.set(name, String(value));
    }
  }

  return parameters;
}

function withQuery(path: string, parameters: URLSearchParams): string {
  const text = parameters.toString();
  return text ? `${path}?${text}` : path;
}

/**
 * Реестр полигонов с отбором по названию и принимаемой группе отходов
 * (AC-040b). Тарифы утилизации приходят прямо в записи списка — сводить их
 * вторым обращением не нужно.
 *
 * @supports: R-040, R-048
 */
export function listLandfills(query: {
  query?: string;
  wasteGroupId?: string;
  limit?: number;
  offset?: number;
}): Promise<Page<Landfill>> {
  return request<Page<Landfill>>(withQuery('/v1/landfills', searchParams(query)));
}

/**
 * Карточка полигона: запись реестра и история юридических лиц (AC-041a).
 * Возвращается подтип `Landfill`, поэтому потребителю, которому история не
 * нужна, достаточно объявить `Landfill`.
 *
 * @supports: R-040, R-041
 */
export function getLandfill(landfillId: string): Promise<LandfillCard> {
  return request<LandfillCard>(`/v1/landfills/${encodeURIComponent(landfillId)}`);
}

/**
 * Справочник групп отходов: название, коды каталога отходов, цена перевозки
 * за тонна-километр и коэффициент плотности.
 *
 * @supports: R-039
 */
export function listWasteGroups(query?: {
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<Page<WasteGroup>> {
  return request<Page<WasteGroup>>(withQuery('/v1/waste-groups', searchParams(query ?? {})));
}

/** @supports: R-039 */
export function getWasteGroup(wasteGroupId: string): Promise<WasteGroup> {
  return request<WasteGroup>(`/v1/waste-groups/${encodeURIComponent(wasteGroupId)}`);
}

/**
 * Отзывы полигона со средней оценкой службы (AC-031a).
 *
 * @supports: R-031
 */
export function listReviews(landfillId: string, query?: { limit?: number; offset?: number }): Promise<ReviewPage> {
  return request<ReviewPage>(
    withQuery(`/v1/landfills/${encodeURIComponent(landfillId)}/reviews`, searchParams(query ?? {})),
  );
}

/**
 * Новый отзыв о полигоне. Операция требует сессии участника: маркер доступа
 * проставляет общий слой, отзыв без сессии отклоняет служба (AC-031c).
 *
 * @supports: R-031
 */
export function createReview(landfillId: string, body: { rating: number; text?: string }): Promise<Review> {
  return request<Review>(`/v1/landfills/${encodeURIComponent(landfillId)}/reviews`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Дата актуальности цен и статусов. Отдельная операция, потому что дата нужна
 * и до расчёта — полоса актуальности стоит над справочником (AC-048a).
 *
 * @supports: R-048
 */
export function getDataFreshness(): Promise<DataFreshness> {
  return request<DataFreshness>('/v1/data-freshness');
}
