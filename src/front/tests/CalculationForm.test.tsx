// Форма исходных данных экрана расчёта: адрес из подсказок, тип отходов из
// справочника, объём с мерой, флажок утилизации и запуск расчёта
// (R-012 — R-015, R-021, R-058, R-060).
//
// Видимые тексты взяты дословно из макета «ux/Калькулятор мобильный.dc.html»,
// поля и действия ищутся по подписи и доступному имени: поле без подписи
// роняет проверку, а не обходится селектором по классу.
//
// Проверки фальсифицируемы: отправьте расчёт с невыбранным адресом, потеряйте
// объём при смене меры, посчитайте пересчёт в тонны молча без показа, пустите
// внутренний идентификатор или код причины на экран, оставьте отказ службы
// пустым экраном — они упадут.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import type { ApiStub } from './apiStub';
import {
  CONCRETE_GROUP,
  DISTANCE_SERVICE_UNAVAILABLE,
  PICKUP_ADDRESS,
  VOSTOK,
  WOOD_GROUP,
  installApiStub,
} from './apiStub';
import { chooseAddress, chooseWasteGroup, enterQuantity, landfillCard, waitForResults } from './flows';

let stub: ApiStub;

beforeEach(() => {
  stub = installApiStub();
});

afterEach(() => {
  stub.restore();
});

/** @uc: UC-001 */
describe('экран расчёта при открытии', () => {
  it('называет себя калькулятором вывоза строительных отходов', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Калькулятор вывоза строительных отходов' }),
    ).toBeInTheDocument();
  });

  it('подписывает поля адреса, типа отходов и объёма', () => {
    render(<App />);

    expect(screen.getByLabelText('Адрес вывоза')).toBeInTheDocument();
    expect(screen.getByLabelText('Тип отходов')).toBeInTheDocument();
    expect(screen.getByLabelText('Объём')).toBeInTheDocument();
  });

  it('называет обе меры объёма словами', () => {
    render(<App />);

    expect(screen.getByRole('radio', { name: 'т' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'м³' })).toBeInTheDocument();
  });

  it('включает утилизацию на полигоне по умолчанию', () => {
    // Экран Э-01 запроса на дизайн: флажок «Нужна утилизация на полигоне»
    // включён, и схема `CalculationRequest` даёт ему то же значение.
    render(<App />);

    expect(screen.getByRole('checkbox', { name: 'Нужна утилизация на полигоне' })).toBeChecked();
  });

  it('предлагает добавить второй тип отходов', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: 'Добавить тип отходов' })).toBeInTheDocument();
  });

  it('предлагает запустить расчёт', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeInTheDocument();
  });
});

/** @ac: AC-012d */
describe('адрес вывоза, набранный без выбора подсказки', () => {
  it('не отправляет запрос расчёта', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('Адрес вывоза'), 'Годовикова');
    await chooseWasteGroup(user);
    await enterQuantity(user, '20');
    await user.click(screen.getByRole('button', { name: 'Рассчитать' }));

    expect(
      stub.sentTo('POST /v1/calculations'),
      'расчёт опирается на координаты подсказки, а не на набранную строку',
    ).toHaveLength(0);
  });

  it('объясняет под полем, что адрес выбирается из подсказки', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('Адрес вывоза'), 'Годовикова');
    await user.click(screen.getByRole('button', { name: 'Рассчитать' }));

    expect(await screen.findByText('Выберите адрес из подсказки')).toBeInTheDocument();
  });
});

/** @ac: AC-013c */
describe('выбор типа отходов поиском по названию', () => {
  it('спрашивает справочник набранной строкой', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('Тип отходов'), 'лом');
    await screen.findByRole('option', { name: CONCRETE_GROUP.name });

    expect(stub.lastTo('GET /v1/waste-groups').query.get('query')).toBe('лом');
  });

  it('показывает найденную группу отходов строкой подсказки', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('Тип отходов'), 'лом');

    expect(await screen.findByRole('option', { name: CONCRETE_GROUP.name })).toBeInTheDocument();
  });

  it('подставляет название выбранной группы в поле', async () => {
    const user = userEvent.setup();
    render(<App />);

    await chooseWasteGroup(user);

    expect(screen.getByLabelText('Тип отходов')).toHaveValue(CONCRETE_GROUP.name);
  });
});

/** @ac: AC-014b */
describe('смена меры объёма', () => {
  it('оставляет введённое число в поле объёма', async () => {
    const user = userEvent.setup();
    render(<App />);

    await chooseWasteGroup(user);
    await enterQuantity(user, '15');
    await user.click(screen.getByRole('radio', { name: 'м³' }));

    // Значение читается со свойства поля: проверка не зависит от того, какой
    // тип поля выбран для объёма.
    expect((screen.getByLabelText('Объём') as HTMLInputElement).value).toBe('15');
  });

  it('уходит в запрос расчёта мерой «m3»', async () => {
    const user = userEvent.setup();
    render(<App />);

    await chooseAddress(user);
    await chooseWasteGroup(user);
    await enterQuantity(user, '15', 'м³');
    await user.click(screen.getByRole('button', { name: 'Рассчитать' }));
    await waitForResults();

    const items = stub.bodyOf('POST /v1/calculations')['items'] as {
      quantity: { value: number; unit: string };
    }[];

    expect(items[0]?.quantity).toEqual({ value: 15, unit: 'm3' });
  });
});

/** @ac: AC-015c */
describe('объём, введённый в кубометрах', () => {
  it('показывает под полем пересчёт в тонны', async () => {
    // Древесина от разборки, плотность 0,5 т/м³: 15 м³ дают 7,5 т.
    // Плотность приходит от расчётной части, интерфейс её не назначает
    // (ADR-0008, инвариант 2).
    const user = userEvent.setup();
    render(<App />);

    await chooseWasteGroup(user, WOOD_GROUP.name, 'древ');
    await enterQuantity(user, '15', 'м³');

    expect(await screen.findByText(/7,5\s?т/u)).toBeInTheDocument();
  });
});

/** @ac: AC-021b */
describe('снятый флажок утилизации', () => {
  it('уходит в запрос расчёта ложным признаком утилизации', async () => {
    const user = userEvent.setup();
    render(<App />);

    await chooseAddress(user);
    await chooseWasteGroup(user);
    await enterQuantity(user, '20');
    await user.click(screen.getByRole('checkbox', { name: 'Нужна утилизация на полигоне' }));
    await user.click(screen.getByRole('button', { name: 'Рассчитать' }));
    await waitForResults();

    expect(stub.bodyOf('POST /v1/calculations')['disposalRequired']).toBe(false);
  });

  it('убирает строку утилизации из карточки полигона', async () => {
    const user = userEvent.setup();
    render(<App />);

    await chooseAddress(user);
    await chooseWasteGroup(user);
    await enterQuantity(user, '20');
    await user.click(screen.getByRole('checkbox', { name: 'Нужна утилизация на полигоне' }));
    await user.click(screen.getByRole('button', { name: 'Рассчитать' }));
    await waitForResults();

    expect(
      within(landfillCard(VOSTOK.landfillName)).queryByText(/утилизация/iu),
      'при выключенной утилизации совокупная цена состоит только из перевозки',
    ).toBeNull();
  });
});

/** @ac: AC-058b */
describe('язык результата расчёта', () => {
  it('не показывает идентификатора группы отходов', async () => {
    const user = userEvent.setup();
    render(<App />);

    await chooseAddress(user);
    await chooseWasteGroup(user);
    await enterQuantity(user, '20');
    await user.click(screen.getByRole('button', { name: 'Рассчитать' }));
    await waitForResults();

    expect(document.body.textContent).not.toContain(CONCRETE_GROUP.id);
  });

  it('не показывает идентификатора полигона', async () => {
    const user = userEvent.setup();
    render(<App />);

    await chooseAddress(user);
    await chooseWasteGroup(user);
    await enterQuantity(user, '20');
    await user.click(screen.getByRole('button', { name: 'Рассчитать' }));
    await waitForResults();

    expect(document.body.textContent).not.toContain(VOSTOK.landfillId);
  });

  it('не показывает кода причины отказа', async () => {
    const user = userEvent.setup();
    stub.answerWith('POST /v1/calculations', {
      status: 503,
      headers: { 'content-type': 'application/problem+json' },
      body: DISTANCE_SERVICE_UNAVAILABLE,
    });
    render(<App />);

    await chooseAddress(user);
    await chooseWasteGroup(user);
    await enterQuantity(user, '20');
    await user.click(screen.getByRole('button', { name: 'Рассчитать' }));
    await screen.findByText('Не удалось рассчитать расстояния');

    expect(document.body.textContent).not.toContain('urn:imolt:problem:');
  });
});

/** @uc: UC-001 */
describe('обращения экрана наружу', () => {
  it('идут только в свою расчётную часть по относительному пути', async () => {
    // Подсказки адресов и расстояния берутся у своей расчётной части: ключи
    // внешних служб в интерфейс не попадают (R-056, AR-006; ADR-0008,
    // инвариант 3).
    const user = userEvent.setup();
    render(<App />);

    await chooseAddress(user);
    await chooseWasteGroup(user);
    await enterQuantity(user, '20');
    await user.click(screen.getByRole('button', { name: 'Рассчитать' }));
    await waitForResults();

    const foreign = stub.requests.filter((request) => !request.url.startsWith('/api/'));

    expect(foreign.map((request) => request.url)).toEqual([]);
  });
});

/** @ac: AC-060c */
describe('отказ расчётной части', () => {
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

  it('называет причину словами заголовка документа об отказе', async () => {
    const user = userEvent.setup();
    render(<App />);

    await calculateAndFail(user);

    expect(screen.getByText('Не удалось рассчитать расстояния')).toBeInTheDocument();
  });

  it('предлагает повторить расчёт', async () => {
    const user = userEvent.setup();
    render(<App />);

    await calculateAndFail(user);

    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });

  it('оставляет выбранный адрес в форме', async () => {
    const user = userEvent.setup();
    render(<App />);

    await calculateAndFail(user);

    expect(screen.getByLabelText('Адрес вывоза')).toHaveValue(PICKUP_ADDRESS);
  });

  it('оставляет строку отходов в форме', async () => {
    const user = userEvent.setup();
    render(<App />);

    await calculateAndFail(user);

    expect(screen.getByLabelText('Тип отходов')).toHaveValue(CONCRETE_GROUP.name);
    expect((screen.getByLabelText('Объём') as HTMLInputElement).value).toBe('20');
  });

  it('повторяет расчёт по кнопке «Повторить»', async () => {
    const user = userEvent.setup();
    render(<App />);

    await calculateAndFail(user);
    await user.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(stub.sentTo('POST /v1/calculations')).toHaveLength(2);
  });
});
