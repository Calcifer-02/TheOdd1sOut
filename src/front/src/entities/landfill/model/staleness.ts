/**
 * Когда сведения о полигоне считаются устаревшими (R-048).
 *
 * Состояние «данные устарели» службой не присылается записью: оно выводится
 * из даты подтверждения статуса и даты актуальности справочника. Значит, это
 * правило показа — и жить оно обязано в одном месте. Раньше их было два:
 * экран расчёта считал устаревшим любое отставание, справочник полигонов —
 * отставание больше недели. Два правила для одного слова на экране означают,
 * что один и тот же полигон подписан по-разному на соседних экранах.
 *
 * Сравнение идёт с датой актуальности справочника, а не с часами браузера:
 * обе даты приходят от службы, поэтому вывод повторяем и не зависит от машины
 * читателя (карточка практики PRACT-027).
 *
 * @supports: R-048
 * @adr: ADR-0008
 */

/**
 * Через сколько суток отставания от даты справочника сведения считаются
 * устаревшими. Значение взято из дизайн-договора (разд. 4.1, роль
 * `status/stale`) и совпадает с порогом расчётной части
 * (`Imolt.References/Adapters/DataFreshnessSource`, `StaleAfterDays`).
 * Заказчиком порог не подтверждён — вопрос Q-023 открыт.
 */
export const STALE_AFTER_DAYS = 7;

const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

/**
 * Номер дня календаря для даты договора «ГГГГ-ММ-ДД». Разбор строковый и в
 * шкале UTC: часовой пояс машины не должен сдвигать дату на сутки.
 */
function dayNumber(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day)) / MILLISECONDS_IN_DAY;
}

/**
 * На сколько суток дата отстаёт от даты актуальности. `null` — когда хотя бы
 * одна из дат нечитаема: молча считать отставание нулевым нельзя.
 */
export function daysBehind(isoDate: string, asOfIsoDate: string): number | null {
  const moment = dayNumber(isoDate);
  const asOf = dayNumber(asOfIsoDate);

  return moment === null || asOf === null ? null : asOf - moment;
}

/** Отстаёт ли подтверждение статуса от справочника больше порога. */
export function isStale(statusUpdatedAt: string, statusesUpdatedAt: string): boolean {
  const behind = daysBehind(statusUpdatedAt, statusesUpdatedAt);

  return behind !== null && behind > STALE_AFTER_DAYS;
}
