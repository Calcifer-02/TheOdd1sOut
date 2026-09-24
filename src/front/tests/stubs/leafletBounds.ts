// Подмена библиотеки карты, запоминающая кадр.
//
// Общая подмена ./leaflet.ts кадр не запоминает: её вызов fitBounds пуст.
// Проверке сводки маршрута кадр нужен — он обязан вмещать все метки, иначе
// часть выбранных полигонов окажется за краем карты. Здесь та же подмена с
// одним изменённым вызовом, а не её копия: второй перечень вызовов библиотеки
// разошёлся бы с первым молча.
//
// Файл без «.test.» в имени в прогон не попадает: это общая оснастка.
import { leafletModule } from './leaflet';

const frames: [number, number][][] = [];

/** Кадры, по которым карту просили встать, в порядке вызова. */
export function fittedFrames(): [number, number][][] {
  return frames.map(frame => [...frame]);
}

/** Чистый список кадров перед следующей проверкой. */
export function resetFrames(): void {
  frames.length = 0;
}

export const boundedLeafletModule = {
  ...leafletModule,

  map(node: HTMLElement, options?: unknown) {
    const drawn = leafletModule.map(node, options);

    return {
      ...drawn,
      fitBounds(places: [number, number][], _options?: unknown) {
        frames.push(places);
      },
    };
  },
};
