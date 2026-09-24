/**
 * Публичный вход сущности «коммерческое предложение».
 *
 * Наружу отдаются состав предложения и его части документа; внутренние пути
 * слайса закрыты — подключаться к ним в обход этого файла нельзя
 * (`tests/Layers.test.ts`).
 *
 * @supports: R-036, R-037, R-038, R-059
 * @adr: ADR-0008
 */
export { composeQuote } from './model/composition';
export type { CompositionSource, QuoteComposition, QuoteLine } from './model/composition';
export { useQuoteStyles } from './ui/styles';
export { QuoteHeading } from './ui/QuoteHeading';
export { QuoteFacts } from './ui/QuoteFacts';
export { QuoteLinesTable } from './ui/QuoteLinesTable';
export { QuoteLineCards } from './ui/QuoteLineCards';
export { QuoteTotal } from './ui/QuoteTotal';
export { PreliminaryPriceNotice } from './ui/PreliminaryPriceNotice';
export { QuoteContacts } from './ui/QuoteContacts';
