/**
 * Справочник полигонов карточками — представление телефона.
 *
 * Те же данные, что в таблице, но другим деревом разметки: столбцы на ширине
 * 390 нечитаемы, а скрывать вторую ветку правилом `display: none` нельзя —
 * она осталась бы в дереве доступности (дизайн-договор, разд. 4.5).
 *
 * Что показано и по какому отбору, решает общая часть экрана: здесь только
 * разметка.
 *
 * @req: R-040
 * @adr: ADR-0008
 */
import { Button } from '@/shared/ui';
import { StatusBadge } from '@/entities/landfill';
import type { DataFreshness, Landfill, WasteGroup } from '@/shared/api/references';
import { landfillBadgeStatus } from '../model/freshness';
import { tariffRows } from '../model/tariffs';
import { LandfillTariffs } from './LandfillTariffs';

export function LandfillsCards({
  landfills,
  groups,
  freshness,
  wasteGroupId,
  caption,
  onOpen,
}: {
  landfills: Landfill[];
  groups: WasteGroup[];
  freshness: DataFreshness | null;
  wasteGroupId: string;
  /** то же описание выборки, что у заголовка таблицы: список им и назван */
  caption: string;
  onOpen: (landfillId: string) => void;
}) {
  return (
    <ul className="imolt-landfill-cards" aria-label={caption}>
      {landfills.map((landfill) => {
        const status = landfillBadgeStatus(landfill, freshness);

        return (
          <li key={landfill.id} className="imolt-landfill-card" data-status={status}>
            {/* Название полигона — вход в карточку и первая строка записи:
                оно выстраивается по левому краю карточки вместе с адресом,
                а длинное переносится, а не уходит за край (BUG-011). */}
            <Button
              kind="tertiary"
              className="imolt-landfill-card-name"
              onClick={() => onOpen(landfill.id)}
            >
              {landfill.name}
            </Button>
            <span className="imolt-landfill-address">{landfill.address}</span>
            <span className="imolt-landfill-card-status">
              <StatusBadge status={status} statusUpdatedAt={landfill.statusUpdatedAt} />
            </span>
            <span className="imolt-landfill-address">
              {landfill.legalEntity ?? 'Юридическое лицо не указано'}
            </span>
            <LandfillTariffs rows={tariffRows(landfill, groups, wasteGroupId)} />
          </li>
        );
      })}
    </ul>
  );
}
