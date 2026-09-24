/**
 * Оформление редактора цен и справочников (`ux/Редактор цен.dc.html`).
 *
 * Правила объявлены рядом с экраном и подключаются по имени: общий файл
 * стилей стал бы местом, где правки разных экранов сталкиваются. Прямых
 * значений здесь нет — только роли из модуля токенов (ADR-0008, инвариант 1).
 *
 * @supports: R-042, R-085
 * @adr: ADR-0008
 */
import { colors, layout, radius, space } from '@/shared/ui/tokens';

/**
 * Левая вертикаль экрана — та же, что у столбца таблицы: общий слой отбивает
 * ячейку и подпись таблицы внутрь плашки на боковое поле `space.s`. Всё
 * остальное на экране встаёт по ней же, иначе заголовок страницы и заголовок
 * таблицы стоят на разных вертикалях (BUG-003, BUG-011).
 */
const INSET = space.s;

/** Расстояние между смысловыми блоками экрана: одно на всю раскладку. */
const RHYTHM = space.l;

export const REFERENCES_CSS = `
.imolt-references { display: flex; flex-direction: column; gap: ${RHYTHM}px; }

/* Блоки экрана отбиваются на общую вертикаль: у заголовка, пояснения, полосы
   отбора, поля поиска и кнопки возврата собственного поля нет вовсе, а у
   отказа, карточки и пустого состояния оно своё и с вертикалью столбца не
   совпадает. */
.imolt-references > .imolt-card,
.imolt-references-cards > .imolt-empty,
.imolt-references > .imolt-references-head,
.imolt-references > .imolt-references-title,
.imolt-references > .imolt-references-subtitle,
.imolt-references > .imolt-references-status,
.imolt-references > .imolt-references-card-entity,
.imolt-references > .imolt-references-actions,
.imolt-references > .imolt-toolbar,
.imolt-references > .imolt-tabs,
.imolt-references > .imolt-grow,
.imolt-references > .imolt-notice,
.imolt-references > .imolt-button {
  padding-left: ${INSET}px;
  padding-right: ${INSET}px;
}

.imolt-references-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${space.l}px;
  flex-wrap: wrap;
}

/* Заголовок и пояснение — один смысловой блок, расстояние между ними меньше
   расстояния между блоками экрана. */
.imolt-references-head-text {
  display: flex;
  flex-direction: column;
  gap: ${space.xxs}px;
  min-width: 0;
}

.imolt-references-title { margin: 0; font-size: 28px; line-height: 34px; font-weight: 700; }

/* Заголовок отказа — первая строка объяснения, а не его же текст. */
.imolt-references-access-title { font-weight: 600; }

.imolt-references-subtitle { font-size: 14px; line-height: 20px; color: ${colors.textSecondary}; }

.imolt-references-actions { display: flex; gap: ${space.xs}px; flex-wrap: wrap; }

.imolt-references-toolbar {
  display: flex;
  gap: ${space.s}px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.imolt-references-sync {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space.m}px;
  flex-wrap: wrap;
  background: ${colors.bgSurface};
  border-radius: ${radius.card}px;
  padding: ${space.m}px ${INSET}px;
}

.imolt-references-sync-text { display: flex; flex-direction: column; gap: ${space.xxs}px; min-width: 0; }

.imolt-references-sync-title { font-size: 15px; line-height: 21px; font-weight: 600; }

.imolt-references-sync-detail { font-size: 13px; line-height: 18px; color: ${colors.textSecondary}; }

.imolt-references-cell {
  min-width: 84px;
  min-height: 32px;
  padding: 0 ${space.xs}px;
  border: 1px solid transparent;
  border-radius: ${radius.badge}px;
  background: ${colors.bgSurface};
  color: ${colors.textPrimary};
  font: inherit;
  font-variant-numeric: tabular-nums;
  text-align: right;
  cursor: text;
}

.imolt-references-cell:hover:enabled { background: ${colors.accentRowHover}; border-color: ${colors.borderDefault}; }

.imolt-references-cell:focus-visible { outline: 2px solid ${colors.accentDark}; outline-offset: 2px; }

.imolt-references-cell:disabled { color: ${colors.disabledText}; cursor: default; }

.imolt-references-cell-form { display: flex; gap: ${space.xxs}px; align-items: center; justify-content: flex-end; }

.imolt-references-cell-form input {
  width: 96px;
  min-height: 32px;
  padding: 0 ${space.xs}px;
  border: 1px solid ${colors.accentDark};
  border-radius: ${radius.badge}px;
  background: ${colors.bgSurface};
  color: ${colors.textPrimary};
  font: inherit;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.imolt-references-cell-error {
  display: block;
  font-size: 12px;
  line-height: 16px;
  color: ${colors.statusBlockedText};
}

.imolt-references-cards { display: flex; flex-direction: column; gap: ${space.s}px; }

.imolt-references-card {
  display: flex;
  flex-direction: column;
  gap: ${space.xs}px;
  background: ${colors.bgSurface};
  border-radius: ${radius.card}px;
  padding: ${space.m}px ${INSET}px;
}

/* Длинные названия переносятся, а не уходят за край карточки или ячейки:
   у полигона длинное имя, у юридического лица — ещё длиннее. */
.imolt-references-card-name,
.imolt-references-card-entity {
  overflow-wrap: anywhere;
}

.imolt-references-card-name { font-size: 16px; line-height: 22px; font-weight: 600; }

.imolt-references-card-entity { font-size: 12px; line-height: 16px; color: ${colors.textSecondary}; }

/* Имя записи в таблице: название и юридическое лицо — две строки. В ячейке
   они остались бы в одной строке и слились в одно слово. */
.imolt-references-cell-name {
  display: flex;
  flex-direction: column;
  gap: ${space.xxs}px;
  min-width: 0;
}

.imolt-references-card dl { margin: 0; display: flex; flex-direction: column; gap: ${space.xxs}px; }

.imolt-references-card dl > div {
  display: flex;
  justify-content: space-between;
  gap: ${space.xs}px;
  border-bottom: 1px solid ${colors.borderDivider};
  padding-bottom: ${space.xxs}px;
}

.imolt-references-card dt {
  font-size: 13px;
  line-height: 18px;
  color: ${colors.textSecondary};
  min-width: 0;
  overflow-wrap: anywhere;
}

/* Значение прижато вправо и переносится: перечень кодов каталога длиннее
   строки карточки, и без переноса он уходил бы за её край. */
.imolt-references-card dd {
  margin: 0;
  font-size: 15px;
  line-height: 21px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  min-width: 0;
  text-align: right;
  overflow-wrap: anywhere;
}

.imolt-references-form { display: flex; flex-direction: column; gap: ${space.m}px; }

.imolt-references-form-row { display: flex; gap: ${space.xs}px; align-items: flex-end; }

.imolt-references-form-row .imolt-references-cell-form input { width: ${layout.amountWidth}px; }

.imolt-references-status { display: flex; gap: ${space.xs}px; align-items: center; flex-wrap: wrap; }

.imolt-references-count { font-size: 13px; line-height: 18px; color: ${colors.textSecondary}; }
`;
