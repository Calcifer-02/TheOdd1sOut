/**
 * Свежесть сведений о полигоне на экране справочника.
 *
 * Само правило устаревания и его порог живут в модели сущности «полигон»
 * (`@/entities/landfill`): одно и то же слово «данные устарели» на экране
 * расчёта и в справочнике обязано означать одно и то же. Здесь остаётся
 * только применение правила к записи справочника и переэкспорт порога для
 * подписи полосы актуальности.
 *
 * @supports: R-048
 * @adr: ADR-0008
 */
import { STALE_AFTER_DAYS, daysBehind, isStale, type BadgeStatus } from '@/entities/landfill';
import type { DataFreshness, Landfill } from '@/shared/api/references';

/**
 * Состояние полигона с учётом свежести данных. «Данные устарели» — состояние
 * производное: оно не приходит от службы записью, а выводится из даты
 * подтверждения статуса. Блокировка важнее устаревания и им не заслоняется.
 */
export function landfillBadgeStatus(
  landfill: Landfill,
  freshness: DataFreshness | null,
): BadgeStatus {
  if (landfill.status !== 'active' || freshness === null) {
    return landfill.status;
  }

  return isStale(landfill.statusUpdatedAt, freshness.statusesUpdatedAt) ? 'stale' : landfill.status;
}

export { STALE_AFTER_DAYS, daysBehind };
