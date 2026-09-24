/**
 * Представление предложения на телефоне: одна колонка и нижняя панель.
 *
 * Лист A4 на ширине 390 не читается, поэтому документ разворачивается в
 * колонку, а строки состава становятся карточками. Панель действий прижата
 * книзу: итог и главное действие обязаны оставаться на виду, сколько бы строк
 * ни было (дизайн-договор, разд. 4.5; макет `ux/КП мобильный.dc.html`).
 *
 * Перечень ранее выпущенных предложений идёт карточками, а не таблицей: на
 * ширине 390 столбцы не читаются (R-085, AC-085a; AC-036h).
 *
 * @supports: R-036, R-037, R-059
 * @adr: ADR-0008
 */
import {
  PreliminaryPriceNotice,
  QuoteContacts,
  QuoteFacts,
  QuoteHeading,
  QuoteLineCards,
  QuoteTotal,
} from '@/entities/quote';
import { Notice } from '@/shared/ui';
import { formatMoney } from '@/shared/lib/formatting';
import type { QuoteHistoryState } from '../model/useQuoteHistory';
import { QUOTE_LABELS, type QuoteView } from '../model/view';
import { QuotePrimaryAction, QuoteSecondaryActions } from './QuoteActions';
import { QuoteHistoryCards } from './QuoteHistory';

export function QuoteMobile({
  view,
  calculationId,
  history,
  issuing,
  issueFailure,
  onIssue,
}: {
  view: QuoteView;
  calculationId: string;
  history: QuoteHistoryState;
  issuing: boolean;
  issueFailure: { title: string; detail?: string } | null;
  onIssue: () => void;
}) {
  return (
    <div className="imolt-quote-mobile">
      <article className="imolt-card" aria-label={QUOTE_LABELS.screen}>
        <QuoteHeading number={view.number} issuedAt={view.issuedAt} />
        <div className="imolt-quote-rule" />
        <h1 className="imolt-quote-title">{QUOTE_LABELS.screen}</h1>
        <QuoteFacts
          pickupAddress={view.pickupAddress}
          pricesUpdatedAt={view.pricesUpdatedAt}
          validUntil={view.validUntil}
        />
      </article>

      <QuoteLineCards lines={view.lines} />

      {view.omitted > 0 && (
        <Notice kind="warning">
          Расчёт не раскрыл ценами выбранные полигоны: {view.omitted}. Вернитесь к расчёту и выберите их заново
        </Notice>
      )}

      <QuoteTotal total={view.total} hint={view.totalHint} />

      <PreliminaryPriceNotice validUntil={view.validUntil} />

      {issueFailure !== null && (
        <Notice kind="error">
          {issueFailure.title}
          {issueFailure.detail !== undefined && `. ${issueFailure.detail}`}
        </Notice>
      )}

      <section className="imolt-card">
        <QuoteContacts />
      </section>

      <QuoteHistoryCards history={history} />

      <div className="imolt-bar" role="group" aria-label={QUOTE_LABELS.actions}>
        <div className="imolt-bar-line">
          <span className="imolt-quote-sum-label">К оплате</span>
          <span className="imolt-quote-sum-value">{view.total === null ? 'нет суммы' : formatMoney(view.total)}</span>
        </div>
        <div className="imolt-bar-actions">
          <QuotePrimaryAction view={view} issuing={issuing} onIssue={onIssue} />
        </div>
        <div className="imolt-bar-actions">
          <QuoteSecondaryActions calculationId={calculationId} />
        </div>
      </div>
    </div>
  );
}
