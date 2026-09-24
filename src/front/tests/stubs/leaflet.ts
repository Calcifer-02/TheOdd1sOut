// Подмена библиотеки карты для проверок интерфейса.
//
// Раскладки в jsdom нет, полотно не рисуется и тайлы по сети не идут: живая
// библиотека показала бы не карту, а пустой узел. Проверяется устройство,
// которое к карте ведёт: метки, их места и отклик на нажатие и отказ тайлов.
// Ставится вызовом vi.mock в самом файле проверки — образец в начале
// tests/RouteModal.test.tsx.
//
// Файл без «.test.» в имени в прогон не попадает: это общая оснастка.

type Listener = (event?: unknown) => void;

/** Метка, поставленная на карту. */
export type DrawnMarker = {
  /** место метки в порядке библиотеки: широта, затем долгота */
  place: [number, number];
  /** доступное имя метки */
  title: string;
  /** назначение метки: признак `data-point` на её узле */
  kind: string | null;
  /** нажатие на метку */
  press: () => void;
};

type MarkerRecord = {
  place: [number, number];
  title: string;
  element: HTMLElement;
  handlers: Map<string, Listener>;
};

const markers: MarkerRecord[] = [];
const tileHandlers = new Map<string, Listener>();
const tileSources: string[] = [];

let drawn = 0;
let removed = 0;

/** Карты, полотно которых библиотека начала рисовать. */
export function mapsDrawn(): number {
  return drawn;
}

/** Карты, снятые вместе с окном: подписки библиотеки не должны пережить его. */
export function mapsRemoved(): number {
  return removed;
}

/** Адреса тайлов, которые библиотеке велено показывать. */
export function tileUrls(): string[] {
  return [...tileSources];
}

/** Метки на карте в порядке постановки. */
export function drawnMarkers(): DrawnMarker[] {
  return markers.map(record => ({
    place: record.place,
    title: record.title,
    kind: record.element.getAttribute('data-point'),
    press: () => record.handlers.get('click')?.(),
  }));
}

/** Метка по назначению: адрес вывоза или полигон. */
export function markerOf(kind: 'pickup' | 'landfill'): DrawnMarker {
  const found = drawnMarkers().find(marker => marker.kind === kind);

  if (found === undefined) {
    throw new Error(`Метки «${kind}» на карте нет`);
  }

  return found;
}

/** Отказ источника тайлов: карта идёт по сети и приходит не всегда. */
export function breakTiles(): void {
  const handler = tileHandlers.get('tileerror');

  if (handler === undefined) {
    throw new Error('Карта не слушает отказ тайлов: сообщить о нём будет нечем');
  }

  handler();
}

/** Чистое полотно перед следующей проверкой. */
export function resetLeaflet(): void {
  markers.length = 0;
  tileSources.length = 0;
  tileHandlers.clear();
  drawn = 0;
  removed = 0;
}

/** Подмена самой библиотеки: те её вызовы, которыми пользуется окно маршрута. */
export const leafletModule = {
  map(_node: HTMLElement, _options?: unknown) {
    drawn += 1;

    return {
      fitBounds: () => undefined,
      remove: () => {
        removed += 1;
      },
    };
  },

  tileLayer(url: string, _options?: unknown) {
    tileSources.push(url);

    const layer = {
      on(event: string, listener: Listener) {
        tileHandlers.set(event, listener);
        return layer;
      },
      addTo: () => layer,
    };

    return layer;
  },

  marker(place: [number, number], options: { title?: string }) {
    const record: MarkerRecord = {
      place,
      title: options.title ?? '',
      element: document.createElement('span'),
      handlers: new Map<string, Listener>(),
    };

    markers.push(record);

    const marker = {
      on(event: string, listener: Listener) {
        record.handlers.set(event, listener);
        return marker;
      },
      addTo: () => marker,
      getElement: () => record.element,
    };

    return marker;
  },

  divIcon(options: unknown) {
    return options;
  },
};
