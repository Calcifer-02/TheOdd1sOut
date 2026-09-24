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
 * @supports: R-040, R-085
 * @adr: ADR-0008
 */
import { colors, fonts, radius, space, stroke } from '@/shared/ui/tokens';
import { BREAKPOINTS } from '@/shared/lib/viewport';

/**
 * Левая вертикаль экрана — та же, что у столбца таблицы: общий слой отбивает
 * ячейку и подпись таблицы внутрь плашки на боковое поле `space.s`. Всё
 * остальное на экране встаёт по ней же, иначе заголовок страницы и заголовок
 * таблицы стоят на разных вертикалях (BUG-003, BUG-011).
 */
const INSET = space.s;

/** Расстояние между смысловыми блоками экрана: одно на всю раскладку. */
const RHYTHM = space.m;

export const LANDFILLS_CSS = `
.imolt-landfills {
  display: grid;
  gap: ${RHYTHM}px;
}

/* Блоки экрана отбиваются на общую вертикаль: у заголовка, пояснения и
   счётчика показанного собственного поля нет вовсе, а у отказа, пустого
   состояния и карточки полигона оно своё и с вертикалью столбца не
   совпадает. */
.imolt-landfills > .imolt-landfills-head,
.imolt-landfills > .imolt-notice,
.imolt-landfills-list > .imolt-notice,
.imolt-landfills-list > .imolt-button,
.imolt-landfills-list > .imolt-empty,
.imolt-landfills-list > .imolt-pager,
.imolt-landfills-body > .imolt-card {
  padding-left: ${INSET}px;
  padding-right: ${INSET}px;
}

.imolt-landfills-head {
  display: grid;
  gap: ${space.xs}px;
}

/* Отступ сверху у заголовка задаёт общий слой, и он складывался бы с
   расстоянием между блоками: ритм экрана считается в одном месте. */
.imolt-landfills-head h1.imolt-title {
  margin-top: 0;
}

/* Полоса актуальности и полоса отбора — один вид плашки: обе идут во всю
   ширину, а содержимое отбивают на общую вертикаль экрана. */
.imolt-landfills-band,
.imolt-landfills-filters {
  padding: ${space.s}px ${INSET}px;
  border-radius: ${radius.field}px;
  background: ${colors.bgSurfaceMuted};
}

.imolt-landfills-band {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space.xs}px ${space.m}px;
  color: ${colors.textSecondary};
  font-size: 14px;
  line-height: 20px;
}

/* Поиск и отбор по группе — одна плашка, но две строки. Общую высоту
   управлений задаёт общий слой (величина «controlHeight»), а рознит строку
   подпись: у поля она стоит над ним и поднимает блок на свою высоту. Поиск и
   отбор по группе — два названных блока, и в одной строке их подписи
   встают на разных уровнях (второй пакет замечаний заказчика, 24.09.2026). */
.imolt-landfills-filters {
  display: grid;
  gap: ${space.s}px;
}

/* Первая строка: поле и «Найти». Высота у них общая, и по нижнему краю они
   встают на одну линию, а подпись поля остаётся над ней. */
.imolt-landfills-search {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: ${space.xs}px;
  min-width: 0;
}

/* Вторая строка: отбор по группе и сброс. Выравнивание по нижнему краю, а не
   по середине: над чипами стоит подпись, и по середине сброс встал бы
   напротив неё, а не напротив чипов. */
.imolt-landfills-groups {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: ${space.xs}px ${space.m}px;
}

/* Подпись отбора набрана тем же классом, что подпись поля: вторая копия
   её оформления разошлась бы с первой. Расстояние до чипов задаёт сама
   подпись своим нижним полем. */
.imolt-landfills-group-field {
  flex: 1 1 auto;
  min-width: 0;
}

.imolt-landfills-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space.xs}px;
}

.imolt-landfills-count {
  color: ${colors.textSecondary};
  font-size: 14px;
  line-height: 20px;
}

.imolt-landfills-body {
  display: grid;
  gap: ${RHYTHM}px;
  align-items: start;
}

/* Список и то, что его сопровождает, живут в том же ритме, что и экран:
   без этого таблица, счётчик и отказ стояли бы вплотную. */
.imolt-landfills-list {
  display: grid;
  gap: ${RHYTHM}px;
  align-content: start;
}

/* Кнопка повтора — не блок во всю ширину: в сетке она иначе растягивается. */
.imolt-landfills-list > .imolt-button {
  justify-self: start;
}

@media (min-width: ${BREAKPOINTS.sideSummary}px) {
  .imolt-landfills-body[data-card="open"] {
    grid-template-columns: minmax(0, 1fr) 380px;
  }
}

/* Ширину столбца задаёт объявленная доля, а не содержимое: при раскладке по
   содержимому длинное юридическое лицо отбирало место у перечня тарифов, и
   границы столбцов расходились от выборки к выборке (второй пакет замечаний
   заказчика, 24.09.2026). Доли стоят в объявлении столбцов «LandfillsTable».
   Ширину таблицы и вид границ держит общий слой. */
.imolt-landfills-table table {
  table-layout: fixed;
}

/* Общий слой держит шапку в одну строку — это верно для коротких названий
   столбцов. При заданной доле длинный заголовок уходил бы под соседний, и
   заголовок переносится внутри своего столбца. */
.imolt-landfills-table thead th {
  white-space: normal;
}

/* Длинное юридическое лицо переносится внутри столбца: без переноса строка
   уводит таблицу вбок, и конец названия остаётся за краем. */
.imolt-landfills-table td {
  overflow-wrap: anywhere;
}

.imolt-landfill-name {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${space.xxs}px;
  min-width: 0;
}

/* Название полигона — длинный предметный текст, а не подпись действия:
   общий слой держит подписи кнопок в одну строку, и длинное название
   вылезло бы за ячейку. Боковое поле кнопки снято, иначе название стоит
   правее своего же адреса. */
.imolt-landfill-name > .imolt-button,
.imolt-landfill-card > .imolt-landfill-card-name {
  padding-left: 0;
  padding-right: 0;
  justify-content: flex-start;
  text-align: left;
  border-radius: ${radius.field}px;
}

/* Отклик на наведение у названия — подчёркивание, а не заливка: общий слой
   рисует третьестепенную кнопку таблеткой в 999 точек, и заливка без бокового
   поля обрезала первую и последнюю буквы перенесённой строки. Составной
   селектор нужен потому, что лист общего слоя ложится в страницу последним и
   одиночный он перебивает. */
@media (hover: hover) {
  .imolt-landfill-name > .imolt-button:hover:not(:disabled),
  .imolt-landfill-card > .imolt-landfill-card-name:hover:not(:disabled) {
    background: none;
    text-decoration-thickness: ${stroke.emphasis}px;
  }
}

.imolt-landfill-name .imolt-button-label,
.imolt-landfill-card .imolt-button-label {
  white-space: normal;
}

.imolt-landfill-address {
  color: ${colors.textSecondary};
  font-size: 14px;
  line-height: 20px;
  overflow-wrap: anywhere;
}

.imolt-landfill-cards {
  display: grid;
  gap: ${space.s}px;
}

/* Боковое поле уменьшено на толщину рамки: содержимое карточки встаёт на ту
   же вертикаль, что заголовок экрана и столбец таблицы, — рамка сдвигала бы
   его на свою толщину вправо (BUG-011). */
.imolt-landfill-card {
  display: grid;
  gap: ${space.xs}px;
  padding: ${space.m}px ${INSET - stroke.hairline}px;
  border: ${stroke.hairline}px solid ${colors.borderDefault};
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

/* Пара «группа отходов — цена» отделена от следующей линией: без неё перечень
   внутри ячейки читался слипшимся текстом, и было не видно, какая цена к
   какой группе относится (второй пакет замечаний заказчика, 24.09.2026). */
.imolt-tariffs-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: ${space.s}px;
  align-items: baseline;
  padding-bottom: ${space.xxs}px;
  border-bottom: ${stroke.hairline}px solid ${colors.borderDivider};
}

/* Последняя пара замыкает перечень: линия под ней читалась бы как разделитель
   с содержимым соседней строки таблицы. */
.imolt-tariffs-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.imolt-tariffs dt {
  color: ${colors.textSecondary};
  font-size: 14px;
  line-height: 20px;
  min-width: 0;
  /* Название группы отходов переносится внутри столбца, а не выталкивает
     цену за край ячейки. */
  overflow-wrap: anywhere;
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
