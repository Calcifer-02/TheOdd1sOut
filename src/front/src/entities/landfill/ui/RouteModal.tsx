/**
 * Окно маршрута: карта с метками, сведения о полигоне и сводка маршрута
 * (сущность «полигон»).
 *
 * Решение заказчика от 24.09.2026: маршрут открывается модальным окном поверх
 * страницы с настоящей картой. Прежде окно отрисовывалось внутри таблицы
 * сравнения, резалось её областью прокрутки и требовало двигать колонки
 * (R-033). Прежний запрет дизайн-договора на модальное окно для маршрута снят
 * тем же решением.
 *
 * Полигонов в окне столько, сколько их в вопросе: из строки таблицы
 * спрашивают про один полигон, из сводки выбора — про весь выбор, и требование
 * R-032 называет выбранные полигоны во множественном числе. Поэтому меток на
 * карте столько же: адрес вывоза и метка на каждый полигон, а кадр карты
 * вмещает их все.
 *
 * Линий маршрута на карте нет намеренно: геометрии договор не отдаёт, а прямая
 * занизила бы плечо перевозки — расчёт считает по дорожной сети (R-020).
 *
 * Оправа здесь одна — модальное окно, и это её единственное назначение: на
 * телефоне маршрут по-прежнему показывает выдвижная панель, и содержимое
 * сводки общее у обеих оправ (`RouteDetails`).
 *
 * @req: R-033
 * @supports: R-032, R-034
 * @adr: ADR-0008
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Coordinates, PlacementOption, RouteSummary } from '@/shared/api/contracts';
import type { LandfillCard, WasteGroup } from '@/shared/api/references';
import { formatMoney } from '@/shared/lib/formatting';
import { Modal, Notice, Skeleton } from '@/shared/ui';
import { useRouteLandfills } from '../model/routeLandfills';
import { drawRouteMap, type MapFailure, type RoutePoint } from '../model/routeMap';
import { routeRows, type RouteScope } from '../model/routeSummary';
import { RouteDetails } from './RouteDetails';
import { StatusBadge } from './StatusBadge';

/**
 * Источник тайлов называется на самой карте: лицензия ODbL требует указания
 * авторов данных. Подпись живёт в разметке окна, а не рисуется библиотекой
 * карты, поэтому остаётся видимой и при отказе тайлов.
 */
const MAP_CREDIT = 'Данные карты — © участники OpenStreetMap';

/** Отказ карты словами. Пустая рамка причины не называет (разд. 4.4). */
const MAP_FAILURE_WORD: Record<MapFailure, string> = {
  tiles: 'Карта не загрузилась: источник карты не ответил.',
  library: 'Карта не загрузилась: не удалось подключить карту.',
};

/** Что остаётся на экране без карты: сама сводка маршрута от неё не зависит. */
const MAP_FAILURE_HINT = 'Расстояние, время в пути и переход во внешние карты остались в окне.';

/** Полотно карты. Библиотека правит этот узел сама, React в него не пишет. */
function RouteMap({ points, onFailure }: { points: RoutePoint[]; onFailure: (failure: MapFailure) => void }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = host.current;

    if (node === null) {
      return;
    }

    let cancelled = false;
    let drop: (() => void) | null = null;

    void drawRouteMap(node, points, onFailure).then(cleanup => {
      // Окно закрылось, пока шла загрузка библиотеки: карту, которой уже никто
      // не видит, надо снять сразу — иначе останутся её подписки на окно
      // браузера.
      if (cancelled) {
        cleanup();
        return;
      }

      drop = cleanup;
    });

    return () => {
      cancelled = true;
      drop?.();
    };
  }, [points, onFailure]);

  return <div className="imolt-map" ref={host} />;
}

/** Название группы отходов; справочник не пришёл — показывается её код. */
function groupName(groups: WasteGroup[], wasteGroupId: string): string {
  return groups.find(group => group.id === wasteGroupId)?.name ?? wasteGroupId;
}

/**
 * Сведения о полигоне, открытые нажатием на его метку. Карточка передаётся
 * готовой: она уже запрошена ради координат метки, и второе обращение за теми
 * же данными службе не нужно.
 */
function LandfillFacts({ card, groups }: { card: LandfillCard; groups: WasteGroup[] }) {
  return (
    <div className="imolt-map-facts">
      <strong>{card.name}</strong>
      <span>{card.address}</span>
      {/* Статус приёма называется словом и датой, на которую он известен:
          одним цветом состояние не выражается (R-048, разд. 4.6). */}
      <StatusBadge status={card.status} statusUpdatedAt={card.statusUpdatedAt} />
      {card.tariffs.length === 0 ? (
        <span>Тарифы утилизации не заданы</span>
      ) : (
        <ul className="imolt-map-tariffs">
          {card.tariffs.map(tariff => (
            <li key={tariff.wasteGroupId}>
              {groupName(groups, tariff.wasteGroupId)} — {formatMoney(tariff.disposalPricePerTon)} за тонну
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RouteModal({
  option,
  summary,
  pickup,
  onClose,
  scope = 'landfill',
  unavailable = false,
}: {
  /**
   * Полигоны маршрута: один — вопрос из строки таблицы, несколько — вопрос
   * сводки выбора (R-032, R-033). Имя свойства осталось в единственном числе:
   * по нему компонент вызывает витрина.
   */
  option: PlacementOption | PlacementOption[];
  summary: RouteSummary | null;
  /** Адрес вывоза из расчёта: его координаты — первая метка на карте (R-012). */
  pickup: { value: string; coordinates: Coordinates };
  onClose: () => void;
  /** Чей это маршрут: одного полигона или всего выбора. */
  scope?: RouteScope;
  /** Служба маршрутов не ответила — это не закрытый подпиской доступ. */
  unavailable?: boolean;
}) {
  const options = useMemo(() => (Array.isArray(option) ? option : [option]), [option]);
  const landfillIds = useMemo(() => options.map(one => one.landfillId), [options]);
  const { cards, groups, missing, pending } = useRouteLandfills(landfillIds);
  const [factsFor, setFactsFor] = useState<string | null>(null);
  const [failure, setFailure] = useState<MapFailure | null>(null);

  const showFacts = useCallback((landfillId: string) => setFactsFor(landfillId), []);

  // Перечень меток пересобирается только при смене самих точек: библиотека
  // карты рисует полотно заново на каждый новый перечень, и новая стрелка на
  // каждой отрисовке перезапускала бы карту. По той же причине метки не
  // зависят от сводки: она приходит позже карточек реестра, и карта не должна
  // перерисовываться на её приход.
  const points = useMemo<RoutePoint[]>(() => {
    if (pending) {
      return [];
    }

    const marks: RoutePoint[] = options.flatMap(one => {
      const place = cards[one.landfillId]?.coordinates;

      return place === undefined
        ? []
        : [
            {
              kind: 'landfill' as const,
              title: `Полигон: ${one.landfillName}`,
              coordinates: place,
              onSelect: () => showFacts(one.landfillId),
            },
          ];
    });

    // Метки адреса вывоза без полигонов не бывает: одна точка не маршрут, а
    // кадр карты по ней сошёлся бы в точку.
    return marks.length === 0
      ? []
      : [{ kind: 'pickup', title: `Адрес вывоза: ${pickup.value}`, coordinates: pickup.coordinates }, ...marks];
  }, [cards, options, pending, pickup.coordinates, pickup.value, showFacts]);

  // Перечень меток под картой идёт в порядке самой сводки: перечень и карта
  // говорят об одном выборе, и разный порядок пришлось бы сверять глазами.
  const shownLandfills = routeRows(options, summary)
    .map(row => row.option)
    .filter(one => cards[one.landfillId] !== undefined);

  const facts = factsFor === null ? undefined : cards[factsFor];
  const lost = missing.map(
    landfillId => options.find(one => one.landfillId === landfillId)?.landfillName ?? landfillId,
  );
  const nothingRead = !pending && missing.length === options.length && options.length > 0;

  const title =
    options.length === 1 ? `Маршрут до полигона ${options[0].landfillName}` : 'Маршрут по выбранным полигонам';

  return (
    <Modal title={title} onClose={onClose}>
      {nothingRead && (
        <Notice kind="warning">
          <span>
            {options.length === 1 ? 'Сведения о полигоне не пришли' : 'Сведения о полигонах не пришли'}: карту показать
            не на чем. {MAP_FAILURE_HINT}
          </span>
        </Notice>
      )}

      {/* Часть карточек не пришла: карта остаётся при остальных метках, но
          недостающие полигоны названы поимённо — иначе метки просто не
          оказалось бы, и человек решил бы, что полигон не выбран (R-034). */}
      {!nothingRead && lost.length > 0 && (
        <Notice kind="warning">
          <span>Сведения не пришли по полигонам: {lost.join(', ')}. Их меток на карте нет.</span>
        </Notice>
      )}

      {failure !== null && (
        <Notice kind="warning">
          <span>
            {MAP_FAILURE_WORD[failure]} {MAP_FAILURE_HINT}
          </span>
        </Notice>
      )}

      {!nothingRead &&
        (points.length === 0 ? (
          <Skeleton rows={1} label="Идёт загрузка карты" />
        ) : (
          <>
            <RouteMap points={points} onFailure={setFailure} />
            {/* Метки названы словами рядом с картой: на самой карте подпись
                видна не всем, а при отказе тайлов её не видно вовсе. */}
            <ul className="imolt-map-legend" aria-label="Метки на карте">
              <li className="imolt-map-legend-item">
                <span className="imolt-map-pin" data-point="pickup" aria-hidden="true" />
                Адрес вывоза: {pickup.value}
              </li>
              {shownLandfills.map(one => (
                <li className="imolt-map-legend-item" key={one.landfillId}>
                  <span className="imolt-map-pin" data-point="landfill" aria-hidden="true" />
                  Полигон: {one.landfillName}
                </li>
              ))}
            </ul>
            <p className="imolt-map-credit">{MAP_CREDIT}</p>
          </>
        ))}

      {facts !== undefined && <LandfillFacts card={facts} groups={groups} />}

      <RouteDetails option={options} summary={summary} scope={scope} unavailable={unavailable} />
    </Modal>
  );
}
