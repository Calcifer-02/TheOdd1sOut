/**
 * Ранее выпущенные предложения на экране предложения: отбор строк, доступ и
 * оба представления (решение заказчика от 24.09.2026).
 *
 * Проверки фальсифицируемы: покажите в перечне расчёт без выпущенного
 * предложения, запросите перечень без сессии участника, уроните экран вместе с
 * отказом службы по сессии, уберите объяснение о платформе MAX, снимите ссылку
 * со строки перечня или разверните перечень таблицей на телефоне — они упадут.
 *
 *   npx vitest run tests/QuoteHistory.test.tsx
 *
 * @ac: AC-036h
 * @supports: R-036, R-049, R-050, R-085
 */
import { configure, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QuotePage } from '@/pages/quote';
import { IDENTITY_FROM_MAX, forget, signIn } from '@/entities/participant';
import { CALCULATION_ID, QUOTE_NUMBER, installQuoteStub, type QuoteStub } from './stubs/quote';
import {
  ВТОРОЙ_АДРЕС,
  ВТОРОЙ_НОМЕР,
  НУЖНА_СЕССИЯ,
  РАСЧЁТ_БЕЗ_ПРЕДЛОЖЕНИЯ,
  РАСЧЁТ_С_ПРЕДЛОЖЕНИЕМ,
  СТАРТОВЫЕ_ПАРАМЕТРЫ,
  installHistoryStub,
  type HistoryStub,
} from './stubs/quoteHistory';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';

// Прогон идёт в несколько потоков на одной машине, и ожидание по умолчанию в
// одну секунду под нагрузкой истекает раньше, чем ответ заглушки доходит до
// разметки. Запас ожидания утверждения не меняет.
configure({ asyncUtilTimeout: 2000 });

/**
 * Неразрывный пробел — разделитель разрядов и отбивка знака рубля (R-061).
 * Записан кодом точки, а не самим знаком: невидимый символ в строке проверки
 * не отличить от обычного пробела при чтении.
 */
const NBSP = ' ';

const ЗАГОЛОВОК_ПЕРЕЧНЯ = 'Ранее выпущенные предложения';

/** Имя ссылки строки перечня: номер без предмета не говорит, что откроется. */
const ССЫЛКА_НА_ПЕРВОЕ = `Открыть предложение ${QUOTE_NUMBER}: ${РАСЧЁТ_С_ПРЕДЛОЖЕНИЕМ.pickupAddress}`;

let служба: QuoteStub;

let перечень: HistoryStub;

/** Опознание участника: без него перечень недоступен (ADR-0006). */
async function опознать(): Promise<void> {
  window.WebApp = { initData: СТАРТОВЫЕ_ПАРАМЕТРЫ };
  await signIn(true);
}

/**
 * Открывает экран предложения по расчёту и ждёт, пока документ соберётся.
 * Признак готовности — действие выпуска: оно есть у обоих представлений и
 * только в собранном состоянии экрана.
 */
async function открытьПредложение(): Promise<void> {
  window.history.replaceState(null, '', `#/quote?calc=${CALCULATION_ID}`);
  render(<QuotePage />);
  await screen.findByRole('button', { name: 'Выпустить предложение' });
}

/** Раздел перечня: у обоих представлений он подписан одинаково. */
function разделПеречня(): HTMLElement {
  return screen.getByRole('region', { name: ЗАГОЛОВОК_ПЕРЕЧНЯ });
}

beforeEach(() => {
  служба = installQuoteStub();
  // Надстройка ставится поверх: свои две точки она отвечает сама, остальное
  // уходит заглушке предложения.
  перечень = installHistoryStub();
});

afterEach(() => {
  forget();
  delete window.WebApp;
  перечень.restore();
  служба.restore();
});

describe('перечень ранее выпущенных предложений на рабочем месте', () => {
  beforeEach(() => {
    setViewportWidth(DESKTOP_WIDTH);
  });

  /** @ac: AC-036h */
  it('показывает номер, дату, адрес вывоза и сумму по каждому выпущенному предложению', async () => {
    await опознать();
    await открытьПредложение();

    const таблица = await screen.findByRole('table', { name: ЗАГОЛОВОК_ПЕРЕЧНЯ });
    const строка = within(таблица).getByRole('row', { name: new RegExp(ВТОРОЙ_НОМЕР, 'u') });

    expect(строка.textContent).toContain('18.09.2026');
    expect(строка.textContent).toContain(ВТОРОЙ_АДРЕС);
    expect(строка.textContent).toContain(`87${NBSP}840${NBSP}₽`);
  });

  /** @ac: AC-036h */
  it('расчёт без выпущенного предложения в перечень не попадает', async () => {
    await опознать();
    await открытьПредложение();

    const таблица = await screen.findByRole('table', { name: ЗАГОЛОВОК_ПЕРЕЧНЯ });

    // Две строки данных и строка заголовков: третий расчёт заглушки номера не
    // имеет, и выпущенным считать его нечем.
    expect(within(таблица).getAllByRole('row')).toHaveLength(3);
    expect(within(таблица).queryByText(РАСЧЁТ_БЕЗ_ПРЕДЛОЖЕНИЯ.pickupAddress)).toBeNull();
  });

  it('строка перечня ведёт на своё предложение', async () => {
    await опознать();
    await открытьПредложение();

    const таблица = await screen.findByRole('table', { name: ЗАГОЛОВОК_ПЕРЕЧНЯ });
    const ссылка = within(таблица).getByRole('link', { name: ССЫЛКА_НА_ПЕРВОЕ });

    expect(ссылка).toHaveAttribute('href', `#/quote?calc=${РАСЧЁТ_С_ПРЕДЛОЖЕНИЕМ.id}`);
  });
});

describe('перечень ранее выпущенных предложений на телефоне', () => {
  /** @ac: AC-036h */
  it('показан карточками: таблицы перечня в мобильном дереве нет', async () => {
    await опознать();
    await открытьПредложение();

    const раздел = разделПеречня();
    await within(раздел).findByRole('link', { name: ССЫЛКА_НА_ПЕРВОЕ });

    // Скрытая правилом оформления таблица осталась бы в дереве доступности
    // (R-085, AC-085a).
    expect(within(раздел).queryByRole('table')).toBeNull();
    expect(раздел.textContent).toContain(ВТОРОЙ_НОМЕР);
    expect(раздел.textContent).toContain(`87${NBSP}840${NBSP}₽`);
  });
});

describe('доступ к перечню', () => {
  /** @ac: AC-036h */
  it('неопознанному участнику названа причина, и перечень у службы не спрашивается', async () => {
    await открытьПредложение();

    expect(within(разделПеречня()).getByText(IDENTITY_FROM_MAX)).toBeInTheDocument();
    expect(перечень.listed, 'перечень запрошен без сессии участника').toEqual([]);
  });

  it('отказ службы по сессии заменяет перечень объяснением, а предложение остаётся на экране', async () => {
    перечень.answerWith({
      status: 401,
      headers: { 'content-type': 'application/problem+json' },
      body: НУЖНА_СЕССИЯ,
    });

    await опознать();
    await открытьПредложение();

    const раздел = разделПеречня();
    await waitFor(() => expect(раздел.textContent).toContain('платформа MAX'));

    // Слова службы «откройте мини-приложение в MAX» заказчик прочитал как
    // противоречие: мини-приложение уже открыто (BUG-012). Причину называет
    // экран, а код отказа наружу не выходит.
    expect(раздел.textContent).not.toContain('401');
    expect(раздел.textContent).not.toContain('urn:imolt');

    // Текущее предложение отказом в перечне не затронуто: это разные запросы.
    expect(screen.getByRole('button', { name: 'Выпустить предложение' })).toBeEnabled();
    expect(screen.getByRole('list', { name: 'Состав предложения' })).toBeInTheDocument();
  });
});

describe('экран предложения без расчёта в адресе', () => {
  /** @ac: AC-036h */
  it('опознанному участнику показывает перечень вместо тупика', async () => {
    await опознать();

    window.history.replaceState(null, '', '#/quote');
    render(<QuotePage />);

    expect(await screen.findByRole('link', { name: ССЫЛКА_НА_ПЕРВОЕ })).toBeInTheDocument();

    // Текущего предложения в этом состоянии нет, и выдумывать его нечем:
    // выпускать нечего, пока расчёт не назван.
    expect(screen.queryByRole('button', { name: 'Выпустить предложение' })).toBeNull();
    expect(служба.sentTo('GET /v1/calculations/:id'), 'расчёт запрошен без идентификатора').toEqual([]);
  });

  it('неопознанному участнику объясняет причину и оставляет путь к расчёту', async () => {
    window.history.replaceState(null, '', '#/quote');
    render(<QuotePage />);

    expect(await screen.findByText(/расчёт в ссылке не назван/u)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Вернуться к расчёту' })).toBeInTheDocument();
    expect(within(разделПеречня()).getByText(IDENTITY_FROM_MAX)).toBeInTheDocument();
    expect(перечень.listed).toEqual([]);
  });
});
