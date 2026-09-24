/**
 * Экран коммерческого предложения (Э-07): одна модель, два представления.
 *
 * Сюда приводит кнопка «Скачать КП» с экрана расчёта и ссылка
 * `#/quote?calc=<расчёт>` из переписки. Этап пути один и тот же: клиент
 * закрепляет результат, чтобы показать его директору (`ux/КАРТА_ПУТИ_
 * ПОЛЬЗОВАТЕЛЯ.md`, путь 1 этап 5 и путь 2 этап 6).
 *
 * Модель вызывается здесь, а не внутри представлений: смена ширины окна
 * меняет разметку, но не должна заново запрашивать расчёт и тем более
 * выпускать предложение.
 *
 * Каждое состояние названо словом. Пустой экран вместо объяснения — самый
 * дорогой из отказов: пользователь не знает, что делать дальше. Состояние без
 * расчёта в адресе перестало быть тупиком: пункт шапки ведёт сюда всегда, и
 * опознанному участнику здесь показывается перечень ранее выпущенных
 * предложений (решение заказчика от 24.09.2026, AC-036h).
 *
 * @supports: R-036, R-037, R-038, R-059
 * @adr: ADR-0008
 */
import { useQuoteStyles } from '@/entities/quote';
import { Notice } from '@/shared/ui';
import { CALCULATOR_PATH, useNavigate } from '@/shared/lib/routing';
import { isWide, useViewport } from '@/shared/lib/viewport';
import { useQuoteHistory } from '../model/useQuoteHistory';
import { useQuoteScreen } from '../model/useQuoteScreen';
import { QUOTE_LABELS, quoteView } from '../model/view';
import { QuoteDesktop } from './QuoteDesktop';
import { QuoteHistoryCards, QuoteHistoryTable } from './QuoteHistory';
import { QuoteMobile } from './QuoteMobile';
import { useQuoteScreenStyles } from './styles';

export function QuotePage() {
  useQuoteStyles();
  useQuoteScreenStyles();

  // Перечень запрашивается до разбора состояния экрана: он не зависит от того,
  // назван ли расчёт в адресе, а перенос вызова внутрь ветки сделал бы порядок
  // подключений React разным у разных состояний.
  const history = useQuoteHistory();
  const { state, calculationId, issue, retry } = useQuoteScreen();
  const viewport = useViewport();
  const navigate = useNavigate();
  const wide = isWide(viewport);

  if (state.kind === 'noCalculation') {
    return (
      <div className="imolt-quote-screen">
        <section className="imolt-card">
          <h1 className="imolt-quote-title">{QUOTE_LABELS.screen}</h1>
          <Notice kind="empty">
            Предложение выпускается по расчёту, а расчёт в ссылке не назван. Вернитесь к расчёту, выберите полигоны и
            нажмите «Сформировать предложение»
          </Notice>
          <button
            type="button"
            className="imolt-button imolt-button--secondary"
            onClick={() => navigate(CALCULATOR_PATH)}
          >
            {QUOTE_LABELS.backToCalculation}
          </button>
        </section>

        {/* Текущего предложения здесь нет и выдумать его нечем: показывается
            только то, что уже выпущено, либо причина, по которой перечень
            закрыт. */}
        {wide ? <QuoteHistoryTable history={history} /> : <QuoteHistoryCards history={history} />}
      </div>
    );
  }

  if (state.kind === 'loading') {
    return (
      <section className="imolt-card">
        <h1 className="imolt-quote-title">{QUOTE_LABELS.screen}</h1>
        <p className="imolt-lead" role="status">
          Загружаем расчёт
        </p>
      </section>
    );
  }

  if (state.kind === 'failed') {
    // Показывается заголовок отказа, а не его код: код — внутреннее имя
    // причины (ADR-0008, инвариант 4).
    return (
      <section className="imolt-card">
        <h1 className="imolt-quote-title">{state.failure.title}</h1>
        {state.failure.detail !== undefined && <p className="imolt-lead">{state.failure.detail}</p>}
        <div className="imolt-bar-actions">
          <button type="button" className="imolt-button" onClick={retry}>
            {QUOTE_LABELS.retry}
          </button>
          <button
            type="button"
            className="imolt-button imolt-button--tertiary"
            onClick={() => navigate(CALCULATOR_PATH)}
          >
            {QUOTE_LABELS.backToCalculation}
          </button>
        </div>
      </section>
    );
  }

  const view = quoteView(state);

  return wide ? (
    <QuoteDesktop
      view={view}
      calculationId={calculationId}
      history={history}
      issuing={state.issuing}
      issueFailure={state.issueFailure}
      onIssue={issue}
    />
  ) : (
    <QuoteMobile
      view={view}
      calculationId={calculationId}
      history={history}
      issuing={state.issuing}
      issueFailure={state.issueFailure}
      onIssue={issue}
    />
  );
}
