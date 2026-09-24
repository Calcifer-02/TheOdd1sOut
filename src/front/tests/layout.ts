// Измерение левой вертикали экрана в проверках раскладки.
//
// Настоящей раскладки в jsdom нет, но каскад правил он считает: у узла
// доступны действующие `padding-left`, `border-left-width` и `margin-left`.
// Этого хватает, чтобы сложить отступ содержимого от края экрана и сравнить
// вертикали блоков — ровно то, на что жалуется дефект BUG-003.
//
// Общее оформление подключает оболочка приложения, а проверка экрана рисует
// экран без неё: подпись таблицы и прочие общие правила пришлось бы считать
// отсутствующими. Поэтому оформление подключается здесь, тем же текстом
// `THEME_CSS`, что и в приложении.
//
// Файл без «.test.» в имени в прогон не попадает: это общая оснастка.
import { THEME_CSS } from '@/shared/ui';

/** Подключение общего оформления на время файла проверок. */
export function installThemeStyles(): () => void {
  const style = document.createElement('style');
  style.dataset.imolt = 'theme-test';
  style.textContent = THEME_CSS;
  document.head.append(style);

  return () => style.remove();
}

function pixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Отступ содержимого узла от левого края экрана: собственное поле узла плюс
 * поля, рамки и отступы его предков вплоть до корня экрана.
 */
export function leftInset(node: Element, root: Element): number {
  let total = 0;
  let current: Element | null = node;

  while (current !== null && current !== root) {
    const style = getComputedStyle(current);
    total += pixels(style.paddingLeft) + pixels(style.borderLeftWidth) + pixels(style.marginLeft);
    current = current.parentElement;
  }

  if (current === null) {
    throw new Error('Узел лежит вне названного корня экрана');
  }

  return total;
}
