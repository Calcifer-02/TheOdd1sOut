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
 * зазор мимо шкалы отступов — они упадут.
 *
 *   npx vitest run tests/ThemeRules.test.ts
 *
 * Критерия приёмки на оформление общего слоя в реестре нет: AC-085a — AC-085c
 * говорят о представлении экрана по ширине окна, а не о ритме и состояниях
 * (разрыв назван в отчёте). Поэтому якоря обслуживающие.
 *
 * @supports: R-023
 * @supports: R-058
 * @supports: R-085
 */
import { describe, expect, it } from 'vitest';
import { THEME_CSS } from '@/shared/ui';
import { colors, layout, space, stroke } from '@/shared/ui/tokens';

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

/** Левое поле из сокращённой записи `padding`. */
function paddingLeft(body: string): number {
  const found = /padding:\s*([^;]+);/.exec(body);

  expect(found, 'правило объявляет поле').not.toBeNull();

  const sides = (found?.[1] ?? '')
    .trim()
    .split(/\s+/)
    .map(side => Number.parseInt(side, 10));

  if (sides.length >= 4) {
    return sides[3];
  }

  return sides.length >= 2 ? sides[1] : sides[0];
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

  it('держит одно поле у карточки, всплывающего окна и выдвижной панели', () => {
    const поле = paddingLeft(ruleBody('.imolt-card'));

    expect(поле).toBe(space.m);
    expect(paddingLeft(ruleBody('.imolt-popover'))).toBe(поле);
    expect(paddingLeft(ruleBody('.imolt-sheet'))).toBe(поле);
  });
});
