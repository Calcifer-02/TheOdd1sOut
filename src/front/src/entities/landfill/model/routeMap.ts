/**
 * Карта маршрута на библиотеке Leaflet и растровых тайлах OpenStreetMap.
 *
 * Почему не Яндекс.Карты: их интерфейс карт требует ключа, которого у проекта
 * нет, — выдумать его нельзя, а без ключа карта не отрисуется. Leaflet ключа
 * не требует, лицензия библиотеки BSD-2-Clause, тайлы OpenStreetMap отдаются
 * по лицензии ODbL, и она требует называть авторов данных. Подпись об
 * авторских правах рисует не библиотека, а само окно маршрута
 * (`RouteModal`): при отказе тайлов подпись обязана остаться видимой.
 *
 * Линия маршрута проводится по дорогам, а не прямой: геометрию отдаёт внешняя
 * служба маршрутизации (`./routeGeometry`), потому что в договоре расчётной
 * части её нет. Линия — рисунок: расстояние, длительность и цена приходят от
 * расчётной части и по ней не считаются, иначе у одной величины стало бы два
 * источника (R-020, AC-033f). Не пришла геометрия — карта остаётся с метками,
 * а сам маршрут по-прежнему открывается ссылкой во внешние карты (R-034).
 *
 * Библиотека подключается по требованию: полотно карты нужно одному окну из
 * пяти экранов, и держать её в первом пакете мини-приложения незачем.
 *
 * @supports: R-033, R-034
 * @adr: ADR-0008
 */
import type * as Leaflet from 'leaflet';
import type { Coordinates } from '@/shared/api/contracts';
import { routeTone, space, stroke } from '@/shared/ui/tokens';
import type { RouteShape } from './routeGeometry';

/** Растровые тайлы OpenStreetMap: ключа не требуют. */
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * Наибольшее приближение тайлов OpenStreetMap. Объявлено числом, потому что
 * его задаёт сам источник тайлов, а не дизайн-договор: за девятнадцатым
 * уровнем сервер отдаёт пустоту.
 */
const OSM_MAX_ZOOM = 19;

/**
 * Приближение, ближе которого карта не встаёт при показе двух меток. Полигон
 * и адрес вывоза стоят в десятках километров друг от друга, но бывают и
 * соседними: без предела карта подошла бы вплотную к одной точке (R-033).
 */
const CLOSEST_ZOOM = 14;

/** Место на карте: адрес вывоза или полигон. */
export type RoutePoint = {
  /** `pickup` — адрес вывоза, `landfill` — полигон; правило вида метки */
  kind: 'pickup' | 'landfill';
  /** доступное имя метки: им же подписана метка в перечне под картой */
  title: string;
  coordinates: Coordinates;
  /** нажатие на метку; у адреса вывоза показывать нечего */
  onSelect?: () => void;
  /**
   * Цвет маршрута этого полигона: им же покрашены его линия на карте и точка
   * в строке перечня. Связь цветом, а не смысл: что это за полигон, говорит
   * подпись рядом (AC-033g).
   */
  tone?: string;
};

/** Толщина линии маршрута: тоньше она теряется на рисунке дорог. */
const LINE_WEIGHT = 5;

/**
 * Нарисованная карта: снятие и досылка путей.
 *
 * Пути приходят позже карты — служба маршрутизации отвечает не мгновенно, — и
 * дорисовываются на готовое полотно. Перерисовывать карту ради линии нельзя:
 * полотно моргает, а кадр и приближение сбрасываются на то, что пользователь
 * уже подвинул.
 */
export type RouteMapHandle = {
  remove: () => void;
  setShapes: (shapes: RouteShape[]) => void;
};

/** Отказ карты: тайлы идут по сети и приходят не всегда. */
export type MapFailure = 'tiles' | 'library';

/**
 * Мера метки. Адрес вывоза крупнее полигона: точка вывоза на карте одна, а
 * полигонов бывает пять, и в общей мере она среди них терялась (AC-033g).
 */
function pinSize(point: RoutePoint): [number, number] {
  const side = point.kind === 'pickup' ? space.l : space.m + stroke.emphasis;

  return [side, side];
}

/** Место точки в порядке библиотеки карты: широта, затем долгота. */
function place(point: RoutePoint): [number, number] {
  return [point.coordinates.latitude, point.coordinates.longitude];
}

/**
 * Рисует карту с метками в переданном узле и возвращает снятие.
 *
 * Отказ называется вызывающему, а не показывается самой картой: окно
 * маршрута остаётся рабочим без карты — расстояние, длительность и переход во
 * внешние карты от неё не зависят (R-034).
 */
export async function drawRouteMap(
  node: HTMLElement,
  points: RoutePoint[],
  onFailure: (failure: MapFailure) => void,
): Promise<RouteMapHandle> {
  let loaded: typeof Leaflet;

  try {
    loaded = await import('leaflet');
    // Правила полотна приходят вместе с библиотекой: без них слои карты
    // складываются в одну точку.
    await import('leaflet/dist/leaflet.css');
  } catch {
    onFailure('library');
    return { remove: () => undefined, setShapes: () => undefined };
  }

  // Библиотека собрана единым модулем старого образца, и сборщик отдаёт её то
  // пространством имён, то одним значением по умолчанию. Признак выбора —
  // наличие самой карты, а не наличие значения по умолчанию: обращаться к
  // отсутствующему `default` у пространства имён нельзя.
  const leaflet =
    typeof loaded.map === 'function' ? loaded : (loaded as unknown as { default: typeof Leaflet }).default;

  const map = leaflet.map(node, {
    // Подпись об авторских правах рисует окно маршрута: она обязана
    // оставаться видимой и тогда, когда тайлы не пришли.
    attributionControl: false,
  });

  const tiles = leaflet.tileLayer(OSM_TILES, { maxZoom: OSM_MAX_ZOOM });

  tiles.on('tileerror', () => onFailure('tiles'));
  tiles.addTo(map);

  for (const point of points) {
    const marker = leaflet.marker(place(point), {
      // Метка рисуется правилом проекта, а не картинкой библиотеки: адреса
      // картинок из её пакета при сборке теряются.
      icon: leaflet.divIcon({
        className: 'imolt-map-pin',
        html: '',
        iconSize: pinSize(point),
        iconAnchor: [pinSize(point)[0] / 2, pinSize(point)[1] / 2],
      }),
      title: point.title,
      alt: point.title,
      // Метка достижима с клавиатуры: указателем по карте ходят не все.
      keyboard: true,
    });

    if (point.onSelect) {
      marker.on('click', point.onSelect);
    }

    marker.addTo(map);

    // Вид метки задаёт её назначение, а не порядок в перечне. Признак
    // ставится после добавления на карту: до него узла метки не существует.
    const pin = marker.getElement();

    pin?.setAttribute('data-point', point.kind);

    // Цвет маршрута приходит рамкой метки: заливка остаётся лаймовой, и при
    // одном полигоне карта выглядит ровно как прежде.
    if (pin && point.tone !== undefined) {
      pin.style.borderColor = point.tone;
    }
  }

  /** Кадр по меткам и уже проведённым путям. */
  function frame(shapes: RouteShape[]): void {
    // Кадр вмещает и метки, и путь: дорога между двумя точками часто уходит в
    // сторону от прямой, и кадр по одним меткам резал бы линию.
    map.fitBounds([...points.map(place), ...shapes.flat()], {
      padding: [space.m, space.m],
      maxZoom: CLOSEST_ZOOM,
    });
  }

  frame([]);

  let drawn: Leaflet.Polyline[] = [];

  return {
    remove: () => map.remove(),
    setShapes: shapes => {
      const lines = shapes.filter(shape => shape.length > 1);

      if (lines.length === 0 && drawn.length === 0) {
        // Путей нет и не было: кадр трогать незачем. Лишний пересчёт сбросил
        // бы приближение, которое читатель уже подвинул.
        return;
      }

      // Прежние линии снимаются: без этого повторная досылка положила бы
      // вторую линию поверх первой, и толщина удвоилась бы.
      for (const line of drawn) {
        line.remove();
      }

      drawn = lines.map((shape, index) =>
        leaflet
          .polyline(shape, {
            color: routeTone(index),
            weight: LINE_WEIGHT,
            opacity: 0.75,
            lineJoin: 'round',
            lineCap: 'round',
          })
          .addTo(map),
      );

      frame(lines);
    },
  };
}
