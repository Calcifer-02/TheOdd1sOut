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
import { BREAKPOINTS } from '@/shared/lib/viewport';
import { colors, fonts, layout, radius, space, stroke, zIndex } from './tokens';

/**
 * Боковое поле ячейки таблицы. Объявлено один раз, потому что его держат три
 * правила сразу — подпись таблицы, ячейка шапки и ячейка данных: разойдясь,
 * они ставят заголовок столбца и значение под ним на разные вертикали
 * (второй пакет замечаний заказчика по живому стенду, R-024, R-040).
 */
const TABLE_CELL_INSET = space.s;

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
  outline: ${stroke.emphasis}px solid ${colors.link};
  outline-offset: ${stroke.emphasis}px;
}

.imolt-page {
  max-width: ${layout.screenWidth}px;
  margin: 0 auto;
  padding: 0 ${layout.gutter}px ${layout.touchTarget * 2}px;
  display: flex;
  flex-direction: column;
  gap: ${space.m}px;
}

/* Широкий экран — рабочее место, и колонка макета телефона на нём выглядит
   ошибкой вёрстки: предельная ширина содержимого объявлена дизайн-договором
   (разд. 4.3). Поля берёт на себя оболочка, поэтому внутри неё страница их
   не повторяет. */
@media (min-width: ${BREAKPOINTS.cards}px) {
  .imolt-page { max-width: ${BREAKPOINTS.container}px; gap: ${space.l}px; }
}

.imolt-shell .imolt-page {
  max-width: none;
  padding-left: 0;
  padding-right: 0;
}

/* Подпись только для вспомогательной технологии: смысл, которого на экране
   не видно, но который нельзя потерять (состояние загрузки, имя столбца). */
.imolt-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.imolt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space.s}px;
  height: ${layout.controlHeight}px;
  border-bottom: ${stroke.hairline}px solid ${colors.borderDefault};
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

/*
 * Ссылка общего слоя. Синий здесь — роль «link» из договора (разд. 4.1), а не
 * умолчание браузера: собственный цвет ссылки живёт в токенах вместе с кольцом
 * фокуса, и оранжевый действием не бывает (разд. 4.6). Подчёркивание рисуется
 * линией заданной толщины с отступом от базовой линии — сплошная браузерная
 * черта режет выносные элементы кириллицы (разд. 4.2). Наведение и фокус
 * утолщают линию, поэтому состояние читается и без различения цветов
 * (разд. 4.4). Третичная кнопка по договору — «текст с подчёркиванием, цвет
 * link», поэтому подчёркивание у неё то же: второе описание разошлось бы.
 */
.imolt-link, .imolt-button--tertiary {
  text-decoration-line: underline;
  text-decoration-thickness: ${stroke.hairline}px;
  text-underline-offset: ${space.xxs}px;
}

.imolt-link {
  color: ${colors.link};
  border-radius: ${radius.badge}px;
  transition: text-decoration-thickness 150ms ease-out;
}

.imolt-link:focus-visible {
  outline: ${stroke.emphasis}px solid ${colors.link};
  outline-offset: ${stroke.emphasis}px;
  text-decoration-thickness: ${stroke.emphasis}px;
}

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
  height: ${layout.controlHeight}px;
  padding: 0 ${space.s}px;
  border: ${stroke.hairline}px solid ${colors.borderDefault};
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
  box-shadow: inset 0 0 0 ${stroke.hairline}px ${colors.link};
}
.imolt-input[aria-invalid='true'] { border-color: ${colors.statusBlockedText}; }

/* Подсказка и ошибка поля — абзацы, и браузерные поля абзаца им не подходят:
   при мере в кубометрах подсказка пересчёта растила строку формы на 40 точек
   ради шестнадцати. Отбивка берётся из шкалы отступов. */
.imolt-hint,
.imolt-error {
  margin: ${space.xxs}px 0 0;
  font-size: 12px;
  line-height: 16px;
}
.imolt-hint { color: ${colors.textSecondary}; }
.imolt-error { color: ${colors.statusBlockedText}; }

.imolt-suggest {
  list-style: none;
  margin: ${space.xxs}px 0 0;
  padding: ${space.xxs}px;
  border: ${stroke.hairline}px solid ${colors.borderDefault};
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

/* Количество и мера стоят в одной строке. Поле количества узкое намеренно:
   в него вводят две-три цифры, и растянутое на всю колонку оно обещает
   ввод, которого не будет. Остаток строки занимает переключатель меры. */
.imolt-row { display: flex; gap: ${space.xs}px; align-items: flex-end; }
.imolt-row > .imolt-field--amount { flex: 0 0 ${layout.amountWidth}px; }
.imolt-row > * { min-width: 0; }
.imolt-grow { flex: 1; }

.imolt-units { display: flex; gap: ${space.xxs}px; }

/* Переключатель: нативный radio скрыт визуально, но остаётся в потоке фокуса
   и объявляется вспомогательной технологии. Собственная система координат
   нужна здесь же: скрытый radio растянут по «таблетке» абсолютно. */
.imolt-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: ${layout.touchTarget}px;
  min-height: ${layout.controlHeight}px;
  padding: 0 ${space.s}px;
  border: ${stroke.hairline}px solid ${colors.borderDefault};
  border-radius: ${radius.pill}px;
  background: ${colors.bgSurface};
  font-family: ${fonts.ui};
  font-size: 14px;
  color: ${colors.textSecondary};
  cursor: pointer;
  white-space: nowrap;
  flex: none;
}

/* Переключатель меры стоит рядом с полем количества, и скругление у него то
   же, что у поля: «таблетка» рядом с полем читается как другой род управления.
   Высоту здесь повторять нечем — она общая у всех управлений полосы. */
.imolt-units .imolt-pill { border-radius: ${radius.field}px; }

.imolt-pill input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.imolt-pill[data-checked='true'] {
  background: ${colors.accentDark};
  border-color: ${colors.accentDark};
  color: ${colors.onAccentDark};
}

.imolt-pill:has(input:focus-visible) {
  outline: ${stroke.emphasis}px solid ${colors.link};
  outline-offset: ${stroke.emphasis}px;
}

/* Кнопка: базовый вид — главное действие. Вид называется ролью, поэтому
   «лаймовая кнопка на экране одна» проверяется по разметке (разд. 4.6). */
.imolt-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${space.xs}px;
  min-height: ${layout.controlHeight}px;
  padding: 0 ${space.l}px;
  border: 0;
  border-radius: ${radius.pill}px;
  background: ${colors.accentPrimary};
  color: ${colors.textPrimary};
  font-family: ${fonts.ui};
  font-size: 16px;
  font-weight: 700;
  line-height: 20px;
  cursor: pointer;
  transition: background-color 150ms ease-out, border-color 150ms ease-out;
}

.imolt-button:active { transform: translateY(${stroke.hairline}px); }
.imolt-button:disabled { background: ${colors.accentPrimaryDisabled}; color: ${colors.disabledText}; cursor: default; }
.imolt-button:disabled:active { transform: none; }
.imolt-button--primary { background: ${colors.accentPrimary}; color: ${colors.textPrimary}; }

/* Малый размер ужимает поле и кегль, но не высоту: малая кнопка стоит в той
   же полосе, что поле поиска и чипы, и своя высота у неё разваливала бы
   полосу на управления трёх мер (второй пакет замечаний заказчика, R-085). */
.imolt-button--s { padding: 0 ${space.m}px; font-size: 14px; }

/* Вторичная кнопка — та же высота управления, что у поля и главной кнопки
   (разд. 4.4): соседние управления разной высоты читаются как сбой вёрстки. */
.imolt-button--secondary {
  min-height: ${layout.controlHeight}px;
  background: ${colors.accentDark};
  color: ${colors.onAccentDark};
  font-weight: 500;
}

.imolt-button--secondary:disabled { background: ${colors.bgSurfaceMuted}; color: ${colors.disabledText}; opacity: 1; }

.imolt-button--tertiary {
  min-height: ${layout.controlHeight}px;
  padding: 0 ${space.xs}px;
  background: none;
  color: ${colors.link};
  font-weight: 500;
  /* Скругление таблетки принадлежит залитой кнопке. У текстовой фона нет, и
     кольцо фокуса радиусом 999 обводило подпись овалом, чужим среди полей
     (замечание заказчика от 24.09.2026). */
  border-radius: ${radius.field}px;
}

.imolt-button--tertiary:disabled { background: none; color: ${colors.disabledText}; text-decoration-line: none; }

/* Опасное действие: цвет отказа, но не только цвет — подпись называет
   последствие, а рамка отличает кнопку от обычной поверхности. */
.imolt-button--danger {
  background: ${colors.statusBlockedBg};
  color: ${colors.statusBlockedText};
  box-shadow: inset 0 0 0 ${stroke.hairline}px ${colors.statusBlockedText};
  font-weight: 600;
}

.imolt-button--danger:disabled { background: ${colors.bgSurfaceMuted}; color: ${colors.disabledText}; box-shadow: none; }

.imolt-button-label { white-space: nowrap; }

/*
 * Кнопка-переключатель меняет подпись вместе с состоянием («По возрастанию» —
 * «По убыванию»), и вместе с подписью менялась бы её ширина: соседи по полосе
 * управления сдвигались бы на каждое нажатие (второй пакет замечаний
 * заказчика по живому стенду, R-024, R-085).
 *
 * Место резервируется по самой длинной подписи: обе подписи лежат в одной
 * ячейке сетки, видна текущая, скрытая держит ширину. Скрытая убрана из
 * дерева доступности разметкой, поэтому доступным именем кнопки остаётся
 * ровно текущая подпись, а «visibility» исключает её и из порядка обхода.
 */
.imolt-button-label--reserve {
  display: inline-grid;
  grid-template-areas: 'imolt-label';
  justify-items: center;
  align-items: center;
}

.imolt-button-label--reserve > * { grid-area: imolt-label; }
.imolt-button-reserve { visibility: hidden; }

/* Признак ожидания. При prefers-reduced-motion вращение выключается общим
   правилом в конце файла, а сам кружок остаётся видимым. */
.imolt-spinner {
  width: ${space.m}px;
  height: ${space.m}px;
  flex: none;
  border-radius: ${radius.pill}px;
  border: ${stroke.emphasis}px solid currentColor;
  border-top-color: transparent;
  animation: imolt-spin 800ms linear infinite;
}

@keyframes imolt-spin { to { transform: rotate(360deg); } }

.imolt-toolbar {
  display: flex;
  align-items: center;
  gap: ${space.xs}px;
  flex-wrap: wrap;
}

.imolt-sorts-line { display: flex; align-items: center; gap: ${space.xs}px; flex-wrap: wrap; }

.imolt-tabs, .imolt-sorts, .imolt-chips {
  display: flex;
  gap: ${space.xs}px;
  overflow-x: auto;
  padding-bottom: ${space.xxs}px;
}

/* Чип, вкладка и переключатель порядка стоят в одной полосе с полем поиска и
   кнопкой, поэтому высота у них общая: замер живого стенда дал поле 48, кнопку
   48 и чип 36, и полоса читалась как набор разнородных управлений (второй
   пакет замечаний заказчика, R-040, R-085). Прежние 36 px разд. 4.4 не
   дотягивали и до цели касания 44 px разд. 4.5 — расхождение названо в
   отчёте. */
.imolt-tab, .imolt-sort, .imolt-chip {
  flex: none;
  min-height: ${layout.controlHeight}px;
  padding: 0 ${space.s}px;
  border: ${stroke.hairline}px solid ${colors.borderDefault};
  border-radius: ${radius.pill}px;
  background: ${colors.bgSurface};
  font-family: ${fonts.ui};
  font-size: 14px;
  color: ${colors.textSecondary};
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 150ms ease-out, border-color 150ms ease-out;
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
  border-left: ${space.xxs}px solid transparent;
  padding: ${space.s}px;
  display: flex;
  flex-direction: column;
  gap: ${space.xs}px;
  transition: background-color 150ms ease-out;
}

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

/*
 * Строка согласия в подвале формы: квадрат флажка и подпись встают на одну
 * оптическую линию, а сама строка остаётся целью касания не ниже 44 px
 * (разд. 4.5) — собственные 24 px флажка до неё не дотягивают. Правило здесь
 * одно: второе объявление того же класса ниже по файлу снимало и выравнивание,
 * и высоту, отчего флажок с кнопкой рядом не сходились (BUG-005).
 */
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
   и на разных платформах выглядит по-разному. Галочка — повёрнутый угол
   рамки; меры самого знака ниже принадлежат рисунку, а не шкале отступов,
   поэтому взяты прямо. */
.imolt-check {
  appearance: none;
  -webkit-appearance: none;
  width: ${space.l}px;
  height: ${space.l}px;
  flex: none;
  margin: 0;
  display: inline-grid;
  place-content: center;
  border: ${stroke.emphasis}px solid ${colors.borderDefault};
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
  border-left: ${stroke.emphasis}px solid currentColor;
  border-bottom: ${stroke.emphasis}px solid currentColor;
  transform: rotate(-45deg) translate(1px, -1px);
  opacity: 0;
}

.imolt-check:checked {
  background: ${colors.accentPrimary};
  border-color: ${colors.accentDark};
}

.imolt-check:checked::after { opacity: 1; }

/* В карточке полигона флажок стоит против названия, а не против середины
   карточки: название — первая строка блока. */
.imolt-option-head > .imolt-check { align-self: flex-start; margin-top: 2px; }

/*
 * Состояние полигона и дата, на которую оно известно, — две разные записи, и
 * в потоке текста ячейки они сходились в «Активенданные от 17.09» (второй
 * пакет замечаний заказчика по живому стенду, R-028, R-048). Зазор объявлен
 * правилом, а не пробелом в разметке: пробел пропадает на переносе и в
 * пересказе содержимого ячейки.
 *
 * Перенос разрешён намеренно: в узком столбце дата уходит на свою строку, а
 * не наезжает на значок и не обрезается краем ячейки.
 */
.imolt-status {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space.xxs}px ${space.xs}px;
  min-width: 0;
  max-width: 100%;
}

.imolt-badge {
  display: inline-flex;
  align-items: center;
  gap: ${space.xxs}px;
  padding: ${space.xxs}px ${space.xs}px;
  border-radius: ${radius.badge}px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
  max-width: 100%;
}

/* Значок статуса не сжимается вместе с подписью: сплющенный знак перестаёт
   отличаться от соседних состояний, а состояние обязано читаться не одним
   цветом (разд. 4.6). */
.imolt-badge > svg { flex: none; }

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
  height: ${layout.skeletonHeight}px;
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

/* Карта маршрута в окне маршрута. Тайлы идут по сети, и до их прихода на
   месте карты стоит приглушённая поверхность, а не пустота (R-034).
   «overflow: hidden» обязателен: библиотека карты двигает слои полотна
   произвольно далеко за края видимой части. */
.imolt-map {
  height: ${layout.routeMapHeight}px;
  border-radius: ${radius.field}px;
  border: ${stroke.hairline}px solid ${colors.borderDivider};
  background: ${colors.bgSurfaceMuted};
  overflow: hidden;
}

/* Метка на карте. Рисуется правилом, а не картинкой: изображения библиотеки
   карты лежат в её пакете и при сборке теряют адрес. */
.imolt-map-pin {
  width: ${space.m}px;
  height: ${space.m}px;
  border-radius: ${radius.pill}px;
  border: ${stroke.emphasis}px solid ${colors.bgSurface};
  box-shadow: ${layout.shadow};
  background: ${colors.accentDark};
}

/* Полигон отличается от адреса вывоза не только цветом: у него своя рамка и
   подпись в перечне меток под картой (разд. 4.6). */
.imolt-map-pin[data-point='landfill'] {
  background: ${colors.accentPrimary};
  border-color: ${colors.accentDark};
  cursor: pointer;
}

/* Перечень меток словами: он же объясняет карту, когда тайлы не пришли. */
.imolt-map-legend { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: ${space.xxs}px; }

.imolt-map-legend-item {
  display: flex;
  align-items: baseline;
  gap: ${space.xs}px;
  font-size: 14px;
  line-height: 20px;
}

/* Указание источника карты. Лицензия ODbL требует называть авторов данных,
   поэтому подпись стоит в разметке окна, а не рисуется самой картой: при
   отказе тайлов подпись обязана остаться видимой. */
.imolt-map-credit { margin: 0; font-size: 12px; line-height: 16px; color: ${colors.textSecondary}; }

/* Сведения о полигоне, открытые нажатием на его метку (R-033). */
.imolt-map-facts {
  display: flex;
  flex-direction: column;
  gap: ${space.xs}px;
  padding: ${space.s}px;
  border-radius: ${radius.field}px;
  background: ${colors.bgSurfaceMuted};
}

.imolt-map-tariffs { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: ${space.xxs}px; }

.imolt-allocation { display: flex; flex-direction: column; gap: ${space.xs}px; }
.imolt-allocation-row { display: flex; align-items: center; gap: ${space.xs}px; }
/* В строке распределения задаётся только ширина: высота поля общая у всех
   управлений, и второе её объявление вернуло бы разнобой высот (R-085). */
.imolt-allocation-row .imolt-input { width: ${layout.shareWidth}px; }

/* Подпись флажка кликабельна вместе с ним и сама держит высоту цели касания:
   нажатие мимо квадрата в 24 px должно попадать в подпись (разд. 4.5). */
.imolt-check-label {
  display: inline-flex;
  align-items: center;
  min-height: ${layout.touchTarget}px;
  cursor: pointer;
}

.imolt-check:disabled { background: ${colors.bgSurfaceMuted}; border-color: ${colors.borderDivider}; cursor: default; }
.imolt-check:disabled + .imolt-check-label { color: ${colors.disabledText}; cursor: default; }

/* Список выбора: та же высота и то же скругление, что у поля ввода, —
   соседние управления разной геометрии читаются как сбой вёрстки. */
.imolt-select {
  width: 100%;
  height: ${layout.controlHeight}px;
  padding: 0 ${space.s}px;
  border: ${stroke.hairline}px solid ${colors.borderDefault};
  border-radius: ${radius.field}px;
  background: ${colors.bgSurface};
  font-family: ${fonts.ui};
  font-size: 16px;
  color: ${colors.textPrimary};
  cursor: pointer;
}

.imolt-select:disabled { background: ${colors.bgSurfaceMuted}; color: ${colors.disabledText}; cursor: default; }
.imolt-select[aria-invalid='true'] { border-color: ${colors.statusBlockedText}; }

.imolt-tab-badge {
  margin-left: ${space.xxs}px;
  font-family: ${fonts.numeric};
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  font-weight: 600;
}

/* Состояние ожидания: полосы на месте будущих строк. */
.imolt-skeleton-list { display: flex; flex-direction: column; gap: ${space.xs}px; }

.imolt-skeleton-bar {
  display: block;
  height: ${space.m}px;
  border-radius: ${radius.badge}px;
  background: ${colors.bgSurfaceMuted};
}

.imolt-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${space.xs}px;
  padding: ${space.l}px ${space.m}px;
  border-radius: ${radius.field}px;
  background: ${colors.bgSurfaceMuted};
  text-align: left;
}

.imolt-empty-title { margin: 0; font-size: 16px; line-height: 22px; font-weight: 600; }
.imolt-empty-hint { margin: 0; font-size: 14px; line-height: 20px; color: ${colors.textSecondary}; }
.imolt-empty-action { margin-top: ${space.xxs}px; }

/* Точка привязки всплывающего окна: окно встаёт под вызвавшим его
   управлением, а не в углу страницы. */
.imolt-anchor { position: relative; display: inline-flex; }

/* Всплывающее окно: тень отделяет его от страницы, но страница за ним
   остаётся видимой и доступной — это не модальное окно (разд. 4.6). */
.imolt-popover {
  position: absolute;
  z-index: ${zIndex.popover};
  min-width: ${layout.sideColumnWidth}px;
  max-width: calc(100vw - ${layout.gutter * 2}px);
  padding: ${space.m}px;
  border: ${stroke.hairline}px solid ${colors.borderDefault};
  border-radius: ${radius.field}px;
  background: ${colors.bgSurface};
  box-shadow: ${layout.shadow};
  display: flex;
  flex-direction: column;
  gap: ${space.s}px;
}

/* Окно, вынесенное из своей разметки в корень страницы: координаты считает
   компонент по месту вызвавшей кнопки и ставит их в самом узле. Замер живого
   стенда 24.09.2026 при ширине окна 1496: окно маршрута 360 x 400 стояло в
   ячейке 78 x 48 внутри области прокрутки 776 x 254, и «overflow: auto» резал
   его справа и снизу (R-033). Собственный «overflow» — на случай, когда места
   до края окна браузера меньше, чем нужно содержимому. */
.imolt-popover[data-detached='true'] {
  position: fixed;
  top: 0;
  left: 0;
  overflow: auto;
}

/* Метка места вынесенного окна в разметке рядом с кнопкой. Ничего не
   показывает и в раскладку не входит: у неё одна работа — назвать оправу, по
   которой считаются координаты. */
.imolt-popover-mark { display: none; }

.imolt-popover-head { display: flex; align-items: center; justify-content: space-between; gap: ${space.s}px; }
.imolt-popover-title { margin: 0; font-size: 16px; line-height: 22px; font-weight: 700; }

/* Подложка затемнения под модальным окном: страница под ней перехвачена
   целиком, и промах мимо окна попадает в подложку, а не в таблицу под ней
   (решение заказчика от 24.09.2026, R-033). Поле подложки — поле страницы:
   на узком окне окно маршрута прижимается к тем же краям, что и содержимое. */
.imolt-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: ${zIndex.modal};
  padding: ${layout.gutter}px;
  background: ${colors.overlay};
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Само окно. Скругление и тень — те же, что у всплывающего окна (разд. 4.4):
   разговор поверх страницы отличается от подсказки поведением, а не видом. */
.imolt-modal {
  width: 100%;
  /* Окно тянется до предела, но не шире окна браузера за вычетом полей. */
  max-width: min(${layout.modalWidth}px, calc(100vw - ${layout.gutterWide * 2}px));
  max-height: 100%;
  overflow: auto;
  padding: ${space.m}px;
  border-radius: ${radius.field}px;
  background: ${colors.bgSurface};
  box-shadow: ${layout.shadow};
  display: flex;
  flex-direction: column;
  gap: ${space.s}px;
}

.imolt-modal-head { display: flex; align-items: center; justify-content: space-between; gap: ${space.s}px; }
.imolt-modal-title { margin: 0; font-size: 18px; line-height: 24px; font-weight: 700; }
.imolt-modal-body { display: flex; flex-direction: column; gap: ${space.s}px; }

/* Крестик закрытия: кнопка-значок 40 x 40 (разд. 4.4). Цель касания добирает
   поле внутри самой кнопки, а не отступ соседей. */
.imolt-modal-close {
  flex: none;
  width: ${layout.iconButton}px;
  height: ${layout.iconButton}px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: ${radius.field}px;
  background: transparent;
  color: ${colors.iconActive};
  cursor: pointer;
}

.imolt-card-head { display: flex; align-items: baseline; justify-content: space-between; gap: ${space.s}px; }
.imolt-card-title { margin: 0; font-size: 18px; line-height: 24px; font-weight: 700; }
.imolt-card-actions { display: flex; align-items: center; gap: ${space.xs}px; }

/* Число с подписью: значение набрано табличными цифрами, чтобы столбец
   сводки выравнивался по разрядам (разд. 4.2). */
.imolt-stat { margin: 0; display: flex; flex-direction: column; gap: ${space.xxs}px; }
.imolt-stat-label { font-size: 12px; line-height: 16px; color: ${colors.textSecondary}; }

.imolt-stat-value {
  margin: 0;
  font-family: ${fonts.numeric};
  font-variant-numeric: tabular-nums;
  font-size: 20px;
  line-height: 26px;
  font-weight: 700;
}

.imolt-stat-hint { margin: 0; font-size: 12px; line-height: 16px; color: ${colors.textSecondary}; }

.imolt-datestamp { font-size: 12px; line-height: 16px; color: ${colors.textSecondary}; }
.imolt-datestamp-age { color: ${colors.textPlaceholder}; }

/* Таблица сравнения. Прокрутка горизонтальная: столбцов много, и сжимать их
   до нечитаемого уже, чем дать увести таблицу вбок. */
.imolt-table-scroll {
  position: relative;
  overflow: auto;
  max-height: 70vh;
  border-radius: ${radius.card}px;
  background: ${colors.bgSurface};
}

/* Границы ячеек не схлопываются. У схлопнутых границ линия под шапкой
   принадлежит таблице, а не ячейке: при прокрутке она остаётся на месте, и
   первая строка уезжает под липкую шапку без разделителя (BUG-001).
   Разделённые границы с нулевым зазором дают тот же вид сетки. */
.imolt-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 14px;
  line-height: 20px;
}

/* Подпись — часть карточки таблицы, и её левый край совпадает с левым краем
   первой колонки шапки: боковое поле у подписи, ячейки шапки и ячейки данных
   одно. Экран выравнивается по этой вертикали, поэтому её смена сдвигает
   заголовок и полосы над таблицей (BUG-003, BUG-011). */
.imolt-table-caption {
  padding: ${space.s}px ${TABLE_CELL_INSET}px ${space.xs}px;
  text-align: left;
  font-size: 12px;
  line-height: 16px;
  color: ${colors.textSecondary};
}

/* Шапка остаётся видимой при прокрутке: без неё колонка чисел через десять
   строк перестаёт быть названной. Разделитель нарисован внутренней тенью, а
   не границей: у липкой ячейки граница отрисовывается по исходному месту
   таблицы и на прокрутке отстаёт от самой шапки. */
.imolt-table thead th {
  position: sticky;
  top: 0;
  z-index: ${zIndex.stickyHead};
  padding: ${space.xs}px ${TABLE_CELL_INSET}px;
  background: ${colors.bgSurfaceMuted};
  box-shadow: inset 0 -${stroke.hairline}px 0 ${colors.borderDivider};
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
  color: ${colors.textSecondary};
  text-align: left;
  white-space: nowrap;
}

.imolt-table th[data-align='end'], .imolt-table td[data-align='end'] { text-align: right; }

/* Числовой столбец набран табличными цифрами: суммы сравнивают по разрядам. */
.imolt-table td[data-align='end'] {
  font-family: ${fonts.numeric};
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.imolt-table th[data-align='end'] .imolt-table-sort { justify-content: flex-end; width: 100%; }

.imolt-table-sort {
  display: inline-flex;
  align-items: center;
  gap: ${space.xxs}px;
  min-height: ${layout.touchTarget}px;
  padding: 0;
  border: 0;
  background: none;
  font-family: ${fonts.ui};
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
  color: ${colors.textSecondary};
  cursor: pointer;
}

.imolt-table th[aria-sort='ascending'] .imolt-table-sort,
.imolt-table th[aria-sort='descending'] .imolt-table-sort { color: ${colors.textPrimary}; }
.imolt-table-sort-mark { flex: none; }

/* Высота строки объявлена наименьшей, а не мерой: в ячейке полигона стоят
   название, адрес и перечень тарифов, и жёсткие 72 px заставляли содержимое
   наезжать на соседнюю строку (BUG-001). Боковое поле — общее поле ячейки:
   заголовок столбца и значение под ним стоят на одной вертикали только
   тогда, когда обе ячейки берут его из одного места (R-024). */
.imolt-table tbody td {
  min-height: ${layout.rowHeight}px;
  padding: ${space.s}px ${TABLE_CELL_INSET}px;
  border-bottom: ${stroke.hairline}px solid ${colors.borderDivider};
  vertical-align: middle;
}

/* Выбранная строка: полоса слева и отмеченный флажок. Один цвет строку
   выбранной не объявляет (разд. 4.6). */
.imolt-table tbody tr[data-selected='true'] td:first-child { box-shadow: inset ${space.xxs}px 0 0 ${colors.accentPrimary}; }

.imolt-table-pick { width: ${layout.touchTarget}px; text-align: center; }
.imolt-table-empty { padding: ${space.m}px; background: ${colors.bgSurface}; }

.imolt-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space.s}px;
  flex-wrap: wrap;
  padding: ${space.s}px 0;
}

.imolt-pager-count {
  margin: 0;
  font-family: ${fonts.numeric};
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  line-height: 18px;
  color: ${colors.textSecondary};
}

/*
 * Наведение — единственным местом на весь общий слой.
 *
 * Отклик обязателен у каждого нажимаемого элемента (разд. 4.4): без него чип,
 * вкладка и переключатель сортировки выглядят надписью, а не управлением
 * (BUG-008). Отклик единообразен: приглушённая поверхность и потемневшая
 * рамка, длительность — те же 150 мс (разд. 4.3).
 *
 * Условие «hover: hover» обязательно. На сенсорном экране правило наведения
 * остаётся на элементе после касания и залипает, а у выбранного чипа это
 * читается как второе выбранное. Выбранное состояние при этом по-прежнему
 * держат цвет и состояние aria, наведение его не подменяет и не отменяет.
 */
@media (hover: hover) {
  .imolt-button:hover:not(:disabled) { background: ${colors.accentPrimaryHover}; }
  .imolt-button--secondary:hover:not(:disabled) { background: ${colors.accentDark}; opacity: 0.9; }
  .imolt-button--danger:hover:not(:disabled) { background: ${colors.statusBlockedBg}; opacity: 0.9; }

  /* Третичная кнопка — текст: поверхность у неё появляется только под
     указателем, а подчёркивание становится плотнее. */
  .imolt-button--tertiary:hover:not(:disabled) {
    background: ${colors.bgSurfaceMuted};
    text-decoration-thickness: ${stroke.emphasis}px;
  }

  .imolt-link:hover { text-decoration-thickness: ${stroke.emphasis}px; }

  .imolt-chip:hover:not(:disabled),
  .imolt-tab:hover:not(:disabled),
  .imolt-sort:hover:not(:disabled),
  .imolt-pill:hover {
    background: ${colors.bgSurfaceMuted};
    border-color: ${colors.accentDark};
  }

  /* Выбранное остаётся выбранным: под указателем оно только приглушается,
     цвет выбора не подменяется цветом наведения (разд. 4.6). */
  .imolt-tab[aria-selected='true']:hover,
  .imolt-sort[aria-pressed='true']:hover,
  .imolt-chip[aria-pressed='true']:hover,
  .imolt-pill[data-checked='true']:hover {
    background: ${colors.accentDark};
    border-color: ${colors.accentDark};
    color: ${colors.onAccentDark};
    opacity: 0.9;
  }

  .imolt-modal-close:hover { background: ${colors.bgSurfaceMuted}; }

  .imolt-suggest button:hover { background: ${colors.accentRowHover}; }
  .imolt-option:hover { background: ${colors.accentRowHover}; }
  .imolt-check:hover:not(:disabled) { border-color: ${colors.accentDark}; }
  .imolt-select:hover:not(:disabled) { border-color: ${colors.accentDark}; }
  .imolt-table-sort:hover { color: ${colors.textPrimary}; }
  .imolt-table tbody tr:hover td { background: ${colors.accentRowHover}; }

  /* Пустой результат строкой данных не является: подсвечивать в нём нечего. */
  .imolt-table tbody tr:hover td.imolt-table-empty { background: ${colors.bgSurface}; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;
