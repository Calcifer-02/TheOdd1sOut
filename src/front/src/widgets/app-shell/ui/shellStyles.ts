/**
 * Оформление оболочки приложения.
 *
 * Правила живут рядом с оболочкой, а не в общем файле темы: общая тема — это
 * примитивы, которыми пользуются все, а раскладка шапки и нижней панели нужна
 * одному виджету. Значения — из токенов дизайн-договора (ADR-0008, инвариант 1).
 *
 * @supports: R-058
 * @adr: ADR-0008
 */
import { BREAKPOINTS } from '@/shared/lib/viewport';
import { colors, fonts, layout, radius, space, zIndex } from '@/shared/ui/tokens';

/**
 * Внутренняя отбивка блоков экрана: та же величина, которой общий слой
 * отбивает содержимое ячейки таблицы. Экраны выстраивают по ней свою левую
 * вертикаль, и шапка обязана встать на ту же.
 */
const CONTENT_INSET = space.s;

export const SHELL_CSS = `
.imolt-shell { min-height: 100vh; display: flex; flex-direction: column; }

/* Переход к содержимому мимо перечня разделов. Кнопка, а не ссылка: адрес
   страницы — это маршрут экрана, и якорь внутри страницы увёл бы приложение
   на несуществующий экран. */
.imolt-skip {
  position: absolute;
  left: ${space.xs}px;
  top: ${space.xs}px;
  z-index: ${zIndex.popover};
  transform: translateY(-200%);
  min-height: ${layout.touchTarget}px;
  padding: 0 ${space.m}px;
  border: 0;
  border-radius: ${radius.pill}px;
  background: ${colors.accentDark};
  color: ${colors.onAccentDark};
  font-family: ${fonts.ui};
  font-size: 14px;
  cursor: pointer;
}

.imolt-skip:focus-visible { transform: none; }

.imolt-shell-header {
  position: sticky;
  top: 0;
  z-index: ${zIndex.shell};
  background: ${colors.bgPage};
  border-bottom: 1px solid ${colors.borderDefault};
}

/* Боковое поле шапки — поле содержимого плюс внутренняя отбивка экрана.
   Экраны отбивают свои блоки на ширину бокового поля ячейки таблицы, чтобы
   заголовок и подпись таблицы стояли на одной вертикали; без той же отбивки
   марка в шапке вставала на 12 точек левее всего остального, и на экране
   получались две вертикали вместо одной. */
.imolt-shell-head-line {
  max-width: ${BREAKPOINTS.container}px;
  margin: 0 auto;
  min-height: ${layout.headerHeight}px;
  padding: ${space.s}px ${layout.gutterWide + CONTENT_INSET}px;
  display: flex;
  align-items: center;
  gap: ${space.l}px;
}

/* Марка — единственное место оранжевого в приложении (разд. 4.1). */
.imolt-shell-brand {
  font-family: ${fonts.ui};
  font-weight: 700;
  font-size: 24px;
  line-height: 28px;
  color: ${colors.brand};
  letter-spacing: -0.01em;
  flex: none;
  /* Ссылка, но не синяя и не подчёркнутая: это название сервиса, а подчёркнутым
     оно читалось бы пунктом перечня (AC-087e). */
  text-decoration: none;
}

@media (hover: hover) {
  .imolt-shell-brand:hover { text-decoration: underline; }
}

.imolt-shell-nav { display: flex; align-items: center; gap: ${space.l}px; flex-wrap: wrap; }

.imolt-shell-link {
  display: inline-flex;
  align-items: center;
  min-height: ${layout.touchTarget}px;
  font-family: ${fonts.ui};
  font-weight: 500;
  font-size: 14px;
  line-height: 20px;
  color: ${colors.textPrimary};
  text-decoration: none;
  border-bottom: 2px solid transparent;
}

.imolt-shell-link:hover { border-bottom-color: ${colors.borderDefault}; }

/* Текущий раздел отмечен тремя признаками сразу: цветом марки, насыщенностью
   и подчёркиванием. Одним цветом состояние не выражается (разд. 4.6). */
.imolt-shell-link[aria-current='page'] {
  color: ${colors.brand};
  font-weight: 700;
  border-bottom-color: ${colors.brand};
}

/* Профиль участника — вход в кабинет (BUG-009), поэтому он цель касания
   полной высоты, а не строка текста. Видимый фокус даёт общее правило
   :focus-visible темы: второе такое правило рано или поздно разошлось бы с
   первым. Ужимается, а не выталкивает перечень разделов: длинное имя
   участника обрезается многоточием внутри самого профиля. */
.imolt-shell-profile {
  margin-left: auto;
  flex: 0 1 auto;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  min-height: ${layout.touchTarget}px;
  padding: 0 ${space.xs}px;
  border-radius: ${radius.pill}px;
  text-decoration: none;
  color: ${colors.textPrimary};
}

.imolt-shell-profile:hover { background: ${colors.bgSurfaceMuted}; }

/* Открытый кабинет отмечен заливкой и обводкой: одной заливкой текущий раздел
   не отличался бы от наведения (разд. 4.6). */
.imolt-shell-profile[aria-current='page'] {
  background: ${colors.bgSurfaceMuted};
  box-shadow: inset 0 0 0 1px ${colors.borderDefault};
}

.imolt-shell-main { flex: 1; }

.imolt-shell-container {
  max-width: ${BREAKPOINTS.container}px;
  margin: 0 auto;
  padding: ${space.xl}px ${layout.gutterWide}px ${space.xxxl}px;
}

.imolt-shell-main:focus-visible { outline-offset: -4px; }

/* Телефон: шапка ниже, содержимое во всю ширину, поля — 16 px (разд. 4.3). */
.imolt-shell--narrow .imolt-shell-head-line {
  min-height: ${layout.headerHeightCompact}px;
  padding: 0 ${layout.gutter + CONTENT_INSET}px;
  gap: ${space.s}px;
}

.imolt-shell--narrow .imolt-shell-brand { font-size: 20px; line-height: 24px; }

.imolt-shell--narrow .imolt-shell-container {
  padding: ${space.l}px ${layout.gutter}px
    ${layout.bottomNavHeight + layout.touchTarget}px;
}

/* Нижняя панель переходов: верх экрана телефона до большого пальца не
   достаёт, поэтому переходы живут внизу (макет «Кабинет мобильный»). */
.imolt-shell-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: ${zIndex.shell};
  height: ${layout.bottomNavHeight}px;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  background: ${colors.bgSurface};
  border-top: 1px solid ${colors.borderDivider};
}

.imolt-shell-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: ${layout.touchTarget}px;
  padding: 0 2px;
  font-family: ${fonts.ui};
  font-weight: 500;
  font-size: 11px;
  line-height: 13px;
  color: ${colors.textSecondary};
  text-align: center;
  text-decoration: none;
}

.imolt-shell-tab svg { color: ${colors.iconDefault}; }

.imolt-shell-tab[aria-current='page'] { color: ${colors.textPrimary}; font-weight: 700; }
.imolt-shell-tab[aria-current='page'] svg { color: ${colors.iconActive}; }

/* Липкая сводка выбора поднимается над панелью переходов: иначе нижняя
   панель закрывает итог и кнопки действия. */
.imolt-shell--narrow .imolt-bar { bottom: ${layout.bottomNavHeight}px; }
`;
