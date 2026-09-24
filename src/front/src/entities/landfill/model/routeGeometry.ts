/**
 * Путь по дорогам между адресом вывоза и полигоном — для линии на карте.
 *
 * Геометрии в договоре расчётной части нет: `RouteLeg` отдаёт расстояние,
 * длительность, ссылку во внешние карты и обременения. Поэтому линию рисует
 * внешняя служба маршрутизации OSRM — та же, по которой набирались плечи
 * перевозки демонстрационного набора. Ключа она не требует, данные — те же
 * OpenStreetMap, что и у тайлов.
 *
 * **Линия — рисунок, а не источник цифр.** Расстояние, длительность и цена
 * приходят от расчётной части и от линии не зависят: расчёт ведётся по
 * таблице плеч, а служба маршрутизации могла проложить путь иначе. Считать
 * расстояние по этой линии нельзя — это был бы второй источник одной величины
 * (R-020, AC-033f).
 *
 * Отказ службы линию просто не рисует: карта с метками остаётся, и окно
 * маршрута работает целиком. Ждать путь дольше названного предела незачем —
 * он украшение, а не содержание.
 *
 * @supports: R-033, R-034
 * @adr: ADR-0008
 */
import type { Coordinates } from '@/shared/api/contracts';

/** Служба маршрутизации на данных OpenStreetMap; ключа не требует. */
const OSRM_ROUTE = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Сколько ждать путь. Линия — украшение карты, и долгое ожидание задержало бы
 * показ карты ради рисунка.
 */
const WAIT_MS = 6000;

/** Точка пути в порядке библиотеки карты: широта, затем долгота. */
export type RouteShape = [number, number][];

/** Ответ службы: путь линией в порядке «долгота, широта». */
type OsrmAnswer = {
  code?: string;
  routes?: { geometry?: { coordinates?: [number, number][] } }[];
};

/**
 * Читает путь по дорогам от одной точки до другой.
 *
 * Пустой перечень означает «пути нет»: служба не ответила, ответила отказом
 * или вернула ответ без геометрии. Разбирать эти случаи по отдельности
 * незачем — во всех линия не рисуется, а причина отказа расчёта не касается.
 */
export async function roadShape(from: Coordinates, to: Coordinates): Promise<RouteShape> {
  const path = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const control = new AbortController();
  const timer = window.setTimeout(() => control.abort(), WAIT_MS);

  try {
    const answer = await fetch(`${OSRM_ROUTE}/${path}?overview=full&geometries=geojson`, {
      signal: control.signal,
    });

    if (!answer.ok) {
      return [];
    }

    const body = (await answer.json()) as OsrmAnswer;

    if (body.code !== 'Ok') {
      return [];
    }

    const line = body.routes?.[0]?.geometry?.coordinates ?? [];

    // Служба отдаёт «долгота, широта», карта ждёт «широта, долгота»: порядок
    // разворачивается здесь, а не в рисующем коде, — иначе о нём придётся
    // помнить в каждом месте показа.
    return line.map(([longitude, latitude]) => [latitude, longitude]);
  } catch {
    return [];
  } finally {
    window.clearTimeout(timer);
  }
}
