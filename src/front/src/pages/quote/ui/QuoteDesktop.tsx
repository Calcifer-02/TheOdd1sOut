/**
 * Представление предложения на рабочем месте: печатный лист A4 по центру и
 * действия сбоку.
 *
 * Лист показан целиком и в тех же пропорциях, в каких он уйдёт в файл: КП
 * показывают директору, и увиденное на экране обязано совпасть с тем, что
 * откроется из вложения (дизайн-договор, разд. 5, Э-07).
 *
 * @supports: R-036, R-037, R-059
 * @adr: ADR-0008
 */
import {
  PreliminaryPriceNotice,
  QuoteContacts,
  QuoteFacts,
  QuoteHeading,
  QuoteLinesTable,
  QuoteTotal,
} from '@/entities/quote';
import { Notice } from '@/shared/ui';
import { QUOTE_LABELS, type QuoteView } from '../model/view';
import { QuotePrimaryAction, QuoteSecondaryActions } from './QuoteActions';

export function QuoteDesktop({
  view,
  issuing,
  issueFailure,
  onIssue,
}: {
  view: QuoteView;
  issuing: boolean;
  issueFailure: { title: string; detail?: string } | null;
  onIssue: () => void;
}) {
  return (
    <div className="imolt-quote-desk">
      <article className="imolt-quote-sheet" aria-label={QUOTE_LABELS.screen}>
        <QuoteHeading number={view.number} issuedAt={view.issuedAt} />
        <div className="imolt-quote-rule" />

        <h1 className="imolt-quote-title">{QUOTE_LABELS.screen}</h1>

        <QuoteFacts
          pickupAddress={view.pickupAddress}
          pricesUpdatedAt={view.pricesUpdatedAt}
          validUntil={view.validUntil}
        />

        <QuoteLinesTable lines={view.lines} total={view.total} />

        {view.omitted > 0 && (
          <Notice kind="warning">
            Расчёт не раскрыл ценами выбранные полигоны: {view.omitted}. Вернитесь к расчёту и выберите их заново
          </Notice>
        )}

        <PreliminaryPriceNotice validUntil={view.validUntil} />

        <div className="imolt-quote-spacer" />

        <QuoteContacts />
      </article>

      <aside className="imolt-quote-aside" aria-label={QUOTE_LABELS.actions}>
        <QuoteTotal total={view.total} hint={view.totalHint} />

        {issueFailure !== null && (
          <Notice kind="error">
            {issueFailure.title}
            {issueFailure.detail !== undefined && `. ${issueFailure.detail}`}
          </Notice>
        )}

        <QuotePrimaryAction view={view} issuing={issuing} onIssue={onIssue} />
        <QuoteSecondaryActions />
      </aside>
    </div>
  );
}
