/**
 * Линия маршрута на карте и различение полигонов (R-033, R-034).
 *
 * Решение заказчика от 24.09.2026 сняло прежний запрет линии: путь проводится
 * по дорогам, а не прямой. Геометрию отдаёт внешняя служба маршрутизации —
 * в договоре расчётной части её нет, — и линия остаётся рисунком: расстояние
 * и цена по ней не считаются.
 *
 * Замечание заказчика от 25.09.2026: при нескольких полигонах линии одного
 * цвета сливаются. Поэтому у каждого полигона свой цвет, и тем же цветом
 * обведена его метка на карте и точка в строке перечня.
 *
 * Служба маршрутизации подменена: настоящая ходит по сети, а проверка обязана
 * идти без неё. Подменяется именно обращение к сети, а не разбор ответа, —
 * иначе проверялась бы заглушка вместо кода.
 *
 * Проверки фальсифицируемы: снимите линию, проведите её прямой между точками,
 * покрасьте все маршруты одним цветом, снимите цвет у точки перечня, верните
 * линию при молчащей службе — упадёт именно та проверка, которая об этом
 * говорит.
 *
 *   npx vitest run tests/RouteLine.test.tsx
 *
 * @ac: AC-033f, AC-033g
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { routeTone } from '@/shared/ui/tokens';
import type { ApiStub } from './apiStub';
import { IKSHA, VOSTOK, installApiStub } from './apiStub';
import { calculateConcrete, landfillCheckbox } from './flows';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';
import { drawnLines, resetLeaflet } from './stubs/leaflet';
import { VOSTOK_CARD, answerLandfillCard } from './stubs/landfillCard';

/** Карточка «Икши»: координаты своя, иначе меток на карте не различить. */
const IKSHA_CARD = {
  id: IKSHA.landfillId,
  name: IKSHA.landfillName,
  legalEntity: 'ООО «Икша-Полигон»',
  address: IKSHA.address,
  coordinates: { latitude: 56.1573, longitude: 37.5011 },
  status: IKSHA.status,
  statusUpdatedAt: VOSTOK_CARD.statusUpdatedAt,
  tariffs: [],
};

vi.mock('leaflet', async () => (await import('./stubs/leaflet')).leafletModule);
vi.mock('leaflet/dist/leaflet.css', () => ({}));

/** Путь, который «отдаёт» служба маршрутизации: три точки, не прямая. */
const ROAD = [
  [37.6, 55.79],
  [37.9, 55.75],
  [38.2, 55.73],
];

let stub: ApiStub;
let routerAnswers = true;

beforeEach(() => {
  stub = installApiStub();
  answerLandfillCard(stub);
  answerLandfillCard(stub, IKSHA_CARD);
  setViewportWidth(DESKTOP_WIDTH);
  resetLeaflet();
  routerAnswers = true;

  // Обращение к службе маршрутизации подменяется поверх подмены расчётной
  // части: остальные запросы уходят прежнему обработчику.
  const previous = window.fetch;

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const address = typeof input === 'string' ? input : input.toString();

    if (address.includes('router.project-osrm.org')) {
      return Promise.resolve({
        ok: routerAnswers,
        json: () =>
          Promise.resolve({
            code: routerAnswers ? 'Ok' : 'NoRoute',
            routes: [{ geometry: { coordinates: ROAD } }],
          }),
      } as Response);
    }

    return previous(input, init);
  }) as typeof window.fetch;
});

afterEach(() => {
  stub.restore();
});

/** Доводит экран до выбора двух полигонов и открывает маршрут по выбору. */
async function openSelectionRoute(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  render(<App />);
  await calculateConcrete(user);

  await user.click(landfillCheckbox(VOSTOK.landfillName));
  await user.click(landfillCheckbox(IKSHA.landfillName));
  await screen.findByText(/Выбрано\s2/u);
  await user.click(screen.getByRole('button', { name: 'Получить маршрут' }));

  return screen.findByRole('dialog');
}

describe('линия маршрута на карте', () => {
  it('проводится по дорогам, а не прямой между точками', async () => {
    const user = userEvent.setup();
    await openSelectionRoute(user);

    await waitFor(() => expect(drawnLines()).toHaveLength(2));

    const [first] = drawnLines();

    // Прямая — это две точки. Путь по дорогам состоит из большего числа
    // точек, и именно их отдала служба маршрутизации (AC-033f).
    expect(first?.shape.length, 'линия проведена прямой между точками').toBeGreaterThan(2);
    expect(first?.shape).toContainEqual([55.75, 37.9]);
  });

  it('у каждого полигона свой цвет, и линии не сливаются', async () => {
    const user = userEvent.setup();
    await openSelectionRoute(user);

    await waitFor(() => expect(drawnLines()).toHaveLength(2));

    const colors = drawnLines().map(line => line.color);

    expect(new Set(colors).size, 'линии покрашены одним цветом').toBe(2);
    expect(colors[0]).toBe(routeTone(0));
    expect(colors[1]).toBe(routeTone(1));
  });

  it('служба маршрутизации молчит — карта остаётся без линии', async () => {
    // Линия — рисунок: её отсутствие не должно уносить ни метки, ни сводку
    // (AC-033f).
    routerAnswers = false;

    const user = userEvent.setup();
    const dialog = await openSelectionRoute(user);

    await waitFor(() => expect(within(dialog).getByLabelText('Метки на карте')).toBeInTheDocument());

    expect(drawnLines(), 'линия проведена по молчащей службе').toHaveLength(0);
  });
});

describe('различение полигонов в окне маршрута', () => {
  it('точка в строке перечня несёт цвет линии своего полигона', async () => {
    const user = userEvent.setup();
    const dialog = await openSelectionRoute(user);

    const list = within(dialog).getByLabelText('Метки на карте');
    const pins = [...list.querySelectorAll('.imolt-map-pin[data-point="landfill"]')];

    expect(pins).toHaveLength(2);
    expect((pins[0] as HTMLElement).style.borderColor, 'точка перечня без цвета маршрута').not.toBe('');
    expect((pins[0] as HTMLElement).style.borderColor).not.toBe((pins[1] as HTMLElement).style.borderColor);
  });

  it('строка перечня раскрывает сведения полигона без повторного названия', async () => {
    // Прежде сведения показывались отдельным блоком и повторяли название,
    // уже стоящее в строке перечня (замечание заказчика от 24.09.2026).
    const user = userEvent.setup();
    const dialog = await openSelectionRoute(user);

    const row = within(dialog).getByRole('button', { name: `Полигон: ${VOSTOK.landfillName}` });

    await user.click(row);

    const facts = await within(dialog).findByText(VOSTOK_CARD.address);

    expect(facts).toBeInTheDocument();
    expect(row).toHaveAttribute('aria-pressed', 'true');

    // Название полигона названо один раз — в самой строке.
    expect(within(dialog).getAllByText(new RegExp(VOSTOK.landfillName, 'u')).length).toBeLessThan(3);
  });

  it('повторное нажатие сворачивает сведения', async () => {
    const user = userEvent.setup();
    const dialog = await openSelectionRoute(user);

    const row = within(dialog).getByRole('button', { name: `Полигон: ${IKSHA.landfillName}` });

    await user.click(row);
    await within(dialog).findByText(IKSHA_CARD.address);

    await user.click(row);

    await waitFor(() => expect(within(dialog).queryByText(IKSHA_CARD.address)).not.toBeInTheDocument());
    expect(row).toHaveAttribute('aria-pressed', 'false');
  });
});
