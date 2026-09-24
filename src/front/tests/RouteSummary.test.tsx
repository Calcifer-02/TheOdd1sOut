/**
 * Сводка маршрута по выбранным полигонам: что показывает окно, открытое
 * кнопкой «Получить маршрут», в каком порядке идут полигоны, сколько меток
 * встаёт на карту и чем закрытый подпиской доступ отличается от молчащей
 * службы.
 *
 * Дефект, ради которого заведена проверка: кнопка сводки искала первый
 * отмеченный полигон и открывала маршрут до него одного, хотя требование
 * R-032 говорит о выбранных полигонах во множественном числе, а служба отдаёт
 * участок маршрута на каждый из них (схема `RouteSummary` договора расчётной
 * части). Заказчик увидел это так: «выбираю несколько полигонов, она
 * показывает только первый».
 *
 * Проверки фальсифицируемы: верните поиск первого отмеченного полигона, снимите
 * упорядочивание по совокупной цене, оставьте на карте одну метку полигона,
 * заставьте кнопку в строке таблицы открывать весь выбор, назовите молчащую
 * службу закрытым подпиской доступом — они упадут.
 *
 *   npx vitest run tests/RouteSummary.test.tsx
 *
 * Критерии приёмки на сводку маршрута в интерфейсе (AC-032a — AC-032c)
 * описывают ответ расчётной части, а не окно, поэтому якоря обслуживающие.
 *
 * @supports: R-032
 * @supports: R-033
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { routeRows } from '@/entities/landfill';
import type { PlacementOption } from '@/shared/api/contracts';
import type { ApiStub } from './apiStub';
import { FRESHNESS_DATE, IKSHA, VOSTOK, installApiStub, problem } from './apiStub';
import { calculateConcrete, landfillCard, landfillCheckbox } from './flows';
import { VOSTOK_CARD, answerLandfillCard } from './stubs/landfillCard';
import { drawnMarkers, resetLeaflet } from './stubs/leaflet';
import { fittedFrames, resetFrames } from './stubs/leafletBounds';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';

// Подмена запоминает кадр карты: он обязан вмещать все метки, иначе часть
// выбранных полигонов окажется за краем (R-033).
vi.mock('leaflet', async () => (await import('./stubs/leafletBounds')).boundedLeafletModule);
// Правила полотна приходят файлом стилей: в прогоне проверок он не нужен, но
// его отсутствие библиотека считала бы отказом и карту не рисовала.
vi.mock('leaflet/dist/leaflet.css', () => ({}));

/** Неразрывный пробел U+00A0 — разделитель разрядов и отбивка знака рубля. */
const NBSP = ' ';

const SELECTION_TITLE = 'Маршрут по выбранным полигонам';

/**
 * Карточка полигона «Икша». Координаты намеренно не совпадают ни с адресом
 * вывоза, ни с «Востоком»: по совпавшим точкам не видно, что меток три.
 */
const IKSHA_CARD = {
  id: IKSHA.landfillId,
  name: IKSHA.landfillName,
  legalEntity: 'ООО «Икша-Полигон»',
  address: IKSHA.address,
  coordinates: { latitude: 56.1573, longitude: 37.5011 },
  status: IKSHA.status,
  statusUpdatedAt: FRESHNESS_DATE,
  tariffs: [
    {
      wasteGroupId: 'beton-lom',
      disposalPricePerTon: { amount: '380.00', currency: 'RUB' },
      updatedAt: FRESHNESS_DATE,
    },
  ],
};

let stub: ApiStub;

beforeEach(() => {
  stub = installApiStub();
  answerLandfillCard(stub);
  answerLandfillCard(stub, IKSHA_CARD);
  resetLeaflet();
  resetFrames();
  // Ширина ставится до отрисовки: после неё представление уже выбрано.
  setViewportWidth(DESKTOP_WIDTH);
});

afterEach(() => {
  stub.restore();
});

/**
 * Отмечает «Икшу», затем «Восток» и открывает маршрут кнопкой сводки выбора.
 *
 * Порядок отметки обратен порядку цены намеренно: перечень обязан показать
 * дешёвый «Восток» первым, а не тем, который отметили раньше.
 */
async function openSelectionRoute(user: UserEvent): Promise<HTMLElement> {
  await calculateConcrete(user);
  await user.click(landfillCheckbox(IKSHA.landfillName));
  await user.click(landfillCheckbox(VOSTOK.landfillName));
  await screen.findByText(/Выбрано\s2/u);

  await user.click(screen.getByRole('button', { name: 'Получить маршрут' }));

  return screen.findByRole('dialog', { name: SELECTION_TITLE });
}

/** Строки перечня полигонов открытого окна маршрута. */
function routeLegs(dialog: HTMLElement): HTMLElement[] {
  return within(within(dialog).getByRole('list', { name: 'Полигоны маршрута' })).getAllByRole('listitem');
}

/** @uc: UC-002 */
describe('окно маршрута по выбранным полигонам', () => {
  it('показывает каждый выбранный полигон, а не первый из них', async () => {
    const user = userEvent.setup();
    render(<App />);

    const dialog = await openSelectionRoute(user);
    const legs = routeLegs(dialog);

    expect(legs, 'окно показало один полигон вместо двух выбранных (R-032)').toHaveLength(2);
    expect(legs.map(leg => leg.textContent ?? '').join('\n')).toContain(VOSTOK.landfillName);
    expect(legs.map(leg => leg.textContent ?? '').join('\n')).toContain(IKSHA.landfillName);
  });

  it('называет по каждому полигону плечо перевозки, обе стоимости и совокупную цену', async () => {
    // Числа — те, что вернула расчётная часть: 45 км, 10 800 и 9 000 рублей у
    // «Востока», 52 км, 12 480 и 7 600 у «Икши» (ADR-0008, инвариант 2).
    const user = userEvent.setup();
    render(<App />);

    const dialog = await openSelectionRoute(user);
    const [cheap, dear] = routeLegs(dialog).map(leg => leg.textContent ?? '');

    expect(cheap).toContain(`45${NBSP}км`);
    expect(cheap).toContain(`10${NBSP}800${NBSP}₽`);
    expect(cheap).toContain(`9${NBSP}000${NBSP}₽`);
    expect(cheap).toContain(`19${NBSP}800${NBSP}₽`);

    expect(dear).toContain(`52${NBSP}км`);
    expect(dear).toContain(`12${NBSP}480${NBSP}₽`);
    expect(dear).toContain(`7${NBSP}600${NBSP}₽`);
    expect(dear).toContain(`20${NBSP}080${NBSP}₽`);
  });

  it('называет время в пути по каждому участку маршрута', async () => {
    const user = userEvent.setup();
    render(<App />);

    const dialog = await openSelectionRoute(user);

    for (const leg of routeLegs(dialog)) {
      expect(leg.textContent, 'участок без времени в пути — половина сводки (R-033)').toMatch(/1\s?ч\s?10\s?мин/u);
    }
  });

  it('называет общий итог, пришедший от службы', async () => {
    // 19 800 + 20 080 = 39 880: итог складывает расчётная часть, а не окно
    // (ADR-0008, инвариант 2).
    const user = userEvent.setup();
    render(<App />);

    const dialog = await openSelectionRoute(user);

    expect(dialog.textContent).toContain(`39${NBSP}880${NBSP}₽`);
    expect(within(dialog).getByText('Итого по выбранным полигонам')).toBeInTheDocument();
  });

  it('перечисляет полигоны от самого дешёвого по совокупной цене', async () => {
    // «Икша» отмечена первой, но стоит 20 080 против 19 800 у «Востока»:
    // порядок перечня отвечает на вопрос «куда дешевле», а не повторяет
    // порядок отметки.
    const user = userEvent.setup();
    render(<App />);

    const dialog = await openSelectionRoute(user);
    const legs = routeLegs(dialog).map(leg => leg.textContent ?? '');

    expect(legs[0], 'перечень не упорядочен по совокупной цене').toContain(VOSTOK.landfillName);
    expect(legs[1]).toContain(IKSHA.landfillName);
  });

  it('называет самый дешёвый полигон словом, а не одним цветом', async () => {
    const user = userEvent.setup();
    render(<App />);

    const dialog = await openSelectionRoute(user);
    const legs = routeLegs(dialog);

    expect(within(legs[0]).getByText('Дешевле остальных')).toBeInTheDocument();
    expect(within(legs[1]).queryByText('Дешевле остальных'), 'дешевле остальных может быть только один').toBeNull();
  });
});

/** @uc: UC-002 */
describe('карта окна маршрута по выбранным полигонам', () => {
  it('ставит метку адреса вывоза и метку на каждый выбранный полигон', async () => {
    const user = userEvent.setup();
    render(<App />);

    await openSelectionRoute(user);
    await waitFor(() => expect(drawnMarkers()).toHaveLength(3));

    const places = drawnMarkers()
      .filter(marker => marker.kind === 'landfill')
      .map(marker => marker.place);

    expect(places, 'на карте осталась метка одного полигона из двух выбранных').toHaveLength(2);
    expect(places).toContainEqual([VOSTOK_CARD.coordinates.latitude, VOSTOK_CARD.coordinates.longitude]);
    expect(places).toContainEqual([IKSHA_CARD.coordinates.latitude, IKSHA_CARD.coordinates.longitude]);
  });

  it('ставит кадр карты по всем меткам, а не по одной из них', async () => {
    // Кадр, сведённый к одной точке, уводит остальные выбранные полигоны за
    // край: сравнивать их на карте после этого нечем (R-033).
    const user = userEvent.setup();
    render(<App />);

    await openSelectionRoute(user);
    await waitFor(() => expect(fittedFrames()).toHaveLength(1));

    expect(fittedFrames()[0], 'в кадр вошли не все метки').toHaveLength(3);
    expect(fittedFrames()[0]).toContainEqual([VOSTOK_CARD.coordinates.latitude, VOSTOK_CARD.coordinates.longitude]);
    expect(fittedFrames()[0]).toContainEqual([IKSHA_CARD.coordinates.latitude, IKSHA_CARD.coordinates.longitude]);
  });

  it('раскрывает сведения того полигона, на метку которого нажали', async () => {
    const user = userEvent.setup();
    render(<App />);

    const dialog = await openSelectionRoute(user);
    await waitFor(() => expect(drawnMarkers()).toHaveLength(3));

    // Нажимаются обе метки по очереди: раскрывшийся первым по любому другому
    // правилу — по порядку отметки или по порядку перечня — на одной метке
    // прошёл бы незамеченным.
    const press = async (landfillName: string) => {
      const marker = drawnMarkers().find(candidate => candidate.title.includes(landfillName));

      await act(async () => {
        marker?.press();
      });
    };

    await press(IKSHA.landfillName);

    expect(await within(dialog).findByText(IKSHA_CARD.address)).toBeInTheDocument();
    expect(within(dialog).queryByText(VOSTOK_CARD.address), 'нажали на «Икшу», а раскрылся «Восток»').toBeNull();

    await press(VOSTOK.landfillName);

    expect(await within(dialog).findByText(VOSTOK_CARD.address)).toBeInTheDocument();
    expect(within(dialog).queryByText(IKSHA_CARD.address), 'нажали на «Восток», а остался «Икша»').toBeNull();
  });
});

/** @uc: UC-002 */
describe('маршрут из строки таблицы', () => {
  it('открывает один полигон строки, а не весь выбор', async () => {
    // Из строки спрашивают про её полигон, из сводки — про весь выбор. Это
    // разные вопросы, и отметка соседних полигонов на первый не влияет.
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(landfillCheckbox(IKSHA.landfillName));
    await user.click(landfillCheckbox(VOSTOK.landfillName));
    await screen.findByText(/Выбрано\s2/u);

    await user.click(
      within(landfillCard(IKSHA.landfillName)).getByRole('button', {
        name: `Маршрут до полигона ${IKSHA.landfillName}`,
      }),
    );

    const dialog = await screen.findByRole('dialog', { name: `Маршрут до полигона ${IKSHA.landfillName}` });

    expect(routeLegs(dialog), 'кнопка строки открыла весь выбор вместо своего полигона').toHaveLength(1);
    expect(dialog.textContent).not.toContain(VOSTOK.landfillName);
  });

  it('не выдаёт итог всего выбора за итог одного полигона', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(landfillCheckbox(IKSHA.landfillName));
    await user.click(landfillCheckbox(VOSTOK.landfillName));
    await screen.findByText(/Выбрано\s2/u);

    await user.click(
      within(landfillCard(IKSHA.landfillName)).getByRole('button', {
        name: `Маршрут до полигона ${IKSHA.landfillName}`,
      }),
    );

    const dialog = await screen.findByRole('dialog', { name: `Маршрут до полигона ${IKSHA.landfillName}` });
    await within(dialog).findByRole('link', { name: 'Открыть в Яндекс.Картах' });

    expect(
      within(dialog).queryByText('Итого по выбранным полигонам'),
      'итог чужой выборки у одного полигона',
    ).toBeNull();
    expect(dialog.textContent, 'итог выбора 39 880 ₽ относится к двум полигонам, а показан один').not.toContain(
      `39${NBSP}880${NBSP}₽`,
    );
  });
});

/** @uc: UC-002 */
describe('закрытые детали маршрута и молчащая служба', () => {
  it('называет закрытый подпиской доступ его собственными словами', async () => {
    stub.answerWith('GET /v1/calculations/:id/route', {
      status: 200,
      body: {
        access: { granted: false, reason: 'subscriptionRequired' },
        legs: [],
        total: { amount: '39880.00', currency: 'RUB' },
      },
    });

    const user = userEvent.setup();
    render(<App />);

    const dialog = await openSelectionRoute(user);

    expect(await within(dialog).findByText('Детали маршрута – по подписке')).toBeInTheDocument();
    expect(within(dialog).queryByText('Сводка маршрута не пришла'), 'закрытый доступ выдан за отказ службы').toBeNull();
    expect(routeLegs(dialog), 'расстояние и стоимость видны всем и без подписки').toHaveLength(2);
  });

  it('называет молчащую службу маршрутов отдельно от закрытого доступа', async () => {
    stub.answerWith('GET /v1/calculations/:id/route', {
      status: 503,
      headers: { 'content-type': 'application/problem+json' },
      body: problem('urn:imolt:problem:unavailable', 'Служба маршрутов недоступна', 503),
    });

    const user = userEvent.setup();
    render(<App />);

    const dialog = await openSelectionRoute(user);

    expect(await within(dialog).findByText('Сводка маршрута не пришла')).toBeInTheDocument();
    expect(
      within(dialog).queryByText('Детали маршрута – по подписке'),
      'отказ службы выдан за закрытый подпиской доступ',
    ).toBeNull();
  });
});

/**
 * Порядок и признак «дешевле остальных» проверяются ещё и напрямую: через
 * разметку не выразить случай равных совокупных цен, а он решает, можно ли
 * вообще назвать кого-то дешевле.
 */
describe('порядок строк сводки маршрута', () => {
  /** Вариант размещения с заданной совокупной ценой; прочие числа не важны. */
  function option(landfillId: string, total: string): PlacementOption {
    return {
      landfillId,
      landfillName: landfillId,
      address: 'Московская обл.',
      distanceKm: 40,
      transportCost: { amount: '1000.00', currency: 'RUB' },
      disposalCost: { amount: '1000.00', currency: 'RUB' },
      totalCost: { amount: total, currency: 'RUB' },
      status: 'active',
      statusUpdatedAt: FRESHNESS_DATE,
    };
  }

  it('ставит дешёвый полигон впереди дорогого', () => {
    const rows = routeRows([option('dear', '20080.00'), option('cheap', '19800.00')], null);

    expect(rows.map(row => row.option.landfillId)).toEqual(['cheap', 'dear']);
  });

  it('сравнивает копейки, а не целые рубли', () => {
    const rows = routeRows([option('later', '19800.50'), option('earlier', '19800.10')], null);

    expect(rows.map(row => row.option.landfillId)).toEqual(['earlier', 'later']);
  });

  it('при равных совокупных ценах дешевле остальных не называет никого', () => {
    const rows = routeRows([option('first', '19800.00'), option('second', '19800.00')], null);

    expect(
      rows.some(row => row.cheapest),
      'из двух одинаковых один назван дешевле',
    ).toBe(false);
  });

  it('у единственного полигона сравнивать не с чем', () => {
    const rows = routeRows([option('alone', '19800.00')], null);

    expect(rows[0].cheapest).toBe(false);
  });
});
