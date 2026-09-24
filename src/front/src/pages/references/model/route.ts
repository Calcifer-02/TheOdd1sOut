/**
 * Состояние редактора, живущее в адресе: открытая вкладка и открытая
 * карточка.
 *
 * В адрес идёт только предметное состояние — что именно сейчас обсуждают:
 * вкладка и запись, которую правят. Черновик ячейки и раскрытость панели
 * импорта в адрес не идут, иначе ссылка перестала бы называть предмет
 * (ADR-0008, инвариант 5; карточка практики PRACT-016).
 *
 * Смена вкладки заменяет запись истории: перебор вкладок не должен
 * превращать «назад» в обратную прокрутку фильтров. Открытие карточки —
 * новая запись: «назад» обязано возвращать к списку.
 *
 * @supports: R-042
 * @adr: ADR-0008
 */
import { useCallback, useMemo } from 'react';
import { navigate, replaceRoute, useRoute } from '@/shared/lib/routing';
import type { EditorTab } from './editor';

/** Адрес редактора цен и справочников. */
export const REFERENCES_PATH = '/references';

const TAB_PARAMETER = 'tab';

const LANDFILL_PARAMETER = 'landfill';

const WASTE_GROUP_PARAMETER = 'group';

/** Вкладка по умолчанию: путь менеджера данных начинается с полигонов. */
const DEFAULT_TAB: EditorTab = 'landfills';

function tabOf(raw: string | null): EditorTab {
  return raw === 'wasteGroups' ? 'wasteGroups' : DEFAULT_TAB;
}

export type EditorRoute = {
  tab: EditorTab;
  /** Полигон, карточка которого открыта на узком экране. */
  landfillId: string | null;
  /** Группа отходов, карточка которой открыта на узком экране. */
  wasteGroupId: string | null;
  pickTab(tab: EditorTab): void;
  openLandfill(landfillId: string): void;
  openWasteGroup(wasteGroupId: string): void;
  closeCard(): void;
};

/** Разбор и смена адресного состояния редактора. */
export function useEditorRoute(): EditorRoute {
  const route = useRoute();

  const tab = tabOf(route.query.get(TAB_PARAMETER));
  const landfillId = route.query.get(LANDFILL_PARAMETER);
  const wasteGroupId = route.query.get(WASTE_GROUP_PARAMETER);

  const pickTab = useCallback((next: EditorTab) => {
    // Карточка принадлежит вкладке: перенос её на соседнюю вкладку дал бы
    // ссылку, которая открывает не то, что называет.
    replaceRoute(REFERENCES_PATH, new URLSearchParams({ [TAB_PARAMETER]: next }));
  }, []);

  const openLandfill = useCallback((id: string) => {
    navigate(REFERENCES_PATH, new URLSearchParams({ [TAB_PARAMETER]: 'landfills', [LANDFILL_PARAMETER]: id }));
  }, []);

  const openWasteGroup = useCallback((id: string) => {
    navigate(REFERENCES_PATH, new URLSearchParams({ [TAB_PARAMETER]: 'wasteGroups', [WASTE_GROUP_PARAMETER]: id }));
  }, []);

  const closeCard = useCallback(() => {
    navigate(REFERENCES_PATH, new URLSearchParams({ [TAB_PARAMETER]: tab }));
  }, [tab]);

  return useMemo(
    () => ({ tab, landfillId, wasteGroupId, pickTab, openLandfill, openWasteGroup, closeCard }),
    [tab, landfillId, wasteGroupId, pickTab, openLandfill, openWasteGroup, closeCard],
  );
}
