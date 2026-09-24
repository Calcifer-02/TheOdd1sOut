/**
 * Тарифы утилизации полигона в вид, пригодный обоим представлениям.
 *
 * Название группы отходов живёт в справочнике групп, а тариф — в записи
 * полигона: сводит их здесь одно место, а не таблица и карточка порознь.
 * Группы, которой нет в справочнике, тариф не лишается: показывается его
 * идентификатор, а не выдуманное название.
 *
 * @supports: R-039, R-040
 * @adr: ADR-0008
 */
import type { Landfill, Money, WasteGroup } from '@/shared/api/references';

export type TariffRow = {
  wasteGroupId: string;
  /** название группы отходов либо её идентификатор, если справочник её не знает */
  name: string;
  disposalPricePerTon: Money;
  /** дата, на которую тариф известен (R-048) */
  updatedAt: string;
};

/**
 * Тарифы полигона. При заданном отборе остаётся тариф выбранной группы: в
 * режиме справочника цен пользователь сравнивает одну строку у разных
 * полигонов, а не перечень у одного.
 */
export function tariffRows(landfill: Landfill, groups: WasteGroup[], wasteGroupId: string): TariffRow[] {
  return landfill.tariffs
    .filter(tariff => wasteGroupId === '' || tariff.wasteGroupId === wasteGroupId)
    .map(tariff => ({
      wasteGroupId: tariff.wasteGroupId,
      name: groups.find(group => group.id === tariff.wasteGroupId)?.name ?? tariff.wasteGroupId,
      disposalPricePerTon: tariff.disposalPricePerTon,
      updatedAt: tariff.updatedAt,
    }));
}
