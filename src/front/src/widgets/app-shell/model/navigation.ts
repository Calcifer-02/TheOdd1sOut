/**
 * Разделы сервиса: единственный перечень переходов оболочки.
 *
 * Перечень объявлен один раз и одинаков для широкого и узкого представления:
 * два списка разошлись бы, и на телефоне рано или поздно не хватило бы
 * раздела, который на рабочем месте есть (карточка практики PRACT-016).
 *
 * @supports: R-058
 * @adr: ADR-0008
 */
import { CALCULATOR_PATH } from '@/shared/lib/routing';

export type Section = { path: string; label: string };

/** Порядок — порядок пути пользователя: расчёт, полигоны, предложение, учёт. */
export const SECTIONS: Section[] = [
  { path: CALCULATOR_PATH, label: 'Расчёт' },
  { path: '/landfills', label: 'Полигоны' },
  { path: '/quote', label: 'Предложение' },
  { path: '/cabinet', label: 'Кабинет' },
  { path: '/references', label: 'Редактор цен' },
];

/** Доступное имя перечня переходов. Оболочка называет его обоим представлениям. */
export const NAVIGATION_LABEL = 'Разделы сервиса';
