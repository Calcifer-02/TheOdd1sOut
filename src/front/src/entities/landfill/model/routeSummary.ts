/**
 * Строки сводки маршрута и их порядок (сущность «полигон»).
 *
 * Расчётная часть отдаёт сводку массивом участков маршрута
 * (`RouteSummary.legs`, договор `src/back/Imolt.Api/contracts/openapi.yaml`) —
 * по записи на каждый выбранный полигон — и общим итогом. Участок знает плечо
 * перевозки, время в пути и переход во внешние карты; стоимости лежат в
 * варианте размещения, который уже показан на экране. Здесь эти две записи
 * сводятся в одну строку перечня.
 *
 * Своих величин модуль не заводит: ни баллов, ни коэффициентов, ни рейтингов.
 * Величины расчёта принадлежат расчётной части (R-058), и придуманное число на
 * экране было бы ложью. Порядок перечня и признак «дешевле остальных» — это
 * сравнение уже пришедших сумм, а не новая величина.
 *
 * @supports: R-032
 * @adr: ADR-0008
 */
import type { PlacementOption, RouteLeg, RouteSummary } from '@/shared/api/contracts';
import type { Money } from '@/shared/lib/formatting';

/**
 * Чей это маршрут. Из строки таблицы спрашивают про один полигон — «сколько
 * до него»; из сводки выбора спрашивают про весь выбор — «куда из выбранных
 * дешевле» (R-032, R-033). Общий итог службы принадлежит второму вопросу: у
 * одного полигона строки он был бы итогом чужой выборки.
 */
export type RouteScope = 'landfill' | 'selection';

/** Строка сводки: полигон, его участок маршрута и признак самого дешёвого. */
export type RouteRow = {
  option: PlacementOption;
  /** участок маршрута; его нет, пока сводка не пришла или закрыта подпиской */
  leg: RouteLeg | undefined;
  /** дешевле остальных показанных по совокупной цене */
  cheapest: boolean;
};

/**
 * Совокупная цена целым числом копеек — для сравнения, а не для показа.
 * Договор передаёт сумму строкой с двумя знаками после точки; сравнение через
 * дробное число зависело бы от двоичного округления (PRACT-027). Текст суммы
 * по-прежнему собирает общий помощник `formatMoney`, второго места
 * форматирования здесь нет.
 */
function kopecks(money: Money): number {
  const negative = money.amount.startsWith('-');
  const [whole, fraction = ''] = (negative ? money.amount.slice(1) : money.amount).split('.');
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));

  return negative ? -value : value;
}

/**
 * Строки сводки по возрастанию совокупной цены.
 *
 * Порядок именно такой, потому что у человека перед перечнем один вопрос —
 * «куда дешевле», — и перечень обязан отвечать на него сразу, а не после
 * перебора строк глазами (R-032).
 */
export function routeRows(options: PlacementOption[], summary: RouteSummary | null): RouteRow[] {
  const ordered = [...options].sort((first, second) => kopecks(first.totalCost) - kopecks(second.totalCost));

  // «Дешевле остальных» называется только тогда, когда такой полигон
  // действительно один: при равных совокупных ценах признака нет — иначе
  // экран назвал бы дешевле один из двух одинаковых.
  const alone = ordered.length > 1 && kopecks(ordered[0].totalCost) < kopecks(ordered[1].totalCost);

  return ordered.map((option, at) => ({
    option,
    leg: summary?.legs.find(candidate => candidate.landfillId === option.landfillId),
    cheapest: at === 0 && alone,
  }));
}
