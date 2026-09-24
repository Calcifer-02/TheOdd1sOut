/**
 * Строка формы «тип отходов и объём»: черновик пользователя до того, как он
 * станет позицией расчёта.
 *
 * Разбор числа живёт здесь, а не в представлении: запятая как десятичный
 * разделитель — норма локали ru-RU (R-061), и мобильное представление обязано
 * понимать её ровно так же, как десктопное.
 *
 * @supports: R-013, R-014, R-061
 * @adr: ADR-0008
 */
import type { WasteGroup } from '@/shared/api/contracts';
import type { Unit } from '@/shared/lib/formatting';

/** Строка формы: что набрано, что выбрано из справочника и в какой мере. */
export type WasteLine = {
  key: string;
  query: string;
  group?: WasteGroup;
  suggestions: WasteGroup[];
  amount: string;
  unit: Unit;
  /** Пересчёт в тонны, если мера кубометры. Считает служба, не интерфейс. */
  tons?: number;
};

/**
 * Ключ строки — счётчик, а не случайное число: случайность мимо явного
 * генератора ломает воспроизводимость прогона (правила проекта, «Типичные
 * грабли»). Ключу нужна единственность внутри списка, а не непредсказуемость.
 */
let issued = 0;

export function emptyLine(): WasteLine {
  issued += 1;

  return { key: `line-${issued}`, query: '', suggestions: [], amount: '', unit: 't' };
}

/** Число из поля объёма: пустое и испорченное дают `NaN`, а не ноль. */
export function parseAmount(amount: string): number {
  return Number.parseFloat(amount.replace(',', '.'));
}

/** Заполненные строки в виде позиций запроса расчёта. */
export function filledItems(lines: WasteLine[]): { wasteGroupId: string; quantity: { value: number; unit: Unit } }[] {
  return lines
    .filter(line => line.group !== undefined && parseAmount(line.amount) > 0)
    .map(line => ({
      wasteGroupId: line.group!.id,
      quantity: { value: parseAmount(line.amount), unit: line.unit },
    }));
}
