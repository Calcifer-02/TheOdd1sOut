/**
 * Объяснение пустого результата словами пользователя.
 *
 * Пустой список — не отказ службы: договор называет причину пустоты полем
 * `emptyReason`, и экран обязан пересказать её, а не показать пустое место
 * (запрос на дизайн, Э-12). Причина переводится в заголовок здесь, чтобы оба
 * представления говорили одно и то же.
 *
 * @supports: R-025, R-060
 * @adr: ADR-0008
 */
import type { EmptyReason } from '@/shared/api/contracts';
import type { ViewState } from '@/shared/lib/viewState';

/** Заголовок пустого результата: чего именно не нашлось и при каком отборе. */
export function emptyResultTitle(reason: EmptyReason | undefined, view: ViewState): string {
  if (reason === 'filteredOutByDistance') {
    const side = view.distanceMode === 'atLeast' ? 'дальше' : 'ближе';

    return `Нет полигонов, принимающих этот тип отходов ${side} ${view.distanceKm} км`;
  }

  if (reason === 'noLandfillsForWasteGroup') {
    return 'Нет полигонов, принимающих этот тип отходов';
  }

  return 'Подходящих полигонов не нашлось';
}
