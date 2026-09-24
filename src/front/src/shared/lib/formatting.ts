/**
 * Форматирование чисел, денег и дат по локали ru-RU (R-061).
 *
 * Единственное место перевода значений договора в текст экрана. Договор
 * передаёт деньги строкой с двумя знаками после точки, а дату — строкой
 * `ГГГГ-ММ-ДД`; разбор здесь строковый, без преобразования в дробное число и
 * без часов машины: округление и часовой пояс не должны появляться там, где
 * их нет в источнике (карточка практики PRACT-027).
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */

/** Неразрывный пробел: разряды и единица не переносятся на новую строку. */
const NBSP = ' ';

const RUBLE = '₽';

export type Money = { amount: string; currency: 'RUB' };

export type Unit = 't' | 'm3';

/** Разряды целой части отделяются неразрывным пробелом: «19 800». */
function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

function splitSign(value: string): { sign: string; rest: string } {
  return value.startsWith('-') ? { sign: '-', rest: value.slice(1) } : { sign: '', rest: value };
}

/**
 * Денежная сумма договора в вид экрана: «19 800 ₽», «19 800,50 ₽».
 * Нулевые копейки не показываются — смета читается по рублям.
 */
export function formatMoney(money: Money): string {
  const { sign, rest } = splitSign(money.amount);
  const [whole, fraction = ''] = rest.split('.');
  const kopecks = fraction.padEnd(2, '0').slice(0, 2);
  const tail = kopecks === '00' ? '' : `,${kopecks}`;

  return `${sign}${groupDigits(whole)}${tail}${NBSP}${RUBLE}`;
}

/** Число в русской записи: десятичная запятая, разряды через пробел. */
export function formatNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  const { sign, rest } = splitSign(String(rounded));
  const [whole, fraction] = rest.split('.');

  return sign + groupDigits(whole) + (fraction ? `,${fraction}` : '');
}

/** Дата договора из формы ГГГГ-ММ-ДД в вид экрана «17.09.2026». */
export function formatDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) {
    return isoDate;
  }

  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
}

/** Короткая дата рядом со статусом полигона: «17.09». */
export function formatShortDate(isoDate: string): string {
  const full = formatDate(isoDate);
  return full.length === 10 ? full.slice(0, 5) : full;
}

/** Объём с мерой: «20 т», «15 м³». */
export function formatQuantity(value: number, unit: Unit): string {
  return `${formatNumber(value)}${NBSP}${unitName(unit)}`;
}

/** Имя меры для экрана. Договор передаёт её кодом, пользователь читает буквы. */
export function unitName(unit: Unit): string {
  return unit === 't' ? 'т' : 'м³';
}

/** Расстояние по дорожной сети: «45 км». */
export function formatDistance(km: number): string {
  return `${formatNumber(km)}${NBSP}км`;
}
