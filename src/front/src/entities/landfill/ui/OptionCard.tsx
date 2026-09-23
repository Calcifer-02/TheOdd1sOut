/**
 * Карточка полигона в сравнении (сущность «полигон»).
 *
 * Флажок — нативный `input`, и доступное имя у него своё: без имени строку
 * нельзя выбрать ни клавиатурой, ни экранным диктором (R-027).
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import type { PlacementOption } from '@/shared/api/contracts';
import { formatDistance, formatMoney } from '@/shared/lib/formatting';
import { StatusBadge, type BadgeStatus } from './StatusBadge';

export function OptionCard({
  option,
  status,
  selected,
  onToggle,
  onRoute,
}: {
  option: PlacementOption;
  status: BadgeStatus;
  selected: boolean;
  onToggle: () => void;
  onRoute: () => void;
}) {
  return (
    <li
      className="imolt-option"
      data-selected={selected ? 'true' : 'false'}
      data-blocked={option.status === 'blocked' ? 'true' : 'false'}
    >
      <div className="imolt-option-head">
        <input
          type="checkbox"
          className="imolt-check"
          checked={selected}
          onChange={onToggle}
          aria-label={`Выбрать полигон ${option.landfillName}`}
        />
        <div className="imolt-grow">
          <div className="imolt-option-name">{option.landfillName}</div>
          <div className="imolt-option-address">
            {option.address} · {formatDistance(option.distanceKm)}
          </div>
        </div>
        <div className="imolt-total">{formatMoney(option.totalCost)}</div>
      </div>

      <div className="imolt-split">
        <StatusBadge status={status} statusUpdatedAt={option.statusUpdatedAt} />
      </div>

      <div className="imolt-option-head">
        <div className="imolt-split imolt-grow">
          <span>перевозка {formatMoney(option.transportCost)}</span>
          {option.disposalCost && <span>утилизация {formatMoney(option.disposalCost)}</span>}
        </div>
        <button type="button" className="imolt-button imolt-button--tertiary" onClick={onRoute}>
          Маршрут
        </button>
      </div>
    </li>
  );
}
