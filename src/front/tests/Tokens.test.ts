// Инвариант 1 решения ADR-0008: прямые визуальные значения живут только в
// модуле токенов. Иначе роль цвета расходится по файлам, и смена роли
// перестаёт менять интерфейс согласованно (карточка практики PRACT-017).
//
// Проверка фальсифицируема: впишите цвет в компонент — она упадёт.
import { describe, expect, it } from 'vitest';
import { sourceFiles } from './repository';

/** Цвет, записанный значением: шестнадцатеричный код или функция rgb. */
const DIRECT_COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/g;

const TOKENS_FILE = 'src/front/src/shared/ui/tokens.ts';

describe('оформление мини-приложения', () => {
  it('держит прямые визуальные значения только в модуле токенов', () => {
    const offenders = sourceFiles()
      .filter((file) => file.path !== TOKENS_FILE)
      .map((file) => ({ path: file.path, found: file.text.match(DIRECT_COLOR) ?? [] }))
      .filter((file) => file.found.length > 0);

    expect(
      offenders.map((file) => `${file.path}: ${file.found.join(' ')}`),
      'цвет называется ролью из tokens.ts, а не значением',
    ).toEqual([]);
  });

  it('называет роль цвета, а не его оттенок', () => {
    const tokens = sourceFiles().find((file) => file.path === TOKENS_FILE);
    const roles = [...(tokens?.text.match(/^\s{2}(\w+):/gm) ?? [])].map((line) => line.trim());

    // Имя вида «grey600» допустимо в исходном слое палитры, но не в ролях:
    // роль обязана называть назначение, иначе токены не дают ничего сверх
    // переменной с цветом.
    const semantic = tokens?.text.slice(tokens.text.indexOf('export const colors')) ?? '';
    const named = [...semantic.matchAll(/^\s{2}(\w+):/gm)].map((match) => match[1]);

    expect(roles.length).toBeGreaterThan(0);
    expect(
      named.filter((role) => /^(grey|lime|red|green|amber|blue|orange|white|black)\d*$/.test(role)),
      'роль называет назначение: bgSurface, statusBlockedText',
    ).toEqual([]);
  });
});
