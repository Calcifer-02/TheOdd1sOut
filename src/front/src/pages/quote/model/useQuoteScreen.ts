/**
 * Модель экрана коммерческого предложения: одна на оба представления.
 *
 * Экран открывается по ссылке `#/quote?calc=<расчёт>` — и с экрана расчёта, и
 * из переписки, и после перезагрузки. Поэтому он не полагается на память
 * предыдущего экрана, а запрашивает расчёт заново (ADR-0008, инвариант 5).
 *
 * Выпуск предложения — отдельное действие пользователя, а не следствие
 * открытия экрана: закрепление номера и цен — коммерческий шаг, и делать его
 * молча при показе страницы нельзя (R-036). Повторный выпуск по тому же
 * расчёту служба возвращает прежним номером, а скачивание файла идёт по
 * адресу уже выпущенного предложения и выпуска не повторяет (`AC-036e`).
 *
 * @supports: R-036, R-037, R-059
 * @adr: ADR-0008
 */
import { useCallback, useEffect, useState } from 'react';
import { composeQuote, type QuoteComposition } from '@/entities/quote';
import type { Calculation, Quote } from '@/shared/api/contracts';
import { ApiProblem, getCalculation, issueQuote } from '@/shared/api/deals';
import { useRoute } from '@/shared/lib/routing';

/** Имя параметра адреса с идентификатором расчёта. Совпадает с экраном расчёта. */
export const CALCULATION_PARAMETER = 'calc';

/**
 * Отказ службы для экрана: заголовок, а не код. Код — внутреннее имя причины,
 * и показывать его пользователю нечего (ADR-0008, инвариант 4).
 */
export type Failure = { title: string; detail?: string };

export type QuoteScreenState =
  /** В адресе нет расчёта: показывать нечего, и надо объяснить, что делать. */
  | { kind: 'noCalculation' }
  | { kind: 'loading' }
  | { kind: 'failed'; failure: Failure }
  | {
      kind: 'ready';
      calculation: Calculation;
      composition: QuoteComposition;
      /** Выпущенное предложение; `null` — ещё не выпущено. */
      quote: Quote | null;
      issuing: boolean;
      issueFailure: Failure | null;
    };

export type QuoteScreen = {
  state: QuoteScreenState;
  /** Выпустить предложение по расчёту. */
  issue: () => void;
  /** Повторить неудавшуюся загрузку расчёта. */
  retry: () => void;
};

function failureOf(error: unknown): Failure {
  return error instanceof ApiProblem
    ? { title: error.title, detail: error.detail }
    : { title: 'Запрос не выполнен' };
}

export function useQuoteScreen(): QuoteScreen {
  const route = useRoute();
  const calculationId = route.query.get(CALCULATION_PARAMETER) ?? '';

  const [state, setState] = useState<QuoteScreenState>({ kind: 'loading' });
  // Счётчик попыток — способ перезапросить расчёт тем же действием: без него
  // повтор после отказа не отличался бы от первой загрузки.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (calculationId === '') {
      setState({ kind: 'noCalculation' });
      return;
    }

    // Ответ опоздавшего запроса не должен перерисовывать экран другого
    // расчёта: адрес меняется быстрее, чем отвечает служба.
    let current = true;
    setState({ kind: 'loading' });

    getCalculation(calculationId).then(
      (calculation) => {
        if (current) {
          setState({
            kind: 'ready',
            calculation,
            composition: composeQuote(calculation),
            quote: null,
            issuing: false,
            issueFailure: null,
          });
        }
      },
      (error: unknown) => {
        if (current) {
          setState({ kind: 'failed', failure: failureOf(error) });
        }
      },
    );

    return () => {
      current = false;
    };
  }, [calculationId, attempt]);

  const issue = useCallback(() => {
    // Выпущенное предложение не выпускается второй раз: номер закреплён, и
    // второй запрос сделал бы ссылку в переписке неоднозначной (R-036).
    if (state.kind !== 'ready' || state.quote !== null || state.issuing) {
      return;
    }

    setState({ ...state, issuing: true, issueFailure: null });

    issueQuote(calculationId).then(
      (quote) => {
        setState((previous) =>
          previous.kind === 'ready' ? { ...previous, quote, issuing: false } : previous,
        );
      },
      (error: unknown) => {
        setState((previous) =>
          previous.kind === 'ready'
            ? { ...previous, issuing: false, issueFailure: failureOf(error) }
            : previous,
        );
      },
    );
  }, [calculationId, state]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { state, issue, retry };
}
