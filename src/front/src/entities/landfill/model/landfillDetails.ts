/**
 * Сведения о полигоне для окна маршрута: карточка реестра и тарифы
 * утилизации по группам отходов.
 *
 * Вариант размещения (`PlacementOption`) координат полигона не содержит —
 * договор расчётной части их в нём не обещает, — а карте без координат
 * рисовать нечего. Их отдаёт операция `getLandfill` вместе со статусом приёма,
 * датой его актуальности и тарифами (R-033).
 *
 * Название группы отходов живёт в справочнике групп, а тариф — в записи
 * полигона: сводятся они здесь. Справочник групп не пришёл — тариф не
 * пропадает, показывается идентификатор группы, а не выдуманное название.
 *
 * @supports: R-033, R-040, R-048
 * @adr: ADR-0008
 */
import { useEffect, useState } from 'react';
import { getLandfill, listWasteGroups, type LandfillCard, type Money, type WasteGroup } from '@/shared/api/references';

/** Тариф утилизации полигона по одной группе отходов. */
export type TariffLine = {
  wasteGroupId: string;
  /** название группы либо её идентификатор, если справочник её не знает */
  name: string;
  pricePerTon: Money;
  /** дата, на которую тариф известен (R-048) */
  updatedAt: string;
};

export type LandfillDetails = { card: LandfillCard; tariffs: TariffLine[] };

function tariffLines(card: LandfillCard, groups: WasteGroup[]): TariffLine[] {
  return card.tariffs.map(tariff => ({
    wasteGroupId: tariff.wasteGroupId,
    name: groups.find(group => group.id === tariff.wasteGroupId)?.name ?? tariff.wasteGroupId,
    pricePerTon: tariff.disposalPricePerTon,
    updatedAt: tariff.updatedAt,
  }));
}

/**
 * Сведения о полигоне по его идентификатору. Отказ службы назван отдельным
 * признаком, а не пустыми сведениями: пустота неотличима от ожидания, и окно
 * маршрута обязано сказать словами, почему карты нет (R-034).
 */
export function useLandfillDetails(landfillId: string): { details: LandfillDetails | null; failed: boolean } {
  const [details, setDetails] = useState<LandfillDetails | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setDetails(null);
    setFailed(false);

    // Справочник групп отходов нужен только ради названий, поэтому его отказ
    // сведений о полигоне не отменяет.
    Promise.all([
      getLandfill(landfillId),
      listWasteGroups()
        .then(page => page.items)
        .catch(() => []),
    ])
      .then(([card, groups]) => {
        if (!cancelled) {
          setDetails({ card, tariffs: tariffLines(card, groups) });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [landfillId]);

  return { details, failed };
}
