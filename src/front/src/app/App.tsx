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
import { CalculatorMobile } from '@/pages/calculator';
import { ChatIdentity } from '@/features/identify-from-chat';
import { useThemeStyles } from './useThemeStyles';

export function App() {
  useThemeStyles();

  return (
    <>
      <ChatIdentity />
      <CalculatorMobile />
    </>
  );
}
