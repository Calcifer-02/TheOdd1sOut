/**
 * Сводка выбора: сколько полигонов отмечено, на какую сумму и что с этим
 * делать дальше (R-027, R-032).
 *
 * Панель объявлена группой: имя, приписанное безымянному узлу, вспомогательная
 * технология не читает, и число выбранных полигонов терялось бы у того, кто
 * идёт по странице областями (разд. 4.5).
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */

/** Нижняя панель: сколько выбрано, на какую сумму и что с этим делать. */
export function SummaryBar({
  selectedCount,
  total,
  onOpenQuote,
  onPickup,
  quoteLabel,
}: {
  selectedCount: number;
  total: string;
  /** Главное действие сводки: переход на экран предложения (R-036, AC-036f). */
  onOpenQuote: () => void;
  onPickup: () => void;
  /** Подпись главного действия: её называет экран, а не панель. */
  /** Подпись главного действия: переход к предложению, а не скачивание файла. */
  quoteLabel: string;
}) {
  return (
    <div className="imolt-bar" role="group" aria-label={`Выбрано полигонов: ${selectedCount}`}>
      <div className="imolt-bar-line">
        <span>Выбрано {selectedCount}</span>
        <span className="imolt-total">{total}</span>
      </div>
      <div className="imolt-bar-actions">
        <button type="button" className="imolt-button imolt-button--secondary" onClick={onPickup}>
          Заявка на вывоз
        </button>
        <button type="button" className="imolt-button" onClick={onOpenQuote}>
          {quoteLabel}
        </button>
      </div>
    </div>
  );
}
