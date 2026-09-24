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
 * Линий маршрута здесь нет намеренно. Договор расчётной части
 * (`src/back/Imolt.Api/contracts/openapi.yaml`, схема `RouteLeg`) отдаёт
 * расстояние, длительность, ссылку во внешние карты и обременения —
 * геометрии в нём нет. Прямая между точками соврала бы о плече перевозки:
 * расчёт считает по дорожной сети, и прямая его занижает (R-020). Поэтому на
 * карте только метки, а сам маршрут — по ссылке во внешние карты (R-034).
 *
 * Библиотека подключается по требованию: полотно карты нужно одному окну из
 * пяти экранов, и держать её в первом пакете мини-приложения незачем.
 *
 * @supports: R-033, R-034
 * @adr: ADR-0008
 */
import type * as Leaflet from 'leaflet';
import type { Coordinates } from '@/shared/api/contracts';
import { space } from '@/shared/ui/tokens';

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
};

/** Отказ карты: тайлы идут по сети и приходят не всегда. */
export type MapFailure = 'tiles' | 'library';

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
): Promise<() => void> {
  let loaded: typeof Leaflet;

  try {
    loaded = await import('leaflet');
    // Правила полотна приходят вместе с библиотекой: без них слои карты
    // складываются в одну точку.
    await import('leaflet/dist/leaflet.css');
  } catch {
    onFailure('library');
    return () => undefined;
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
        iconSize: [space.m, space.m],
        iconAnchor: [space.m / 2, space.m / 2],
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
    marker.getElement()?.setAttribute('data-point', point.kind);
  }

  map.fitBounds(points.map(place), { padding: [space.m, space.m], maxZoom: CLOSEST_ZOOM });

  return () => map.remove();
}
