// Статический аудит продуктовых текстов мини-приложения: состояние и
// действие выражаются словом и семантикой, а не картинкой из шрифта
// (карточка практики PRACT-029, раздел «чего не делать» дизайн-договора).
//
// Проверка фальсифицируема: добавьте эмодзи в продуктовый текст — она упадёт.
import { describe, expect, it } from 'vitest';
import { sourceFiles } from './repository';

/** Диапазоны знаков, которые платформа рисует картинкой, а не буквой. */
const PICTOGRAPH_RANGES: [number, number][] = [
  [0x1f000, 0x1faff],
  [0x2600, 0x27bf],
  [0x2b00, 0x2bff],
  [0xfe0f, 0xfe0f],
];

function pictographs(text: string): string[] {
  return [...text].filter((character) => {
    const code = character.codePointAt(0) ?? 0;
    return PICTOGRAPH_RANGES.some(([from, to]) => code >= from && code <= to);
  });
}

describe('продуктовый текст мини-приложения', () => {
  it('не несёт смысла эмодзи и пиктограммами шрифта', () => {
    const offenders = sourceFiles()
      .map((file) => ({ path: file.path, found: pictographs(file.text) }))
      .filter((file) => file.found.length > 0);

    expect(
      offenders.map((file) => `${file.path}: ${file.found.join(' ')}`),
      'состояние и действие выражаются словом и значком с доступным именем',
    ).toEqual([]);
  });
});
