/**
 * Отказ по доступу к правке справочника — одним блоком на оба представления.
 *
 * Заголовок остаётся словом службы (ADR-0008, инвариант 4), а объяснение
 * ниже называет причину: почему чтение открыто, почему правка закрыта и что
 * её открывает. Текст берётся из предметной части — вторая копия объяснения
 * в мобильном представлении разошлась бы с первой молча (BUG-012).
 *
 * @supports: R-050, R-042
 * @adr: ADR-0006
 */
import { Button, Notice } from '@/shared/ui';
import type { Refusal } from '@/shared/api/maintenance';
import { accessExplanation } from '@/entities/participant';

export function AccessNotice({
  refusal,
  onRetry,
}: {
  refusal: Refusal;
  /** Повторная проверка права: сессия появляется позже открытия экрана. */
  onRetry: () => void;
}) {
  return (
    <Notice kind="error">
      <span className="imolt-references-access-title">{refusal.title}</span>
      {accessExplanation(refusal).map(line => (
        <span key={line}>{line}</span>
      ))}
      <Button kind="tertiary" size="s" onClick={onRetry}>
        Проверить право заново
      </Button>
    </Notice>
  );
}
