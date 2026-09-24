/**
 * Факты маршрута до полигона: расстояние, время в пути и переход во внешние
 * карты (сущность «полигон»).
 *
 * Содержимое одно, оправа разная: на телефоне его показывает выдвижной лист,
 * на рабочем месте — модальное окно поверх страницы (решением заказчика от
 * 24.09.2026, R-033). Оправа здесь не выбирается — её задаёт представление.
 *
 * Карты здесь нет: она принадлежит окну маршрута (`RouteModal`), а не фактам.
 * Прежняя серая заглушка мини-карты снята тем же решением — карта стала
 * настоящей, и рисовать её рядом с собственной подписью «заглушка» больше
 * незачем (R-034).
 *
 * Время в пути и переход в Яндекс.Карты закрыты подпиской: разрешение
 * называет расчётная часть полем `access`, интерфейс его не толкует (R-032).
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import type { PlacementOption, RouteSummary } from '@/shared/api/contracts';
import { formatDistance } from '@/shared/lib/formatting';

/** Время в пути словами: «~1 ч 10 мин». */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return hours > 0 ? `~${hours} ч ${rest} мин` : `~${rest} мин`;
}

export function RouteDetails({ option, summary }: { option: PlacementOption; summary: RouteSummary | null }) {
  const leg = summary?.legs.find(candidate => candidate.landfillId === option.landfillId);

  return (
    <>
      <strong>{option.landfillName}</strong>
      {summary?.access.granted ? (
        <>
          <span>
            {formatDistance(option.distanceKm)}
            {leg?.durationMinutes ? ` · ${formatDuration(leg.durationMinutes)}` : ''}
          </span>
          {leg?.externalMapUrl && (
            <a href={leg.externalMapUrl} target="_blank" rel="noreferrer">
              Открыть в Яндекс.Картах
            </a>
          )}
        </>
      ) : (
        <>
          <strong>Детали маршрута – по подписке</strong>
          <span>
            Расстояние и стоимость видны всем. Время в пути и переход в Яндекс.Карты – перевозчикам и демонтажным
            компаниям.
          </span>
          <span>{formatDistance(option.distanceKm)}</span>
        </>
      )}
    </>
  );
}
