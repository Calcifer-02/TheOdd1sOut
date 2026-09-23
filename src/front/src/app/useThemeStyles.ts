/**
 * Подключение оформления к странице.
 *
 * Стили собираются из токенов в коде, а не лежат отдельным файлом: иначе
 * прямые значения разошлись бы по двум источникам (ADR-0008, инвариант 1).
 * Вынесено в общий приём, потому что точек входа у приложения две — экран и
 * витрина, — и второе место подключения разошлось бы с первым.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import { useEffect } from 'react';
import { THEME_CSS } from '@/shared/ui';

export function useThemeStyles(): void {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = THEME_CSS;
    document.head.append(style);

    return () => style.remove();
  }, []);
}
