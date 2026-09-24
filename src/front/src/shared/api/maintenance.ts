/**
 * Обращения ведения справочников: правка цен и тарифов, ручной статус
 * полигона, прогон обновления и двухшаговый импорт книги.
 *
 * Отдельный модуль, а не строки в общем файле обращений: экраны пишутся
 * раздельно, и единый файл стал бы местом, где правки сталкиваются
 * (ADR-0008). Чтение справочников живёт в `references.ts` — здесь только
 * запись и то, что читается ради неё.
 *
 * Формы списаны со схем `src/back/Imolt.Api/contracts/openapi.yaml`
 * (`WasteGroupUpdate`, `LandfillTariff`, `LandfillStatusState`, `SyncRun`,
 * `ReferenceImportPreview`, `ReferenceImportResult`) и сверены с ответами
 * службы: интерфейс своей модели справочника не заводит.
 *
 * @supports: R-042, R-043, R-044, R-045, R-048
 * @adr: ADR-0008
 */
import { ApiProblem, request } from './http';
import type { LandfillStatus, WasteGroup } from './contracts';
import type { Money } from '@/shared/lib/formatting';

/** Правка группы отходов: меняется переданное, непереданное остаётся прежним. */
export type WasteGroupUpdate = {
  name?: string;
  fkkoCodes?: string[];
  transportPricePerTonKm?: Money;
  densityTonPerCubicMeter?: number;
};

/** Тариф утилизации полигона по группе отходов. */
export type LandfillTariff = {
  wasteGroupId: string;
  disposalPricePerTon: Money;
  updatedAt: string;
};

/** Откуда взят статус полигона: сбор, ручной ввод либо официальный перечень. */
export type LandfillStatusSource = 'telegram' | 'manual' | 'registry';

export type LandfillStatusState = {
  landfillId: string;
  status: LandfillStatus;
  statusUpdatedAt: string;
  source: LandfillStatusSource;
  reason?: string;
};

/** Итог одного прогона обновления справочников (ADR-0002). */
export type SyncRun = {
  startedAt: string;
  finishedAt?: string | null;
  source: 'telegram' | 'file' | 'registry';
  outcome: 'succeeded' | 'partial' | 'failed';
  recognizedMessages?: number;
  updatedLandfills?: number;
  failureReason?: string | null;
};

/** Какой справочник загружается книгой. */
export type ReferenceImportKind = 'wasteGroups' | 'landfills' | 'tariffs';

export type ReferenceImportChange = {
  entityId: string;
  field: string;
  currentValue: string | null;
  fileValue: string;
};

export type ReferenceImportRejectedRow = { row: number; reason: string };

export type ReferenceImportPreview = {
  id: string;
  kind: ReferenceImportKind;
  changes: ReferenceImportChange[];
  rejectedRows?: ReferenceImportRejectedRow[];
};

export type ReferenceImportResult = {
  id: string;
  appliedChanges: number;
  updatedAt: string;
};

/** Код отказа: предпросмотр посчитан на справочнике, которого больше нет. */
export const STALE_PREVIEW = 'urn:imolt:problem:stale-preview';

/** Код отказа: у участника нет права ведения справочников (ADR-0007). */
export const ROLE_REQUIRED = 'urn:imolt:problem:role-required';

/** Код отказа: операция требует сессии участника (ADR-0006). */
export const AUTHENTICATION_REQUIRED = 'urn:imolt:problem:authentication-required';

/**
 * Правка цены перевозки и прочих полей группы отходов (R-042, R-043).
 * Дату актуальности двигает служба: второго места, где она считается, нет.
 */
export function updateWasteGroup(wasteGroupId: string, update: WasteGroupUpdate): Promise<WasteGroup> {
  return request<WasteGroup>(`/v1/waste-groups/${encodeURIComponent(wasteGroupId)}`, {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
}

/** Тариф утилизации в ячейке «полигон и группа отходов» (R-042, R-048). */
export function setLandfillTariff(
  landfillId: string,
  wasteGroupId: string,
  disposalPricePerTon: Money,
): Promise<LandfillTariff> {
  const path = `/v1/landfills/${encodeURIComponent(landfillId)}/tariffs/${encodeURIComponent(wasteGroupId)}`;

  return request<LandfillTariff>(path, {
    method: 'PUT',
    body: JSON.stringify({ disposalPricePerTon }),
  });
}

/**
 * Ручной ввод статуса полигона — объявленный запасной путь к автоматическому
 * сбору (R-044). Основание необязательно договором, но передаётся, когда
 * менеджер данных его назвал: без основания запись не объясняет сама себя.
 */
export function setLandfillStatus(
  landfillId: string,
  status: LandfillStatus,
  reason?: string,
): Promise<LandfillStatusState> {
  const body = reason && reason.trim().length > 0 ? { status, reason: reason.trim() } : { status };

  return request<LandfillStatusState>(`/v1/landfills/${encodeURIComponent(landfillId)}/status`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/** Итог последнего обновления справочников. Требует сессии участника. */
export function getLatestSyncRun(): Promise<SyncRun> {
  return request<SyncRun>('/v1/sync-runs/latest');
}

/**
 * Первый шаг импорта: книга уходит на разбор, обратно приходят расхождения.
 * Справочник при этом не меняется (R-045).
 *
 * Тело составное: общий обмен не назначает ему типа содержимого, потому что
 * границу частей проставляет среда.
 */
export function startReferenceImport(kind: ReferenceImportKind, file: File): Promise<ReferenceImportPreview> {
  const form = new FormData();
  form.append('kind', kind);
  form.append('file', file, file.name);

  return request<ReferenceImportPreview>('/v1/reference-imports', { method: 'POST', body: form });
}

/**
 * Второй шаг импорта: разобранные расхождения применяются. Устаревший
 * предпросмотр служба отклоняет кодом 409 — повторять его бессмысленно,
 * книгу надо разобрать заново (R-045).
 */
export function confirmReferenceImport(importId: string): Promise<ReferenceImportResult> {
  return request<ReferenceImportResult>(`/v1/reference-imports/${encodeURIComponent(importId)}/confirmation`, {
    method: 'POST',
  });
}

/** Отказ службы, пригодный для показа: заголовок, пояснение и код причины. */
export type Refusal = { type: string; title: string; detail?: string; status: number };

/**
 * Отказ в виде, который показывает экран. Заголовок — то, что читает человек;
 * код причины остаётся внутренним именем и нужен только для ветвления
 * (ADR-0008, инвариант 4).
 */
export function refusalOf(error: unknown): Refusal {
  if (error instanceof ApiProblem) {
    return { type: error.type, title: error.title, detail: error.detail, status: error.status };
  }

  return {
    type: 'urn:imolt:problem:unknown',
    title: 'Запрос не выполнен',
    status: 0,
  };
}

/** Отказ означает, что править справочники этому участнику нельзя. */
export function deniesMaintenance(refusal: Refusal): boolean {
  return refusal.type === ROLE_REQUIRED || refusal.type === AUTHENTICATION_REQUIRED;
}
