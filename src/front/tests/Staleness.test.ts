/**
 * Правило устаревания сведений о полигоне — одно на весь интерфейс (R-048).
 *
 * До этой проверки правил было два: экран расчёта считал устаревшим любое
 * отставание от даты справочника, а справочник полигонов — только отставание
 * больше недели. Один и тот же полигон подписывался на соседних экранах
 * по-разному, и заметить это можно было только глазами.
 *
 * Проверка фальсифицируема: разведите правила снова — задайте в
 * `pages/landfills/model/freshness.ts` собственный порог или верните экрану
 * расчёта сравнение дат «меньше» — и последняя проверка назовёт расхождение.
 *
 *   npx vitest run tests/Staleness.test.ts
 *
 * @supports: R-048
 */
import { describe, expect, it } from 'vitest';
import { STALE_AFTER_DAYS, badgeStatus, daysBehind, isStale } from '@/entities/landfill';
import { landfillBadgeStatus } from '@/pages/landfills/model/freshness';
import type { PlacementOption } from '@/shared/api/contracts';
import type { DataFreshness, Landfill } from '@/shared/api/references';

/** Дата актуальности справочника из канонического примера договора. */
const AS_OF = '2026-09-17';

/** Дата, отставшая от актуальности ровно на заданное число суток. */
function датаОтставшаяНа(суток: number): string {
  const moment = new Date(Date.UTC(2026, 8, 17) - суток * 24 * 60 * 60 * 1000);
  return moment.toISOString().slice(0, 10);
}

function вариант(statusUpdatedAt: string): PlacementOption {
  return {
    landfillId: 'vostok-timohovo',
    landfillName: 'Восток-Тимохово',
    address: 'Московская обл, Ногинский р-н',
    distanceKm: 45,
    transportCost: { amount: '10800.00', currency: 'RUB' },
    disposalCost: { amount: '9000.00', currency: 'RUB' },
    totalCost: { amount: '19800.00', currency: 'RUB' },
    status: 'active',
    statusUpdatedAt,
  };
}

function запись(statusUpdatedAt: string): Landfill {
  return {
    id: 'vostok-timohovo',
    name: 'Восток-Тимохово',
    address: 'Московская обл, Ногинский р-н',
    coordinates: { latitude: 55.79, longitude: 38.33 },
    status: 'active',
    statusUpdatedAt,
  } as Landfill;
}

const справочник: DataFreshness = { pricesUpdatedAt: AS_OF, statusesUpdatedAt: AS_OF };

describe('устаревание сведений о полигоне', () => {
  it('при отставании ровно на порог сведения устаревшими не считает', () => {
    expect(isStale(датаОтставшаяНа(STALE_AFTER_DAYS), AS_OF)).toBe(false);
  });

  it('при отставании больше порога называет сведения устаревшими', () => {
    expect(isStale(датаОтставшаяНа(STALE_AFTER_DAYS + 1), AS_OF)).toBe(true);
  });

  it('при нечитаемой дате отставание не считает нулевым, а отказывается отвечать', () => {
    expect(daysBehind('не дата', AS_OF)).toBeNull();
    expect(isStale('не дата', AS_OF)).toBe(false);
  });

  it('одну и ту же пару дат экран расчёта и справочник называют одинаково', () => {
    for (const суток of [0, 1, STALE_AFTER_DAYS, STALE_AFTER_DAYS + 1, 30]) {
      const дата = датаОтставшаяНа(суток);

      expect(
        landfillBadgeStatus(запись(дата), справочник),
        `отставание ${суток} суток названо экранами по-разному`,
      ).toBe(badgeStatus(вариант(дата), AS_OF));
    }
  });
});
