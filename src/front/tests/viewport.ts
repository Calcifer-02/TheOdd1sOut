// Ширина окна для проверок интерфейса.
//
// В jsdom нет ни настоящего окна, ни matchMedia, а интерфейс выбирает между
// карточками и таблицей именно по ширине (`@/shared/lib/viewport`). Без этой
// подмены проверка десктопного представления была бы невозможна, а мобильного
// — случайной.
//
// Подмена разбирает только `(min-width: Npx)`: других запросов интерфейс не
// задаёт, и делать вид, что поддержано больше, незачем.
//
// Файл без «.test.» в имени в прогон не попадает: это общая оснастка.

/** Ширина макета мобильного размера — значение по умолчанию для проверок. */
export const MOBILE_WIDTH = 390;

/** Ширина рабочего места: десктопная раскладка дизайн-договора. */
export const DESKTOP_WIDTH = 1440;

type Listener = () => void;

const listeners = new Set<Listener>();

let width = MOBILE_WIDTH;

function minWidthOf(query: string): number | null {
  const found = /\(min-width:\s*(\d+)px\)/.exec(query);
  return found ? Number.parseInt(found[1], 10) : null;
}

/** Установка ширины окна с извещением подписчиков, как у настоящего окна. */
export function setViewportWidth(next: number): void {
  width = next;
  window.innerWidth = next;

  for (const listener of [...listeners]) {
    listener();
  }
}

/** Подмена matchMedia на разбор ширины. Вызывается один раз при подготовке. */
export function installViewport(): void {
  window.matchMedia = ((query: string) => {
    const minimum = minWidthOf(query);

    return {
      get matches() {
        return minimum === null ? false : width >= minimum;
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, listener: Listener) => listeners.add(listener),
      removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
      // Устаревшая пара нужна только для совместимости формы объекта.
      addListener: (listener: Listener) => listeners.add(listener),
      removeListener: (listener: Listener) => listeners.delete(listener),
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;

  setViewportWidth(MOBILE_WIDTH);
}
