/**
 * Подключение оформления к странице.
 *
 * Стили собираются из токенов в коде, а не лежат отдельным файлом: иначе
 * прямые значения разошлись бы по двум источникам (ADR-0008, инвариант 1).
 *
 * Правил стало больше, чем у одного экрана, и держать их одной строкой нельзя:
 * экраны пишутся раздельно, а общий файл стилей превращается в место, где
 * правки сталкиваются. Поэтому каждый экран объявляет своё оформление рядом с
 * собой и подключает его по имени, а общая часть подключается один раз.
 *
 * Имя — ключ подключения: одна и та же порция правил попадает в страницу один
 * раз, сколько бы компонентов её ни просили.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import { useEffect } from 'react';
import { THEME_CSS } from './theme';

/** Сколько живых потребителей у порции правил: ноль — узел убирается. */
const mounted = new Map<string, number>();

function attach(name: string, css: string): () => void {
  const count = mounted.get(name) ?? 0;
  mounted.set(name, count + 1);

  if (count === 0) {
    const style = document.createElement('style');
    style.dataset.imolt = name;
    style.textContent = css;
    document.head.append(style);
  }

  return () => {
    const left = (mounted.get(name) ?? 1) - 1;
    mounted.set(name, left);

    if (left === 0) {
      document.head.querySelector(`style[data-imolt="${name}"]`)?.remove();
    }
  };
}

/** Подключение именованной порции правил на время жизни компонента. */
export function useStyles(name: string, css: string): void {
  useEffect(() => attach(name, css), [name, css]);
}

/** Общее оформление: токены, примитивы, раскладка. Нужно каждому экрану. */
export function useThemeStyles(): void {
  useStyles('theme', THEME_CSS);
}
