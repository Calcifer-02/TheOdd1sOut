/**
 * Обращения области «сделка»: расчёт под предложение, выпуск коммерческого
 * предложения и адрес его файла.
 *
 * Область вынесена в свой модуль, потому что обращения экранов пишутся
 * раздельно, а один файл обращений стал бы местом, где правки сталкиваются
 * (ADR-0008, инвариант 3). Имя области совпадает с областью расчётной части
 * (`src/back/Imolt.Deals`), чтобы граница читалась с обеих сторон.
 *
 * Выпуск и скачивание разделены намеренно: договор объявляет отдельную
 * операцию на файл, и повторное скачивание не выпускает второго предложения
 * (R-036, `openapi.yaml`, `createQuote`).
 *
 * @supports: R-036, R-037, R-038, R-053
 * @adr: ADR-0008
 */
import type { PickupRequest, PickupRequestInput, Quote } from './contracts';
import { ApiProblem, fileHref, request } from './http';

export { ApiProblem };

/** Необязательные реквизиты получателя предложения (схема `QuoteRequest`). */
export type QuoteRequest = { customerName?: string; comment?: string };

/**
 * Расчёт целиком: исходные данные, выбор, распределение и актуальность.
 * Живёт в области расчёта и переобъявления здесь не получает: два имени одной
 * операции расходятся ровно так же, как две её реализации.
 */
export { getCalculation } from './imolt';

/**
 * Выпуск предложения по расчёту. Повторный вызов по тому же расчёту
 * возвращает уже выпущенное предложение с прежним номером — так ведёт себя
 * расчётная часть (`DealScenarios.IssueAsync`), и интерфейс следует ей, а не
 * заводит своего учёта выпущенных номеров (R-036).
 *
 * Тело уходит всегда, пусть и пустым объектом: договор объявляет тело
 * необязательным, но запрос без него не несёт типа содержимого.
 *
 * @supports: R-036, R-037
 */
export function issueQuote(calculationId: string, body: QuoteRequest = {}): Promise<Quote> {
  return request<Quote>(`/v1/calculations/${calculationId}/quotes`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Адрес файла предложения. Путь приходит от службы полем `documentUrl`:
 * собирать его из идентификатора значило бы завести второй источник одного и
 * того же адреса.
 *
 * @supports: R-036
 */
export function quoteDocumentHref(quote: Quote): string {
  return fileHref(quote.documentUrl);
}

/**
 * Заявка на вывоз по выбранному полигону. Согласие на обработку персональных
 * данных приходит полем, а не подставляется здесь истиной: без него операция
 * договора отвечает отказом, и подставлять согласие за участника нельзя
 * (R-054).
 *
 * @supports: R-053, R-054
 */
export function createPickupRequest(body: PickupRequestInput): Promise<PickupRequest> {
  return request<PickupRequest>('/v1/pickup-requests', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
