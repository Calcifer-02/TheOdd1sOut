/**
 * Экран расчёта: одна модель, два представления.
 *
 * Различие между телефоном и рабочим местом не выражается оформлением:
 * карточки против таблицы и нижняя панель против правой колонки — разные
 * деревья разметки, и держать обе ветки сразу нельзя, потому что `display:
 * none` оставляет скрытую ветку в дереве доступности (дизайн-договор,
 * разд. 4.5).
 *
 * Модель вызывается здесь, а не внутри представлений: смена ширины окна меняет
 * разметку, но не должна сбрасывать набранное.
 *
 * @supports: R-058
 * @adr: ADR-0008
 */
import { isWide, useViewport } from '@/shared/lib/viewport';
import { useCalculator } from '../model/useCalculator';
import { CalculatorDesktop } from './CalculatorDesktop';
import { CalculatorMobile } from './CalculatorMobile';

export function CalculatorPage() {
  const model = useCalculator();
  const viewport = useViewport();

  return isWide(viewport) ? <CalculatorDesktop model={model} /> : <CalculatorMobile model={model} />;
}
