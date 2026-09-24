/**
 * Разделы кабинета и их имя в адресе страницы.
 *
 * Перечень разделов — из дизайн-договора (разд. 5, экран Э-10): «Расчёты ·
 * Маршруты · Услуги · Подписка · Профиль». Он живёт у навигации, а не у
 * страницы: имя раздела нужно и меню, и адресу, и второй список разошёлся бы
 * с первым.
 *
 * Имя раздела — предметное состояние экрана и потому лежит в адресе:
 * `#/cabinet?tab=calculations` возвращает в тот же раздел (ADR-0008,
 * инвариант 5, практика PRACT-016).
 *
 * @supports: R-049, R-052
 * @adr: ADR-0008
 */

export type CabinetSection = 'calculations' | 'routes' | 'services' | 'subscription' | 'profile';

/** Имя параметра адреса, хранящего открытый раздел. */
export const SECTION_QUERY_KEY = 'tab';

/** Раздел, который открывается без указания в адресе. */
export const DEFAULT_CABINET_SECTION: CabinetSection = 'calculations';

export const CABINET_SECTIONS: { value: CabinetSection; label: string }[] = [
  { value: 'calculations', label: 'Расчёты' },
  { value: 'routes', label: 'Маршруты' },
  { value: 'services', label: 'Услуги' },
  { value: 'subscription', label: 'Подписка' },
  { value: 'profile', label: 'Профиль' },
];

/**
 * Раздел по значению из адреса. Незнакомое значение даёт раздел по умолчанию,
 * а не пустой экран: испорченную ссылку присылают чаще, чем кажется.
 */
export function sectionOf(raw: string | null): CabinetSection {
  const found = CABINET_SECTIONS.find(section => section.value === raw);

  return found?.value ?? DEFAULT_CABINET_SECTION;
}
