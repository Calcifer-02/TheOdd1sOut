/**
 * Корень витрины компонентов: отдельная точка входа приложения (R-084).
 *
 * Витрина живёт своей страницей, а не разделом экрана расчёта: она нужна
 * разработке и дизайну, а не пользователю сервиса, и попадать в путь клиента
 * ей незачем.
 *
 * @req: R-084
 * @adr: ADR-0008
 */
import { Showcase } from '@/pages/showcase';
import { useThemeStyles } from './useThemeStyles';

export function ShowcaseApp() {
  useThemeStyles();

  return <Showcase />;
}
