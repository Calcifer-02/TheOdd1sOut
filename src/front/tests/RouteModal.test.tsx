/**
 * Окно маршрута на рабочем месте: где его узел лежит в дереве, чем оно
 * открывается и закрывается, что показывает карта и что остаётся от окна,
 * когда карта не пришла.
 *
 * Замер живого стенда 24.09.2026 при ширине окна 1496: окно маршрута 360 × 400
 * отрисовано в ячейке 78 × 48 внутри области прокрутки таблицы 776 × 254 с
 * «overflow: auto», которая резала его справа и снизу. Решением заказчика от
 * 24.09.2026 маршрут открывается модальным окном поверх страницы с настоящей
 * картой.
 *
 * Раскладки в jsdom нет, полотно карты не рисуется, поэтому проверяется
 * устройство: узел окна вынесен в корень страницы, прокрутка под окном
 * заблокирована, фокус заперт внутри и возвращается на вызвавшую кнопку, карте
 * передано ровно две метки. Библиотека карты подменена.
 *
 * Проверки фальсифицируемы: верните окно в разметку ячейки, снимите портал,
 * верните открытие наведением, снимите блокировку прокрутки, возврат фокуса
 * или ловушку фокуса, поставьте одну метку, отвяжите нажатие на метку
 * полигона, проглотите отказ тайлов молча, покажите маршрут на телефоне
 * модальным окном — они упадут.
 *
 *   npx vitest run tests/RouteModal.test.tsx
 *
 * Критерии приёмки AC-033a — AC-033e заводятся отдельным коммитом аналитики,
 * поэтому якоря здесь обслуживающие.
 *
 * @supports: R-033
 * @supports: R-034
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import type { ApiStub } from './apiStub';
import { EXTERNAL_MAP_URL, GODOVIKOVA_SUGGESTION, VOSTOK, installApiStub } from './apiStub';
import { calculateConcrete, landfillCard } from './flows';
import { VOSTOK_CARD, answerLandfillCard, failLandfillCard } from './stubs/landfillCard';
import { breakTiles, drawnMarkers, mapsDrawn, mapsRemoved, markerOf, resetLeaflet, tileUrls } from './stubs/leaflet';
import { DESKTOP_WIDTH, MOBILE_WIDTH, setViewportWidth } from './viewport';

vi.mock('leaflet', async () => (await import('./stubs/leaflet')).leafletModule);
// Правила полотна приходят файлом стилей: в прогоне проверок он не нужен, но
// его отсутствие библиотека считала бы отказом и карту не рисовала.
vi.mock('leaflet/dist/leaflet.css', () => ({}));

const ROUTE_TITLE = `Маршрут до полигона ${VOSTOK.landfillName}`;

let stub: ApiStub;

beforeEach(() => {
  stub = installApiStub();
  answerLandfillCard(stub);
  resetLeaflet();
  // Ширина ставится до отрисовки: после неё представление уже выбрано.
  setViewportWidth(DESKTOP_WIDTH);
});

afterEach(() => {
  stub.restore();
});

/** Кнопка маршрута в строке полигона: ищется по доступному имени. */
function routeButton(landfillName: string = VOSTOK.landfillName): HTMLElement {
  return within(landfillCard(landfillName)).getByRole('button', {
    name: `Маршрут до полигона ${landfillName}`,
  });
}

/** Открытое окно маршрута по его доступному имени. */
function routeDialog(): Promise<HTMLElement> {
  return screen.findByRole('dialog', { name: ROUTE_TITLE });
}

/** Окно маршрута с отрисованной картой: метки поставлены, ожидание кончилось. */
async function openRouteWithMap(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await calculateConcrete(user);
  await user.click(routeButton());

  const dialog = await routeDialog();
  await waitFor(() => expect(drawnMarkers()).toHaveLength(2));

  return dialog;
}

/** @uc: UC-002 */
describe('окно маршрута на рабочем месте', () => {
  it('открывается нажатием на кнопку маршрута', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(routeButton());

    expect(await routeDialog()).toHaveAttribute('aria-modal', 'true');
  });

  it('не открывается наведением на ячейку маршрута', async () => {
    // Наведение открывало прежнее всплывающее окно рядом с кнопкой. Модальное
    // окно так открывать нельзя: человек проводит указателем по таблице и
    // получает окно поверх всей страницы (решение заказчика от 24.09.2026).
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.hover(routeButton());

    expect(screen.queryByRole('dialog', { name: ROUTE_TITLE })).not.toBeInTheDocument();
  });

  it('лежит в корне страницы, а не внутри обрезающей области таблицы', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(routeButton());
    const dialog = await routeDialog();

    expect(dialog.closest('.imolt-table-scroll'), 'область прокрутки режет окно справа и снизу').toBeNull();
    expect(dialog.closest('table'), 'окно шире своей ячейки в четыре с половиной раза').toBeNull();
    expect(dialog.parentElement?.parentElement, 'окно вместе с подложкой уходит порталом в корень').toBe(document.body);
  });

  it('блокирует прокрутку страницы под собой и возвращает её после закрытия', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    const before = document.body.style.overflow;

    await user.click(routeButton());
    await routeDialog();

    expect(document.body.style.overflow, 'страница под окном прокручивалась бы вместе с ним').toBe('hidden');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: ROUTE_TITLE })).not.toBeInTheDocument());

    expect(document.body.style.overflow, 'страница осталась бы заблокированной после закрытия').toBe(before);
  });
});

/** @uc: UC-002 */
describe('закрытие окна маршрута', () => {
  it('закрывается крестиком и возвращает фокус на кнопку маршрута', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    const opener = routeButton();
    await user.click(opener);
    await routeDialog();

    await user.click(screen.getByRole('button', { name: `Закрыть «${ROUTE_TITLE}»` }));

    expect(screen.queryByRole('dialog', { name: ROUTE_TITLE })).not.toBeInTheDocument();
    expect(opener, 'без возврата фокуса клавиатура окажется в начале страницы').toHaveFocus();
  });

  it('закрывается нажатием вне окна и возвращает фокус на кнопку маршрута', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    const opener = routeButton();
    await user.click(opener);
    const dialog = await routeDialog();

    // Подложка накрывает страницу целиком, и промах мимо окна попадает в неё,
    // а не в таблицу под ней.
    const backdrop = dialog.parentElement as HTMLElement;
    await user.click(backdrop);

    expect(screen.queryByRole('dialog', { name: ROUTE_TITLE })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('закрывается по Escape и возвращает фокус на кнопку маршрута', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    const opener = routeButton();
    await user.click(opener);
    await routeDialog();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: ROUTE_TITLE })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('держит фокус внутри себя: обход по Tab не уходит на страницу под окном', async () => {
    const user = userEvent.setup();
    render(<App />);
    const dialog = await openRouteWithMap(user);

    const close = within(dialog).getByRole('button', { name: `Закрыть «${ROUTE_TITLE}»` });
    const external = within(dialog).getByRole('link', { name: 'Открыть в Яндекс.Картах' });

    external.focus();
    await user.tab();

    expect(close, 'обход по Tab ушёл бы на управления, до которых указателем не дотянуться').toHaveFocus();

    await user.tab({ shift: true });

    expect(external).toHaveFocus();
  });
});

/** @uc: UC-002 */
describe('карта в окне маршрута', () => {
  it('ставит две метки: адрес вывоза и полигон', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openRouteWithMap(user);

    expect(mapsDrawn(), 'карта рисуется один раз на открытие окна').toBe(1);
    expect(markerOf('pickup').place, 'метка адреса вывоза стоит по координатам расчёта').toEqual([
      GODOVIKOVA_SUGGESTION.coordinates.latitude,
      GODOVIKOVA_SUGGESTION.coordinates.longitude,
    ]);
    expect(markerOf('landfill').place, 'метка полигона стоит по координатам реестра').toEqual([
      VOSTOK_CARD.coordinates.latitude,
      VOSTOK_CARD.coordinates.longitude,
    ]);
  });

  it('берёт тайлы OpenStreetMap: ключа у проекта нет и выдумать его нельзя', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openRouteWithMap(user);

    expect(tileUrls()).toEqual([expect.stringContaining('tile.openstreetmap.org')]);
  });

  it('снимает карту вместе с окном: подписки библиотеки его не переживают', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openRouteWithMap(user);

    await user.keyboard('{Escape}');

    await waitFor(() => expect(mapsRemoved()).toBe(1));
  });

  it('называет источник карты: лицензия требует указания авторов данных', async () => {
    const user = userEvent.setup();
    render(<App />);
    const dialog = await openRouteWithMap(user);

    expect(within(dialog).getByText(/OpenStreetMap/u)).toBeInTheDocument();
  });

  it('показывает сведения о полигоне нажатием на его метку', async () => {
    const user = userEvent.setup();
    render(<App />);
    const dialog = await openRouteWithMap(user);

    expect(within(dialog).queryByText(VOSTOK_CARD.address), 'сведения открываются нажатием, а не сразу').toBeNull();

    await act(async () => {
      markerOf('landfill').press();
    });

    expect(await within(dialog).findByText(VOSTOK_CARD.address)).toBeInTheDocument();
    expect(within(dialog).getByText('Активен'), 'статус приёма называется словом').toBeInTheDocument();
    expect(within(dialog).getByText(/Лом бетона и железобетона\s+—\s+450/u), 'тариф утилизации').toBeInTheDocument();
  });

  it('называет отказ карты словами, оставляя расстояние и переход во внешние карты', async () => {
    const user = userEvent.setup();
    render(<App />);
    const dialog = await openRouteWithMap(user);

    await act(async () => {
      breakTiles();
    });

    expect(await within(dialog).findByText(/Карта не загрузилась/u)).toBeInTheDocument();
    expect(within(dialog).getByText(/45\s?км/u), 'расстояние от карты не зависит').toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Открыть в Яндекс.Картах' })).toHaveAttribute(
      'href',
      EXTERNAL_MAP_URL,
    );
  });

  it('называет словами и отказ реестра полигонов: без координат рисовать нечего', async () => {
    failLandfillCard(stub);

    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);
    await user.click(routeButton());

    const dialog = await routeDialog();

    expect(await within(dialog).findByText(/Сведения о полигоне не пришли/u)).toBeInTheDocument();
    expect(drawnMarkers(), 'метку без координат поставить не на что').toHaveLength(0);
    expect(within(dialog).getByRole('link', { name: 'Открыть в Яндекс.Картах' })).toBeInTheDocument();
  });
});

/** @uc: UC-002 */
describe('маршрут на телефоне', () => {
  it('остаётся выдвижной панелью, а не модальным окном', async () => {
    // Окно поверх всего на телефоне избыточно: панель занимает тот же экран
    // целиком, а страницы под ней всё равно не видно (решение заказчика от
    // 24.09.2026).
    setViewportWidth(MOBILE_WIDTH);

    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(within(landfillCard(VOSTOK.landfillName)).getByRole('button', { name: 'Маршрут' }));

    const sheet = await screen.findByRole('dialog', { name: 'Маршрут' });

    expect(sheet).toHaveClass('imolt-sheet');
    expect(sheet).not.toHaveAttribute('aria-modal');
    expect(document.body.style.overflow, 'панель прокрутку страницы не блокирует').not.toBe('hidden');
  });
});
