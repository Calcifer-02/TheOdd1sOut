/**
 * Полнота витрины компонентов (R-084).
 *
 * Витрина ценна ровно настолько, насколько она полна: компонент, которого в
 * ней нет, остаётся непроверенным и расходится с остальными молча. Проверка
 * сверяет две выборки — что интерфейс объявляет компонентом и что витрина
 * показывает.
 *
 * Витрина разложена на разделы, поэтому проверка смотрит всю её папку, а не
 * один файл: раздел, забытый в рамке витрины, тоже обязан быть виден.
 *
 * Проверка фальсифицируема: заведите экспортируемый компонент в общем слое,
 * сущности или виджете и не поставьте его в витрину — она назовёт имя.
 *
 *   npx vitest run tests/Showcase.test.ts
 *
 * @ac: AC-084a
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { miniappSource, sourceFiles } from './repository';

const SHOWCASE_FRAME = 'src/front/src/pages/showcase/ui/Showcase.tsx';

const SHOWCASE_DIRECTORY = 'src/front/src/pages/showcase/';

/** Слои, чьи компоненты обязаны попасть в витрину. */
const ПОКАЗЫВАЕМЫЕ_СЛОИ = ['src/front/src/shared/ui/', 'src/front/src/entities/', 'src/front/src/widgets/'];

/**
 * Исключения — с причиной и поимённо; молча список не растёт (PRACT-017).
 * Оболочка страницы образцом внутри витрины быть не может: витрина сама живёт
 * внутри такой же оболочки, и образец в образце ничего не показывает.
 */
const ВНЕ_ВИТРИНЫ = new Map([['AppShell', 'оболочка страницы, а не образец внутри неё']]);

/**
 * Компонент — экспортируемая функция с именем в верхнем регистре. Помощники
 * вроде `badgeStatus` начинаются со строчной и компонентами не считаются.
 */
function компоненты(text: string): string[] {
  return [...text.matchAll(/^export function ([A-Z][A-Za-z0-9]*)/gm)].map(match => match[1]);
}

const файлы = sourceFiles();

const витрина = файлы.filter(file => file.path.startsWith(SHOWCASE_DIRECTORY));

describe('витрина компонентов', () => {
  it('существует отдельной страницей', () => {
    const рамка = файлы.find(file => file.path === SHOWCASE_FRAME);
    expect(рамка, `витрина не найдена по пути ${SHOWCASE_FRAME}`).toBeDefined();
  });

  it('показывает каждый раздел витрины', () => {
    const рамка = файлы.find(file => file.path === SHOWCASE_FRAME)?.text ?? '';

    const разделы = sourceFiles(join(miniappSource, 'pages', 'showcase', 'sections')).flatMap(file =>
      компоненты(file.text),
    );

    expect(разделы.length).toBeGreaterThan(3);

    const забытые = разделы.filter(имя => !рамка.includes(`<${имя}`));
    expect(забытые, 'раздел витрины объявлен, но не поставлен в неё').toEqual([]);
  });

  it('показывает каждый объявленный компонент интерфейса', () => {
    const объявленные = файлы
      .filter(file => ПОКАЗЫВАЕМЫЕ_СЛОИ.some(слой => file.path.startsWith(слой)))
      .filter(file => file.path.endsWith('.tsx'))
      .flatMap(file => компоненты(file.text));

    // Пустая выборка сделала бы проверку бессодержательной.
    expect(объявленные.length).toBeGreaterThan(4);

    const текст = витрина.map(file => file.text).join('\n');
    const пропущенные = [...new Set(объявленные)]
      .filter(имя => !ВНЕ_ВИТРИНЫ.has(имя))
      .filter(имя => !текст.includes(`<${имя}`));

    expect(пропущенные, 'компонент объявлен интерфейсом, но не показан в витрине').toEqual([]);
  });
});
