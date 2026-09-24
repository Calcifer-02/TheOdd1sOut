/**
 * Предметная часть экрана расчёта: состояние формы, обращения к расчётной
 * части, выбор полигонов, распределение объёма, выпуск предложения и заявка
 * на вывоз.
 *
 * Представлений у экрана два — карточки на телефоне и таблица сравнения на
 * рабочем месте, — но предметная часть одна. Копия этой логики во втором
 * файле разошлась бы с первой на первой же правке, поэтому оба представления
 * получают одну и ту же модель и отличаются только разметкой (дизайн-договор,
 * разд. 4.5).
 *
 * Модель ничего не считает: цены, пересчёт меры, порядок списка и итоги
 * приходят от расчётной части (ADR-0008, инвариант 2). Здесь — состояние,
 * порядок обращений и перевод отказа в понятное слово.
 *
 * @req: R-012, R-013, R-014, R-015, R-021, R-024, R-025, R-027, R-029, R-030, R-032, R-036, R-053
 * @adr: ADR-0008
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AddressSuggestion,
  Calculation,
  PlacementOption,
  PlacementOptionPage,
  Quote,
  RouteSummary,
  SelectionEntry,
  SelectionState,
  SelectionWarning,
  WasteGroup,
} from '@/shared/api/contracts';
import {
  ApiProblem,
  convertAmounts,
  createCalculation,
  getCalculation,
  getRoute,
  listPlacementOptions,
  searchWasteGroups,
  setAllocation,
  setSelection,
  suggestAddresses,
} from '@/shared/api/imolt';
import { createPickupRequest, issueQuote, quoteDocumentHref } from '@/shared/api/deals';
import type { Unit } from '@/shared/lib/formatting';
import { formatMoney, formatQuantity } from '@/shared/lib/formatting';
import { CALCULATOR_PATH, hashOf, replaceRoute } from '@/shared/lib/routing';
import type { SortField, ViewState } from '@/shared/lib/viewState';
import { DEFAULT_VIEW_STATE, parseViewState, viewStateToHash } from '@/shared/lib/viewState';
import type { WasteLine } from './wasteLine';
import { emptyLine, filledItems, parseAmount } from './wasteLine';

/** Первая страница — десять полигонов, остальные по «Показать ещё» (R-029). */
export const PAGE_SIZE = 10;

/** Поля сортировки договора и их названия словами (R-024). */
export const SORTS: { field: SortField; label: string }[] = [
  { field: 'total', label: 'По итогу' },
  { field: 'transport', label: 'Перевозка' },
  { field: 'disposal', label: 'Утилизация' },
  { field: 'distance', label: 'Расстояние' },
];

/** Предел, при котором отбор по расстоянию считается снятым (R-025). */
const WIDEST_DISTANCE_KM = 1000;

/** Черновик заявки на вывоз: до отправки он живёт только на экране (R-053). */
export type PickupDraft = {
  name: string;
  phone: string;
  consent: boolean;
  landfillName: string;
};

/** Открытый маршрут: полигон известен сразу, сводка приходит следом (R-032). */
export type OpenRoute = { option: PlacementOption; summary: RouteSummary | null };

export type CalculatorModel = ReturnType<typeof useCalculator>;

/**
 * Состояние экрана расчёта целиком. Вызывается один раз на странице, а
 * представления получают готовую модель: так ширина окна меняет разметку, но
 * не сбрасывает набранное.
 */
export function useCalculator() {
  const [view, setView] = useState<ViewState>(() => parseViewState(window.location.hash));
  const [addressQuery, setAddressQuery] = useState('');
  const [addressPicked, setAddressPicked] = useState<AddressSuggestion | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressError, setAddressError] = useState<string | undefined>(undefined);
  const [lines, setLines] = useState<WasteLine[]>([emptyLine()]);
  const [disposalRequired, setDisposalRequired] = useState(true);

  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [options, setOptions] = useState<PlacementOptionPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiProblem | null>(null);

  const [selection, setSelectionState] = useState<SelectionState | null>(null);
  const [allocationDraft, setAllocationDraft] = useState<Record<string, string>>({});
  const [allocationTotal, setAllocationTotal] = useState<string | null>(null);
  const [allocationProblem, setAllocationProblem] = useState<ApiProblem | null>(null);
  const [allocationMismatch, setAllocationMismatch] = useState<string | null>(null);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [route, setRoute] = useState<OpenRoute | null>(null);
  const [pickup, setPickup] = useState<PickupDraft | null>(null);
  const [pickupError, setPickupError] = useState<string | undefined>(undefined);
  const [pickupDone, setPickupDone] = useState<string | null>(null);
  const [filterDraft, setFilterDraft] = useState<string | null>(null);

  // Адрес подсказывает служба, и набранная строка сама по себе расчёту не
  // годится: нужны координаты выбранной подсказки (R-012).
  useEffect(() => {
    if (addressPicked || addressQuery.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      suggestAddresses(addressQuery.trim())
        .then((page) => {
          if (!cancelled) {
            setAddressSuggestions(page.items);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setAddressSuggestions([]);
          }
        });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [addressQuery, addressPicked]);

  /**
   * Состояние выборки кладётся в адрес заменой записи истории: сортировка и
   * предел плеча не должны превращать «назад» в перебор фильтров
   * (ADR-0008, инвариант 5; карточка практики PRACT-016).
   */
  const rememberInAddress = useCallback((next: ViewState) => {
    const hash = viewStateToHash(next);
    const query = new URLSearchParams(hash.startsWith('#?') ? hash.slice(2) : '');

    replaceRoute(CALCULATOR_PATH, query);
  }, []);

  const loadOptions = useCallback(
    async (calculationId: string, next: ViewState, offset: number) => {
      const page = await listPlacementOptions(calculationId, {
        wasteGroupId: next.wasteGroupId ?? '',
        sort: next.sort,
        order: next.order,
        distanceMode: next.distanceMode,
        distanceKm: next.distanceKm,
        limit: PAGE_SIZE,
        offset,
      });

      setOptions((previous) =>
        offset > 0 && previous ? { ...page, items: [...previous.items, ...page.items] } : page,
      );
    },
    [],
  );

  // Расчёт восстанавливается из адреса, с которым открыли страницу:
  // обновление не теряет результат, а ссылка воспроизводит выборку
  // (ADR-0008, инвариант 5). Расчёт, только что созданный на этом экране,
  // перечитывать незачем — он уже в руках.
  const openedWith = useRef(parseViewState(window.location.hash));
  useEffect(() => {
    const opened = openedWith.current;
    if (!opened.calculationId) {
      return;
    }

    getCalculation(opened.calculationId)
      .then((restoredCalculation) => {
        setCalculation(restoredCalculation);
        setSelectionState(restoredCalculation.selection ?? null);
        const group = opened.wasteGroupId ?? restoredCalculation.results[0]?.wasteGroupId;
        const next = { ...opened, wasteGroupId: group };
        setView(next);
        setAddressQuery(restoredCalculation.pickupAddress.value);
        if (group) {
          void loadOptions(restoredCalculation.id, next, 0);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof ApiProblem) {
          setFailure(error);
        }
      });
  }, [loadOptions]);

  function updateLine(key: string, change: Partial<WasteLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...change } : line)));
  }

  async function searchGroup(key: string, query: string) {
    updateLine(key, { query, group: undefined, tons: undefined });

    if (query.trim().length < 2) {
      updateLine(key, { suggestions: [] });
      return;
    }

    try {
      const page = await searchWasteGroups(query.trim());
      updateLine(key, { suggestions: page.items });
    } catch {
      updateLine(key, { suggestions: [] });
    }
  }

  // Пересчёт кубометров в тонны делает служба: коэффициент плотности живёт в
  // справочнике, и второго места его применения быть не должно.
  async function refreshConversion(line: WasteLine, amount: string, unit: Unit) {
    const value = parseAmount(amount);

    if (!line.group || unit !== 'm3' || !Number.isFinite(value) || value <= 0) {
      updateLine(line.key, { tons: undefined });
      return;
    }

    try {
      const result = await convertAmounts([
        { wasteGroupId: line.group.id, quantity: { value, unit: 'm3' } },
      ]);
      updateLine(line.key, { tons: result.items[0]?.tons });
    } catch {
      updateLine(line.key, { tons: undefined });
    }
  }

  function pickGroup(line: WasteLine, group: WasteGroup) {
    updateLine(line.key, { group, query: group.name, suggestions: [] });
    void refreshConversion({ ...line, group }, line.amount, line.unit);
  }

  function changeAmount(line: WasteLine, amount: string) {
    updateLine(line.key, { amount });
    void refreshConversion(line, amount, line.unit);
  }

  function changeUnit(line: WasteLine, unit: Unit) {
    updateLine(line.key, { unit });
    void refreshConversion(line, line.amount, unit);
  }

  function addLine() {
    setLines((current) => [...current, emptyLine()]);
  }

  function removeLine(key: string) {
    setLines((current) => (current.length > 1 ? current.filter((line) => line.key !== key) : current));
  }

  function changeAddress(value: string) {
    setAddressQuery(value);
    setAddressPicked(null);
    setAddressError(undefined);
  }

  function pickAddress(suggestion: AddressSuggestion) {
    setAddressPicked(suggestion);
    setAddressQuery(suggestion.value);
    setAddressSuggestions([]);
  }

  async function calculate() {
    if (!addressPicked) {
      setAddressError('Выберите адрес из подсказки');
      return;
    }

    const items = filledItems(lines);
    if (items.length === 0) {
      setAddressError(undefined);
      setFailure(
        new ApiProblem('urn:imolt:problem:validation', 'Заполните тип отходов и объём', 400),
      );
      return;
    }

    setAddressError(undefined);
    setBusy(true);
    setFailure(null);

    try {
      const result = await createCalculation({
        pickupAddress: {
          suggestionId: addressPicked.id,
          value: addressPicked.value,
          coordinates: addressPicked.coordinates,
          area: addressPicked.area,
        },
        items,
        disposalRequired,
        distanceFilter: { mode: view.distanceMode, km: view.distanceKm },
      });

      const group = result.results[0]?.wasteGroupId;
      const next: ViewState = { ...view, calculationId: result.id, wasteGroupId: group };

      setCalculation(result);
      setSelectionState(null);
      setQuote(null);
      setAllocationTotal(null);
      setAllocationDraft({});
      setOptions(result.results.find((tab) => tab.wasteGroupId === group)?.options ?? null);
      setView(next);
      rememberInAddress(next);
    } catch (error: unknown) {
      setFailure(
        error instanceof ApiProblem
          ? error
          : new ApiProblem('urn:imolt:problem:unknown', 'Запрос не выполнен', 0),
      );
    } finally {
      setBusy(false);
    }
  }

  function applyView(change: Partial<ViewState>) {
    const next = { ...view, ...change };
    setView(next);
    rememberInAddress(next);

    // Смена вкладки меняет предмет списка, а не его порядок: показывать
    // полигоны прежней группы, пока идёт запрос, значит показывать неправду.
    if (change.wasteGroupId && change.wasteGroupId !== view.wasteGroupId) {
      setOptions(null);
    }

    if (next.calculationId && next.wasteGroupId) {
      void loadOptions(next.calculationId, next, 0);
    }
  }

  /** Сортировка по столбцу: повторный выбор того же поля меняет направление. */
  function sortBy(field: SortField) {
    applyView(
      field === view.sort
        ? { order: view.order === 'asc' ? 'desc' : 'asc' }
        : { sort: field, order: 'asc' },
    );
  }

  function toggleOrder() {
    applyView({ order: view.order === 'asc' ? 'desc' : 'asc' });
  }

  /** Снятие отбора по расстоянию: предел раздвигается, режим — по умолчанию. */
  function clearDistanceFilter() {
    applyView({ distanceMode: DEFAULT_VIEW_STATE.distanceMode, distanceKm: WIDEST_DISTANCE_KM });
  }

  /** Применение набранного предела: испорченное число возвращает значение по умолчанию. */
  function applyDistanceDraft(mode: ViewState['distanceMode'] = 'atMost') {
    const km = Number.parseInt(filterDraft ?? '', 10);
    setFilterDraft(null);
    applyView({
      distanceMode: mode,
      distanceKm: Number.isFinite(km) ? km : DEFAULT_VIEW_STATE.distanceKm,
    });
  }

  async function toggleLandfill(option: PlacementOption) {
    if (!calculation || !view.wasteGroupId) {
      return;
    }

    // Выбор держится на идентификаторе полигона, а не на позиции строки:
    // сортировка не должна переносить отметку на соседа (PRACT-021).
    const entries: SelectionEntry[] = selection ? [...selection.entries] : [];
    const at = entries.findIndex(
      (entry) => entry.landfillId === option.landfillId && entry.wasteGroupId === view.wasteGroupId,
    );

    if (at >= 0) {
      entries.splice(at, 1);
    } else {
      entries.push({ wasteGroupId: view.wasteGroupId, landfillId: option.landfillId });
    }

    const state = await setSelection(calculation.id, entries);
    setSelectionState(state);
    setAllocationTotal(null);
    setAllocationProblem(null);
  }

  function isSelected(option: PlacementOption): boolean {
    return (selection?.entries ?? []).some(
      (entry) => entry.landfillId === option.landfillId && entry.wasteGroupId === view.wasteGroupId,
    );
  }

  /** Объём группы в тоннах: его назвала расчётная часть, а не интерфейс. */
  function groupTons(): number | undefined {
    return calculation?.items.find((item) => item.wasteGroupId === view.wasteGroupId)?.tons;
  }

  /**
   * Распределение уходит само, как только доли сошлись с объёмом группы:
   * несошедшиеся доли не отправляются вовсе (AC-030c), и пользователь не
   * ищет кнопку, чтобы узнать, что ошибся. Сходимость — сравнение двух чисел,
   * полученных от службы и от пользователя, а не расчёт цены.
   */
  async function applyAllocation(draft: Record<string, string>, landfillIds: string[]) {
    if (!calculation || !view.wasteGroupId) {
      return;
    }

    const entries = landfillIds
      .map((landfillId) => ({
        wasteGroupId: view.wasteGroupId!,
        landfillId,
        quantity: { value: parseAmount(draft[landfillId] ?? ''), unit: 't' as Unit },
      }))
      .filter((entry) => Number.isFinite(entry.quantity.value) && entry.quantity.value > 0);

    if (entries.length !== landfillIds.length) {
      setAllocationProblem(null);
      return;
    }

    const tons = groupTons();
    const allocated = entries.reduce((sum, entry) => sum + entry.quantity.value, 0);

    if (tons !== undefined && Math.abs(allocated - tons) > 0.0005) {
      setAllocationTotal(null);
      setAllocationMismatch(
        `Разложено ${formatQuantity(allocated, 't')} из ${formatQuantity(tons, 't')}: сумма долей обязана сойтись с объёмом группы`,
      );
      return;
    }

    try {
      const state = await setAllocation(calculation.id, entries);
      setAllocationTotal(formatMoney(state.total));
      setAllocationMismatch(null);
      setAllocationProblem(null);
    } catch (error: unknown) {
      if (error instanceof ApiProblem) {
        setAllocationProblem(error);
        setAllocationTotal(null);
      }
    }
  }

  function changeAllocationShare(landfillId: string, value: string) {
    const draft = { ...allocationDraft, [landfillId]: value };
    setAllocationDraft(draft);
    void applyAllocation(
      draft,
      selectedInGroup.map((entry) => entry.landfillId),
    );
  }

  async function download() {
    if (!calculation || quote) {
      // Повторное скачивание не выпускает второе предложение: номер и цены
      // закреплены на момент выпуска (R-036).
      return;
    }

    try {
      setQuote(await issueQuote(calculation.id));
    } catch (error: unknown) {
      if (error instanceof ApiProblem) {
        setFailure(error);
      }
    }
  }

  async function openRoute(option: PlacementOption) {
    if (!calculation) {
      return;
    }

    setRoute({ option, summary: null });

    try {
      setRoute({ option, summary: await getRoute(calculation.id) });
    } catch {
      // Отказ службы маршрутов не выдаётся за закрытые подпиской детали:
      // недоступное «по подписке» и недоступное «служба молчит» — разные
      // исходы, и второй показывается пустой сводкой без разрешения.
      setRoute({
        option,
        summary: { access: { granted: false }, legs: [], total: { amount: '0.00', currency: 'RUB' } },
      });
    }
  }

  function closeRoute() {
    setRoute(null);
  }

  /** Название полигона для показа: идентификатор справочника наружу не идёт. */
  function landfillNameById(landfillId?: string): string | undefined {
    return (shown?.items ?? []).find((option) => option.landfillId === landfillId)?.landfillName;
  }

  function landfillIdByName(landfillName: string): string | undefined {
    return (shown?.items ?? []).find((option) => option.landfillName === landfillName)?.landfillId;
  }

  function openPickup() {
    setPickup({
      name: '',
      phone: '',
      consent: false,
      landfillName: landfillNameById(selection?.entries[0]?.landfillId) ?? '',
    });
  }

  function changePickup(change: Partial<PickupDraft>) {
    setPickup((current) => (current ? { ...current, ...change } : current));
  }

  function closePickup() {
    setPickup(null);
  }

  async function sendPickup() {
    if (!pickup) {
      return;
    }

    if (!pickup.consent) {
      setPickupError('Без согласия на обработку персональных данных заявка не отправляется');
      return;
    }

    try {
      const created = await createPickupRequest({
        calculationId: calculation?.id,
        landfillId: landfillIdByName(pickup.landfillName),
        contactName: pickup.name,
        phone: pickup.phone,
        personalDataConsent: pickup.consent,
      });

      setPickupDone(created.message ?? 'Заявка принята');
      setPickup(null);
      setPickupError(undefined);
    } catch (error: unknown) {
      setPickupError(error instanceof ApiProblem ? error.title : 'Заявка не отправлена');
    }
  }

  function loadMore() {
    if (view.calculationId && shown) {
      void loadOptions(view.calculationId, view, shown.items.length);
    }
  }

  const activeTab = calculation?.results.find((tab) => tab.wasteGroupId === view.wasteGroupId);
  const shown = options ?? activeTab?.options ?? null;
  const freshness = calculation?.dataFreshness;
  const selectedInGroup: SelectionEntry[] = (selection?.entries ?? []).filter(
    (entry) => entry.wasteGroupId === view.wasteGroupId,
  );
  const warnings: SelectionWarning[] = selection?.warnings ?? [];

  // Список ещё не пришёл, а расчёт уже есть: это ожидание, а не пустой
  // результат. Разница видна пользователю (Э-12), поэтому она названа здесь.
  const loadingOptions = busy || (calculation !== null && shown === null);

  return {
    view,
    addressQuery,
    addressPicked,
    addressSuggestions,
    addressError,
    lines,
    disposalRequired,
    calculation,
    shown,
    freshness,
    busy,
    loadingOptions,
    failure,
    selection,
    selectedInGroup,
    warnings,
    allocationDraft,
    allocationTotal,
    allocationProblem,
    allocationMismatch,
    quote,
    quoteDocumentHref: quote ? quoteDocumentHref(quote) : undefined,
    /** Ссылка на экран предложения по этому расчёту (карта пути, этап 5). */
    quoteScreenHref: calculation
      ? hashOf('/quote', new URLSearchParams({ calc: calculation.id }))
      : undefined,
    route,
    pickup,
    pickupError,
    pickupDone,
    filterDraft,
    groupTons,
    isSelected,
    landfillNameById,
    setDisposalRequired,
    setFilterDraft,
    changeAddress,
    pickAddress,
    searchGroup,
    pickGroup,
    changeAmount,
    changeUnit,
    addLine,
    removeLine,
    calculate,
    applyView,
    sortBy,
    toggleOrder,
    clearDistanceFilter,
    applyDistanceDraft,
    loadMore,
    toggleLandfill,
    changeAllocationShare,
    download,
    openRoute,
    closeRoute,
    openPickup,
    changePickup,
    closePickup,
    sendPickup,
  };
}
