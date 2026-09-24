/**
 * Оформление коммерческого предложения (макеты `ux/КП.dc.html` и
 * `ux/КП мобильный.dc.html`).
 *
 * Правила объявлены рядом со своими компонентами и подключаются по имени:
 * общий файл стилей стал бы местом, где правки разных экранов сталкиваются
 * (`@/shared/ui/useStyles`).
 *
 * Размеры листа — не токен оформления, а формат печати: A4 задан стандартом
 * и назван в дизайн-договоре (разд. 5, Э-07). Поэтому он объявлен здесь
 * именованной величиной, а не значением врассыпную.
 *
 * @supports: R-037
 * @adr: ADR-0008
 */
import { colors, fonts, layout, radius, space } from '@/shared/ui/tokens';
import { useStyles } from '@/shared/ui';

/** Лист документа: формат A4 и поля печати из макета Э-07. */
const SHEET = { width: '210mm', height: '297mm', margin: '16mm' } as const;

/** Столбцы карточки строки на телефоне: две колонки чисел под названием. */
const CARD_COLUMNS = 2;

const QUOTE_CSS = `
.imolt-quote-desk {
  display: grid;
  grid-template-columns: ${SHEET.width} minmax(240px, 1fr);
  gap: ${space.l}px;
  align-items: start;
  justify-content: center;
  padding: ${space.l}px 0;
}

.imolt-quote-sheet {
  width: ${SHEET.width};
  min-height: ${SHEET.height};
  padding: ${SHEET.margin};
  background: ${colors.bgSurface};
  box-shadow: ${layout.shadow};
  display: flex;
  flex-direction: column;
  gap: ${space.m}px;
}

.imolt-quote-mobile {
  display: flex;
  flex-direction: column;
  gap: ${space.m}px;
  /* Запас под прижатую книзу панель действий: без него последняя карточка
     уезжает под неё и дочитать её нечем. */
  padding-bottom: ${layout.touchTarget * 3}px;
}

/* Скачивание — ссылка в виде кнопки: подчёркивание сделало бы её похожей на
   строку текста, а не на действие. */
.imolt-quote-link { text-decoration: none; }

.imolt-quote-aside {
  position: sticky;
  top: ${space.m}px;
  display: flex;
  flex-direction: column;
  gap: ${space.xs}px;
  padding: ${space.m}px;
  background: ${colors.bgSurface};
  border-radius: ${radius.card}px;
}

.imolt-quote-brand {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${space.m}px;
}

.imolt-quote-mark {
  font-weight: 700;
  font-size: 26px;
  line-height: 30px;
  color: ${colors.brand};
  letter-spacing: -0.01em;
}

.imolt-quote-tagline { font-size: 11px; line-height: 16px; color: ${colors.textSecondary}; }

.imolt-quote-number {
  text-align: right;
  font-family: ${fonts.numeric};
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: 13px;
  line-height: 18px;
  color: ${colors.textPrimary};
}

.imolt-quote-number span { display: block; font-weight: 400; color: ${colors.textSecondary}; }

.imolt-quote-rule { height: 1px; background: ${colors.textPrimary}; }

.imolt-quote-title {
  margin: 0;
  font-size: 24px;
  line-height: 30px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.imolt-quote-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: ${space.s}px;
  padding: ${space.s}px ${space.m}px;
  background: ${colors.bgSurfaceMuted};
  border-radius: ${radius.field}px;
}

.imolt-quote-fact { display: flex; flex-direction: column; gap: ${space.xxs}px; min-width: 0; }

.imolt-quote-fact dt {
  font-size: 10px;
  line-height: 14px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${colors.textSecondary};
}

.imolt-quote-fact dd { margin: 0; font-size: 13px; line-height: 18px; font-weight: 500; }

.imolt-quote-fact dd time {
  font-family: ${fonts.numeric};
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.imolt-quote-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid ${colors.borderDivider};
  border-radius: ${radius.field}px;
  overflow: hidden;
}

.imolt-quote-table caption {
  text-align: left;
  padding-bottom: ${space.xs}px;
  font-size: 10px;
  line-height: 14px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${colors.textSecondary};
}

.imolt-quote-table th,
.imolt-quote-table td {
  padding: ${space.s}px ${space.xs}px;
  border-top: 1px solid ${colors.borderDivider};
  text-align: left;
  vertical-align: top;
  font-size: 12px;
  line-height: 17px;
}

.imolt-quote-table thead th {
  background: ${colors.bgSurfaceMuted};
  border-top: 0;
  font-weight: 500;
  font-size: 10px;
  line-height: 13px;
  color: ${colors.textSecondary};
}

.imolt-quote-table [data-align='end'] {
  text-align: right;
  font-family: ${fonts.numeric};
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  white-space: nowrap;
}

.imolt-quote-table tbody td[data-total='true'] { font-weight: 700; font-size: 13px; }

.imolt-quote-table tfoot th,
.imolt-quote-table tfoot td {
  background: ${colors.bgSurfaceMuted};
  border-top: 1px solid ${colors.textPrimary};
  font-weight: 600;
}

.imolt-quote-table tfoot td[data-align='end'] { font-weight: 700; font-size: 16px; line-height: 20px; }

.imolt-quote-line-name { font-weight: 500; }

.imolt-quote-line-place { font-size: 11px; line-height: 15px; color: ${colors.textSecondary}; }

.imolt-quote-cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: ${space.xs}px; }

.imolt-quote-card {
  background: ${colors.bgSurface};
  border-radius: ${radius.field}px;
  padding: ${space.s}px;
  display: flex;
  flex-direction: column;
  gap: ${space.xs}px;
}

.imolt-quote-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: ${space.s}px; }

.imolt-quote-card-sum {
  font-family: ${fonts.numeric};
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 17px;
  line-height: 23px;
  white-space: nowrap;
}

.imolt-quote-card-facts {
  display: grid;
  grid-template-columns: repeat(${CARD_COLUMNS}, minmax(0, 1fr));
  gap: ${space.xs}px ${space.s}px;
  margin: 0;
  border-top: 1px solid ${colors.borderDivider};
  padding-top: ${space.xs}px;
}

.imolt-quote-card-facts dt { font-size: 11px; line-height: 15px; color: ${colors.textSecondary}; }

.imolt-quote-card-facts dd {
  margin: 0;
  font-family: ${fonts.numeric};
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: 13px;
  line-height: 18px;
}

.imolt-quote-sum {
  display: flex;
  flex-direction: column;
  gap: ${space.xs}px;
  padding: ${space.m}px;
  border: 1px solid ${colors.textPrimary};
  border-radius: ${radius.field}px;
  background: ${colors.bgSurface};
}

.imolt-quote-sum-line { display: flex; align-items: baseline; justify-content: space-between; gap: ${space.m}px; }

.imolt-quote-sum-label { font-weight: 600; font-size: 14px; line-height: 20px; }

.imolt-quote-sum-value {
  font-family: ${fonts.numeric};
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 22px;
  line-height: 26px;
}

.imolt-quote-sum-hint { font-size: 12px; line-height: 16px; color: ${colors.textSecondary}; }

.imolt-quote-note {
  padding: ${space.s}px ${space.m}px;
  background: ${colors.bgSurfaceMuted};
  border-radius: ${radius.field}px;
  font-size: 12px;
  line-height: 17px;
  color: ${colors.textSecondary};
}

.imolt-quote-note strong { color: ${colors.textPrimary}; }

.imolt-quote-contacts {
  display: flex;
  flex-direction: column;
  gap: ${space.xxs}px;
  padding-top: ${space.s}px;
  border-top: 1px solid ${colors.borderDivider};
  font-size: 11px;
  line-height: 16px;
  color: ${colors.textSecondary};
}

.imolt-quote-contacts a { color: ${colors.link}; }

.imolt-quote-spacer { flex: 1; min-height: ${space.l}px; }
`;

/**
 * Подключение оформления предложения. Вызывается и экраном, и витриной:
 * образец без своих правил показывал бы не то, что увидит пользователь.
 */
export function useQuoteStyles(): void {
  useStyles('quote', QUOTE_CSS);
}
