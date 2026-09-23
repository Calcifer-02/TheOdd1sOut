/**
 * Корень мини-приложения: оформление из токенов и экран расчёта.
 *
 * Разметка страницы и заголовок вкладки задаются здесь, потому что
 * мини-приложение открывается поверх мессенджера и своей навигации не имеет:
 * экран один, состояние выборки живёт в адресе (ADR-0008).
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import { useEffect } from 'react';
import { CalculatorScreen } from './CalculatorScreen';
import { THEME_CSS } from './theme';

export function App() {
  useEffect(() => {
    // Стили собираются из токенов в коде, а не лежат отдельным файлом:
    // иначе прямые значения разошлись бы по двум источникам (ADR-0008).
    const style = document.createElement('style');
    style.textContent = THEME_CSS;
    document.head.append(style);

    return () => style.remove();
  }, []);

  return <CalculatorScreen />;
}
