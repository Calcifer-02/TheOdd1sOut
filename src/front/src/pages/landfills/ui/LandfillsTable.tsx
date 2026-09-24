/**
 * Справочник полигонов таблицей — представление рабочего места.
 *
 * Таблица объявлена семантикой `table` с заголовком и заголовками столбцов:
 * сетка из ячеек читалась бы вспомогательной технологией как набор строк без
 * связи со столбцом (карточка практики PRACT-021). Ключ строки предметный —
 * идентификатор полигона, а не его позиция в выборке.
 *
 * @req: R-040
 * @supports: R-058
 * @adr: ADR-0008
 */
import { Button, DataTable } from '@/shared/ui';
import { StatusBadge } from '@/entities/landfill';
import type { DataFreshness, Landfill, WasteGroup } from '@/shared/api/references';
import { landfillBadgeStatus } from '../model/freshness';
import { tariffRows } from '../model/tariffs';
import { LandfillTariffs } from './LandfillTariffs';

/**
 * Доли ширины столбцов. Объявлены здесь, а не отданы содержимому: при
 * автоматической раскладке ширину столбца задавала самая длинная строка, и
 * название юридического лица отбирало место у перечня тарифов — границы
 * столбцов расходились от выборки к выборке (второй пакет замечаний
 * заказчика, 24.09.2026). Доли в сумме дают сто процентов, и раскладка
 * `fixed` из файла стилей считает их от ширины таблицы, а не от текста.
 */
const COLUMN_WIDTHS = {
  name: '30%',
  legalEntity: '22%',
  tariffs: '32%',
  status: '16%',
} as const;

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
          { key: 'name', title: 'Полигон', width: COLUMN_WIDTHS.name },
          { key: 'legalEntity', title: 'Юридическое лицо', width: COLUMN_WIDTHS.legalEntity },
          // Заголовок стоит над началом ячейки, а не у её правого края:
          // внутри — перечень «группа отходов — цена», и он начинается
          // слева. Прижатый вправо заголовок висел над ценами и читался как
          // заголовок чужого столбца (второй пакет замечаний заказчика).
          { key: 'tariffs', title: 'Тариф утилизации, ₽/т', width: COLUMN_WIDTHS.tariffs },
          { key: 'status', title: 'Статус', width: COLUMN_WIDTHS.status },
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

          // Статус стоит по центру своего столбца, как и в редакторе цен:
          // прижатый влево, он читался хвостом соседнего столбца.
          return (
            <div className="imolt-landfill-status-cell">
              <StatusBadge
                status={landfillBadgeStatus(landfill, freshness)}
                statusUpdatedAt={landfill.statusUpdatedAt}
              />
            </div>
          );
        }}
      />
    </div>
  );
}
