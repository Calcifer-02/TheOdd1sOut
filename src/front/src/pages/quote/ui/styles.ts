/**
 * Оформление экрана предложения: правила, нужные только ему.
 *
 * Оформление самого документа живёт у сущности «коммерческое предложение» —
 * его показывает и витрина. Здесь остаётся раскладка экрана: колонка страницы
 * и перечень ранее выпущенных предложений, которых у документа нет.
 *
 * Прямые визуальные значения сюда не попадают — только роли из модуля токенов
 * (ADR-0008, инвариант 1).
 *
 * @supports: R-036, R-085
 * @adr: ADR-0008
 */
import { colors, fonts, radius, space } from '@/shared/ui/tokens';
import { useStyles } from '@/shared/ui';

export const QUOTE_SCREEN_CSS = `
.imolt-quote-screen {
  display: flex;
  flex-direction: column;
  gap: ${space.l}px;
}

.imolt-quote-history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${space.xs}px;
}

.imolt-quote-history-card {
  display: flex;
  flex-direction: column;
  gap: ${space.xxs}px;
  padding: ${space.s}px;
  background: ${colors.bgSurfaceMuted};
  border-radius: ${radius.field}px;
}

.imolt-quote-history-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${space.s}px;
}

.imolt-quote-history-sum {
  font-family: ${fonts.numeric};
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  white-space: nowrap;
}

.imolt-quote-history-meta {
  font-size: 12px;
  line-height: 16px;
  color: ${colors.textSecondary};
}
`;

/** Подключение оформления экрана. Имя — ключ подключения (`useStyles`). */
export function useQuoteScreenStyles(): void {
  useStyles('quote-screen', QUOTE_SCREEN_CSS);
}
