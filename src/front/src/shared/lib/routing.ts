/**
 * Маршрут приложения живёт в адресе страницы.
 *
 * Сервис перестал быть одним экраном: расчёт, кабинет, предложение, справочник
 * полигонов и редактор цен — разные этапы пути пользователя, и возврат к этапу
 * обязан работать по ссылке (ADR-0008, инвариант 5; карточка практики
 * PRACT-016). Маршрут кладётся в хеш, а не в путь: мини-приложение отдаётся
 * статикой, и перезагрузка по глубокой ссылке не должна упираться в настройку
 * сервера.
 *
 * Своего маршрутизатора в зависимостях нет и не заводится: нужен разбор одной
 * строки и подписка на её смену, а библиотека принесла бы собственную модель
 * истории поверх той, что уже используется состоянием выборки.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';

/** Разобранный адрес: путь экрана и его передаваемое состояние. */
export type Route = { path: string; query: URLSearchParams };

/**
 * Смена адреса через `pushState` события `hashchange` не порождает, поэтому
 * приложение объявляет её само. Имя собственное: чужой обработчик `hashchange`
 * на странице мессенджера трогать незачем.
 */
const NAVIGATION_EVENT = 'imolt:navigate';

/** Путь экрана расчёта: он же корень, потому что с него начинается путь. */
export const CALCULATOR_PATH = '/';

function normalize(path: string): string {
  if (path === '' || path === '/') {
    return '/';
  }

  const withSlash = path.startsWith('/') ? path : `/${path}`;
  return withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
}

/** Разбор хеша в маршрут. Испорченный адрес даёт корень, а не отказ. */
export function routeOf(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const separator = raw.indexOf('?');
  const path = separator === -1 ? raw : raw.slice(0, separator);
  const query = separator === -1 ? '' : raw.slice(separator + 1);

  return { path: normalize(path), query: new URLSearchParams(query) };
}

/** Сборка адреса. Пустое состояние не пишется: ссылка не обрастает шумом. */
export function hashOf(path: string, query?: URLSearchParams): string {
  const normalized = normalize(path);
  const text = query?.toString() ?? '';
  const head = normalized === '/' ? '' : normalized;

  if (!text) {
    return head ? `#${head}` : '#';
  }

  return `#${head}?${text}`;
}

function announce(): void {
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

/**
 * Переход на экран. Новая запись истории — по умолчанию: кнопка «назад»
 * обязана возвращать на предыдущий этап пути, а не выбрасывать из сервиса.
 */
export function navigate(path: string, query?: URLSearchParams): void {
  const target = hashOf(path, query);
  if (window.location.hash === target) {
    return;
  }

  window.history.pushState(null, '', target);
  announce();
}

/**
 * Замена адреса без новой записи истории: так обновляется состояние выборки —
 * сортировка и предел плеча не должны превращать «назад» в перебор фильтров.
 */
export function replaceRoute(path: string, query?: URLSearchParams): void {
  const target = hashOf(path, query);
  if (window.location.hash === target) {
    return;
  }

  window.history.replaceState(null, '', target);
  announce();
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAVIGATION_EVENT, onChange);

  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAVIGATION_EVENT, onChange);
  };
}

function currentHash(): string {
  return window.location.hash;
}

/** Текущий маршрут с подпиской на смену адреса. */
export function useRoute(): Route {
  // Снимок — строка адреса, а не разобранный объект: новый объект на каждом
  // чтении заставил бы React считать состояние изменившимся всегда.
  const hash = useSyncExternalStore(subscribe, currentHash, () => '');

  return useMemo(() => routeOf(hash), [hash]);
}

/** Переход, пригодный для обработчика события. */
export function useNavigate(): (path: string, query?: URLSearchParams) => void {
  return useCallback((path: string, query?: URLSearchParams) => navigate(path, query), []);
}
