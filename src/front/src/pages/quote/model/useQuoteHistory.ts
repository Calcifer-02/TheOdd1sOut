/**
 * Ранее выпущенные предложения: перечень под текущим документом.
 *
 * Экран предложения перестал быть тупиком без расчёта в адресе: пункт шапки
 * ведёт сюда всегда, и показывать «нечего показать» участнику, у которого
 * предложения уже выпущены, нельзя (решение заказчика от 24.09.2026, AC-036h).
 *
 * Своего учёта выпущенных предложений интерфейс не заводит: перечень строится
 * по сохранённым расчётам участника, а выпущенным считается тот расчёт, чей
 * номер предложения назвала служба (`CalculationSummary.quoteNumber`).
 *
 * Операция требует опознанного участника, и без сессии обращение не
 * отправляется вовсе: отказ вместо объяснения оставил бы человека без ответа
 * на вопрос «почему» (R-050, ADR-0006). Слова об устройстве доступа берутся у
 * сущности «участник» — вторая редакция того же объяснения разошлась бы с
 * первой молча (BUG-012).
 *
 * Отказ в перечне не трогает текущее предложение: это разные запросы и разные
 * части экрана, и закрытая история не отменяет выпуска документа.
 *
 * @supports: R-036, R-049, R-050
 * @adr: ADR-0006
 */
import { useEffect, useState } from 'react';
import { IDENTITY_FROM_MAX, accessRefusalLine, useParticipant } from '@/entities/participant';
import { listCalculations, type CalculationSummary } from '@/shared/api/cabinet';
import { ApiProblem } from '@/shared/api/http';
import type { Money } from '@/shared/lib/formatting';
import { hashOf } from '@/shared/lib/routing';
import { QUOTE_PATH } from './useQuoteScreen';
import { QUOTE_LABELS, calculationQuery } from './view';

/**
 * Сколько расчётов участника просматривается за раз. Страница берётся одна:
 * перечень стоит под документом и служит возвратом к недавнему предложению, а
 * полный список сохранённых расчётов живёт в кабинете (R-049).
 */
export const HISTORY_PAGE = 20;

/** Строка перечня: ни одно поле здесь не вычисляется заново. */
export type QuoteHistoryRow = {
  calculationId: string;
  number: string;
  /** Дата расчёта: даты выпуска перечень сохранённых расчётов не несёт. */
  createdAt: string;
  pickupAddress: string;
  total: Money;
  /** Адрес этого же экрана с расчётом строки. */
  href: string;
};

export type QuoteHistoryState =
  | { kind: 'loading' }
  /** Перечень недоступен: причина названа словом, а не пустотой. */
  | { kind: 'closed'; reason: string }
  | { kind: 'ready'; rows: QuoteHistoryRow[] };

/**
 * Строка перечня по сохранённому расчёту. Расчёт без выпущенного предложения
 * даёт пустой список и в перечень не попадает: номер не пуст ровно у тех
 * расчётов, по которым предложение выпущено (AC-036h).
 */
function rowsOf(summary: CalculationSummary): QuoteHistoryRow[] {
  const number = summary.quoteNumber ?? '';

  if (number === '') {
    return [];
  }

  return [
    {
      calculationId: summary.id,
      number,
      createdAt: summary.createdAt,
      pickupAddress: summary.pickupAddress,
      total: summary.total,
      href: hashOf(QUOTE_PATH, calculationQuery(summary.id)),
    },
  ];
}

/**
 * Причина, по которой перечня нет. Отказ по личности и праву объясняет
 * сущность «участник»; всякий иной отказ остаётся словами службы, а её код на
 * экран не выходит (ADR-0008, инвариант 4).
 */
function reasonOf(error: unknown): string {
  const explained = accessRefusalLine(error);

  if (explained !== '') {
    return explained;
  }

  if (error instanceof ApiProblem) {
    return error.title;
  }

  return QUOTE_LABELS.historyFailed;
}

export function useQuoteHistory(): QuoteHistoryState {
  const participant = useParticipant();
  const identified = participant !== null;

  const [state, setState] = useState<QuoteHistoryState>({ kind: 'loading' });

  useEffect(() => {
    if (!identified) {
      setState({ kind: 'closed', reason: IDENTITY_FROM_MAX });
      return;
    }

    // Ответ опоздавшего запроса не перерисовывает экран, который его уже не
    // ждёт: участник опознаётся и забывается без перезагрузки страницы.
    let current = true;
    setState({ kind: 'loading' });

    listCalculations(HISTORY_PAGE, 0).then(
      page => {
        if (current) {
          setState({ kind: 'ready', rows: page.items.flatMap(rowsOf) });
        }
      },
      (error: unknown) => {
        if (current) {
          setState({ kind: 'closed', reason: reasonOf(error) });
        }
      },
    );

    return () => {
      current = false;
    };
  }, [identified]);

  return state;
}
