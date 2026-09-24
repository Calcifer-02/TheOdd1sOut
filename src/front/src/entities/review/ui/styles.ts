/**
 * Оформление сущности «отзыв о полигоне».
 *
 * Правила объявлены рядом со своими компонентами и подключаются по имени:
 * общий файл стилей стал бы местом, где правки разных слайсов сталкиваются
 * (пояснение в `@/shared/ui/useStyles`). Прямых значений здесь нет — только
 * роли токенов (ADR-0008, инвариант 1).
 *
 * @supports: R-031
 * @adr: ADR-0008
 */
import { colors, fonts, layout, radius, space } from '@/shared/ui/tokens';

export const REVIEW_CSS = `
/* Круг оценки: величина целиком, а не начало строки. Размер берётся от цели
   касания — круг меньше неё выглядел бы меткой, а не значением. */
.imolt-review-rating {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: none;
  width: ${layout.touchTarget}px;
  height: ${layout.touchTarget}px;
  border-radius: 50%;
  background: ${colors.bgSurfaceMuted};
  font-family: ${fonts.numeric};
  font-variant-numeric: tabular-nums;
  color: ${colors.textPrimary};
  white-space: nowrap;
}

.imolt-review-rating-value {
  font-size: 16px;
  line-height: 18px;
  font-weight: 600;
}

/* Шкала мельче числа, но остаётся видимой: без неё «4» читается и как число
   отзывов (R-031). */
.imolt-review-rating-scale {
  font-size: 10px;
  line-height: 12px;
  color: ${colors.textSecondary};
}

.imolt-review-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: ${space.xs}px ${space.s}px;
  padding: ${space.s}px ${space.m}px;
  border-radius: ${radius.field}px;
  background: ${colors.bgSurfaceMuted};
}

.imolt-review-summary-label {
  color: ${colors.textSecondary};
}

.imolt-review-summary-none,
.imolt-review-summary-count {
  color: ${colors.textSecondary};
  font-size: 14px;
  line-height: 20px;
}

.imolt-review-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: ${space.s}px;
}

.imolt-review-item {
  display: grid;
  gap: ${space.xxs}px;
  padding: ${space.s}px 0;
  border-bottom: 1px solid ${colors.borderDivider};
}

.imolt-review-item:last-child {
  border-bottom: 0;
}

.imolt-review-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space.s}px;
}

.imolt-review-item-date {
  color: ${colors.textSecondary};
  font-size: 12px;
  line-height: 16px;
}

.imolt-review-item-text {
  margin: 0;
  color: ${colors.textPrimary};
}

.imolt-review-form {
  display: grid;
  gap: ${space.s}px;
  justify-items: stretch;
}

.imolt-review-scale {
  display: flex;
  flex-wrap: wrap;
  gap: ${space.xs}px;
}
`;
