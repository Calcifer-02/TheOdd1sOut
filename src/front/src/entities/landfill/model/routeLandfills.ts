/**
 * Карточки реестра по полигонам открытого маршрута (сущность «полигон»).
 *
 * Вариант размещения (`PlacementOption`) координат полигона не содержит —
 * договор расчётной части их в нём не обещает, — а карте без координат
 * рисовать нечего. Их отдаёт операция `getLandfill` вместе со статусом приёма,
 * датой его актуальности и тарифами (R-033).
 *
 * Полигонов в окне столько, сколько их в вопросе: сводка выбора спрашивает про
 * весь выбор (R-032). Хук на один полигон в цикле не вызвать — правила React
 * этого не допускают, — поэтому чтение идёт пачкой: один запрос справочника
 * групп на всё окно вместо запроса на каждый полигон, и одна запись состояния
 * на всю пачку. Частями состояние обновлять нельзя: карта рисуется заново на
 * каждый новый перечень меток, и второе обновление перезапускало бы её.
 *
 * Отказ по отдельному полигону назван отдельно от его отсутствия: пустая
 * карточка неотличима от ожидания, а окно обязано сказать словами, почему
 * метки нет (R-034).
 *
 * @supports: R-032, R-033, R-040, R-048
 * @adr: ADR-0008
 */
import { useEffect, useState } from 'react';
import { getLandfill, listWasteGroups, type LandfillCard, type WasteGroup } from '@/shared/api/references';

/**
 * Разделитель ключа перечня. Разделительный знак Unicode взят намеренно: в
 * идентификаторе полигона он встретиться не может, а запятая или пробел —
 * могут.
 */
const SEPARATOR = '\u001f';

/** Карточки полигонов окна маршрута: пришедшие, непришедшие и признак ожидания. */
export type RouteLandfills = {
  /**
   * Карточка по идентификатору полигона. Значение объявлено необязательным
   * намеренно: у непришедшего полигона записи нет, и обращение по ключу обязано
   * это показывать, а не делать вид, что карточка есть.
   */
  cards: Record<string, LandfillCard | undefined>;
  /** справочник групп отходов: нужен только ради названий тарифов */
  groups: WasteGroup[];
  /** полигоны, сведения о которых реестр не отдал */
  missing: string[];
  /** чтение ещё идёт: пустота сама по себе об этом не говорит */
  pending: boolean;
};

const NOTHING_READ: RouteLandfills = { cards: {}, groups: [], missing: [], pending: false };

export function useRouteLandfills(landfillIds: string[]): RouteLandfills {
  // Перечень приходит новым массивом на каждой отрисовке, и зависимость от
  // самого массива перезапускала бы чтение без конца. Ключ — строка, и
  // сравнивается он по значению.
  const key = landfillIds.join(SEPARATOR);
  const [read, setRead] = useState<RouteLandfills>({ ...NOTHING_READ, pending: key.length > 0 });

  useEffect(() => {
    const ids = key.length === 0 ? [] : key.split(SEPARATOR);

    if (ids.length === 0) {
      setRead(NOTHING_READ);
      return;
    }

    let cancelled = false;

    setRead({ ...NOTHING_READ, pending: true });

    // Справочник групп отходов нужен только ради названий, поэтому его отказ
    // сведений о полигонах не отменяет. Отказ одного полигона не отменяет
    // остальных: карту рисует то, что пришло.
    void Promise.all([
      Promise.allSettled(ids.map(landfillId => getLandfill(landfillId))),
      listWasteGroups()
        .then(page => page.items)
        .catch(() => []),
    ]).then(([answers, groups]) => {
      if (cancelled) {
        return;
      }

      const cards: Record<string, LandfillCard> = {};
      const missing: string[] = [];

      answers.forEach((answer, at) => {
        const landfillId = ids[at];

        if (answer.status === 'fulfilled') {
          cards[landfillId] = answer.value;
          return;
        }

        missing.push(landfillId);
      });

      setRead({ cards, groups, missing, pending: false });
    });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return read;
}
