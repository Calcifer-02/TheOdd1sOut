/**
 * Полнота витрины компонентов (R-084).
 *
 * Витрина ценна ровно настолько, насколько она полна: компонент, которого в
 * ней нет, остаётся непроверенным и расходится с остальными молча. Проверка
 * сверяет две выборки — что интерфейс объявляет компонентом и что витрина
 * показывает.
 *
 * Проверка фальсифицируема: заведите экспортируемый компонент в общем слое,
 * сущности или виджете и не поставьте его в витрину — она назовёт имя.
 *
 *   npx vitest run tests/Showcase.test.ts
 *
 * @ac: AC-084a
 */
import { describe, expect, it } from 'vitest';
import { sourceFiles } from './repository';

const SHOWCASE = 'src/front/src/pages/showcase/ui/Showcase.tsx';

/** Слои, чьи компоненты обязаны попасть в витрину. */
const ПОКАЗЫВАЕМЫЕ_СЛОИ = ['src/front/src/shared/ui/', 'src/front/src/entities/', 'src/front/src/widgets/'];

/**
 * Компонент — экспортируемая функция с именем в верхнем регистре. Помощники
 * вроде `badgeStatus` начинаются со строчной и компонентами не считаются.
 */
function компоненты(text: string): string[] {
  return [...text.matchAll(/^export function ([A-Z][A-Za-z0-9]*)/gm)].map((match) => match[1]);
}

const файлы = sourceFiles();
const витрина = файлы.find((file) => file.path === SHOWCASE);

describe('витрина компонентов', () => {
  it('существует отдельной страницей', () => {
    expect(витрина, `витрина не найдена по пути ${SHOWCASE}`).toBeDefined();
  });

  it('показывает каждый объявленный компонент интерфейса', () => {
    const объявленные = файлы
      .filter((file) => ПОКАЗЫВАЕМЫЕ_СЛОИ.some((слой) => file.path.startsWith(слой)))
      .filter((file) => file.path.endsWith('.tsx'))
      .flatMap((file) => компоненты(file.text));

    // Пустая выборка сделала бы проверку бессодержательной.
    expect(объявленные.length).toBeGreaterThan(4);

    const текст = витрина?.text ?? '';
    const пропущенные = [...new Set(объявленные)].filter((имя) => !текст.includes(`<${имя}`));

    expect(пропущенные, 'компонент объявлен интерфейсом, но не показан в витрине').toEqual([]);
  });
});
