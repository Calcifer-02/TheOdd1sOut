/**
 * Предметная часть экрана справочника полигонов: чтение справочников, отбор,
 * предел показа и переходы к карточке.
 *
 * Часть одна на оба представления. На телефоне список — карточки, на рабочем
 * месте — таблица, но что именно показано и по какому отбору, решается здесь:
 * копия этой логики во втором представлении разошлась бы с первым при первой
 * же правке (дизайн-договор, разд. 4.5).
 *
 * @supports: R-039, R-040, R-048
 * @adr: ADR-0008
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ApiProblem,
  getDataFreshness,
  listLandfills,
  listWasteGroups,
  type DataFreshness,
  type Landfill,
  type WasteGroup,
} from '@/shared/api/references';
import { navigate, replaceRoute, useRoute } from '@/shared/lib/routing';
import {
  LANDFILLS_PATH,
  PAGE_SIZE,
  filtersQuery,
  parseFilters,
  type LandfillsFilters,
} from './filters';

/**
 * Заголовок отказа службы. Пользователю показывается заголовок, а не код:
 * код — внутреннее имя (ADR-0008, инвариант 4).
 */
export function problemTitle(error: unknown): string {
  return error instanceof ApiProblem ? error.title : 'Запрос не выполнен';
}

export type LandfillsScreen = {
  filters: LandfillsFilters;
  groups: WasteGroup[];
  /** выбранная группа отходов; `null` — отбора нет либо группа неизвестна */
  selectedGroup: WasteGroup | null;
  /** в адресе задана группа, которой нет в справочнике */
  unknownGroup: boolean;
  freshness: DataFreshness | null;
  landfills: Landfill[];
  /** сколько записей подходит под отбор всего */
  total: number;
  loading: boolean;
  /** заголовок отказа при чтении реестра; пустая строка — отказа не было */
  failure: string;
  /** заголовок отказа при чтении справочников; отбор в этом случае недоступен */
  referenceFailure: string;
  retry: () => void;
  search: (query: string) => void;
  toggleGroup: (wasteGroupId: string) => void;
  showMore: () => void;
  reset: () => void;
  openLandfill: (landfillId: string) => void;
  closeLandfill: () => void;
};

export function useLandfillsScreen(): LandfillsScreen {
  const route = useRoute();
  const filters = useMemo(() => parseFilters(route.query), [route.query]);

  const [groups, setGroups] = useState<WasteGroup[]>([]);
  const [freshness, setFreshness] = useState<DataFreshness | null>(null);
  const [referenceFailure, setReferenceFailure] = useState('');

  const [landfills, setLandfills] = useState<Landfill[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listFailure, setListFailure] = useState('');

  // Номер попытки: «Повторить» обязано сходить в службу заново, а не показать
  // тот же отказ из состояния.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        // Справочник групп и дата актуальности не зависят друг от друга:
        // последовательный запрос удвоил бы ожидание без причины.
        const [groupPage, current] = await Promise.all([
          listWasteGroups({ limit: 100 }),
          getDataFreshness(),
        ]);

        if (cancelled) {
          return;
        }

        setGroups(groupPage.items);
        setFreshness(current);
        setReferenceFailure('');
      } catch (error) {
        if (!cancelled) {
          setReferenceFailure(problemTitle(error));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const { query, wasteGroupId, limit } = filters;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const page = await listLandfills({
          query: query || undefined,
          wasteGroupId: wasteGroupId || undefined,
          limit,
        });

        if (cancelled) {
          return;
        }

        setLandfills(page.items);
        setTotal(page.total);
        setListFailure('');
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLandfills([]);
        setTotal(0);
        setListFailure(problemTitle(error));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [query, wasteGroupId, limit, attempt]);

  const apply = useCallback(
    (next: Partial<LandfillsFilters>) => {
      // Смена отбора не заводит записи истории: «назад» обязано возвращать на
      // предыдущий экран, а не отматывать перебор фильтров.
      replaceRoute(LANDFILLS_PATH, filtersQuery({ ...filters, ...next }));
    },
    [filters],
  );

  const selectedGroup =
    groups.find((group) => group.id === filters.wasteGroupId) ?? null;

  return {
    filters,
    groups,
    selectedGroup,
    unknownGroup: filters.wasteGroupId !== '' && groups.length > 0 && selectedGroup === null,
    freshness,
    landfills,
    total,
    loading,
    failure: listFailure,
    referenceFailure,
    retry: () => setAttempt((value) => value + 1),
    search: (value: string) => apply({ query: value.trim(), limit: PAGE_SIZE }),
    toggleGroup: (id: string) =>
      apply({ wasteGroupId: filters.wasteGroupId === id ? '' : id, limit: PAGE_SIZE }),
    showMore: () => apply({ limit: filters.limit + PAGE_SIZE }),
    // Сброс снимает отбор, но открытую карточку не закрывает: она не часть
    // выборки, и закрывать её заодно пользователь не просил.
    reset: () => apply({ query: '', wasteGroupId: '', limit: PAGE_SIZE }),
    // Открытая карточка — отдельный этап пути, и «назад» обязано её закрывать,
    // поэтому здесь запись истории заводится.
    openLandfill: (id: string) =>
      navigate(LANDFILLS_PATH, filtersQuery({ ...filters, landfillId: id })),
    closeLandfill: () =>
      navigate(LANDFILLS_PATH, filtersQuery({ ...filters, landfillId: '' })),
  };
}
