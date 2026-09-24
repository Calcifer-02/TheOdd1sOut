/**
 * Сводка маршрута по полигонам: плечо перевозки, время в пути, стоимости,
 * общий итог и переход во внешние карты (сущность «полигон»).
 *
 * Содержимое одно, оправа разная: на телефоне его показывает выдвижной лист,
 * на рабочем месте — модальное окно поверх страницы (решением заказчика от
 * 24.09.2026, R-033). Оправа здесь не выбирается — её задаёт представление.
 *
 * Полигонов столько, сколько их в вопросе. Требование R-032 говорит о
 * выбранных полигонах во множественном числе, и служба отдаёт участок
 * маршрута на каждый из них: перечень показывает их все, а не первый.
 * Порядок — по возрастанию совокупной цены, потому что вопрос перед перечнем
 * один: «куда дешевле».
 *
 * Своих величин здесь нет: ни баллов, ни коэффициентов, ни рейтингов —
 * величины расчёта принадлежат расчётной части (R-058). Показываются те числа,
 * которые она вернула, а «дешевле остальных» — сравнение этих же чисел.
 *
 * Карты здесь нет: она принадлежит окну маршрута (`RouteModal`), а не фактам.
 *
 * Время в пути и переход в Яндекс.Карты закрыты подпиской: разрешение
 * называет расчётная часть полем `access`, интерфейс его не толкует (R-032).
 * Молчащая служба маршрутов — другой исход, и называется он отдельно.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import type { PlacementOption, RouteSummary } from '@/shared/api/contracts';
import { formatDistance, formatMoney } from '@/shared/lib/formatting';
import { useStyles } from '@/shared/ui';
import { colors, fonts, radius, space, stroke } from '@/shared/ui/tokens';
import { routeRows, type RouteRow, type RouteScope } from '../model/routeSummary';

/** Прочерк вместо суммы: утилизация не заказана, и нуля здесь нет. */
const NO_VALUE = '–';

/**
 * Слова о самом дешёвом полигоне. Признак назван словом, а не одним цветом и
 * не рамкой: цвет и рамка читаются не всеми (разд. 4.6).
 */
const CHEAPEST_WORD = 'Дешевле остальных';

const ROUTE_CSS = `
.imolt-route { display: flex; flex-direction: column; gap: ${space.s}px; }
.imolt-route-order { margin: 0; font-size: 12px; line-height: 16px; color: ${colors.textSecondary}; }
.imolt-route-legs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${space.xs}px;
}

/* Полигон в перечне — отдельная плашка: в строке стоят название, плечо
   перевозки, разбивка цены и переход во внешние карты, и без рамки соседние
   полигоны сливаются в один столбец чисел (разд. 4.4). */
.imolt-route-leg {
  display: flex;
  flex-direction: column;
  gap: ${space.xxs}px;
  padding: ${space.s}px;
  border-radius: ${radius.field}px;
  border: ${stroke.hairline}px solid ${colors.borderDivider};
}

/* У самого дешёвого рамка заметнее, но она здесь второй признак: первый —
   слово «Дешевле остальных» рядом с названием (разд. 4.6). */
.imolt-route-leg[data-cheapest='true'] { border-color: ${colors.accentDark}; }

.imolt-route-leg-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${space.xs}px;
  flex-wrap: wrap;
}

.imolt-route-cheapest {
  padding: ${space.xxs}px ${space.xs}px;
  border-radius: ${radius.badge}px;
  background: ${colors.accentPrimary};
  color: ${colors.textPrimary};
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
  white-space: nowrap;
}

.imolt-route-way { font-size: 14px; line-height: 20px; color: ${colors.textSecondary}; }

/* Совокупная цена строки — не итог всего выбора: общий класс «imolt-total»
   набран в размер итога, и в перечне из трёх полигонов все числа получились бы
   одинаково крупными. Табличные цифры остаются, ступень — своя (разд. 4.2). */
.imolt-route-sum {
  font-family: ${fonts.numeric};
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: 16px;
  line-height: 22px;
  white-space: nowrap;
}

.imolt-route-locked { display: flex; flex-direction: column; gap: ${space.xxs}px; }
.imolt-route-total {
  margin: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${space.s}px;
  padding-top: ${space.xs}px;
  border-top: ${stroke.hairline}px solid ${colors.borderDivider};
}
`;

/** Время в пути словами: «~1 ч 10 мин». */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return hours > 0 ? `~${hours} ч ${rest} мин` : `~${rest} мин`;
}

/**
 * Плечо перевозки и время в пути одной строкой. Расстояние знает и вариант
 * размещения, и участок маршрута; берётся первое — оно показано в таблице
 * сравнения, и два разных числа об одном плече читались бы как ошибка.
 */
function wayOf(row: RouteRow): string {
  const duration = row.leg?.durationMinutes;

  return duration
    ? `${formatDistance(row.option.distanceKm)} · ${formatDuration(duration)}`
    : formatDistance(row.option.distanceKm);
}

export function RouteDetails({
  option,
  summary,
  scope = 'landfill',
  unavailable = false,
}: {
  /**
   * Полигоны маршрута: один — вопрос из строки таблицы, несколько — вопрос
   * сводки выбора (R-032, R-033). Имя свойства осталось в единственном числе:
   * по нему компонент вызывает витрина, а второе имя для того же предмета
   * развело бы вызовы.
   */
  option: PlacementOption | PlacementOption[];
  summary: RouteSummary | null;
  /** Чей это маршрут: одного полигона или всего выбора. */
  scope?: RouteScope;
  /** Служба маршрутов не ответила — это не закрытый подпиской доступ. */
  unavailable?: boolean;
}) {
  useStyles('landfill-route-details', ROUTE_CSS);

  const options = Array.isArray(option) ? option : [option];
  const granted = summary?.access.granted === true;
  const rows = routeRows(options, summary);

  return (
    <div className="imolt-route">
      {unavailable && (
        <div className="imolt-route-locked">
          <strong>Сводка маршрута не пришла</strong>
          <span>
            Служба маршрутов не ответила. Плечо перевозки и стоимости остались от расчёта; время в пути и переход в
            Яндекс.Карты появятся после повтора.
          </span>
        </div>
      )}

      {summary !== null && !granted && (
        <div className="imolt-route-locked">
          <strong>Детали маршрута – по подписке</strong>
          <span>
            Расстояние и стоимость видны всем. Время в пути и переход в Яндекс.Карты – перевозчикам и демонтажным
            компаниям.
          </span>
        </div>
      )}

      {rows.length > 1 && <p className="imolt-route-order">Полигоны перечислены от самого дешёвого по итогу.</p>}

      {/* Перечень назван, потому что он не один на экране: рядом стоят метки
          карты, и без имени вспомогательная технология их не различает. */}
      <ul className="imolt-route-legs" aria-label="Полигоны маршрута">
        {rows.map(row => (
          <li className="imolt-route-leg" key={row.option.landfillId} data-cheapest={row.cheapest}>
            <span className="imolt-route-leg-head">
              <strong className="imolt-option-name">{row.option.landfillName}</strong>
              {row.cheapest && <span className="imolt-route-cheapest">{CHEAPEST_WORD}</span>}
            </span>
            <span className="imolt-route-way">{wayOf(row)}</span>
            <span className="imolt-split">
              <span>Перевозка {formatMoney(row.option.transportCost)}</span>
              <span>Утилизация {row.option.disposalCost ? formatMoney(row.option.disposalCost) : NO_VALUE}</span>
            </span>
            <span className="imolt-route-sum">Итого {formatMoney(row.option.totalCost)}</span>
            {row.leg?.externalMapUrl && (
              <a href={row.leg.externalMapUrl} target="_blank" rel="noreferrer">
                Открыть в Яндекс.Картах
              </a>
            )}
          </li>
        ))}
      </ul>

      {/* Общий итог принадлежит вопросу о выборе: у одного полигона строки он
          был бы итогом чужой выборки, и показывать его там нельзя (R-032). */}
      {scope === 'selection' && summary !== null && (
        <p className="imolt-route-total">
          <span>Итого по выбранным полигонам</span>
          <span className="imolt-total">{formatMoney(summary.total)}</span>
        </p>
      )}
    </div>
  );
}
