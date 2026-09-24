/**
 * Представление экрана предложения: что показать и что можно сделать.
 *
 * Оба представления — лист на широком экране и одна колонка на телефоне —
 * берут разметку отсюда, а не решают сами: расхождение веток было бы
 * незаметно ровно до того дня, когда числа на телефоне и на рабочем месте
 * разойдутся (дизайн-договор, разд. 4.5).
 *
 * @supports: R-036, R-037, R-059
 * @adr: ADR-0008
 */
import type { QuoteLine } from '@/entities/quote';
import { quoteDocumentHref } from '@/shared/api/deals';
import type { Money } from '@/shared/lib/formatting';
import { CALCULATION_PARAMETER, type QuoteScreenState } from './useQuoteScreen';

/** Тексты действий и заголовков экрана: одно написание на оба представления. */
export const QUOTE_LABELS = {
  screen: 'Коммерческое предложение',
  issue: 'Выпустить предложение',
  issuing: 'Выпускаем предложение',
  download: 'Скачать файл',
  backToCalculation: 'Вернуться к расчёту',
  pickupRequest: 'Оформить заявку на вывоз',
  retry: 'Повторить',
  actions: 'Действия с предложением',
  history: 'Ранее выпущенные предложения',
  historyNumber: 'Номер',
  /*
   * Перечень строится по сохранённым расчётам, и дату выпуска служба в нём не
   * называет: в схеме `CalculationSummary` договора есть только дата расчёта.
   * Столбец назван тем, что в нём стоит: подписать дату расчёта выпуском
   * значило бы показать выдуманное (AC-036h).
   */
  historyDate: 'Дата расчёта',
  historyAddress: 'Адрес вывоза',
  historyTotal: 'Итого',
  historyOpen: 'Открыть',
  historyEmpty: 'Ранее выпущенных предложений нет',
  historyLoading: 'Загружаем ранее выпущенные предложения',
  historyFailed: 'Ранее выпущенные предложения не загрузились',
} as const;

/**
 * Состояние адреса, несущее расчёт. Имя параметра одно на весь сервис, и
 * собирается состояние здесь: возврат к расчёту и ссылка строки истории
 * обязаны назвать тот же расчёт, а не открыть пустой экран (AC-036g).
 */
export function calculationQuery(calculationId: string): URLSearchParams {
  return new URLSearchParams({ [CALCULATION_PARAMETER]: calculationId });
}

/** Готовое к показу предложение: ни одно поле здесь не вычисляется заново. */
export type QuoteView = {
  number: string | null;
  issuedAt: string | null;
  validUntil: string | null;
  pickupAddress: string;
  pricesUpdatedAt: string;
  lines: QuoteLine[];
  total: Money | null;
  /** Откуда взят итог: закреплённый снимок или ещё не выпущенный выбор. */
  totalHint: string;
  /** Адрес файла предложения; `null` — предложение ещё не выпущено. */
  documentHref: string | null;
  canIssue: boolean;
  /** Сколько выбранных полигонов расчёт не раскрыл ценами. */
  omitted: number;
};

type Ready = Extract<QuoteScreenState, { kind: 'ready' }>;

function totalHintOf(state: Ready): string {
  if (state.quote !== null) {
    return 'Итог выпущенного предложения: цены закреплены снимком на момент выпуска';
  }

  if (state.composition.total !== null) {
    return 'Итог по выбранным полигонам. Номер и срок действия присваиваются при выпуске';
  }

  return 'Полигоны выбираются на экране расчёта';
}

export function quoteView(state: Ready): QuoteView {
  const { calculation, composition, quote } = state;

  return {
    number: quote?.number ?? null,
    issuedAt: quote?.issuedAt ?? null,
    validUntil: quote?.validUntil ?? null,
    pickupAddress: calculation.pickupAddress.value,
    pricesUpdatedAt: calculation.dataFreshness.pricesUpdatedAt,
    lines: composition.lines,
    // Выпущенное предложение называет итог сам: он закреплён снимком и может
    // отличаться от нынешнего выбора, если справочник уже обновился (R-037).
    total: quote?.total ?? composition.total,
    totalHint: totalHintOf(state),
    documentHref: quote === null ? null : quoteDocumentHref(quote),
    canIssue: quote === null && composition.lines.length > 0,
    omitted: composition.omitted,
  };
}
