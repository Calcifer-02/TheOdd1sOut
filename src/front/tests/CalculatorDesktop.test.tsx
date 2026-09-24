/**
 * Десктопное представление экрана расчёта: таблица сравнения полигонов,
 * сортировка по столбцу, отбор по расстоянию, липкая сводка выбора и
 * состояния Э-12 (R-019, R-023 — R-029, R-032, R-053, R-060).
 *
 * Ширина окна ставится до отрисовки: представление выбирается по ней, и
 * проверка, поставившая ширину после, проверяла бы мобильную раскладку.
 *
 * Элементы ищутся по роли и доступному имени: заголовок столбца без признака
 * `aria-sort`, флажок без названия полигона и всплывающее окно без имени
 * роняют проверку, а не обходятся селектором по классу.
 *
 * Проверки фальсифицируемы: покажите на широком экране карточки вместо
 * таблицы, привяжите выбор к позиции строки, потеряйте признак `aria-sort`,
 * оставьте предел расстояния вне адреса, покажите код отказа вместо
 * заголовка, снимите отметку с заблокированного полигона — они упадут.
 *
 *   npx vitest run tests/CalculatorDesktop.test.tsx
 *
 * @ac: AC-024c, AC-025c, AC-027b, AC-028c, AC-060c
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import type { ApiStub } from './apiStub';
import { ALEKSIN_BLOCKED, DISTANCE_SERVICE_UNAVAILABLE, IKSHA, VOSTOK, installApiStub } from './apiStub';
import {
  calculateConcrete,
  chooseAddress,
  chooseWasteGroup,
  enterQuantity,
  landfillCard,
  landfillCheckbox,
  precedes,
} from './flows';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';

let stub: ApiStub;

beforeEach(() => {
  stub = installApiStub();
  // Ширина ставится до отрисовки: после неё представление уже выбрано.
  setViewportWidth(DESKTOP_WIDTH);
});

afterEach(() => {
  stub.restore();
});

/** Таблица сравнения полигонов по её подписи. */
function comparisonTable(): HTMLElement {
  return screen.getByRole('table', { name: 'Сравнение полигонов' });
}

/** Заголовок столбца по его названию. */
function columnHeader(title: string | RegExp): HTMLElement {
  return within(comparisonTable()).getByRole('columnheader', { name: title });
}

/** Доводит экран до результата и переключает порядок на «Расстояние». */
async function sortByDistance(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(within(comparisonTable()).getByRole('button', { name: 'Расстояние' }));
  await waitFor(() => {
    expect(stub.lastTo('GET /v1/calculations/:id/options').query.get('sort')).toBe('distance');
  });
}

/** @uc: UC-001 */
describe('сравнение полигонов на широком экране', () => {
  it('показано таблицей со столбцами, а не карточками', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    expect(comparisonTable()).toBeInTheDocument();
  });

  it('называет перевозку, утилизацию и итог отдельными столбцами', async () => {
    // Разбивка цены — требование R-019: одна цифра вместо трёх запрещена
    // дизайн-договором, разд. 4.6.
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    expect(columnHeader(/Перевозка/u)).toBeInTheDocument();
    expect(columnHeader(/Утилизация/u)).toBeInTheDocument();
    expect(columnHeader(/Итого/u)).toBeInTheDocument();
  });

  it('показывает в строке полигона три суммы, а не одну', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    const row = landfillCard(VOSTOK.landfillName);
    const текст = row.textContent ?? '';
    const суммы = [...текст.matchAll(/₽/gu)];

    expect(суммы).toHaveLength(3);
  });
});

/** @ac: AC-024c */
describe('сортировка по столбцу таблицы на широком экране', () => {
  beforeEach(() => {
    // Порядок задаёт расчётная часть: интерфейс показывает пришедший список,
    // а не пересортировывает его у себя (ADR-0008, инвариант 2).
    stub.setOptions(request => (request.query.get('sort') === 'distance' ? [IKSHA, VOSTOK] : [VOSTOK, IKSHA]));
  });

  it('переставляет строки таблицы в порядке ответа службы', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await sortByDistance(user);

    await waitFor(() => {
      expect(precedes(landfillCheckbox(IKSHA.landfillName), landfillCheckbox(VOSTOK.landfillName))).toBe(true);
    });
  });

  it('помечает столбец порядка признаком «aria-sort»', async () => {
    // Без признака направление сортировки видно только глазом: экранный
    // диктор о нём не узнает (дизайн-договор, разд. 4.5).
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await sortByDistance(user);

    await waitFor(() => {
      expect(columnHeader(/Расстояние/u)).toHaveAttribute('aria-sort', 'ascending');
    });
  });

  it('снимает признак порядка с прежнего столбца', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await sortByDistance(user);

    await waitFor(() => {
      expect(columnHeader(/Итого/u)).toHaveAttribute('aria-sort', 'none');
    });
  });

  it('повторным нажатием по тому же столбцу меняет направление на обратное', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await sortByDistance(user);
    await user.click(within(comparisonTable()).getByRole('button', { name: 'Расстояние' }));

    await waitFor(() => {
      expect(stub.lastTo('GET /v1/calculations/:id/options').query.get('order')).toBe('desc');
    });
  });
});

/** @ac: AC-027b */
describe('выбранный полигон при смене порядка на широком экране', () => {
  beforeEach(() => {
    stub.setOptions(request => (request.query.get('sort') === 'distance' ? [IKSHA, VOSTOK] : [VOSTOK, IKSHA]));
  });

  it('остаётся отмеченным после перестановки строк', async () => {
    // Икша стояла второй и стала первой: выбор, привязанный к номеру строки,
    // после перестановки отметил бы «Восток» (карточка практики PRACT-021).
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(landfillCheckbox(IKSHA.landfillName));
    await screen.findByText(/Выбрано\s1/u);
    await sortByDistance(user);

    await waitFor(() => {
      expect(landfillCheckbox(IKSHA.landfillName)).toBeChecked();
    });
    expect(landfillCheckbox(VOSTOK.landfillName)).not.toBeChecked();
  });
});

/** @ac: AC-025c */
describe('предел расстояния на широком экране', () => {
  it('открывается всплывающим окном с полем предела', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(screen.getByRole('button', { name: 'до 50 км' }));

    expect(await screen.findByLabelText('Не более, км')).toBeInTheDocument();
  });

  it('уходит в адрес страницы, а не остаётся только на экране', async () => {
    // По ссылке восстанавливается та же выборка: предел — предмет разговора,
    // а не поза окна (ADR-0008, инвариант 5).
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(screen.getByRole('button', { name: 'до 50 км' }));
    const field = await screen.findByLabelText('Не более, км');
    await user.clear(field);
    await user.type(field, '60');
    await user.click(screen.getByRole('button', { name: 'Применить' }));

    await waitFor(() => {
      expect(window.location.hash).toContain('km=60');
    });
  });

  it('уходит в запрос списка режимом и числом', async () => {
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
});

/** @ac: AC-060c */
describe('отказ службы расстояний на широком экране', () => {
  beforeEach(() => {
    stub.answerWith('POST /v1/calculations', {
      status: 503,
      headers: { 'content-type': 'application/problem+json' },
      body: DISTANCE_SERVICE_UNAVAILABLE,
    });
  });

  async function calculateAndFail(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await chooseAddress(user);
    await chooseWasteGroup(user);
    await enterQuantity(user, '20');
    await user.click(screen.getByRole('button', { name: 'Рассчитать' }));
    await screen.findByText('Не удалось рассчитать расстояния');
  }

  it('назван заголовком документа об отказе, а не кодом причины', async () => {
    const user = userEvent.setup();
    render(<App />);

    await calculateAndFail(user);

    expect(document.body.textContent).not.toContain('urn:imolt:problem:');
  });

  it('предлагает повторить расчёт и повторяет его', async () => {
    const user = userEvent.setup();
    render(<App />);

    await calculateAndFail(user);
    await user.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(stub.sentTo('POST /v1/calculations')).toHaveLength(2);
  });
});

/** @ac: AC-028c */
describe('выбор заблокированного полигона на широком экране', () => {
  beforeEach(() => {
    stub.setOptions([VOSTOK, ALEKSIN_BLOCKED]);
  });

  it('предупреждает словами расчётной части', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(landfillCheckbox(ALEKSIN_BLOCKED.landfillName));

    expect(await screen.findByText('Полигон заблокирован. Он остаётся в выборе, решение за вами.')).toBeInTheDocument();
  });

  it('оставляет полигон отмеченным: решение за пользователем', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(landfillCheckbox(ALEKSIN_BLOCKED.landfillName));
    await screen.findByText('Полигон заблокирован. Он остаётся в выборе, решение за вами.');

    expect(landfillCheckbox(ALEKSIN_BLOCKED.landfillName)).toBeChecked();
  });
});

/** @uc: UC-003 */
describe('пустой результат на широком экране', () => {
  beforeEach(() => {
    stub.setOptions([]);
  });

  it('объясняет пустоту числом предела расстояния', async () => {
    const user = userEvent.setup();
    render(<App />);
    await chooseAddress(user);
    await chooseWasteGroup(user);
    await enterQuantity(user, '20');
    await user.click(screen.getByRole('button', { name: 'Рассчитать' }));
    await screen.findByRole('region', { name: 'Результаты' });

    expect(await screen.findByText('Нет полигонов, принимающих этот тип отходов ближе 50 км')).toBeInTheDocument();
  });

  it('предлагает снять фильтр отдельным действием', async () => {
    const user = userEvent.setup();
    render(<App />);
    await chooseAddress(user);
    await chooseWasteGroup(user);
    await enterQuantity(user, '20');
    await user.click(screen.getByRole('button', { name: 'Рассчитать' }));
    await screen.findByRole('region', { name: 'Результаты' });

    expect(await screen.findByRole('button', { name: 'Снять фильтр' })).toBeInTheDocument();
  });
});

/** @ac: AC-032c */
describe('сводка выбора боковой колонкой', () => {
  it('до выбора зовёт отметить полигоны, а не показывает нулевой итог', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    expect(screen.getByRole('heading', { name: 'Выберите полигоны' })).toBeInTheDocument();
  });

  it('после выбора показывает итог, пришедший от расчётной части', async () => {
    // 19 800 + 20 080 = 39 880: итог считает расчётная часть.
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(landfillCheckbox(VOSTOK.landfillName));
    await user.click(landfillCheckbox(IKSHA.landfillName));

    await waitFor(() => {
      expect(document.body.textContent).toContain('39 880 ₽');
    });
  });

  it('даёт скачать коммерческое предложение и выпускает его один раз', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(landfillCheckbox(VOSTOK.landfillName));
    await screen.findByText(/Выбрано\s1/u);
    await user.click(screen.getByRole('button', { name: 'Скачать КП' }));
    await screen.findByText('КП сохранено');
    await user.click(screen.getByRole('button', { name: 'Скачать КП' }));

    expect(stub.sentTo('POST /v1/calculations/:id/quotes')).toHaveLength(1);
  });

  it('ведёт на экран предложения по этому расчёту', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(landfillCheckbox(VOSTOK.landfillName));
    await screen.findByText(/Выбрано\s1/u);
    await user.click(screen.getByRole('button', { name: 'Скачать КП' }));

    const link = await screen.findByRole('link', { name: 'Открыть экран предложения' });

    expect(link.getAttribute('href')).toContain('#/quote?calc=');
  });
});

/** @uc: UC-002 */
describe('маршрут на широком экране', () => {
  it('показан всплывающим окном, а не модальным', async () => {
    // Модальное окно для маршрута запрещено дизайн-договором, разд. 4.6:
    // страница за окном обязана остаться доступной.
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(
      within(landfillCard(VOSTOK.landfillName)).getByRole('button', {
        name: `Маршрут до полигона ${VOSTOK.landfillName}`,
      }),
    );

    const popover = await screen.findByRole('dialog', {
      name: `Маршрут до полигона ${VOSTOK.landfillName}`,
    });

    expect(popover).not.toHaveAttribute('aria-modal');
  });

  it('оставляет список полигонов на экране', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(
      within(landfillCard(VOSTOK.landfillName)).getByRole('button', {
        name: `Маршрут до полигона ${VOSTOK.landfillName}`,
      }),
    );
    await screen.findByRole('dialog', { name: `Маршрут до полигона ${VOSTOK.landfillName}` });

    expect(landfillCheckbox(IKSHA.landfillName)).toBeInTheDocument();
  });
});

/** @ac: AC-053c */
describe('заявка на вывоз на широком экране', () => {
  it('открывается формой на самой странице', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(landfillCheckbox(VOSTOK.landfillName));
    await screen.findByText(/Выбрано\s1/u);
    await user.click(screen.getByRole('button', { name: 'Оставить заявку на вывоз' }));

    expect(await screen.findByLabelText('Имя')).toBeInTheDocument();
    expect(screen.getByLabelText('Телефон')).toBeInTheDocument();
    expect(screen.getByLabelText('Полигон')).toHaveValue(VOSTOK.landfillName);
  });

  it('без согласия на обработку персональных данных не отправляется', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await user.click(landfillCheckbox(VOSTOK.landfillName));
    await screen.findByText(/Выбрано\s1/u);
    await user.click(screen.getByRole('button', { name: 'Оставить заявку на вывоз' }));
    await user.type(await screen.findByLabelText('Имя'), 'Иван');
    await user.type(screen.getByLabelText('Телефон'), '+79161234567');
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }));

    expect(stub.sentTo('POST /v1/pickup-requests'), 'без явного согласия заявка не создаётся (R-054)').toHaveLength(0);
    expect(await screen.findByRole('alert')).toHaveTextContent(/соглас/iu);
  });
});
