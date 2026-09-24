/**
 * Состав коммерческого предложения: строки «отходы — полигон — суммы».
 *
 * Здесь предметная логика экрана Э-07, общая для обоих представлений: на
 * широком экране строки становятся таблицей, на телефоне — карточками, но
 * считаются они один раз (дизайн-договор, разд. 4.5).
 *
 * Ни одна сумма здесь не вычисляется. Состав предложения складывается из
 * ответа расчётной части: доли распределения уже приходят с ценами
 * (`allocation.entries`), а выбор без распределения берёт суммы варианта
 * размещения по группе (`results[].options`). Итог называет служба —
 * `allocation.total`, `selection.total` или `quote.total`. Второй источник
 * тех же цифр в браузере разошёлся бы с документом, который собирает
 * расчётная часть по снимку (R-037, ADR-0008, инвариант 2).
 *
 * @supports: R-037
 * @adr: ADR-0008
 */
import type { Calculation, PlacementOption, Quantity } from '@/shared/api/contracts';
import { formatQuantity, type Money } from '@/shared/lib/formatting';

/** Строка предложения: одна группа отходов на одном полигоне. */
export type QuoteLine = {
  /** Ключ строки: группа, полигон и порядок — одна группа делится на части. */
  id: string;
  wasteGroupName: string;
  /** Имя полигона; `null`, когда вариант размещения не пришёл с расчётом. */
  landfillName: string | null;
  landfillAddress: string | null;
  distanceKm: number | null;
  /** Количество так, как его назвал пользователь: тонны либо кубометры. */
  quantity: Quantity;
  /** Пересчёт службы в тонны; показывается, когда мера — кубометры (R-015). */
  tons: number | null;
  transportCost: Money;
  disposalCost: Money | null;
  totalCost: Money;
};

/**
 * Откуда взят состав: распределение объёма по нескольким полигонам (UC-004),
 * простой выбор полигонов или ничего — тогда предложение не выпускается.
 */
export type CompositionSource = 'allocation' | 'selection' | 'none';

export type QuoteComposition = {
  source: CompositionSource;
  lines: QuoteLine[];
  /** Итог по составу, названный расчётной частью; `null` — состава нет. */
  total: Money | null;
  /**
   * Сколько выбранных полигонов расчёт не раскрыл ценами. Молчаливый пропуск
   * строки сделал бы предпросмотр короче документа, и расхождение осталось бы
   * незамеченным.
   */
  omitted: number;
};

function optionOf(
  calculation: Calculation,
  wasteGroupId: string,
  landfillId: string,
): PlacementOption | undefined {
  return calculation.results
    .find((result) => result.wasteGroupId === wasteGroupId)
    ?.options.items.find((option) => option.landfillId === landfillId);
}

function wasteGroupNameOf(calculation: Calculation, wasteGroupId: string): string {
  // Имя группы приходит с расчётом; запасной вариант — идентификатор группы:
  // пустая ячейка в документе хуже технического имени.
  return (
    calculation.items.find((item) => item.wasteGroupId === wasteGroupId)?.wasteGroupName ??
    wasteGroupId
  );
}

/** Состав по распределению объёма: доли приходят уже с ценами. */
function fromAllocation(calculation: Calculation): QuoteComposition {
  const allocation = calculation.allocation!;

  const lines = allocation.entries.map((entry, index) => {
    const option = optionOf(calculation, entry.wasteGroupId, entry.landfillId);

    return {
      id: `${entry.wasteGroupId}-${entry.landfillId}-${index}`,
      wasteGroupName: wasteGroupNameOf(calculation, entry.wasteGroupId),
      landfillName: option?.landfillName ?? null,
      landfillAddress: option?.address ?? null,
      distanceKm: option?.distanceKm ?? null,
      quantity: entry.quantity,
      // Пересчёт доли в тонны расчёт не присылает, и считать его здесь значило
      // бы завести вторую плотность рядом со справочником (R-015).
      tons: null,
      transportCost: entry.transportCost,
      disposalCost: entry.disposalCost ?? null,
      totalCost: entry.totalCost,
    } satisfies QuoteLine;
  });

  return { source: 'allocation', lines, total: allocation.total, omitted: 0 };
}

/** Состав по выбору полигонов: суммы берутся у варианта размещения. */
function fromSelection(calculation: Calculation): QuoteComposition {
  const selection = calculation.selection!;
  const lines: QuoteLine[] = [];
  let omitted = 0;

  selection.entries.forEach((entry, index) => {
    const option = optionOf(calculation, entry.wasteGroupId, entry.landfillId);
    const item = calculation.items.find((candidate) => candidate.wasteGroupId === entry.wasteGroupId);

    if (!option || !item) {
      omitted += 1;
      return;
    }

    lines.push({
      id: `${entry.wasteGroupId}-${entry.landfillId}-${index}`,
      wasteGroupName: wasteGroupNameOf(calculation, entry.wasteGroupId),
      landfillName: option.landfillName,
      landfillAddress: option.address,
      distanceKm: option.distanceKm,
      quantity: item.input,
      tons: item.input.unit === 'm3' ? item.tons : null,
      transportCost: option.transportCost,
      disposalCost: option.disposalCost ?? null,
      totalCost: option.totalCost,
    });
  });

  return { source: 'selection', lines, total: selection.total, omitted };
}

/**
 * Состав предложения по расчёту. Распределение старше выбора: разделив 20 т
 * на два полигона, пользователь ждёт в предложении две строки по бетону
 * (UC-004, шаг 3), а не одну строку выбора.
 */
export function composeQuote(calculation: Calculation): QuoteComposition {
  if (calculation.allocation && calculation.allocation.entries.length > 0) {
    return fromAllocation(calculation);
  }

  if (calculation.selection && calculation.selection.entries.length > 0) {
    return fromSelection(calculation);
  }

  return { source: 'none', lines: [], total: null, omitted: 0 };
}

/**
 * Количество строки одной надписью. Пересчёт в тонны показывается рядом с
 * введённой мерой, а не вместо неё: пользователь вводил кубометры и обязан
 * узнать своё число (R-015, макет Э-02).
 *
 * Надпись собирается здесь, а не в двух представлениях: таблица и карточка
 * показывают одно и то же количество, и расходиться им незачем.
 */
export function quantityTextOf(line: QuoteLine): string {
  const entered = formatQuantity(line.quantity.value, line.quantity.unit);

  return line.tons === null ? entered : `${entered} ≈ ${formatQuantity(line.tons, 't')}`;
}
