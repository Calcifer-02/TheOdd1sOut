/**
 * Окно маршрута до полигона: карта с метками, сведения о полигоне и факты
 * плеча перевозки (сущность «полигон»).
 *
 * Решение заказчика от 24.09.2026: маршрут открывается модальным окном поверх
 * страницы с настоящей картой. Прежде окно отрисовывалось внутри таблицы
 * сравнения, резалось её областью прокрутки и требовало двигать колонки
 * (R-033). Прежний запрет дизайн-договора на модальное окно для маршрута снят
 * тем же решением.
 *
 * Оправа здесь одна — модальное окно, и это её единственное назначение: на
 * телефоне маршрут по-прежнему показывает выдвижная панель, и содержимое
 * фактов общее у обеих оправ (`RouteDetails`).
 *
 * @req: R-033
 * @supports: R-034
 * @adr: ADR-0008
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Coordinates, PlacementOption, RouteSummary } from '@/shared/api/contracts';
import { formatMoney } from '@/shared/lib/formatting';
import { Modal, Notice, Skeleton } from '@/shared/ui';
import { useLandfillDetails, type LandfillDetails } from '../model/landfillDetails';
import { drawRouteMap, type MapFailure, type RoutePoint } from '../model/routeMap';
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

/** Что остаётся на экране без карты: сами факты маршрута от неё не зависят. */
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

/**
 * Сведения о полигоне, открытые нажатием на его метку. Сведения передаются
 * готовыми: они уже запрошены ради координат метки, и второе обращение за
 * теми же данными службе не нужно.
 */
function LandfillFacts({ details }: { details: LandfillDetails }) {
  return (
    <div className="imolt-map-facts">
      <strong>{details.card.name}</strong>
      <span>{details.card.address}</span>
      {/* Статус приёма называется словом и датой, на которую он известен:
          одним цветом состояние не выражается (R-048, разд. 4.6). */}
      <StatusBadge status={details.card.status} statusUpdatedAt={details.card.statusUpdatedAt} />
      {details.tariffs.length === 0 ? (
        <span>Тарифы утилизации не заданы</span>
      ) : (
        <ul className="imolt-map-tariffs">
          {details.tariffs.map(tariff => (
            <li key={tariff.wasteGroupId}>
              {tariff.name} — {formatMoney(tariff.pricePerTon)} за тонну
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
}: {
  option: PlacementOption;
  summary: RouteSummary | null;
  /** Адрес вывоза из расчёта: его координаты — вторая метка на карте (R-012). */
  pickup: { value: string; coordinates: Coordinates };
  onClose: () => void;
}) {
  const { details, failed } = useLandfillDetails(option.landfillId);
  const [factsShown, setFactsShown] = useState(false);
  const [failure, setFailure] = useState<MapFailure | null>(null);

  const landfillPlace = details?.card.coordinates;

  const showFacts = useCallback(() => setFactsShown(true), []);

  // Перечень меток пересобирается только при смене самих точек: библиотека
  // карты рисует полотно заново на каждый новый перечень, и новая стрелка на
  // каждой отрисовке перезапускала бы карту.
  const points = useMemo<RoutePoint[]>(() => {
    if (landfillPlace === undefined) {
      return [];
    }

    return [
      { kind: 'pickup', title: `Адрес вывоза: ${pickup.value}`, coordinates: pickup.coordinates },
      {
        kind: 'landfill',
        title: `Полигон: ${option.landfillName}`,
        coordinates: landfillPlace,
        onSelect: showFacts,
      },
    ];
  }, [landfillPlace, option.landfillName, pickup.coordinates, pickup.value, showFacts]);

  return (
    <Modal title={`Маршрут до полигона ${option.landfillName}`} onClose={onClose}>
      {failed && (
        <Notice kind="warning">
          <span>Сведения о полигоне не пришли: карту показать не на чем. {MAP_FAILURE_HINT}</span>
        </Notice>
      )}

      {failure !== null && (
        <Notice kind="warning">
          <span>
            {MAP_FAILURE_WORD[failure]} {MAP_FAILURE_HINT}
          </span>
        </Notice>
      )}

      {!failed &&
        (points.length === 0 ? (
          <Skeleton rows={1} label="Идёт загрузка карты" />
        ) : (
          <>
            <RouteMap points={points} onFailure={setFailure} />
            {/* Метки названы словами рядом с картой: на самой карте подпись
                видна не всем, а при отказе тайлов её не видно вовсе. */}
            <ul className="imolt-map-legend">
              <li className="imolt-map-legend-item">
                <span className="imolt-map-pin" data-point="pickup" aria-hidden="true" />
                Адрес вывоза: {pickup.value}
              </li>
              <li className="imolt-map-legend-item">
                <span className="imolt-map-pin" data-point="landfill" aria-hidden="true" />
                Полигон: {option.landfillName}
              </li>
            </ul>
            <p className="imolt-map-credit">{MAP_CREDIT}</p>
          </>
        ))}

      {factsShown && details !== null && <LandfillFacts details={details} />}

      <RouteDetails option={option} summary={summary} />
    </Modal>
  );
}
