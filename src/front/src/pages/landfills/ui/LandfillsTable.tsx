/**
 * Справочник полигонов таблицей — представление рабочего места.
 *
 * Таблица объявлена семантикой `table` с заголовком и заголовками столбцов:
 * сетка из ячеек читалась бы вспомогательной технологией как набор строк без
 * связи со столбцом (карточка практики PRACT-021). Ключ строки предметный —
 * идентификатор полигона, а не его позиция в выборке.
 *
 * @req: R-040
 * @adr: ADR-0008
 */
import { Button, DataTable } from '@/shared/ui';
import { StatusBadge } from '@/entities/landfill';
import type { DataFreshness, Landfill, WasteGroup } from '@/shared/api/references';
import { landfillBadgeStatus } from '../model/freshness';
import { tariffRows } from '../model/tariffs';
import { LandfillTariffs } from './LandfillTariffs';

export function LandfillsTable({
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
  caption: string;
  onOpen: (landfillId: string) => void;
}) {
  return (
    <div className="imolt-landfills-table">
      <DataTable
        caption={caption}
        columns={[
          { key: 'name', title: 'Полигон' },
          { key: 'legalEntity', title: 'Юридическое лицо' },
          { key: 'tariffs', title: 'Тариф утилизации, ₽/т', align: 'end' },
          { key: 'status', title: 'Статус' },
        ]}
        rows={landfills}
        rowKey={(landfill: Landfill) => landfill.id}
        cell={(landfill: Landfill, columnKey: string) => {
          if (columnKey === 'name') {
            return (
              <span className="imolt-landfill-name">
                {/*
                  Название и есть вход в карточку: отдельная кнопка «Подробнее»
                  повторялась бы в каждой строке одним и тем же доступным
                  именем и перестала бы их различать.
                */}
                <Button kind="tertiary" onClick={() => onOpen(landfill.id)}>
                  {landfill.name}
                </Button>
                <span className="imolt-landfill-address">{landfill.address}</span>
              </span>
            );
          }

          if (columnKey === 'legalEntity') {
            // Договор юридическое лицо не требует: у части записей его нет, и
            // придумывать его вместо службы нельзя.
            return landfill.legalEntity ?? 'не указано';
          }

          if (columnKey === 'tariffs') {
            return <LandfillTariffs rows={tariffRows(landfill, groups, wasteGroupId)} />;
          }

          return (
            <StatusBadge
              status={landfillBadgeStatus(landfill, freshness)}
              statusUpdatedAt={landfill.statusUpdatedAt}
            />
          );
        }}
      />
    </div>
  );
}
