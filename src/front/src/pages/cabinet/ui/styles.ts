/**
 * Оформление кабинета: правила, нужные только этому экрану.
 *
 * Держатся рядом с экраном, а не в общем файле темы: экраны пишутся
 * раздельно, и общий файл стилей стал бы местом, где правки сталкиваются
 * (ADR-0008, инвариант 1). Прямые визуальные значения сюда не попадают —
 * только роли из модуля токенов.
 *
 * @supports: R-049, R-052
 * @adr: ADR-0008
 */
import { colors, fonts, layout, radius, space } from '@/shared/ui/tokens';
import { BREAKPOINTS } from '@/shared/lib/viewport';

export const CABINET_CSS = `
.imolt-cabinet {
  display: grid;
  gap: ${space.l}px;
  width: 100%;
  max-width: ${BREAKPOINTS.container}px;
  margin: 0 auto;
}

.imolt-cabinet-layout {
  display: grid;
  gap: ${space.l}px;
  align-items: start;
}
.imolt-cabinet-layout--wide { grid-template-columns: 240px minmax(0, 1fr); }
.imolt-cabinet-aside { display: grid; gap: ${space.m}px; }
.imolt-cabinet-main { display: grid; gap: ${space.l}px; min-width: 0; }

.imolt-cabinet-section { display: grid; gap: ${space.m}px; align-content: start; }

.imolt-cabinet-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${space.m}px;
  flex-wrap: wrap;
}
.imolt-cabinet-heading { display: grid; gap: ${space.xxs}px; }

.imolt-cabinet-banner {
  display: flex;
  align-items: flex-start;
  gap: ${space.xs}px;
  padding: ${space.s}px ${space.m}px;
  border-radius: ${radius.field}px;
  background: ${colors.statusStaleBg};
  color: ${colors.statusStaleText};
  font-family: ${fonts.ui};
  font-size: 13px;
  line-height: 18px;
}

.imolt-calc-list { display: grid; gap: ${space.s}px; list-style: none; margin: 0; padding: 0; }
.imolt-calc-card {
  display: grid;
  gap: ${space.xs}px;
  padding: ${space.s}px ${space.m}px;
  border-radius: ${radius.field}px;
  background: ${colors.bgSurface};
}
.imolt-calc-line {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${space.s}px;
}
.imolt-calc-address { font-size: 15px; line-height: 21px; font-weight: 600; min-width: 0; }
.imolt-calc-total {
  font-family: ${fonts.numeric};
  font-size: 18px;
  line-height: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.imolt-calc-divider { height: 1px; background: ${colors.borderDivider}; }
.imolt-calc-meta { font-size: 12px; line-height: 16px; color: ${colors.textSecondary}; }

.imolt-cabinet-services { display: grid; gap: ${space.s}px; }
.imolt-cabinet-services--wide { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }

.imolt-service {
  display: flex;
  flex-direction: column;
  gap: ${space.s}px;
  padding: ${space.m}px;
  border-radius: ${radius.card}px;
  background: ${colors.bgSurface};
}
.imolt-service-name { font-size: 18px; line-height: 24px; font-weight: 700; text-wrap: pretty; }
.imolt-service-price-label { font-size: 12px; line-height: 16px; color: ${colors.textSecondary}; }
.imolt-service-price {
  font-family: ${fonts.numeric};
  font-size: 20px;
  line-height: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.imolt-service-grow { flex: 1; }
.imolt-service-order {
  display: grid;
  gap: ${space.s}px;
  padding-top: ${space.s}px;
  border-top: 1px solid ${colors.borderDivider};
}
.imolt-service-order-actions { display: flex; gap: ${space.xs}px; }
.imolt-service-order-actions > * { flex: 1; }

.imolt-textarea {
  width: 100%;
  min-height: ${layout.touchTarget * 2}px;
  padding: ${space.xs}px ${space.s}px;
  border: 1px solid ${colors.borderDefault};
  border-radius: ${radius.field}px;
  background: ${colors.bgSurface};
  font-family: ${fonts.ui};
  font-size: 16px;
  line-height: 22px;
  color: ${colors.textPrimary};
  resize: vertical;
}
.imolt-textarea:focus,
.imolt-textarea:focus-visible {
  outline: none;
  border-color: ${colors.link};
  box-shadow: inset 0 0 0 1px ${colors.link};
}

.imolt-cabinet-panel {
  display: grid;
  gap: ${space.s}px;
  padding: ${space.m}px;
  border-radius: ${radius.card}px;
  background: ${colors.bgSurface};
}

/* Вход в кабинет. Раскладка объявлена обоим представлениям, а не одному:
   класс без правила — мёртвый крючок, по которому нельзя отличить, что
   представление действительно разведено (R-085, AC-085a). */
.imolt-cabinet-entry { display: grid; gap: ${space.l}px; }
.imolt-cabinet-entry--narrow { grid-template-columns: minmax(0, 1fr); }

/* Рабочее место: объяснение занимает основную колонку, перечень возможностей —
   боковую той же ширины, что и сводка выбора на экране расчёта (разд. 4.4).
   Одна карточка в половину окна читается как обрезанная колонка телефона —
   это и было замечанием заказчика по стенду. */
.imolt-cabinet-entry--wide {
  grid-template-columns: minmax(0, 1fr) ${layout.sideColumnWidth}px;
}

/* Вес селектора взят вместе с «imolt-card» не для красоты: общее оформление
   подключается корнем приложения, а правила экрана — самим экраном, и лист
   общего слоя ложится в страницу последним. При равном весе он побеждает, и
   одиночное правило карточки входа теряло свой зазор молча. */
.imolt-card.imolt-cabinet-signin { display: grid; gap: ${space.m}px; align-content: start; }

/* Мера строки: во всю ширину основной колонки строка уходит за сотню знаков и
   перестаёт читаться (разд. 4.2). Предел — у текста, а не у карточки: белая
   поверхность держит ширину колонки. */
.imolt-cabinet-entry--wide .imolt-cabinet-signin > .imolt-lead,
.imolt-cabinet-entry--wide .imolt-cabinet-signin > .imolt-notice {
  max-width: 640px;
}

.imolt-card.imolt-cabinet-benefits { display: grid; gap: ${space.m}px; align-content: start; }
.imolt-cabinet-benefit-list { display: grid; gap: ${space.s}px; margin: 0; }
.imolt-cabinet-benefit { display: grid; gap: ${space.xxs}px; }
.imolt-cabinet-benefit-name { font-size: 15px; line-height: 21px; font-weight: 600; }
.imolt-cabinet-benefit-detail {
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: ${colors.textSecondary};
}

.imolt-cabinet-state { display: flex; align-items: center; gap: ${space.xs}px; flex-wrap: wrap; }

/* Только раскладка и размер: цвет, подчёркивание и видимый фокус ссылки
   объявлены один раз общим классом .imolt-link (BUG-002). Второе объявление
   тех же свойств разошлось бы с первым молча. */
.imolt-cabinet-link {
  font-family: ${fonts.ui};
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  justify-self: start;
}
`;
