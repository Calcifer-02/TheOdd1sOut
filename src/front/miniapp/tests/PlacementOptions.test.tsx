// Сравнение полигонов в результатах расчёта: разбивка цены, сортировка,
// предел расстояния, выбор, статусы и догрузка остальных
// (R-019, R-024 — R-029, R-048, R-060, R-061).
//
// Видимые тексты взяты дословно из макета «ux/Калькулятор мобильный.dc.html».
// Карточки ищутся через флажок с названием полигона в доступном имени: выбор
// держится за идентификатор полигона, а не за позицию строки (карточка
// практики PRACT-021, ADR-0008).
//
// Проверки фальсифицируемы: сложите перевозку и утилизацию в одну цифру,
// перенесите выбор на соседнюю строку при перестановке списка, покажите
// статус одним цветом, потеряйте дату актуальности, покажите сразу все
// полигоны без «Показать ещё» — они упадут.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import type { ApiStub } from './apiStub';
import {
  ALEKSIN_BLOCKED,
  IKSHA,
  LESNAYA_STALE,
  VOSTOK,
  installApiStub,
  placementOptionSeries,
} from './apiStub';
import {
  calculateConcrete,
  chooseAddress,
  chooseWasteGroup,
  enterQuantity,
  landfillCard,
  landfillCheckbox,
  landfillCheckboxes,
  precedes,
  resultsRegion,
} from './flows';

let stub: ApiStub;

beforeEach(() => {
  stub = installApiStub();
});

afterEach(() => {
  stub.restore();
});

/** Все денежные суммы, показанные внутри узла, — в рублях числом. */
function shownAmounts(element: HTMLElement): number[] {
  const text = element.textContent ?? '';

  return [...text.matchAll(/(-?[\d   ]+(?:,\d+)?)[ \s]?₽/gu)].map((match) =>
    Number((match[1] ?? '').replace(/[  \s]/gu, '').replace(',', '.')),
  );
}

// @ac: AC-019b
describe('карточка полигона', () => {
  it('называет перевозку словом', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    expect(
      within(landfillCard(VOSTOK.landfillName)).getByText(/перевозка/u),
    ).toBeInTheDocument();
  });

  it('называет утилизацию словом', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    expect(
      within(landfillCard(VOSTOK.landfillName)).getByText(/утилизация/u),
    ).toBeInTheDocument();
  });

  it('показывает итог рядом с перевозкой и утилизацией', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    expect(shownAmounts(landfillCard(VOSTOK.landfillName))).toContain(19800);
  });

  it('показывает итог, равный сумме показанных перевозки и утилизации', async () => {
    // Сравниваются показанные числа, а не пришедшие: слияние двух строк в
    // одну цифру запрещено дизайн-договором, разд. 4.6.
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    const amounts = shownAmounts(landfillCard(VOSTOK.landfillName));
    const total = Math.max(...amounts);
    const parts = amounts.filter((amount) => amount !== total);

    expect(parts).toHaveLength(2);
    expect(parts.reduce((sum, amount) => sum + amount, 0)).toBe(total);
  });
});

// @ac: AC-048d
describe('дата актуальности над списком', () => {
  it('называет дату цен и статусов абсолютным числом', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    expect(screen.getByText('Цены и статусы на 17.09.2026')).toBeInTheDocument();
  });
});

// @ac: AC-024c
describe('переключатель сортировки', () => {
  beforeEach(() => {
    // Порядок задаёт расчётная часть: интерфейс показывает пришедший список,
    // а не пересортировывает его у себя (ADR-0008, инвариант 2).
    stub.setOptions((request) =>
      request.query.get('sort') === 'distance' ? [IKSHA, VOSTOK] : [VOSTOK, IKSHA],
    );
  });

  it('называет все четыре поля сортировки словами', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    expect(screen.getByRole('radio', { name: 'По итогу' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Перевозка' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Утилизация' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Расстояние' })).toBeInTheDocument();
  });

  it('перезапрашивает список с сортировкой «distance»', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(screen.getByRole('radio', { name: 'Расстояние' }));

    await waitFor(() => {
      expect(stub.lastTo('GET /v1/calculations/:id/options').query.get('sort')).toBe('distance');
    });
  });

  it('показывает первой карточку, пришедшую первой в ответе', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(screen.getByRole('radio', { name: 'Расстояние' }));

    await waitFor(() => {
      expect(
        precedes(landfillCheckbox(IKSHA.landfillName), landfillCheckbox(VOSTOK.landfillName)),
      ).toBe(true);
    });
  });
});

// @ac: AC-025c
describe('чип предела расстояния', () => {
  it('показывает предел по умолчанию словами «до 50 км»', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    expect(screen.getByRole('button', { name: 'до 50 км' })).toBeInTheDocument();
  });

  it('предлагает вторую сторону отбора «не менее 50 км»', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    expect(screen.getByRole('button', { name: 'не менее 50 км' })).toBeInTheDocument();
  });

  it('запрашивает список с введённым пределом и режимом «atMost»', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(screen.getByRole('button', { name: 'до 50 км' }));
    const field = await screen.findByLabelText('Не более, км');
    await user.clear(field);
    await user.type(field, '60');
    await user.click(screen.getByRole('button', { name: 'Применить' }));

    await waitFor(() => {
      const query = stub.lastTo('GET /v1/calculations/:id/options').query;
      expect(query.get('distanceMode')).toBe('atMost');
      expect(query.get('distanceKm')).toBe('60');
    });
  });

  it('показывает введённый предел на чипе', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(screen.getByRole('button', { name: 'до 50 км' }));
    const field = await screen.findByLabelText('Не более, км');
    await user.clear(field);
    await user.type(field, '60');
    await user.click(screen.getByRole('button', { name: 'Применить' }));

    expect(await screen.findByRole('button', { name: 'до 60 км' })).toBeInTheDocument();
  });
});

// @ac: AC-027b
describe('выбранный полигон при смене сортировки', () => {
  beforeEach(() => {
    stub.setOptions((request) =>
      request.query.get('sort') === 'distance' ? [IKSHA, VOSTOK] : [VOSTOK, IKSHA],
    );
  });

  async function selectIkshaAndSortByDistance(
    user: ReturnType<typeof userEvent.setup>,
  ): Promise<void> {
    await calculateConcrete(user);
    await user.click(landfillCheckbox(IKSHA.landfillName));
    await screen.findByText(/Выбрано\s1/u);
    await user.click(screen.getByRole('radio', { name: 'Расстояние' }));
    await waitFor(() => {
      expect(
        precedes(landfillCheckbox(IKSHA.landfillName), landfillCheckbox(VOSTOK.landfillName)),
      ).toBe(true);
    });
  }

  it('оставляет отмеченной карточку того же полигона', async () => {
    const user = userEvent.setup();
    render(<App />);

    await selectIkshaAndSortByDistance(user);

    expect(landfillCheckbox(IKSHA.landfillName)).toBeChecked();
  });

  it('не переносит отметку на полигон, занявший прежнюю позицию строки', async () => {
    // Икша стояла второй и стала первой. Выбор, привязанный к номеру строки,
    // после перестановки отметил бы «Восток» — это и ловит проверка.
    const user = userEvent.setup();
    render(<App />);

    await selectIkshaAndSortByDistance(user);

    expect(landfillCheckbox(VOSTOK.landfillName)).not.toBeChecked();
  });

  it('оставляет в сводке один выбранный полигон', async () => {
    const user = userEvent.setup();
    render(<App />);

    await selectIkshaAndSortByDistance(user);

    expect(screen.getByText(/Выбрано\s1/u)).toBeInTheDocument();
  });

  it('называет расчётной части тот же идентификатор полигона', async () => {
    const user = userEvent.setup();
    render(<App />);

    await selectIkshaAndSortByDistance(user);

    const entries = stub.bodyOf('PUT /v1/calculations/:id/selection')['entries'] as {
      landfillId: string;
    }[];

    expect(entries.map((entry) => entry.landfillId)).toEqual([IKSHA.landfillId]);
  });
});

// @ac: AC-027b
describe('выбранный полигон при догрузке остальных', () => {
  it('остаётся отмеченным после нажатия «Показать ещё»', async () => {
    const user = userEvent.setup();
    const series = placementOptionSeries(12);
    stub.setOptions(series);
    render(<App />);
    await calculateConcrete(user);

    const chosen = series[1] as (typeof series)[number];
    await user.click(landfillCheckbox(chosen.landfillName));
    await user.click(screen.getByRole('button', { name: /Показать ещё/u }));
    await waitFor(() => {
      expect(landfillCheckboxes()).toHaveLength(12);
    });

    expect(landfillCheckbox(chosen.landfillName)).toBeChecked();
  });

  it('не отмечает соседний полигон после догрузки', async () => {
    const user = userEvent.setup();
    const series = placementOptionSeries(12);
    stub.setOptions(series);
    render(<App />);
    await calculateConcrete(user);

    const chosen = series[1] as (typeof series)[number];
    const neighbour = series[0] as (typeof series)[number];
    await user.click(landfillCheckbox(chosen.landfillName));
    await user.click(screen.getByRole('button', { name: /Показать ещё/u }));
    await waitFor(() => {
      expect(landfillCheckboxes()).toHaveLength(12);
    });

    expect(landfillCheckbox(neighbour.landfillName)).not.toBeChecked();
  });
});

// @ac: AC-028b
describe('статус полигона в карточке', () => {
  it('называет блокировку словом, а не только цветом', async () => {
    const user = userEvent.setup();
    stub.setOptions([VOSTOK, ALEKSIN_BLOCKED]);
    render(<App />);
    await calculateConcrete(user);

    expect(
      within(landfillCard(ALEKSIN_BLOCKED.landfillName)).getByText('Заблокирован'),
    ).toBeInTheDocument();
  });

  it('называет приём отходов словом у работающего полигона', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    expect(within(landfillCard(VOSTOK.landfillName)).getByText('Активен')).toBeInTheDocument();
  });

  it('показывает рядом со статусом дату его актуальности', async () => {
    const user = userEvent.setup();
    stub.setOptions([VOSTOK, ALEKSIN_BLOCKED]);
    render(<App />);
    await calculateConcrete(user);

    expect(
      within(landfillCard(ALEKSIN_BLOCKED.landfillName)).getByText(/данные от 17\.09/u),
    ).toBeInTheDocument();
  });

  it('показывает собственную дату у полигона с данными старше остальных', async () => {
    // «Лесная» подтверждена 03.09, тогда как цены и статусы сервиса — от
    // 17.09: дата показывается абсолютной и по каждому полигону своя
    // (карточка практики PRACT-027).
    const user = userEvent.setup();
    stub.setOptions([VOSTOK, LESNAYA_STALE]);
    render(<App />);
    await calculateConcrete(user);

    expect(
      within(landfillCard(LESNAYA_STALE.landfillName)).getByText(/данные от 03\.09/u),
    ).toBeInTheDocument();
  });
});

// @ac: AC-028c
describe('выбор заблокированного полигона', () => {
  beforeEach(() => {
    stub.setOptions([VOSTOK, ALEKSIN_BLOCKED]);
  });

  it('предупреждает о блокировке словами расчётной части', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(landfillCheckbox(ALEKSIN_BLOCKED.landfillName));

    expect(
      await screen.findByText('Полигон заблокирован. Он остаётся в выборе, решение за вами.'),
    ).toBeInTheDocument();
  });

  it('не снимает отметку с предупреждённого полигона', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(landfillCheckbox(ALEKSIN_BLOCKED.landfillName));
    await screen.findByText('Полигон заблокирован. Он остаётся в выборе, решение за вами.');

    expect(landfillCheckbox(ALEKSIN_BLOCKED.landfillName)).toBeChecked();
  });

  it('оставляет заблокированный полигон в выборе расчётной части', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(landfillCheckbox(ALEKSIN_BLOCKED.landfillName));
    await screen.findByText('Полигон заблокирован. Он остаётся в выборе, решение за вами.');

    const entries = stub.bodyOf('PUT /v1/calculations/:id/selection')['entries'] as {
      landfillId: string;
    }[];

    expect(entries.map((entry) => entry.landfillId)).toContain(ALEKSIN_BLOCKED.landfillId);
  });
});

// @ac: AC-029b
describe('первая страница списка полигонов', () => {
  beforeEach(() => {
    stub.setOptions(placementOptionSeries(12));
  });

  it('показывает десять карточек из двенадцати подходящих', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    expect(landfillCheckboxes()).toHaveLength(10);
  });

  it('предлагает догрузить остальные кнопкой «Показать ещё»', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    expect(screen.getByRole('button', { name: /Показать ещё/u })).toBeInTheDocument();
  });

  it('запрашивает остальные со сдвигом на уже показанные', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(screen.getByRole('button', { name: /Показать ещё/u }));

    await waitFor(() => {
      expect(stub.lastTo('GET /v1/calculations/:id/options').query.get('offset')).toBe('10');
    });
  });

  it('добавляет догруженные карточки к показанным, а не заменяет их', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(screen.getByRole('button', { name: /Показать ещё/u }));

    await waitFor(() => {
      expect(landfillCheckboxes()).toHaveLength(12);
    });
  });

  it('убирает «Показать ещё», когда показаны все подходящие', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(screen.getByRole('button', { name: /Показать ещё/u }));
    await waitFor(() => {
      expect(landfillCheckboxes()).toHaveLength(12);
    });

    expect(screen.queryByRole('button', { name: /Показать ещё/u })).toBeNull();
  });
});

// @uc: UC-003
describe('пустой список полигонов', () => {
  beforeEach(() => {
    stub.setOptions([]);
  });

  it('объясняет пустоту и предлагает снять предел расстояния', async () => {
    const user = userEvent.setup();
    render(<App />);
    await chooseEmptyResult(user);

    expect(
      screen.getByText('Снимите фильтр расстояния или выберите другой тип отходов.'),
    ).toBeInTheDocument();
  });

  it('предлагает снять фильтр отдельным действием', async () => {
    const user = userEvent.setup();
    render(<App />);
    await chooseEmptyResult(user);

    expect(screen.getByRole('button', { name: 'Снять фильтр' })).toBeInTheDocument();
  });

  it('не показывает пустоту как отказ службы', async () => {
    // Пустой список ошибкой не является: договор несёт причину пустоты, а не
    // документ об отказе.
    const user = userEvent.setup();
    render(<App />);
    await chooseEmptyResult(user);

    expect(screen.queryByText('Не удалось рассчитать расстояния')).toBeNull();
    expect(within(resultsRegion()).queryAllByRole('checkbox')).toHaveLength(0);
  });
});

/**
 * Доводит экран до пустого результата: заглушка не отдаёт ни одного полигона.
 * Ждётся сам раздел результатов, а не подпись свежести: при пустом списке
 * макет её не показывает, и ожидание подписи скрыло бы проверяемый исход.
 */
async function chooseEmptyResult(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await chooseAddress(user);
  await chooseWasteGroup(user);
  await enterQuantity(user, '20');
  await user.click(screen.getByRole('button', { name: 'Рассчитать' }));
  await screen.findByRole('region', { name: 'Результаты' });
}
