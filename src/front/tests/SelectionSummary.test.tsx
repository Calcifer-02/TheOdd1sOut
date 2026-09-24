// Сводка выбора, распределение объёма и документы: панель выбора, доли по
// полигонам, ссылка на внешние карты, выпуск коммерческого предложения и
// заявка на вывоз (R-030, R-032, R-034, R-036, R-053, R-061).
//
// Видимые тексты взяты дословно из макета «ux/Калькулятор мобильный.dc.html».
// Суммы сверяются посимвольно: неразрывный пробел — часть требования R-061, и
// обычный пробел его не заменяет.
//
// Проверки фальсифицируемы: покажите сводку до выбора, посчитайте итог
// распределения у себя вместо ответа расчётной части, отправьте несошедшиеся
// доли, выпустите второе предложение при повторном скачивании, примите заявку
// без согласия на обработку персональных данных — они упадут.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import type { ApiStub } from './apiStub';
import { CONCRETE_GROUP, EXTERNAL_MAP_URL, IKSHA, QUOTE_DOCUMENT_URL, VOSTOK, installApiStub } from './apiStub';
import { calculateConcrete, landfillCard, landfillCheckbox } from './flows';

/** Неразрывный пробел U+00A0 — разделитель разрядов и отбивка знака рубля. */
const NBSP = ' ';

let stub: ApiStub;

beforeEach(() => {
  stub = installApiStub();
});

afterEach(() => {
  stub.restore();
});

/** Отмечает полигоны по названиям и ждёт, пока сводка назовёт их число. */
async function selectLandfills(user: ReturnType<typeof userEvent.setup>, names: string[]): Promise<void> {
  for (const name of names) {
    await user.click(landfillCheckbox(name));
  }

  await screen.findByText(new RegExp(`Выбрано\\s${names.length}`, 'u'));
}

/** Доли распределения по каждому выбранному полигону. */
function allocationShares(): number[] {
  return stub.sentTo('PUT /v1/calculations/:id/allocation').flatMap(request => {
    const entries = ((request.body as Record<string, unknown>)?.['entries'] ?? []) as {
      quantity: { value: number };
    }[];
    return entries.map(entry => entry.quantity.value);
  });
}

/** @ac: AC-032c */
describe('панель сводки выбора', () => {
  it('не показана, пока не выбран ни один полигон', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    expect(screen.queryByText(/Выбрано/u)).toBeNull();
  });

  it('называет число выбранных полигонов', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await selectLandfills(user, [VOSTOK.landfillName, IKSHA.landfillName]);

    expect(screen.getByText(/Выбрано\s2/u)).toBeInTheDocument();
  });

  it('показывает итог, пришедший от расчётной части', async () => {
    // 19 800 + 20 080 = 39 880: итог считает расчётная часть, интерфейс его
    // не пересчитывает (ADR-0008, инвариант 2).
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await selectLandfills(user, [VOSTOK.landfillName, IKSHA.landfillName]);

    expect(document.body.textContent).toContain(`39${NBSP}880${NBSP}₽`);
  });

  it('называет расчётной части весь выбор целиком', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await selectLandfills(user, [VOSTOK.landfillName, IKSHA.landfillName]);

    const entries = stub.bodyOf('PUT /v1/calculations/:id/selection')['entries'] as {
      landfillId: string;
    }[];

    expect(entries.map(entry => entry.landfillId)).toEqual([VOSTOK.landfillId, IKSHA.landfillId]);
  });
});

/** @ac: AC-061b */
describe('сумма на экране', () => {
  it('разделяет разряды неразрывным пробелом', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await selectLandfills(user, [VOSTOK.landfillName]);

    expect(document.body.textContent).toContain(`19${NBSP}800`);
  });

  it('не разделяет разряды обычным пробелом', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await selectLandfills(user, [VOSTOK.landfillName]);

    expect(document.body.textContent).not.toContain('19 800');
  });

  it('ставит знак рубля после числа', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    await selectLandfills(user, [VOSTOK.landfillName]);

    expect(document.body.textContent).toContain(`19${NBSP}800${NBSP}₽`);
    expect(document.body.textContent).not.toContain('₽ 19');
  });
});

/** @ac: AC-030c */
describe('распределение объёма между выбранными полигонами', () => {
  async function selectBothAndShare(
    user: ReturnType<typeof userEvent.setup>,
    vostokShare: string,
    ikshaShare: string,
  ): Promise<void> {
    await calculateConcrete(user);
    await selectLandfills(user, [VOSTOK.landfillName, IKSHA.landfillName]);

    const panel = await screen.findByRole('region', { name: 'Распределение объёма' });
    const vostokField = within(panel).getByLabelText(VOSTOK.landfillName);
    const ikshaField = within(panel).getByLabelText(IKSHA.landfillName);

    await user.clear(vostokField);
    await user.type(vostokField, vostokShare);
    await user.clear(ikshaField);
    await user.type(ikshaField, ikshaShare);
  }

  it('отправляет сошедшиеся доли расчётной части', async () => {
    const user = userEvent.setup();
    render(<App />);

    await selectBothAndShare(user, '12', '8');

    await waitFor(() => {
      const entries = stub.bodyOf('PUT /v1/calculations/:id/allocation')['entries'] as {
        landfillId: string;
        quantity: { value: number; unit: string };
      }[];

      expect(entries).toEqual([
        {
          wasteGroupId: CONCRETE_GROUP.id,
          landfillId: VOSTOK.landfillId,
          quantity: { value: 12, unit: 't' },
        },
        {
          wasteGroupId: CONCRETE_GROUP.id,
          landfillId: IKSHA.landfillId,
          quantity: { value: 8, unit: 't' },
        },
      ]);
    });
  });

  it('не отправляет распределение, пока доли не заданы', async () => {
    // Панель распределения открывается пустой: до ввода долей в сводке стоит
    // итог выбора, а не итог распределения (AC-032c).
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);
    await selectLandfills(user, [VOSTOK.landfillName, IKSHA.landfillName]);
    await screen.findByRole('region', { name: 'Распределение объёма' });

    expect(stub.sentTo('PUT /v1/calculations/:id/allocation')).toHaveLength(0);
  });

  it('заменяет итог выбора итогом распределения', async () => {
    // 12 т Востока дают 11 880 ₽, 8 т Икши — 8 032 ₽: итог распределения
    // 19 912 ₽ отличается от итога выбора 39 880 ₽.
    const user = userEvent.setup();
    render(<App />);

    await selectBothAndShare(user, '12', '8');

    await waitFor(() => {
      expect(document.body.textContent).toContain(`19${NBSP}912${NBSP}₽`);
    });
  });

  it('убирает прежний итог выбора с экрана', async () => {
    const user = userEvent.setup();
    render(<App />);

    await selectBothAndShare(user, '12', '8');

    await waitFor(() => {
      expect(document.body.textContent).toContain(`19${NBSP}912${NBSP}₽`);
    });
    expect(document.body.textContent).not.toContain(`39${NBSP}880${NBSP}₽`);
  });

  it('не отправляет доли, не сошедшиеся с объёмом группы', async () => {
    const user = userEvent.setup();
    render(<App />);

    await selectBothAndShare(user, '12', '5');

    expect(allocationShares(), 'несошедшееся распределение не применяется целиком (R-030)').not.toContain(5);
  });

  it('объясняет несовпадение числом объёма группы', async () => {
    const user = userEvent.setup();
    render(<App />);

    await selectBothAndShare(user, '12', '5');

    expect(await screen.findByRole('alert')).toHaveTextContent(/20\s?т/u);
  });
});

/** @ac: AC-034b */
describe('ссылка на внешние карты', () => {
  async function openRoute(user: ReturnType<typeof userEvent.setup>): Promise<HTMLAnchorElement> {
    await calculateConcrete(user);
    await selectLandfills(user, [VOSTOK.landfillName]);
    await user.click(within(landfillCard(VOSTOK.landfillName)).getByRole('button', { name: 'Маршрут' }));

    return (await screen.findByRole('link', {
      name: 'Открыть в Яндекс.Картах',
    })) as HTMLAnchorElement;
  }

  it('ведёт по адресу, пришедшему от расчётной части', async () => {
    const user = userEvent.setup();
    render(<App />);

    const link = await openRoute(user);

    expect(link).toHaveAttribute('href', EXTERNAL_MAP_URL);
  });

  it('открывается отдельной вкладкой', async () => {
    const user = userEvent.setup();
    render(<App />);

    const link = await openRoute(user);

    expect(link).toHaveAttribute('target', '_blank');
  });

  it('закрывается, не уводя со списка полигонов', async () => {
    const user = userEvent.setup();
    render(<App />);

    await openRoute(user);
    await user.click(screen.getByRole('button', { name: 'Закрыть' }));

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Открыть в Яндекс.Картах' })).toBeNull();
    });
    expect(landfillCheckbox(VOSTOK.landfillName)).toBeInTheDocument();
  });
});

/** @uc: UC-002 */
describe('детали маршрута без подписки', () => {
  beforeEach(() => {
    stub.answerWith('GET /v1/calculations/:id/route', {
      status: 200,
      body: {
        access: { granted: false, reason: 'subscriptionRequired' },
        legs: [],
        total: { amount: '19800.00', currency: 'RUB' },
      },
    });
  });

  it('называет закрытые детали словами, а не пустым окном', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);
    await selectLandfills(user, [VOSTOK.landfillName]);

    await user.click(within(landfillCard(VOSTOK.landfillName)).getByRole('button', { name: 'Маршрут' }));

    expect(await screen.findByText('Детали маршрута – по подписке')).toBeInTheDocument();
  });

  it('не показывает ссылки на внешние карты вместо закрытых деталей', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);
    await selectLandfills(user, [VOSTOK.landfillName]);

    await user.click(within(landfillCard(VOSTOK.landfillName)).getByRole('button', { name: 'Маршрут' }));
    await screen.findByText('Детали маршрута – по подписке');

    expect(screen.queryByRole('link', { name: 'Открыть в Яндекс.Картах' })).toBeNull();
  });
});

/** @ac: AC-036e */
describe('скачивание коммерческого предложения', () => {
  async function downloadQuote(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await calculateConcrete(user);
    await selectLandfills(user, [VOSTOK.landfillName, IKSHA.landfillName]);
    await user.click(screen.getByRole('button', { name: 'Скачать КП' }));
    await screen.findByText('КП сохранено');
  }

  it('выпускает предложение при первом нажатии', async () => {
    const user = userEvent.setup();
    render(<App />);

    await downloadQuote(user);

    expect(stub.sentTo('POST /v1/calculations/:id/quotes')).toHaveLength(1);
  });

  it('подтверждает выпуск словами «КП сохранено»', async () => {
    const user = userEvent.setup();
    render(<App />);

    await downloadQuote(user);

    expect(screen.getByText('КП сохранено')).toBeInTheDocument();
  });

  it('не выпускает второго предложения при повторном нажатии', async () => {
    // Выпуск закрепляет цены и номер: второе нажатие не должно давать второй
    // номер (договор, операция `createQuote`).
    const user = userEvent.setup();
    render(<App />);

    await downloadQuote(user);
    await user.click(screen.getByRole('button', { name: 'Скачать КП' }));

    expect(stub.sentTo('POST /v1/calculations/:id/quotes')).toHaveLength(1);
  });

  it('скачивает файл по адресу ранее выпущенного предложения', async () => {
    const user = userEvent.setup();
    render(<App />);

    await downloadQuote(user);
    await user.click(screen.getByRole('button', { name: 'Скачать КП' }));

    const link = screen.getByRole('link', { name: 'Открыть коммерческое предложение' });

    expect(link.getAttribute('href')).toMatch(new RegExp(`${QUOTE_DOCUMENT_URL}$`, 'u'));
  });
});

/** @ac: AC-053c */
describe('заявка на вывоз без согласия на обработку персональных данных', () => {
  async function fillRequestWithoutConsent(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await calculateConcrete(user);
    await selectLandfills(user, [VOSTOK.landfillName]);
    await user.click(screen.getByRole('button', { name: 'Заявка на вывоз' }));

    await user.type(await screen.findByLabelText('Имя'), 'Иван');
    await user.type(screen.getByLabelText('Телефон'), '+79161234567');
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }));
  }

  it('не отправляет заявку', async () => {
    const user = userEvent.setup();
    render(<App />);

    await fillRequestWithoutConsent(user);

    expect(stub.sentTo('POST /v1/pickup-requests'), 'без явного согласия заявка не создаётся (R-054)').toHaveLength(0);
  });

  it('объясняет, что согласие обязательно', async () => {
    const user = userEvent.setup();
    render(<App />);

    await fillRequestWithoutConsent(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/соглас/iu);
  });
});

/** @uc: UC-001 */
describe('заявка на вывоз с согласием на обработку персональных данных', () => {
  async function sendRequest(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await calculateConcrete(user);
    await selectLandfills(user, [VOSTOK.landfillName]);
    await user.click(screen.getByRole('button', { name: 'Заявка на вывоз' }));

    await user.type(await screen.findByLabelText('Имя'), 'Иван');
    await user.type(screen.getByLabelText('Телефон'), '+79161234567');
    await user.click(screen.getByRole('checkbox', { name: /Согласен на обработку персональных данных/u }));
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }));
  }

  it('подставляет выбранный полигон в поле «Полигон»', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);
    await selectLandfills(user, [VOSTOK.landfillName]);

    await user.click(screen.getByRole('button', { name: 'Заявка на вывоз' }));

    expect(await screen.findByLabelText('Полигон')).toHaveValue(VOSTOK.landfillName);
  });

  it('отправляет заявку с отмеченным согласием', async () => {
    const user = userEvent.setup();
    render(<App />);

    await sendRequest(user);

    await waitFor(() => {
      expect(stub.bodyOf('POST /v1/pickup-requests')['personalDataConsent']).toBe(true);
    });
  });

  it('подтверждает приём заявки словами', async () => {
    const user = userEvent.setup();
    render(<App />);

    await sendRequest(user);

    expect(await screen.findByText('Заявка принята')).toBeInTheDocument();
  });
});
