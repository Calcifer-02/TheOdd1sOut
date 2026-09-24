/**
 * Сводка выбора боковой колонкой (R-027, R-032, R-036).
 *
 * На рабочем месте сводка стоит справа от таблицы и прилипает при прокрутке:
 * итог обязан быть виден в тот момент, когда отмечается очередная строка, а не
 * после возврата к началу списка (дизайн-договор, разд. 4.4).
 *
 * Панель ничего не складывает: и строки, и итог приходят от расчётной части.
 * Второе место сложения тех же сумм разошлось бы с первым (ADR-0008,
 * инвариант 2).
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import { Button, Card, Stat, useStyles } from '@/shared/ui';
import { colors, space } from '@/shared/ui/tokens';

const SUMMARY_PANEL_CSS = `
.imolt-summary-panel { display: flex; flex-direction: column; gap: ${space.m}px; }
.imolt-summary-lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: ${space.xxs}px; }
.imolt-summary-line { display: flex; align-items: baseline; justify-content: space-between; gap: ${space.s}px; }
.imolt-summary-line > span:first-child { color: ${colors.textSecondary}; min-width: 0; }
.imolt-summary-actions { display: flex; flex-direction: column; gap: ${space.xs}px; }
`;

/** Строка сводки: выбранный полигон и его сумма, как её назвала служба. */
export type SummaryLine = { landfillId: string; landfillName: string; sum: string };

export function SummaryPanel({
  selectedCount,
  lines,
  total,
  totalLabel,
  onRoute,
  onDownload,
  onPickup,
}: {
  selectedCount: number;
  lines: SummaryLine[];
  total: string;
  /** Чей это итог: выбора или распределения объёма. */
  totalLabel: string;
  onRoute: () => void;
  onDownload: () => void;
  onPickup: () => void;
}) {
  useStyles('selection-summary-panel', SUMMARY_PANEL_CSS);

  if (selectedCount === 0) {
    return (
      <Card title="Выберите полигоны" className="imolt-summary-panel">
        <p className="imolt-lead">
          Отметьте один или несколько – здесь появится итог, маршрут и коммерческое предложение.
        </p>
      </Card>
    );
  }

  return (
    <Card title={`Выбрано ${selectedCount}`} className="imolt-summary-panel imolt-summary-panel--filled">
      <ul className="imolt-summary-lines">
        {lines.map(line => (
          <li className="imolt-summary-line" key={line.landfillId}>
            <span>{line.landfillName}</span>
            <span className="imolt-total">{line.sum}</span>
          </li>
        ))}
      </ul>

      <Stat label={totalLabel} value={total} />

      <div className="imolt-summary-actions">
        <Button kind="secondary" onClick={onRoute}>
          Получить маршрут
        </Button>
        <Button onClick={onDownload}>Скачать КП</Button>
        <Button kind="tertiary" onClick={onPickup}>
          Оставить заявку на вывоз
        </Button>
      </div>

      <p className="imolt-hint">Цена предварительная. Отклонение финальной – в пределах согласованного порога.</p>
    </Card>
  );
}
