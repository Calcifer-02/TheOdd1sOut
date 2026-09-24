// Экран коммерческого предложения: оба представления, выпуск номера, снимок
// цен, предварительность и отказы (R-036, R-037, R-038, R-059).
//
// Видимые тексты сверяются с макетами «ux/КП.dc.html» и «ux/КП мобильный.
// dc.html». Суммы сверяются посимвольно, через textContent: неразрывный
// пробел — часть требования R-061, и обычный пробел его не заменяет.
//
// Проверки фальсифицируемы: выпустите предложение при открытии экрана,
// сложите итог из строк вместо ответа службы, выпустите второе предложение
// при повторном скачивании, покажите код отказа вместо заголовка, уберите
// слово «предварительная» или оставьте пустой экран без расчёта в адресе —
// они упадут.
//
//   npx vitest run tests/QuoteScreen.test.tsx
//
// @ac: AC-036e
// @supports: R-036, R-037, R-038, R-059
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QuotePage } from '@/pages/quote';
import {
  CALCULATION_ID,
  QUOTE_ID,
  QUOTE_NUMBER,
  calculationWithAllocation,
  calculationWithoutSelection,
  installQuoteStub,
  problem,
  type QuoteStub,
} from './stubs/quote';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';

/** Неразрывный пробел U+00A0 — разделитель разрядов и отбивка знака рубля. */
const NBSP = ' ';

/** Вид номера предложения: «КП-2026-0924-001» (`QuoteNumber` расчётной части). */
const NUMBER_PATTERN = /КП-\d{4}-\d{4}-\d{3}/gu;

let stub: QuoteStub;

beforeEach(() => {
  stub = installQuoteStub();
});

afterEach(() => {
  stub.restore();
});

/** Открывает экран предложения по расчёту и ждёт, пока состав появится. */
async function openQuote(): Promise<void> {
  window.history.replaceState(null, '', `#/quote?calc=${CALCULATION_ID}`);
  render(<QuotePage />);
  await screen.findByText('Адрес вывоза');
}

function issueButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Выпустить предложение' });
}

function issuedQuotes(): number {
  return stub.sentTo('POST /v1/calculations/:id/quotes').length;
}

describe('экран коммерческого предложения без расчёта в адресе', () => {
  it('объясняет, где взять предложение, и к службе не обращается', async () => {
    window.history.replaceState(null, '', '#/quote');
    render(<QuotePage />);

    expect(await screen.findByText(/расчёт в ссылке не назван/u)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Вернуться к расчёту' })).toBeInTheDocument();
    expect(stub.requests).toEqual([]);
  });
});

describe('экран предложения на широком экране', () => {
  beforeEach(() => {
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('показывает состав таблицей с суммами и расстояниями из ответа расчёта', async () => {
    await openQuote();

    const table = await screen.findByRole('table', { name: 'Состав предложения' });
    const concrete = within(table).getByRole('row', { name: /Лом бетона и железобетона/u });

    expect(concrete.textContent).toContain(`20${NBSP}т`);
    expect(concrete.textContent).toContain(`45${NBSP}км`);
    expect(concrete.textContent).toContain(`10${NBSP}800${NBSP}₽`);
    expect(concrete.textContent).toContain(`9${NBSP}000${NBSP}₽`);
    expect(concrete.textContent).toContain(`19${NBSP}800${NBSP}₽`);
    expect(concrete.textContent).toContain('Комплекс переработки «Восток»');

    // Пересчёт кубометров в тонны показан рядом с введённой мерой, а не
    // вместо неё: пользователь вводил 15 м³ (R-015).
    const wood = within(table).getByRole('row', { name: /Древесина от разборки/u });
    expect(wood.textContent).toContain(`15${NBSP}м³ ≈ 7,5${NBSP}т`);

    const footer = within(table).getByRole('row', { name: /^Итого/u });
    expect(footer.textContent).toContain(`27${NBSP}450${NBSP}₽`);
  });

  it('распределение объёма даёт по строке на каждую долю одной группы отходов', async () => {
    stub.setCalculation(calculationWithAllocation());
    await openQuote();

    const table = await screen.findByRole('table', { name: 'Состав предложения' });
    const parts = within(table).getAllByRole('row', { name: /Лом бетона и железобетона/u });

    expect(parts).toHaveLength(2);
    expect(parts[0].textContent).toContain(`12${NBSP}т`);
    expect(parts[1].textContent).toContain(`8${NBSP}т`);

    const footer = within(table).getByRole('row', { name: /^Итого/u });
    expect(footer.textContent).toContain(`19${NBSP}912${NBSP}₽`);
  });
});

describe('экран предложения на телефоне', () => {
  it('показывает тот же состав карточками, а действия — нижней панелью', async () => {
    await openQuote();

    // Таблицы в мобильном дереве нет вовсе: скрытая правилом оформления ветка
    // осталась бы в дереве доступности (дизайн-договор, разд. 4.5).
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    const cards = await screen.findByRole('list', { name: 'Состав предложения' });
    const items = within(cards).getAllByRole('listitem');

    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Лом бетона и железобетона');
    expect(items[0].textContent).toContain(`19${NBSP}800${NBSP}₽`);
    expect(items[0].textContent).toContain(`45${NBSP}км`);

    const bar = screen.getByRole('group', { name: 'Действия с предложением' });
    expect(within(bar).getByRole('button', { name: 'Выпустить предложение' })).toBeInTheDocument();
    expect(bar.textContent).toContain(`27${NBSP}450${NBSP}₽`);
  });
});

describe('выпуск предложения', () => {
  it('при открытии экрана номер не выпускается', async () => {
    await openQuote();

    expect(issuedQuotes()).toBe(0);
    expect(issueButton()).toBeEnabled();
    expect(
      screen.getByText('Номер присваивается при выпуске', { selector: 'span' }),
    ).toBeInTheDocument();
  });

  it('по нажатию показывает номер, дату выпуска и срок действия из ответа службы', async () => {
    const user = userEvent.setup();
    await openQuote();
    await user.click(issueButton());

    expect(await screen.findByText(`№ ${QUOTE_NUMBER}`)).toBeInTheDocument();
    expect(screen.getByText('24.09.2026')).toBeInTheDocument();

    const validity = screen.getByText('Срок действия').parentElement;
    expect(validity?.textContent).toContain('до 01.10.2026');
    expect(issuedQuotes()).toBe(1);
  });

  /** @ac: AC-036e */
  it('повторное скачивание не отправляет второго запроса на выпуск', async () => {
    const user = userEvent.setup();
    await openQuote();
    await user.click(issueButton());

    const download = await screen.findByRole('link', { name: 'Скачать файл' });
    expect(download).toHaveAttribute('href', `/api/v1/quotes/${QUOTE_ID}/document`);

    await user.click(download);
    await user.click(download);

    expect(issuedQuotes()).toBe(1);
    // Выпустить второй раз попросту нечем: кнопки выпуска на экране больше нет.
    expect(screen.queryByRole('button', { name: 'Выпустить предложение' })).not.toBeInTheDocument();
    // Второго номера на экране не появилось — он на экране ровно один.
    expect(document.body.textContent?.match(NUMBER_PATTERN)).toEqual([QUOTE_NUMBER]);
  });

  it('итог берётся из ответа о предложении, а не складывается из строк состава', async () => {
    const user = userEvent.setup();

    // Снимок цен на момент выпуска отличается от нынешнего справочника: так
    // бывает, когда цены обновились после выпуска (R-037). Документ обязан
    // остаться прежним, поэтому экран показывает итог предложения, а не сумму
    // строк расчёта.
    stub.answerWith('POST /v1/calculations/:id/quotes', {
      status: 201,
      body: {
        id: QUOTE_ID,
        number: QUOTE_NUMBER,
        issuedAt: '2026-09-24T12:04:00+03:00',
        validUntil: '2026-10-01',
        total: { amount: '25100.00', currency: 'RUB' },
        preliminary: true,
        documentUrl: `/v1/quotes/${QUOTE_ID}/document`,
      },
    });

    await openQuote();
    await user.click(issueButton());
    await screen.findByRole('link', { name: 'Скачать файл' });

    const bar = screen.getByRole('group', { name: 'Действия с предложением' });
    expect(bar.textContent).toContain(`25${NBSP}100${NBSP}₽`);
    expect(bar.textContent).not.toContain(`27${NBSP}450${NBSP}₽`);
  });

  it('расчёт без выбранных полигонов выпустить нельзя, и это сказано словом', async () => {
    stub.setCalculation(calculationWithoutSelection());
    await openQuote();

    expect(
      await screen.findByText('В расчёте не выбрано ни одного полигона'),
    ).toBeInTheDocument();
    expect(issueButton()).toBeDisabled();
    expect(issuedQuotes()).toBe(0);
  });

  it('отказ службы при выпуске показан заголовком и оставляет возможность повторить', async () => {
    const user = userEvent.setup();

    stub.answerWith('POST /v1/calculations/:id/quotes', {
      status: 503,
      body: problem(
        'urn:imolt:problem:upstream-unavailable',
        'Не удалось собрать документ',
        503,
        'Повторите попытку',
      ),
    });

    await openQuote();
    await user.click(issueButton());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Не удалось собрать документ');
    expect(alert.textContent).not.toContain('503');
    expect(alert.textContent).not.toContain('urn:imolt');

    expect(issueButton()).toBeEnabled();
    await user.click(issueButton());
    await waitFor(() => expect(issuedQuotes()).toBe(2));
  });
});

describe('предварительность цены', () => {
  it('названа словом на экране, а не подразумевается', async () => {
    await openQuote();

    expect(screen.getByText('Цена предварительная')).toBeInTheDocument();
    expect(screen.getByText(/не является публичной офертой/u)).toBeInTheDocument();
  });

  it('после выпуска называет дату, до которой цена закреплена', async () => {
    const user = userEvent.setup();
    await openQuote();
    await user.click(issueButton());

    await screen.findByRole('link', { name: 'Скачать файл' });
    expect(screen.getByText(/Цена закреплена до/u)).toBeInTheDocument();
  });
});

describe('отказ в загрузке расчёта', () => {
  it('показан заголовком отказа, а не его кодом, и повторяется по кнопке', async () => {
    const user = userEvent.setup();
    stub.setCalculation(null);

    window.history.replaceState(null, '', `#/quote?calc=${CALCULATION_ID}`);
    render(<QuotePage />);

    expect(await screen.findByRole('heading', { name: 'Запись не найдена' })).toBeInTheDocument();
    expect(screen.queryByText(/404/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/urn:imolt/u)).not.toBeInTheDocument();

    expect(stub.sentTo('GET /v1/calculations/:id')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Повторить' }));

    await waitFor(() => expect(stub.sentTo('GET /v1/calculations/:id')).toHaveLength(2));
  });
});
