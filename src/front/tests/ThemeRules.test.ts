/**
 * Оформление общего слоя как проверяемый договор, а не как вид на снимке.
 *
 * Браузера у проверки нет: jsdom не считает раскладку, и «строки набегают друг
 * на друга» напрямую измерить нечем. Поэтому проверяется правило, из которого
 * дефект следует: жёсткая высота ячейки, граница липкой шапки, край подписи
 * таблицы, второе объявление класса, отсутствующее наведение и зазор мимо
 * шкалы. Каждое из них названо дефектом в реестре.
 *
 * Проверки фальсифицируемы: верните ячейке таблицы жёсткую высоту, схлопните
 * границы таблицы, сдвиньте подпись таблицы внутрь плашки, покрасьте ссылку
 * маркой вместо роли `link`, объявите строку согласия вторым правилом, уберите
 * любое правило наведения или вынесите его из-под `hover: hover`, поставьте
 * зазор мимо шкалы отступов, верните чипу собственную высоту 36 px, разведите
 * боковые поля шапки и ячейки таблицы, уберите резерв ширины у кнопки,
 * меняющей подпись, верните вынесенному окну координаты предка, снимите
 * обрезку у области прокрутки таблицы, уберите подложку затемнения у
 * модального окна или опустите его под всплывающее — они упадут.
 *
 *   npx vitest run tests/ThemeRules.test.ts
 *
 * Критерия приёмки на оформление общего слоя в реестре нет: AC-085a — AC-085c
 * говорят о представлении экрана по ширине окна, а не о ритме и состояниях
 * (разрыв назван в отчёте). Поэтому якоря обслуживающие.
 *
 * @supports: R-023
 * @supports: R-024
 * @supports: R-033
 * @supports: R-058
 * @supports: R-085
 */
import { describe, expect, it } from 'vitest';
import { THEME_CSS } from '@/shared/ui';
import { colors, layout, radius, space, stroke, zIndex } from '@/shared/ui/tokens';

/** Объявления правила с точно этим селектором. */
function ruleBody(selector: string): string {
  const head = `\n${selector} {`;
  const at = THEME_CSS.indexOf(head);

  expect(at, `правило «${selector}» объявлено в общем слое`).toBeGreaterThan(-1);

  const from = at + head.length;

  return THEME_CSS.slice(from, THEME_CSS.indexOf('}', from));
}

/** Сколько раз селектор объявлен. Два объявления одного класса — расхождение. */
function ruleCount(selector: string): number {
  return THEME_CSS.split(`\n${selector} {`).length - 1;
}

/** Боковые поля из сокращённой записи `padding`. */
function paddingX(body: string): { left: number; right: number } {
  const found = /padding:\s*([^;]+);/.exec(body);

  expect(found, 'правило объявляет поле').not.toBeNull();

  const sides = (found?.[1] ?? '')
    .trim()
    .split(/\s+/)
    .map(side => Number.parseInt(side, 10));

  if (sides.length >= 4) {
    return { right: sides[1], left: sides[3] };
  }

  if (sides.length >= 2) {
    return { right: sides[1], left: sides[1] };
  }

  return { right: sides[0], left: sides[0] };
}

/** Левое поле из сокращённой записи `padding`. */
function paddingLeft(body: string): number {
  return paddingX(body).left;
}

/**
 * Объявленная высота управления. Берётся первое объявление `height` или
 * `min-height`: составное `line-height` высотой управления не является.
 */
function controlHeight(selector: string): number {
  const body = ruleBody(selector);
  const found = /(?:^|\s)(?:min-)?height:\s*(\d+)px/.exec(body);

  expect(found, `правило «${selector}» объявляет высоту`).not.toBeNull();

  return Number.parseInt(found?.[1] ?? '0', 10);
}

/** Тело внешнего правила вместе с вложенными: скобки считаются, а не ищутся. */
function atRuleBody(head: string): string {
  const at = THEME_CSS.indexOf(head);

  expect(at, `правило «${head}» объявлено в общем слое`).toBeGreaterThan(-1);

  let depth = 0;

  for (let index = THEME_CSS.indexOf('{', at); index < THEME_CSS.length; index += 1) {
    if (THEME_CSS[index] === '{') {
      depth += 1;
    } else if (THEME_CSS[index] === '}') {
      depth -= 1;

      if (depth === 0) {
        return THEME_CSS.slice(at, index + 1);
      }
    }
  }

  throw new Error(`Правило «${head}» не закрыто`);
}

const HOVER_BLOCK = atRuleBody('@media (hover: hover)');

describe('таблица сравнения (BUG-001, BUG-003)', () => {
  it('ячейка с многострочным содержимым растит строку, а не режет её', () => {
    const body = ruleBody('.imolt-table tbody td');

    expect(body, 'высота строки сравнения — наименьшая, а не мера').toContain(`min-height: ${layout.rowHeight}px`);
    expect(body, 'жёсткая высота обрезала бы название, адрес и перечень тарифов').not.toMatch(/(^|[^-])height:\s*\d/);
  });

  it('липкая шапка не накрывает первую строку', () => {
    expect(
      ruleBody('.imolt-table'),
      'при схлопнутых границах линия под шапкой принадлежит таблице и на прокрутке остаётся на месте',
    ).toContain('border-collapse: separate');

    const head = ruleBody('.imolt-table thead th');

    expect(head).toContain('position: sticky');
    expect(head, 'разделитель липкой ячейки рисуется внутренней тенью').toContain(
      `box-shadow: inset 0 -${stroke.hairline}px 0 ${colors.borderDivider}`,
    );
    expect(head, 'граница липкой ячейки отстаёт от самой шапки').not.toContain('border-bottom');
  });

  it('левый край подписи совпадает с левым краем первой колонки шапки', () => {
    const caption = paddingLeft(ruleBody('.imolt-table-caption'));

    expect(caption, 'подпись — часть карточки таблицы, а не отступ внутрь плашки').toBe(
      paddingLeft(ruleBody('.imolt-table thead th')),
    );
    expect(caption).toBe(paddingLeft(ruleBody('.imolt-table tbody td')));
  });
});

describe('ссылка общего слоя (BUG-002)', () => {
  it('окрашена ролью из токенов, а не маркой', () => {
    const body = ruleBody('.imolt-link');

    expect(body).toContain(`color: ${colors.link}`);
    expect(body, 'оранжевый — цвет марки, а не действия (разд. 4.6)').not.toContain(colors.brand);
  });

  it('подчёркнута линией с объявленной толщиной и отступом, а не чертой браузера', () => {
    const body = ruleBody('.imolt-link, .imolt-button--tertiary');

    expect(body).toContain(`text-decoration-thickness: ${stroke.hairline}px`);
    expect(body).toContain(`text-underline-offset: ${space.xxs}px`);
    expect(HOVER_BLOCK, 'под указателем линия плотнее').toContain('.imolt-link:hover');
  });

  it('показывает фокус кольцом, а не одной сменой цвета', () => {
    expect(ruleBody('.imolt-link:focus-visible')).toContain(`outline: ${stroke.emphasis}px solid ${colors.link}`);
  });
});

describe('строка согласия в подвале формы (BUG-005)', () => {
  it('объявлена одним правилом: второе сняло бы выравнивание и высоту', () => {
    expect(ruleCount('.imolt-consent')).toBe(1);
  });

  it('держит цель касания 44 px и ставит флажок с подписью по одной линии', () => {
    const body = ruleBody('.imolt-consent');

    expect(body).toContain('align-items: center');
    expect(body).toContain(`min-height: ${layout.touchTarget}px`);
    expect(ruleBody('.imolt-check-label'), 'нажатие мимо квадрата попадает в подпись').toContain(
      `min-height: ${layout.touchTarget}px`,
    );
  });
});

describe('отклик на наведение (BUG-008)', () => {
  const НАЖИМАЕМЫЕ = [
    '.imolt-chip',
    '.imolt-tab',
    '.imolt-sort',
    '.imolt-pill',
    '.imolt-button--tertiary',
    '.imolt-suggest button',
    '.imolt-option',
    '.imolt-table tbody tr',
  ];

  it.each(НАЖИМАЕМЫЕ)('управление %s отвечает на наведение', selector => {
    expect(HOVER_BLOCK).toContain(`${selector}:hover`);
  });

  it('не залипает на сенсорном экране: все правила наведения под hover: hover', () => {
    const остальное = THEME_CSS.replace(HOVER_BLOCK, '');

    expect(остальное, 'на тач-экране наведение остаётся после касания').not.toContain(':hover');
  });

  it('не подменяет выбранное состояние цветом наведения', () => {
    expect(HOVER_BLOCK).toContain(`.imolt-tab[aria-selected='true']:hover`);
    expect(HOVER_BLOCK).toContain(`.imolt-chip[aria-pressed='true']:hover`);
    expect(HOVER_BLOCK).toContain(`.imolt-sort[aria-pressed='true']:hover`);
  });
});

describe('вертикальный ритм общего слоя (BUG-011)', () => {
  /** Правила верхнего уровня: содержимое `@media` и `@keyframes` отброшено. */
  function topLevelRules(): string[] {
    const withoutComments = THEME_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    let plain = '';
    let from = 0;

    while (from < withoutComments.length) {
      const at = withoutComments.indexOf('@', from);

      if (at === -1) {
        plain += withoutComments.slice(from);
        break;
      }

      plain += withoutComments.slice(from, at);

      let depth = 0;
      let index = withoutComments.indexOf('{', at);

      for (; index < withoutComments.length; index += 1) {
        if (withoutComments[index] === '{') {
          depth += 1;
        } else if (withoutComments[index] === '}') {
          depth -= 1;

          if (depth === 0) {
            break;
          }
        }
      }

      from = index + 1;
    }

    return [...plain.matchAll(/([^{}]+)\{[^{}]*\}/g)].map(rule => rule[1].trim());
  }

  it('не объявляет один класс дважды: второе правило тихо снимает первое', () => {
    const классы = topLevelRules().filter(selector => /^\.[a-z0-9-]+$/.test(selector));
    const дважды = классы.filter((selector, at) => классы.indexOf(selector) !== at);

    expect([...new Set(дважды)]).toEqual([]);
  });

  it('берёт зазоры между элементами из шкалы отступов', () => {
    const шкала = new Set<number>(Object.values(space));
    const мимо = [...THEME_CSS.matchAll(/gap:\s*(\d+)px/g)]
      .map(found => Number.parseInt(found[1], 10))
      .filter(value => !шкала.has(value));

    expect([...new Set(мимо)], 'зазор мимо шкалы, кратной восьми (разд. 4.3)').toEqual([]);
  });

  it('держит одно поле у карточки, всплывающего окна, выдвижной панели и модального окна', () => {
    const поле = paddingLeft(ruleBody('.imolt-card'));

    expect(поле).toBe(space.m);
    expect(paddingLeft(ruleBody('.imolt-popover'))).toBe(поле);
    expect(paddingLeft(ruleBody('.imolt-sheet'))).toBe(поле);
    expect(paddingLeft(ruleBody('.imolt-modal'))).toBe(поле);
  });
});

/**
 * Второй пакет замечаний заказчика по живому стенду: на экране `#/landfills`
 * при ширине окна 1496 поле поиска и кнопка «Найти» были 48 точек, а чипы
 * групп отходов — 36, и полоса читалась как набор разнородных управлений.
 */
describe('высота управлений одной полосы (R-085)', () => {
  /** Управления, которые встают в одну полосу и потому равны по высоте. */
  const УПРАВЛЕНИЯ = [
    '.imolt-input',
    '.imolt-select',
    '.imolt-button',
    '.imolt-button--secondary',
    '.imolt-button--tertiary',
    '.imolt-tab, .imolt-sort, .imolt-chip',
    '.imolt-pill',
  ];

  it.each(УПРАВЛЕНИЯ)('управление %s объявлено общей высотой полосы', selector => {
    expect(controlHeight(selector)).toBe(layout.controlHeight);
  });

  it('общая высота не ниже наименьшей цели касания', () => {
    expect(layout.controlHeight, 'цель касания не меньше 44 px (разд. 4.5)').toBeGreaterThanOrEqual(layout.touchTarget);
  });

  it('малый размер кнопки не заводит второй высоты', () => {
    const body = ruleBody('.imolt-button--s');

    expect(body, 'размер s меняет поле и кегль, но не высоту управления').not.toMatch(/(?:^|\s)(?:min-)?height:/);
  });

  it('переключатель меры не переобъявляет высоту рядом с полем количества', () => {
    expect(ruleBody('.imolt-units .imolt-pill'), 'высота управления считается в одном месте').not.toMatch(
      /(?:^|\s)(?:min-)?height:/,
    );
  });
});

/**
 * Замер живого стенда: у ячейки шапки поле `8px 12px`, у ячейки данных `12px`.
 * Вертикальные поля различаются намеренно — шапка плотнее; боковые обязаны
 * совпадать, иначе заголовок столбца и значение под ним стоят на разных
 * вертикалях (R-024).
 */
describe('вертикаль столбца таблицы (R-024)', () => {
  it('боковые поля шапки и ячейки данных совпадают', () => {
    const шапка = paddingX(ruleBody('.imolt-table thead th'));
    const ячейка = paddingX(ruleBody('.imolt-table tbody td'));

    expect(шапка.left, 'левый край заголовка столбца и значения под ним один').toBe(ячейка.left);
    expect(шапка.right, 'правый край числового столбца в шапке и в ячейке один').toBe(ячейка.right);
  });

  it('числовой столбец выровнен по правому краю и в шапке, и в ячейке', () => {
    const body = ruleBody(`.imolt-table th[data-align='end'], .imolt-table td[data-align='end']`);

    expect(body, 'правило, названное только для ячейки, оставляет заголовок у левого края').toContain(
      'text-align: right',
    );
  });
});

/**
 * Переключатель порядка сортировки меняет подпись вместе с состоянием
 * («По возрастанию» — «По убыванию»). Без резерва ширины полоса управления
 * сдвигается на каждое нажатие (второй пакет замечаний заказчика, R-024).
 */
describe('резерв ширины у кнопки, меняющей подпись (R-024)', () => {
  it('держит текущую и резервную подписи в одной ячейке сетки', () => {
    const стек = ruleBody('.imolt-button-label--reserve');

    expect(стек).toContain('display: inline-grid');
    expect(стек, 'без общей области подписи встанут друг за другом и удвоят ширину').toContain(
      `grid-template-areas: 'imolt-label'`,
    );
    expect(ruleBody('.imolt-button-label--reserve > *')).toContain('grid-area: imolt-label');
  });

  it('скрывает резервную подпись, не снимая её ширины', () => {
    const резерв = ruleBody('.imolt-button-reserve');

    expect(резерв).toContain('visibility: hidden');
    expect(резерв, 'display: none убрал бы и саму ширину, ради которой резерв стоит').not.toContain('display: none');
  });
});

/**
 * Значок статуса полигона и дата актуальности сходились в ячейке таблицы в
 * «Активенданные от 17.09»: зазор между ними не задавало ни одно правило
 * (второй пакет замечаний заказчика, R-028).
 */
describe('значок статуса и дата актуальности (R-028)', () => {
  it('разведены зазором из шкалы отступов, а не пробелом в разметке', () => {
    const body = ruleBody('.imolt-status');

    expect(body).toContain('display: inline-flex');
    expect(body, 'зазор объявлен правилом: пробел разметки пропадает на переносе').toContain(
      `gap: ${space.xxs}px ${space.xs}px`,
    );
  });

  it('в узком столбце переносит дату на свою строку, а не обрезает её', () => {
    const body = ruleBody('.imolt-status');

    expect(body).toContain('flex-wrap: wrap');
    expect(body).toContain('max-width: 100%');
  });

  it('не сплющивает значок состояния вместе с подписью', () => {
    expect(ruleBody('.imolt-badge > svg'), 'состояние не выражается одним цветом (разд. 4.6)').toContain('flex: none');
  });
});

/**
 * Замер живого стенда 24.09.2026 при ширине окна 1496: окно маршрута 360 × 400
 * стояло в ячейке 78 × 48 внутри области прокрутки 776 × 254, и «overflow:
 * auto» резал его и справа, и снизу. Правило, из которого дефект следует, —
 * система координат окна: у окна в потоке разметки её задаёт обрезающий
 * предок.
 */
describe('всплывающее окно маршрута и обрезка таблицы (R-033)', () => {
  it('вынесенное окно стоит в координатах окна браузера, а не предка', () => {
    const body = ruleBody(`.imolt-popover[data-detached='true']`);

    expect(body, 'у окна в потоке разметки координаты считает позиционированный предок').toContain('position: fixed');
  });

  it('область прокрутки таблицы сохраняет прокрутку вместо снятой обрезки', () => {
    // Снять обрезку у предка — второй способ вывести окно из-под неё, и он
    // отвергнут: этой же обрезкой держатся горизонтальная прокрутка семи
    // столбцов на узком окне и липкая шапка таблицы (R-085).
    expect(ruleBody('.imolt-table-scroll'), 'без прокрутки столбцы сжимаются до нечитаемого').toContain(
      'overflow: auto',
    );
  });
});

/**
 * Решение заказчика от 24.09.2026: маршрут открывается модальным окном поверх
 * страницы с настоящей картой. Прежде окно отрисовывалось внутри таблицы, и
 * его приходилось двигать вместе с колонками. Раскладки в jsdom нет, поэтому
 * проверяется правило, из которого дефект следует: система координат окна,
 * подложка над страницей и порядок наложения.
 */
describe('модальное окно маршрута (R-033)', () => {
  it('стоит над страницей на подложке затемнения, а не в потоке разметки', () => {
    const подложка = ruleBody('.imolt-modal-backdrop');

    expect(подложка, 'окно в потоке разметки режется обрезающим предком').toContain('position: fixed');
    expect(подложка, 'без подложки нажатие мимо окна попадает в таблицу под ним').toContain(
      `background: ${colors.overlay}`,
    );
    expect(подложка).toContain(`z-index: ${zIndex.modal}`);
  });

  it('встаёт выше всплывающего окна: оно иначе читалось бы частью разговора', () => {
    expect(zIndex.modal).toBeGreaterThan(zIndex.popover);
  });

  it('оформлено как всплывающее окно: то же скругление и та же тень (разд. 4.4)', () => {
    const окно = ruleBody('.imolt-modal');

    expect(окно).toContain(`border-radius: ${radius.field}px`);
    expect(окно).toContain(`box-shadow: ${layout.shadow}`);
    // Предел объявлен и ограничен окном браузера: без второй границы окно на
    // узком экране вылезло бы за его края.
    expect(окно).toContain(`${layout.modalWidth}px`);
    expect(окно, 'окно не ограничено шириной окна браузера').toContain('100vw');
  });

  it('держит крестик закрытия мерой кнопки-значка', () => {
    const крестик = ruleBody('.imolt-modal-close');

    expect(крестик).toContain(`width: ${layout.iconButton}px`);
    expect(крестик).toContain(`height: ${layout.iconButton}px`);
  });
});

/**
 * Карта маршрута настоящая: библиотека карты рисует полотно тайлами
 * OpenStreetMap (R-034). Лицензия ODbL требует называть авторов данных.
 */
describe('карта маршрута (R-034)', () => {
  it('держит меру полотна и обрезает слои библиотеки по своим краям', () => {
    const карта = ruleBody('.imolt-map');

    expect(карта).toContain(`height: ${layout.routeMapHeight}px`);
    expect(карта, 'слои полотна уходят произвольно далеко за края видимой части').toContain('overflow: hidden');
  });

  it('оставляет подпись об источнике видимой', () => {
    const подпись = ruleBody('.imolt-map-credit');

    expect(подпись, 'лицензия ODbL требует называть авторов данных карты').not.toContain('display: none');
    expect(подпись).toContain(`color: ${colors.textSecondary}`);
  });

  it('различает метки не одним цветом: у полигона своя рамка (разд. 4.6)', () => {
    const метка = ruleBody(`.imolt-map-pin[data-point='landfill']`);

    expect(метка).toContain(`border-color: ${colors.accentDark}`);
  });
});

describe('подсказка и ошибка поля', () => {
  // Браузерные поля абзаца растили строку формы на 40 точек ради подсказки в
  // шестнадцать: при мере в кубометрах под полем объёма появляется пересчёт в
  // тонны, и форма подпрыгивала.
  it('отбита сверху из шкалы отступов, а не полями абзаца по умолчанию', () => {
    const правило = ruleBody(`.imolt-hint,\n.imolt-error`);

    expect(правило, 'подсказка и ошибка не объявлены одним правилом').not.toBe('');
    expect(правило).toContain(`margin: ${space.xxs}px 0 0;`);
  });
});
