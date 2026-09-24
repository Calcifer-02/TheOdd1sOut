/**
 * Оформление экрана, собранное из токенов дизайн-договора.
 *
 * Правила живут строкой стилей, а не в разметке: наведение, видимый фокус и
 * отключённое состояние встроенными стилями не выражаются, а дизайн-договор
 * требует их у каждого компонента (разд. 4.4). Значения берутся из `tokens.ts`
 * — прямых цветов и размеров здесь нет (ADR-0008, инвариант 1).
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import { colors, fonts, layout, radius, space } from './tokens';

export const THEME_CSS = `
*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  background: ${colors.bgPage};
  color: ${colors.textPrimary};
  font-family: ${fonts.ui};
  font-size: 16px;
  line-height: 24px;
  -webkit-font-smoothing: antialiased;
}

:focus-visible {
  outline: 2px solid ${colors.link};
  outline-offset: 2px;
}

.imolt-page {
  max-width: ${layout.screenWidth}px;
  margin: 0 auto;
  padding: 0 ${layout.gutter}px ${layout.touchTarget * 2}px;
  display: flex;
  flex-direction: column;
  gap: ${space.m}px;
}

.imolt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space.s}px;
  height: ${layout.fieldHeight}px;
  border-bottom: 1px solid ${colors.borderDefault};
}

.imolt-brand {
  font-weight: 700;
  font-size: 20px;
  line-height: 24px;
  color: ${colors.brand};
  letter-spacing: -0.01em;
}

h1.imolt-title { font-size: 26px; line-height: 32px; font-weight: 700; margin: ${space.xs}px 0 0; }
p.imolt-lead { margin: 0; color: ${colors.textSecondary}; font-size: 14px; line-height: 20px; }
h2.imolt-section { font-size: 20px; line-height: 26px; font-weight: 700; margin: ${space.xs}px 0 0; }

.imolt-card {
  background: ${colors.bgSurface};
  border-radius: ${radius.card}px;
  padding: ${space.m}px;
  display: flex;
  flex-direction: column;
  gap: ${space.s}px;
}

.imolt-label {
  display: block;
  font-size: 12px;
  line-height: 16px;
  color: ${colors.textPlaceholder};
  margin-bottom: ${space.xxs}px;
}

.imolt-input {
  width: 100%;
  height: ${layout.fieldHeight}px;
  padding: 0 ${space.s}px;
  border: 1px solid ${colors.borderDefault};
  border-radius: ${radius.field}px;
  background: ${colors.bgSurface};
  font-family: ${fonts.ui};
  font-size: 16px;
  color: ${colors.textPrimary};
}

/* Фокус меняет цвет собственной рамки поля и уплотняет её изнутри. Второе
   кольцо поверх первого читается как дефект, а толщина рядом с цветом
   оставляет признак фокуса заметным и без различения цветов. */
.imolt-input:focus,
.imolt-input:focus-visible {
  outline: none;
  border-color: ${colors.link};
  box-shadow: inset 0 0 0 1px ${colors.link};
}
.imolt-input[aria-invalid='true'] { border-color: ${colors.statusBlockedText}; }

.imolt-hint { font-size: 12px; line-height: 16px; color: ${colors.textSecondary}; }
.imolt-error { font-size: 12px; line-height: 16px; color: ${colors.statusBlockedText}; }

.imolt-suggest {
  list-style: none;
  margin: ${space.xxs}px 0 0;
  padding: ${space.xxs}px;
  border: 1px solid ${colors.borderDefault};
  border-radius: ${radius.field}px;
  background: ${colors.bgSurface};
  box-shadow: ${layout.shadow};
  max-height: ${layout.touchTarget * 6}px;
  overflow-y: auto;
}

.imolt-suggest button {
  display: block;
  width: 100%;
  min-height: ${layout.touchTarget}px;
  padding: ${space.xs}px ${space.s}px;
  border: 0;
  border-radius: ${radius.badge}px;
  background: none;
  text-align: left;
  font-family: ${fonts.ui};
  font-size: 14px;
  color: ${colors.textPrimary};
  cursor: pointer;
}

.imolt-suggest button:hover { background: ${colors.accentRowHover}; }

.imolt-row { display: flex; gap: ${space.xs}px; align-items: flex-end; }
.imolt-row > * { min-width: 0; }
.imolt-grow { flex: 1; }

.imolt-units { display: flex; gap: ${space.xxs}px; }

/* Переключатель: нативный radio скрыт визуально, но остаётся в потоке фокуса
   и объявляется вспомогательной технологии. */
.imolt-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: ${layout.touchTarget}px;
  min-height: 36px;
  padding: 0 ${space.s}px;
  border: 1px solid ${colors.borderDefault};
  border-radius: ${radius.pill}px;
  background: ${colors.bgSurface};
  font-family: ${fonts.ui};
  font-size: 14px;
  color: ${colors.textSecondary};
  cursor: pointer;
  white-space: nowrap;
  flex: none;
}

/* Переключатель меры стоит рядом с полем количества и обязан быть той же
   высоты: два соседних управления разной высоты читаются как сбой вёрстки. */
.imolt-units .imolt-pill { border-radius: ${radius.field}px; min-height: ${layout.fieldHeight}px; }

.imolt-pill input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.imolt-pill { position: relative; }

.imolt-pill[data-checked='true'] {
  background: ${colors.accentDark};
  border-color: ${colors.accentDark};
  color: ${colors.onAccentDark};
}

.imolt-pill:has(input:focus-visible) {
  outline: 2px solid ${colors.link};
  outline-offset: 2px;
}

.imolt-button {
  min-height: ${layout.fieldHeight}px;
  padding: 0 ${space.l}px;
  border: 0;
  border-radius: ${radius.pill}px;
  background: ${colors.accentPrimary};
  color: ${colors.textPrimary};
  font-family: ${fonts.ui};
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}

.imolt-button:hover { background: ${colors.accentPrimaryHover}; }
.imolt-button:disabled { background: ${colors.accentPrimaryDisabled}; color: ${colors.disabledText}; cursor: default; }

.imolt-button--secondary {
  min-height: ${layout.touchTarget + 4}px;
  background: ${colors.accentDark};
  color: ${colors.onAccentDark};
  font-weight: 500;
}

.imolt-button--secondary:hover { background: ${colors.accentDark}; opacity: 0.9; }

.imolt-button--tertiary {
  min-height: ${layout.touchTarget}px;
  padding: 0;
  background: none;
  color: ${colors.link};
  font-weight: 500;
  text-decoration: underline;
}

.imolt-button--tertiary:hover { background: none; }

.imolt-sorts-line { display: flex; align-items: center; gap: ${space.xs}px; flex-wrap: wrap; }

.imolt-tabs, .imolt-sorts, .imolt-chips {
  display: flex;
  gap: ${space.xs}px;
  overflow-x: auto;
  padding-bottom: ${space.xxs}px;
}

.imolt-tab, .imolt-sort, .imolt-chip {
  flex: none;
  min-height: 36px;
  padding: 0 ${space.s}px;
  border: 1px solid ${colors.borderDefault};
  border-radius: ${radius.pill}px;
  background: ${colors.bgSurface};
  font-family: ${fonts.ui};
  font-size: 14px;
  color: ${colors.textSecondary};
  cursor: pointer;
  white-space: nowrap;
}

.imolt-tab[aria-selected='true'], .imolt-sort[aria-pressed='true'], .imolt-chip[aria-pressed='true'] {
  background: ${colors.accentDark};
  border-color: ${colors.accentDark};
  color: ${colors.onAccentDark};
}

.imolt-options {
  display: flex;
  flex-direction: column;
  gap: ${space.xs}px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.imolt-option {
  background: ${colors.bgSurface};
  border-radius: ${radius.field}px;
  border-left: 4px solid transparent;
  padding: ${space.s}px;
  display: flex;
  flex-direction: column;
  gap: ${space.xs}px;
}

.imolt-option:hover { background: ${colors.accentRowHover}; }
.imolt-option[data-selected='true'] { border-left-color: ${colors.accentPrimary}; }
.imolt-option[data-blocked='true'] .imolt-option-name { color: ${colors.textSecondary}; }

.imolt-option-head { display: flex; gap: ${space.s}px; align-items: flex-start; }
.imolt-option-name { font-size: 16px; line-height: 22px; font-weight: 600; }
.imolt-option-address { font-size: 12px; line-height: 16px; color: ${colors.textSecondary}; }

.imolt-total {
  font-family: ${fonts.numeric};
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 20px;
  line-height: 24px;
  white-space: nowrap;
}

.imolt-split {
  display: flex;
  gap: ${space.s}px;
  font-family: ${fonts.numeric};
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  line-height: 18px;
  color: ${colors.textSecondary};
  flex-wrap: wrap;
}

/* Полоса над экраном: та же колонка, что у страницы. Без неё содержимое
   растекается на всю ширину окна и поля выглядят непомерно широкими. */
.imolt-band {
  max-width: ${layout.screenWidth}px;
  margin: 0 auto;
  padding: ${space.m}px ${layout.gutter}px 0;
}

/* Строка согласия: флажок и подпись на одной оптической линии. */
.imolt-consent {
  display: flex;
  align-items: center;
  gap: ${space.xs}px;
  min-height: ${layout.touchTarget}px;
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;
}

/* Флажок рисуется сам: базовый вид браузера не принадлежит дизайн-договору
   и на разных платформах выглядит по-разному. Размер — та же цель касания,
   галочка — повёрнутый угол рамки, поэтому прямых цветов здесь нет. */
.imolt-check {
  appearance: none;
  -webkit-appearance: none;
  width: ${space.l}px;
  height: ${space.l}px;
  flex: none;
  margin: 0;
  display: inline-grid;
  place-content: center;
  border: 2px solid ${colors.borderDefault};
  border-radius: ${radius.badge}px;
  background: ${colors.bgSurface};
  color: ${colors.accentDark};
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease;
}

.imolt-check::after {
  content: '';
  width: 10px;
  height: 5px;
  border-left: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(-45deg) translate(1px, -1px);
  opacity: 0;
}

.imolt-check:hover { border-color: ${colors.accentDark}; }

.imolt-check:checked {
  background: ${colors.accentPrimary};
  border-color: ${colors.accentDark};
}

.imolt-check:checked::after { opacity: 1; }

/* В карточке полигона флажок стоит против названия, а не против середины
   карточки: название — первая строка блока. */
.imolt-option-head > .imolt-check { align-self: flex-start; margin-top: 2px; }

.imolt-badge {
  display: inline-flex;
  align-items: center;
  gap: ${space.xxs}px;
  padding: ${space.xxs}px ${space.xs}px;
  border-radius: ${radius.badge}px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
}

.imolt-badge[data-status='active'] { background: ${colors.statusActiveBg}; color: ${colors.statusActiveText}; }
.imolt-badge[data-status='blocked'] { background: ${colors.statusBlockedBg}; color: ${colors.statusBlockedText}; }
.imolt-badge[data-status='stale'] { background: ${colors.statusStaleBg}; color: ${colors.statusStaleText}; }
.imolt-badge[data-status='unconfirmed'] { background: ${colors.statusUnknownBg}; color: ${colors.statusUnknownText}; }

.imolt-notice {
  padding: ${space.s}px;
  border-radius: ${radius.field}px;
  font-size: 14px;
  line-height: 20px;
  display: flex;
  flex-direction: column;
  gap: ${space.xs}px;
  align-items: flex-start;
}

.imolt-notice[data-kind='error'] { background: ${colors.statusBlockedBg}; color: ${colors.statusBlockedText}; }
.imolt-notice[data-kind='warning'] { background: ${colors.statusStaleBg}; color: ${colors.statusStaleText}; }
.imolt-notice[data-kind='empty'] { background: ${colors.bgSurfaceMuted}; color: ${colors.textSecondary}; }
.imolt-notice[data-kind='done'] { background: ${colors.statusActiveBg}; color: ${colors.statusActiveText}; }

.imolt-freshness { font-size: 12px; line-height: 16px; color: ${colors.textSecondary}; }

.imolt-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${colors.bgSurface};
  box-shadow: ${layout.shadow};
  padding: ${space.s}px ${layout.gutter}px;
  display: flex;
  flex-direction: column;
  gap: ${space.xs}px;
}

.imolt-bar-line { display: flex; align-items: center; justify-content: space-between; gap: ${space.s}px; }
.imolt-bar-actions { display: flex; gap: ${space.xs}px; }
.imolt-bar-actions > * { flex: 1; }

.imolt-skeleton {
  height: 92px;
  border-radius: ${radius.field}px;
  background: ${colors.bgSurfaceMuted};
}

.imolt-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${colors.bgSurface};
  border-radius: ${radius.card}px ${radius.card}px 0 0;
  box-shadow: ${layout.shadow};
  padding: ${space.m}px;
  display: flex;
  flex-direction: column;
  gap: ${space.s}px;
  max-height: 90vh;
  overflow-y: auto;
}

.imolt-map {
  height: 120px;
  border-radius: ${radius.field}px;
  background: ${colors.bgSurfaceMuted};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${colors.textPlaceholder};
  font-size: 12px;
}

.imolt-allocation { display: flex; flex-direction: column; gap: ${space.xs}px; }
.imolt-allocation-row { display: flex; align-items: center; gap: ${space.xs}px; }
.imolt-allocation-row .imolt-input { width: 96px; height: ${layout.touchTarget}px; }

.imolt-consent { display: flex; gap: ${space.xs}px; align-items: flex-start; font-size: 13px; line-height: 18px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;
