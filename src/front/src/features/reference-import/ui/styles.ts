/**
 * Оформление импорта справочника. Правила объявлены рядом со слайсом и
 * подключаются по имени: общий файл стилей стал бы местом, где правки разных
 * экранов сталкиваются (ADR-0008, инвариант 1).
 *
 * @supports: R-045
 * @adr: ADR-0008
 */
import { colors, radius, space, layout } from '@/shared/ui/tokens';

export const IMPORT_CSS = `
.imolt-import {
  display: flex;
  flex-direction: column;
  gap: ${space.m}px;
  background: ${colors.bgSurface};
  border-radius: ${radius.card}px;
  padding: ${space.l}px;
}

.imolt-import-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${space.m}px;
}

.imolt-import-title { font-size: 20px; line-height: 26px; font-weight: 700; margin: 0; }

.imolt-import-source { font-size: 13px; line-height: 18px; color: ${colors.textSecondary}; }

.imolt-import-pick {
  display: flex;
  gap: ${space.m}px;
  flex-wrap: wrap;
  align-items: flex-end;
}

.imolt-import-file {
  display: flex;
  flex-direction: column;
  gap: ${space.xxs}px;
  min-width: 220px;
}

.imolt-import-file input {
  min-height: ${layout.fieldHeight}px;
  border: 1px solid ${colors.borderDefault};
  border-radius: ${radius.field}px;
  padding: ${space.s}px;
  background: ${colors.bgSurface};
  color: ${colors.textPrimary};
}

.imolt-import-file input:focus-visible { outline: 2px solid ${colors.accentDark}; outline-offset: 2px; }

.imolt-import-changed { background: ${colors.accentRowHover}; }

.imolt-import-rejected {
  margin: 0;
  padding-left: ${space.m}px;
  font-size: 13px;
  line-height: 18px;
  color: ${colors.textSecondary};
}

.imolt-import-actions { display: flex; gap: ${space.xs}px; flex-wrap: wrap; align-items: center; }

.imolt-import-step {
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
  color: ${colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.imolt-import-cards { display: flex; flex-direction: column; gap: ${space.xs}px; }

.imolt-import-card {
  display: flex;
  flex-direction: column;
  gap: ${space.xxs}px;
  border: 1px solid ${colors.borderDivider};
  border-radius: ${radius.field}px;
  padding: ${space.s}px;
}

.imolt-import-card dl { display: flex; gap: ${space.m}px; margin: 0; flex-wrap: wrap; }

.imolt-import-card dt { font-size: 12px; line-height: 16px; color: ${colors.textSecondary}; }

.imolt-import-card dd { margin: 0; font-size: 15px; line-height: 21px; font-weight: 600; }
`;
