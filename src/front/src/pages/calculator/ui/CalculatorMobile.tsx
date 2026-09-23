/**
 * Экран расчёта: форма исходных данных, сравнение полигонов, сводка выбора,
 * распределение объёма и документы — главный путь UC-001 целиком, вместе с
 * ветками UC-003 (фильтр расстояния) и UC-004 (распределение объёма).
 *
 * Экран ничего не считает: цены, пересчёт меры и итоги приходят от расчётной
 * части (ADR-0008, инвариант 2). Здесь — состояние, порядок обращений и показ.
 *
 * @req: R-012, R-013, R-014, R-019, R-021, R-024, R-025, R-027, R-029, R-030, R-032, R-036, R-053, R-058, R-061
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
  WasteGroup,
} from '@/shared/api/contracts';
import {
  ApiProblem,
  convertAmounts,
  createCalculation,
  createPickupRequest,
  createQuote,
  documentHref,
  getCalculation,
  getRoute,
  listPlacementOptions,
  searchWasteGroups,
  setAllocation,
  setSelection,
  suggestAddresses,
} from '@/shared/api/imolt';
import { Field, Notice, RadioPills, Sheet, SuggestList } from '@/shared/ui';
import { OptionCard, badgeStatus } from '@/entities/landfill';
import { SummaryBar } from '@/widgets/selection-summary';
import type { Unit } from '@/shared/lib/formatting';
import {
  formatDate,
  formatDistance,
  formatMoney,
  formatNumber,
  formatQuantity,
  unitName,
} from '@/shared/lib/formatting';
import type { SortField, ViewState } from '@/shared/lib/viewState';
import { DEFAULT_VIEW_STATE, parseViewState, viewStateToHash } from '@/shared/lib/viewState';

/** Первая страница — десять полигонов, остальные по «Показать ещё» (R-029). */
const PAGE_SIZE = 10;

const SORTS: { field: SortField; label: string }[] = [
  { field: 'total', label: 'По итогу' },
  { field: 'transport', label: 'Перевозка' },
  { field: 'disposal', label: 'Утилизация' },
  { field: 'distance', label: 'Расстояние' },
];

type WasteLine = {
  key: string;
  query: string;
  group?: WasteGroup;
  suggestions: WasteGroup[];
  amount: string;
  unit: Unit;
  tons?: number;
};

function emptyLine(): WasteLine {
  return { key: `line-${Math.random().toString(36).slice(2)}`, query: '', suggestions: [], amount: '', unit: 't' };
}

/** Время в пути словами: «~1 ч 10 мин». */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return hours > 0 ? `~${hours} ч ${rest} мин` : `~${rest} мин`;
}

export function CalculatorMobile() {
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
  const [route, setRoute] = useState<{ option: PlacementOption; summary: RouteSummary | null } | null>(null);
  const [pickup, setPickup] = useState<{
    name: string;
    phone: string;
    consent: boolean;
    landfillName: string;
  } | null>(null);
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

  const hashOf = useCallback((next: ViewState) => {
    const target = viewStateToHash(next);
    if (window.location.hash !== target) {
      window.history.replaceState(null, '', target);
    }
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
        offset > 0 && previous
          ? { ...page, items: [...previous.items, ...page.items] }
          : page,
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
    const value = Number.parseFloat(amount.replace(',', '.'));

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

  function filledLines(): { wasteGroupId: string; quantity: { value: number; unit: Unit } }[] {
    return lines
      .filter((line) => line.group && Number.parseFloat(line.amount.replace(',', '.')) > 0)
      .map((line) => ({
        wasteGroupId: line.group!.id,
        quantity: { value: Number.parseFloat(line.amount.replace(',', '.')), unit: line.unit },
      }));
  }

  async function calculate() {
    if (!addressPicked) {
      setAddressError('Выберите адрес из подсказки');
      return;
    }

    const items = filledLines();
    if (items.length === 0) {
      setAddressError(undefined);
      setFailure(new ApiProblem('urn:imolt:problem:validation', 'Заполните тип отходов и объём', 400));
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
      hashOf(next);
    } catch (error: unknown) {
      setFailure(error instanceof ApiProblem ? error : new ApiProblem('urn:imolt:problem:unknown', 'Запрос не выполнен', 0));
    } finally {
      setBusy(false);
    }
  }

  function applyView(change: Partial<ViewState>) {
    const next = { ...view, ...change };
    setView(next);
    hashOf(next);

    // Смена вкладки меняет предмет списка, а не его порядок: показывать
    // полигоны прежней группы, пока идёт запрос, значит показывать неправду.
    if (change.wasteGroupId && change.wasteGroupId !== view.wasteGroupId) {
      setOptions(null);
    }

    if (next.calculationId && next.wasteGroupId) {
      void loadOptions(next.calculationId, next, 0);
    }
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
        quantity: {
          value: Number.parseFloat((draft[landfillId] ?? '').replace(',', '.')),
          unit: 't' as Unit,
        },
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

  async function download() {
    if (!calculation || quote) {
      // Повторное скачивание не выпускает второе предложение: номер и цены
      // закреплены на момент выпуска (R-036).
      return;
    }

    try {
      setQuote(await createQuote(calculation.id));
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
      setRoute({ option, summary: { access: { granted: false }, legs: [], total: { amount: '0.00', currency: 'RUB' } } });
    }
  }

  /** Название полигона для показа: идентификатор справочника наружу не идёт. */
  function landfillNameById(landfillId?: string): string | undefined {
    return (options?.items ?? []).find((option) => option.landfillId === landfillId)?.landfillName;
  }

  function landfillIdByName(landfillName: string): string | undefined {
    return (options?.items ?? []).find((option) => option.landfillName === landfillName)
      ?.landfillId;
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

  const activeTab = calculation?.results.find((tab) => tab.wasteGroupId === view.wasteGroupId);
  const shown = options ?? activeTab?.options ?? null;
  const freshness = calculation?.dataFreshness;
  const selectedInGroup = (selection?.entries ?? []).filter(
    (entry) => entry.wasteGroupId === view.wasteGroupId,
  );

  return (
    <div className="imolt-page">
      <header className="imolt-header">
        <span className="imolt-brand">ИМОЛТ</span>
      </header>

      <h1 className="imolt-title">Калькулятор вывоза строительных отходов</h1>
      <p className="imolt-lead">
        Москва и область. Перевозка и утилизация — отдельно, результат сразу.
      </p>

      <section className="imolt-card" aria-label="Исходные данные расчёта">
        <Field
          id="address"
          label="Адрес вывоза"
          value={addressQuery}
          error={addressError}
          placeholder="Улица и дом"
          onChange={(value) => {
            setAddressQuery(value);
            setAddressPicked(null);
            setAddressError(undefined);
          }}
        />
        <SuggestList
          items={addressSuggestions}
          label="Подсказки адреса"
          render={(item) => item.value}
          onPick={(item) => {
            setAddressPicked(item);
            setAddressQuery(item.value);
            setAddressSuggestions([]);
          }}
        />

        {lines.map((line, index) => (
          <div key={line.key}>
            <Field
              id={`waste-${index}`}
              label="Тип отходов"
              value={line.query}
              placeholder="Название или код"
              onChange={(value) => void searchGroup(line.key, value)}
            />
            <SuggestList
              items={line.suggestions}
              label="Подсказки типа отходов"
              render={(item) => item.name}
              onPick={(item) => {
                updateLine(line.key, { group: item, query: item.name, suggestions: [] });
                void refreshConversion({ ...line, group: item }, line.amount, line.unit);
              }}
            />

            <div className="imolt-row">
              <Field
                id={`amount-${index}`}
                label="Объём"
                value={line.amount}
                inputMode="decimal"
                hint={line.tons !== undefined ? `≈ ${formatNumber(line.tons)} т` : undefined}
                onChange={(value) => {
                  updateLine(line.key, { amount: value });
                  void refreshConversion(line, value, line.unit);
                }}
              />
              <RadioPills
                className="imolt-units"
                name={`unit-${index}`}
                label="Мера объёма"
                value={line.unit}
                options={[
                  { value: 't' as Unit, label: unitName('t') },
                  { value: 'm3' as Unit, label: unitName('m3') },
                ]}
                onPick={(unit) => {
                  updateLine(line.key, { unit });
                  void refreshConversion(line, line.amount, unit);
                }}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          className="imolt-button imolt-button--tertiary"
          onClick={() => setLines((current) => [...current, emptyLine()])}
        >
          Добавить тип отходов
        </button>

        <label className="imolt-consent">
          <input
            type="checkbox"
            className="imolt-check"
            checked={disposalRequired}
            onChange={(event) => setDisposalRequired(event.target.checked)}
          />
          Нужна утилизация на полигоне
        </label>

        <button type="button" className="imolt-button" onClick={() => void calculate()} disabled={busy}>
          Рассчитать
        </button>
      </section>

      {busy && (
        <div className="imolt-skeleton" role="status" aria-label="Идёт расчёт" />
      )}

      {failure && (
        <Notice kind="error">
          <strong>
            {failure.type === 'urn:imolt:problem:distance-service-unavailable'
              ? 'Не удалось рассчитать расстояния'
              : failure.title}
          </strong>
          {failure.detail && <span>{failure.detail}</span>}
          <button type="button" className="imolt-button imolt-button--secondary" onClick={() => void calculate()}>
            Повторить
          </button>
        </Notice>
      )}

      {calculation && (
        <section aria-label="Результаты">
          <h2 className="imolt-section">Результаты</h2>

          <div className="imolt-tabs" role="tablist" aria-label="Группы отходов">
            {calculation.items.map((item) => (
              <button
                key={item.wasteGroupId}
                type="button"
                role="tab"
                className="imolt-tab"
                aria-selected={view.wasteGroupId === item.wasteGroupId}
                onClick={() => applyView({ wasteGroupId: item.wasteGroupId })}
              >
                {item.wasteGroupName}
              </button>
            ))}
          </div>

          <div className="imolt-sorts-line">
            <RadioPills
              className="imolt-sorts"
              name="sort"
              label="Сортировка"
              value={view.sort}
              options={SORTS.map((sort) => ({ value: sort.field, label: sort.label }))}
              onPick={(field) => applyView({ sort: field })}
            />
            <button
              type="button"
              className="imolt-button imolt-button--tertiary"
              onClick={() => applyView({ order: view.order === 'asc' ? 'desc' : 'asc' })}
            >
              {view.order === 'asc' ? 'По возрастанию' : 'По убыванию'}
            </button>
          </div>

          <div className="imolt-chips" aria-label="Фильтр расстояния">
            <button
              type="button"
              className="imolt-chip"
              aria-pressed={view.distanceMode === 'atMost'}
              onClick={() => setFilterDraft(String(view.distanceKm))}
            >
              до {view.distanceKm} км
            </button>
            <button
              type="button"
              className="imolt-chip"
              aria-pressed={view.distanceMode === 'atLeast'}
              onClick={() => applyView({ distanceMode: 'atLeast' })}
            >
              не менее {view.distanceKm} км
            </button>
          </div>

          {filterDraft !== null && (
            <div className="imolt-card">
              <Field
                id="distance-limit"
                label="Не более, км"
                value={filterDraft}
                inputMode="decimal"
                onChange={setFilterDraft}
              />
              <button
                type="button"
                className="imolt-button"
                onClick={() => {
                  const km = Number.parseInt(filterDraft, 10);
                  setFilterDraft(null);
                  applyView({ distanceMode: 'atMost', distanceKm: Number.isFinite(km) ? km : DEFAULT_VIEW_STATE.distanceKm });
                }}
              >
                Применить
              </button>
            </div>
          )}

          {freshness && (
            <p className="imolt-freshness">
              {freshness.pricesUpdatedAt === freshness.statusesUpdatedAt
                ? `Цены и статусы на ${formatDate(freshness.pricesUpdatedAt)}`
                : `Цены на ${formatDate(freshness.pricesUpdatedAt)}, статусы на ${formatDate(freshness.statusesUpdatedAt)}`}
            </p>
          )}

          {(selection?.warnings ?? []).map((warning) => (
            <Notice key={warning.landfillId} kind="warning">
              <span>Полигон заблокирован. Он остаётся в выборе, решение за вами.</span>
            </Notice>
          ))}

          {shown && shown.items.length === 0 && (
            <Notice kind="empty">
              <span>Снимите фильтр расстояния или выберите другой тип отходов.</span>
              {shown.emptyReason === 'filteredOutByDistance' && (
                <button
                  type="button"
                  className="imolt-button imolt-button--secondary"
                  onClick={() =>
                    applyView({
                      distanceMode: DEFAULT_VIEW_STATE.distanceMode,
                      distanceKm: 1000,
                    })
                  }
                >
                  Снять фильтр
                </button>
              )}
            </Notice>
          )}

          <ul className="imolt-options">
            {(shown?.items ?? []).map((option) => (
              <OptionCard
                key={option.landfillId}
                option={option}
                status={badgeStatus(option, freshness?.statusesUpdatedAt ?? option.statusUpdatedAt)}
                selected={isSelected(option)}
                onToggle={() => void toggleLandfill(option)}
                onRoute={() => void openRoute(option)}
              />
            ))}
          </ul>

          {shown && shown.items.length < shown.total && (
            <button
              type="button"
              className="imolt-button imolt-button--secondary"
              onClick={() =>
                view.calculationId && void loadOptions(view.calculationId, view, shown.items.length)
              }
            >
              Показать ещё
            </button>
          )}

          {selectedInGroup.length > 1 && (
            <section className="imolt-card imolt-allocation" aria-label="Распределение объёма">
              <strong>Распределение объёма</strong>
              {selectedInGroup.map((entry) => (
                <div className="imolt-allocation-row" key={entry.landfillId}>
                  <Field
                    id={`allocation-${entry.landfillId}`}
                    label={
                      (shown?.items ?? []).find((option) => option.landfillId === entry.landfillId)
                        ?.landfillName ?? 'Полигон'
                    }
                    value={allocationDraft[entry.landfillId] ?? ''}
                    inputMode="decimal"
                    onChange={(value) => {
                      const draft = { ...allocationDraft, [entry.landfillId]: value };
                      setAllocationDraft(draft);
                      void applyAllocation(
                        draft,
                        selectedInGroup.map((selected) => selected.landfillId),
                      );
                    }}
                  />
                  <span className="imolt-hint">т</span>
                </div>
              ))}
              {allocationMismatch && (
                <p className="imolt-error" role="alert">
                  {allocationMismatch}
                </p>
              )}
              {allocationProblem && (
                <Notice kind="error">
                  <strong>{allocationProblem.title}</strong>
                  {allocationProblem.detail && <span>{allocationProblem.detail}</span>}
                </Notice>
              )}
            </section>
          )}

          {quote && (
            <Notice kind="done">
              <strong>КП сохранено</strong>
              <a href={documentHref(quote)} download>
                Открыть коммерческое предложение
              </a>
            </Notice>
          )}

          {pickupDone && (
            <Notice kind="done">
              <strong>Заявка принята</strong>
              <span>{pickupDone}</span>
            </Notice>
          )}
        </section>
      )}

      {selection && selection.selectedLandfills > 0 && (
        <SummaryBar
          selectedCount={selection.selectedLandfills}
          total={allocationTotal ?? formatMoney(selection.total)}
          downloadLabel="Скачать КП"
          onDownload={() => void download()}
          onPickup={() =>
            setPickup({
              name: '',
              phone: '',
              consent: false,
              landfillName: landfillNameById(selection.entries[0]?.landfillId) ?? '',
            })
          }
        />
      )}

      {route && (
        <Sheet title="Маршрут" onClose={() => setRoute(null)}>
          <div className="imolt-map">мини-карта · заглушка</div>
          <strong>{route.option.landfillName}</strong>
          {route.summary?.access.granted ? (
            <>
              <span>
                {formatDistance(route.option.distanceKm)}
                {route.summary.legs.find((leg) => leg.landfillId === route.option.landfillId)
                  ?.durationMinutes
                  ? ` · ${formatDuration(
                      route.summary.legs.find((leg) => leg.landfillId === route.option.landfillId)!
                        .durationMinutes!,
                    )}`
                  : ''}
              </span>
              {route.summary.legs.find((leg) => leg.landfillId === route.option.landfillId)
                ?.externalMapUrl && (
                <a
                  href={
                    route.summary.legs.find((leg) => leg.landfillId === route.option.landfillId)!
                      .externalMapUrl!
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть в Яндекс.Картах
                </a>
              )}
            </>
          ) : (
            <>
              <strong>Детали маршрута — по подписке</strong>
              <span>
                Расстояние и стоимость видны всем. Время в пути и переход в Яндекс.Карты —
                перевозчикам и демонтажным компаниям.
              </span>
              <span>{formatDistance(route.option.distanceKm)}</span>
            </>
          )}
        </Sheet>
      )}

      {pickup && (
        <Sheet title="Заявка на вывоз" onClose={() => setPickup(null)}>
          <Field
            id="pickup-name"
            label="Имя"
            value={pickup.name}
            onChange={(value) => setPickup({ ...pickup, name: value })}
          />
          <Field
            id="pickup-phone"
            label="Телефон"
            value={pickup.phone}
            inputMode="tel"
            placeholder="+7"
            onChange={(value) => setPickup({ ...pickup, phone: value })}
          />
          <div className="imolt-grow">
            <label className="imolt-label" htmlFor="pickup-landfill">
              Полигон
            </label>
            <select
              id="pickup-landfill"
              className="imolt-input"
              value={pickup.landfillName}
              onChange={(event) => setPickup({ ...pickup, landfillName: event.target.value })}
            >
              {(selection?.entries ?? []).map((entry) => (
                <option key={entry.landfillId} value={landfillNameById(entry.landfillId) ?? ''}>
                  {landfillNameById(entry.landfillId)}
                </option>
              ))}
            </select>
          </div>
          <label className="imolt-consent">
            <input
              type="checkbox"
              className="imolt-check"
              checked={pickup.consent}
              onChange={(event) => setPickup({ ...pickup, consent: event.target.checked })}
            />
            Согласен на обработку персональных данных согласно политике
          </label>
          {pickupError && (
            <p className="imolt-error" role="alert">
              {pickupError}
            </p>
          )}
          <button type="button" className="imolt-button" onClick={() => void sendPickup()}>
            Отправить заявку
          </button>
        </Sheet>
      )}
    </div>
  );
}
