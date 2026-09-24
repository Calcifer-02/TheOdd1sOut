/**
 * Предметная часть редактора цен и справочников: загрузка, правка, статусы
 * и актуальность данных.
 *
 * Логика живёт здесь, а не в разметке, потому что представлений у экрана два
 * — таблица рабочего места и карточки телефона, — и они обязаны вести себя
 * одинаково. Копия правил в двух файлах разошлась бы молча (ADR-0008).
 *
 * Величины справочника — тарифы, цены перевозки, плотности — приходят от
 * службы и здесь не назначаются: редактор переносит введённое менеджером
 * данных и показывает то, чем ответила служба (R-039, R-040, R-042).
 *
 * @req: R-042, R-043, R-044, R-048
 * @adr: ADR-0008
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DataFreshness, LandfillStatus, WasteGroup } from '@/shared/api/contracts';
import type { Money } from '@/shared/lib/formatting';
import {
  type Landfill,
  getDataFreshness,
  listLandfills,
  listWasteGroups,
} from '@/shared/api/references';
import {
  type LandfillTariff,
  type Refusal,
  type SyncRun,
  deniesMaintenance,
  getLatestSyncRun,
  refusalOf,
  setLandfillStatus,
  setLandfillTariff,
  updateWasteGroup,
} from '@/shared/api/maintenance';

/** Вкладки редактора. Какая открыта — видно в адресе (ADR-0008, инвариант 5). */
export type EditorTab = 'landfills' | 'wasteGroups';

/** Сколько записей справочника редактор читает за раз. */
const PAGE_LIMIT = 100;

/**
 * Ключ редактируемой ячейки. Предметный, а не позиционный: строка таблицы
 * переставляется поиском, а ячейка остаётся той же (карточка практики
 * PRACT-021).
 */
export function tariffCellKey(landfillId: string, wasteGroupId: string): string {
  return `tariff:${landfillId}:${wasteGroupId}`;
}

export function transportCellKey(wasteGroupId: string): string {
  return `transport:${wasteGroupId}`;
}

/**
 * Разбор введённой суммы в денежную форму договора. Допускаются целое и два
 * знака после запятой либо точки; отрицательная цена и посторонние знаки
 * отклоняются до обращения к службе, чтобы отказ не стоил обхода по сети.
 */
export function moneyOf(text: string): Money | null {
  const trimmed = text.replace(/\s/g, '').replace(',', '.');

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }

  const [whole, fraction = ''] = trimmed.split('.');

  return { amount: `${whole}.${fraction.padEnd(2, '0')}`, currency: 'RUB' };
}

/** Тариф утилизации полигона по группе отходов или его отсутствие. */
export function tariffOf(landfill: Landfill, wasteGroupId: string): LandfillTariff | undefined {
  return landfill.tariffs.find((tariff) => tariff.wasteGroupId === wasteGroupId);
}

/**
 * Дата, на которую известны цены полигона: самая поздняя среди его тарифов.
 * Правило показа, а не расчёта: все даты приходят от службы (R-048).
 */
export function latestTariffDate(landfill: Landfill): string | null {
  return landfill.tariffs.reduce<string | null>(
    (latest, tariff) => (latest === null || tariff.updatedAt > latest ? tariff.updatedAt : latest),
    null,
  );
}

/** Отбор по названию: полигон — по имени и юрлицу, группа — по имени и коду. */
function matchesLandfill(landfill: Landfill, query: string): boolean {
  const lowered = query.trim().toLowerCase();

  return (
    lowered === ''
    || landfill.name.toLowerCase().includes(lowered)
    || (landfill.legalEntity ?? '').toLowerCase().includes(lowered)
  );
}

function matchesWasteGroup(group: WasteGroup, query: string): boolean {
  const lowered = query.trim().toLowerCase();

  return (
    lowered === ''
    || group.name.toLowerCase().includes(lowered)
    || group.fkkoCodes.some((code) => code.toLowerCase().includes(lowered))
  );
}

export type ReferenceEditor = {
  loading: boolean;
  /** Отказ при чтении справочника: таблицы нет, и выдумывать её нечем. */
  loadRefusal: Refusal | null;
  landfills: Landfill[];
  /** Сколько полигонов в реестре всего: прочитано может быть меньше. */
  landfillTotal: number;
  wasteGroups: WasteGroup[];
  wasteGroupTotal: number;
  freshness: DataFreshness | null;
  syncRun: SyncRun | null;
  /** Отказ при чтении прогона обновления: чаще всего — отсутствие сессии. */
  syncRefusal: Refusal | null;
  /** Отказ по праву ведения справочников: правка закрыта, чтение остаётся. */
  maintenanceRefusal: Refusal | null;
  /** Ключ ячейки, которую служба сейчас принимает. */
  saving: string | null;
  /** Отказ по ячейке: показывается рядом с ней, значение остаётся прежним. */
  cellRefusal: { key: string; title: string } | null;
  /** Правка разрешена, пока служба не ответила отказом по праву или сессии. */
  editable: boolean;
  visibleLandfills(query: string): Landfill[];
  visibleWasteGroups(query: string): WasteGroup[];
  saveTariff(landfillId: string, wasteGroupId: string, text: string): Promise<boolean>;
  saveTransportPrice(wasteGroupId: string, text: string): Promise<boolean>;
  saveStatus(landfillId: string, status: LandfillStatus, reason?: string): Promise<boolean>;
  forgetCellRefusal(): void;
  /**
   * Повторная проверка права после входа. Сессия появляется позже открытия
   * экрана — участник даёт согласие на обработку персональных данных уже на
   * странице, — и отказ, снятый входом, обязан сниматься и здесь (R-054).
   */
  retryMaintenance(): Promise<void>;
  reload(): Promise<void>;
};

/**
 * Состояние редактора. Один экземпляр на экран: оба представления получают
 * его от страницы и различаются только разметкой.
 */
export function useReferenceEditor(): ReferenceEditor {
  const [loading, setLoading] = useState(true);
  const [loadRefusal, setLoadRefusal] = useState<Refusal | null>(null);
  const [landfills, setLandfills] = useState<Landfill[]>([]);
  const [landfillTotal, setLandfillTotal] = useState(0);
  const [wasteGroups, setWasteGroups] = useState<WasteGroup[]>([]);
  const [wasteGroupTotal, setWasteGroupTotal] = useState(0);
  const [freshness, setFreshness] = useState<DataFreshness | null>(null);
  const [syncRun, setSyncRun] = useState<SyncRun | null>(null);
  const [syncRefusal, setSyncRefusal] = useState<Refusal | null>(null);
  const [maintenanceRefusal, setMaintenanceRefusal] = useState<Refusal | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [cellRefusal, setCellRefusal] = useState<{ key: string; title: string } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);

    try {
      const [landfillPage, groupPage, dates] = await Promise.all([
        listLandfills({ limit: PAGE_LIMIT }),
        listWasteGroups({ limit: PAGE_LIMIT }),
        getDataFreshness(),
      ]);

      setLandfills(landfillPage.items);
      setLandfillTotal(landfillPage.total);
      setWasteGroups(groupPage.items);
      setWasteGroupTotal(groupPage.total);
      setFreshness(dates);
      setLoadRefusal(null);
    } catch (error) {
      setLoadRefusal(refusalOf(error));
    } finally {
      setLoading(false);
    }
  }, []);

  const readSyncRun = useCallback(async () => {
    try {
      setSyncRun(await getLatestSyncRun());
      setSyncRefusal(null);
    } catch (error) {
      const refusal = refusalOf(error);
      setSyncRun(null);
      setSyncRefusal(refusal);

      // Отказ по сессии закрывает и правку: все шесть операций ведения
      // требуют участника (ADR-0006). Честнее показать это сразу, чем дать
      // набрать значение и отказать после (R-042).
      if (deniesMaintenance(refusal)) {
        setMaintenanceRefusal(refusal);
      }
    }
  }, []);

  useEffect(() => {
    void reload();
    void readSyncRun();
  }, [reload, readSyncRun]);

  /** Обновление даты актуальности после удачной правки цены (R-048). */
  const refreshDates = useCallback(async () => {
    try {
      setFreshness(await getDataFreshness());
    } catch {
      // Дата актуальности не перечиталась: прежняя остаётся на экране, а
      // правка уже принята. Подменять дату «сегодняшней» нельзя — её
      // считает служба.
    }
  }, []);

  /** Общая часть удачной и неудачной правки: отказ и снятие занятости. */
  const acceptRefusal = useCallback((key: string, error: unknown) => {
    const refusal = refusalOf(error);
    setCellRefusal({ key, title: refusal.title });

    if (deniesMaintenance(refusal)) {
      setMaintenanceRefusal(refusal);
    }
  }, []);

  const saveTariff = useCallback(
    async (landfillId: string, wasteGroupId: string, text: string): Promise<boolean> => {
      const key = tariffCellKey(landfillId, wasteGroupId);
      const price = moneyOf(text);

      if (price === null) {
        setCellRefusal({ key, title: 'Цена вводится числом, не меньше нуля' });
        return false;
      }

      setSaving(key);
      setCellRefusal(null);

      try {
        const tariff = await setLandfillTariff(landfillId, wasteGroupId, price);

        setLandfills((current) =>
          current.map((landfill) =>
            landfill.id === landfillId
              ? {
                  ...landfill,
                  tariffs: landfill.tariffs.some((item) => item.wasteGroupId === wasteGroupId)
                    ? landfill.tariffs.map((item) =>
                        item.wasteGroupId === wasteGroupId ? tariff : item,
                      )
                    : [...landfill.tariffs, tariff],
                }
              : landfill,
          ),
        );

        await refreshDates();
        return true;
      } catch (error) {
        acceptRefusal(key, error);
        return false;
      } finally {
        setSaving(null);
      }
    },
    [acceptRefusal, refreshDates],
  );

  const saveTransportPrice = useCallback(
    async (wasteGroupId: string, text: string): Promise<boolean> => {
      const key = transportCellKey(wasteGroupId);
      const price = moneyOf(text);

      if (price === null) {
        setCellRefusal({ key, title: 'Цена вводится числом, не меньше нуля' });
        return false;
      }

      setSaving(key);
      setCellRefusal(null);

      try {
        const updated = await updateWasteGroup(wasteGroupId, { transportPricePerTonKm: price });

        setWasteGroups((current) =>
          current.map((group) => (group.id === wasteGroupId ? updated : group)),
        );

        await refreshDates();
        return true;
      } catch (error) {
        acceptRefusal(key, error);
        return false;
      } finally {
        setSaving(null);
      }
    },
    [acceptRefusal, refreshDates],
  );

  const saveStatus = useCallback(
    async (landfillId: string, status: LandfillStatus, reason?: string): Promise<boolean> => {
      const key = `status:${landfillId}`;
      setSaving(key);
      setCellRefusal(null);

      try {
        const state = await setLandfillStatus(landfillId, status, reason);

        setLandfills((current) =>
          current.map((landfill) =>
            landfill.id === landfillId
              ? { ...landfill, status: state.status, statusUpdatedAt: state.statusUpdatedAt }
              : landfill,
          ),
        );

        return true;
      } catch (error) {
        acceptRefusal(key, error);
        return false;
      } finally {
        setSaving(null);
      }
    },
    [acceptRefusal],
  );

  const forgetCellRefusal = useCallback(() => setCellRefusal(null), []);

  const retryMaintenance = useCallback(async () => {
    setMaintenanceRefusal(null);
    setCellRefusal(null);
    await readSyncRun();
  }, [readSyncRun]);

  const visibleLandfills = useCallback(
    (query: string) => landfills.filter((landfill) => matchesLandfill(landfill, query)),
    [landfills],
  );

  const visibleWasteGroups = useCallback(
    (query: string) => wasteGroups.filter((group) => matchesWasteGroup(group, query)),
    [wasteGroups],
  );

  return useMemo(
    () => ({
      loading,
      loadRefusal,
      landfills,
      landfillTotal,
      wasteGroups,
      wasteGroupTotal,
      freshness,
      syncRun,
      syncRefusal,
      maintenanceRefusal,
      saving,
      cellRefusal,
      editable: maintenanceRefusal === null,
      visibleLandfills,
      visibleWasteGroups,
      saveTariff,
      saveTransportPrice,
      saveStatus,
      forgetCellRefusal,
      retryMaintenance,
      reload,
    }),
    [
      loading,
      loadRefusal,
      landfills,
      landfillTotal,
      wasteGroups,
      wasteGroupTotal,
      freshness,
      syncRun,
      syncRefusal,
      maintenanceRefusal,
      saving,
      cellRefusal,
      visibleLandfills,
      visibleWasteGroups,
      saveTariff,
      saveTransportPrice,
      saveStatus,
      forgetCellRefusal,
      retryMaintenance,
      reload,
    ],
  );
}
