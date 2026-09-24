/**
 * Оформление экрана справочника полигонов.
 *
 * Правила объявлены рядом с экраном и подключаются по имени: общий файл
 * стилей стал бы местом, где правки разных экранов сталкиваются (пояснение в
 * `@/shared/ui/useStyles`). Прямых значений здесь нет — только роли токенов
 * (ADR-0008, инвариант 1).
 *
 * Точки перелома — из дизайн-договора, разд. 4.5: 1024 — карточка полигона
 * уходит в боковую колонку, 768 — числовые столбцы сворачиваются.
 *
 * @supports: R-040
 * @adr: ADR-0008
 */
import { colors, fonts, radius, space } from '@/shared/ui/tokens';
import { BREAKPOINTS } from '@/shared/lib/viewport';

export const LANDFILLS_CSS = `
.imolt-landfills {
  display: grid;
  gap: ${space.m}px;
}

.imolt-landfills-band {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space.xs}px ${space.m}px;
  padding: ${space.s}px ${space.m}px;
  border-radius: ${radius.field}px;
  background: ${colors.bgSurfaceMuted};
  color: ${colors.textSecondary};
  font-size: 14px;
  line-height: 20px;
}

.imolt-landfills-filters {
  display: grid;
  gap: ${space.s}px;
}

.imolt-landfills-search {
  display: flex;
  align-items: flex-end;
  gap: ${space.xs}px;
}

.imolt-landfills-groups {
  display: flex;
  flex-wrap: wrap;
  gap: ${space.xs}px;
}

.imolt-landfills-count {
  color: ${colors.textSecondary};
  font-size: 14px;
  line-height: 20px;
}

.imolt-landfills-body {
  display: grid;
  gap: ${space.m}px;
  align-items: start;
}

@media (min-width: ${BREAKPOINTS.sideSummary}px) {
  .imolt-landfills-body[data-card="open"] {
    grid-template-columns: minmax(0, 1fr) 380px;
  }
}

.imolt-landfills-table table {
  width: 100%;
  border-collapse: collapse;
}

.imolt-landfill-name {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${space.xxs}px;
  min-width: 0;
}

.imolt-landfill-address {
  color: ${colors.textSecondary};
  font-size: 14px;
  line-height: 20px;
}

.imolt-landfill-cards {
  display: grid;
  gap: ${space.s}px;
}

.imolt-landfill-card {
  display: grid;
  gap: ${space.xs}px;
  padding: ${space.m}px;
  border: 1px solid ${colors.borderDefault};
  border-radius: ${radius.field}px;
  background: ${colors.bgSurface};
}

.imolt-landfill-card[data-status="blocked"] {
  border-color: ${colors.statusBlockedText};
}

.imolt-landfill-card-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space.xs}px;
}

.imolt-tariffs {
  margin: 0;
  display: grid;
  gap: ${space.xxs}px;
}

.imolt-tariffs-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: ${space.s}px;
  align-items: baseline;
}

.imolt-tariffs dt {
  color: ${colors.textSecondary};
  font-size: 14px;
  line-height: 20px;
  min-width: 0;
}

.imolt-tariffs dd {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: ${space.xxs}px;
  text-align: right;
}

.imolt-tariffs-price {
  font-family: ${fonts.numeric};
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.imolt-tariffs-none {
  margin: 0;
  color: ${colors.textSecondary};
  font-size: 14px;
  line-height: 20px;
}

.imolt-landfill-details {
  display: grid;
  gap: ${space.m}px;
}

.imolt-landfill-history {
  margin: 0;
  display: grid;
  gap: ${space.xxs}px;
  list-style: none;
  padding: 0;
  color: ${colors.textSecondary};
  font-size: 14px;
  line-height: 20px;
}
`;
