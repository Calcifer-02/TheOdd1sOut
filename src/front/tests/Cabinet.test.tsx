/**
 * Кабинет на телефоне: доступ, разделы в адресе и отказ службы (Э-09, Э-10).
 *
 * Проверка фальсифицируема: она падает, если кабинет покажет данные
 * участника без сессии, если объяснение входа исчезнет, если открытый раздел
 * перестанет восстанавливаться из адреса и если отказ службы выйдет на экран
 * кодом причины вместо заголовка.
 *
 *   npx vitest run tests/Cabinet.test.tsx
 *
 * @supports: R-049, R-050
 */
import { configure, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CabinetPage } from '@/pages/cabinet';
import { forget, signIn } from '@/entities/participant';
import {
  installCabinetStub,
  отказ,
  АДРЕС_ВЫВОЗА,
  СТАРТОВЫЕ_ПАРАМЕТРЫ,
  type CabinetStub,
} from './stubs/cabinet';

// Прогон идёт в несколько потоков на одной машине, и ожидание по
// умолчанию в одну секунду под нагрузкой истекает раньше, чем ответ
// заглушки доходит до разметки. Запас ожидания утверждения не меняет.
configure({ asyncUtilTimeout: 2000 });

let служба: CabinetStub;

/** Опознание участника: без него кабинет данных не показывает (ADR-0006). */
async function опознать(): Promise<void> {
  window.WebApp = { initData: СТАРТОВЫЕ_ПАРАМЕТРЫ };
  await signIn(true);
}

/** Адрес страницы до отрисовки: раздел кабинета живёт в нём (PRACT-016). */
function открытьАдрес(hash: string): void {
  window.history.replaceState(null, '', hash);
}

beforeEach(() => {
  служба = installCabinetStub();
});

afterEach(() => {
  forget();
  delete window.WebApp;
  служба.restore();
});

describe('кабинет на телефоне', () => {
  it('без сессии не показывает данных участника и объясняет, как войти', () => {
    render(<CabinetPage />);

    expect(
      screen.getByRole('heading', { name: 'Кабинет открывается из переписки' }),
    ).toBeInTheDocument();

    const ссылка = screen.getByRole('link', { name: 'Открыть чат-бота ИМОЛТ' });
    expect(ссылка).toHaveAttribute('href', 'https://max.ru/t782_hakaton_max_bot');

    // Ни одного обращения к закрытым операциям: без сессии спрашивать нечего,
    // а чужих данных на экране быть не может (R-050).
    expect(служба.sentTo('GET /v1/profile'), 'профиль запрошен без сессии').toEqual([]);
    expect(служба.sentTo('GET /v1/calculations'), 'расчёты запрошены без сессии').toEqual([]);
    expect(screen.queryByText(АДРЕС_ВЫВОЗА)).toBeNull();
  });

  it('формы входа по телефону с кодом не показывает: своего входа у сервиса нет', () => {
    render(<CabinetPage />);

    expect(screen.queryByLabelText(/Телефон/)).toBeNull();
    expect(screen.queryByLabelText(/Код/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Получить код/ })).toBeNull();
  });

  it('открытое из переписки приложение открывает кабинет после согласия', async () => {
    const пользователь = userEvent.setup();
    window.WebApp = { initData: СТАРТОВЫЕ_ПАРАМЕТРЫ };
    render(<CabinetPage />);

    await пользователь.click(
      screen.getByRole('checkbox', { name: 'Согласен на обработку персональных данных' }),
    );
    await пользователь.click(screen.getByRole('button', { name: 'Открыть кабинет' }));

    expect(
      await screen.findByRole('link', { name: `Открыть расчёт: ${АДРЕС_ВЫВОЗА}` }),
    ).toBeInTheDocument();

    // Строка уходит как есть: подпись проверяется только по исходной строке,
    // и разобранный браузером объект личностью не считается (ADR-0006).
    const тело = служба.bodyOf('POST /v1/auth/sessions');
    expect(тело.initData).toBe(СТАРТОВЫЕ_ПАРАМЕТРЫ);
    expect(тело.personalDataConsent).toBe(true);
  });

  it('после опознания показывает сохранённые расчёты карточками, а не таблицей', async () => {
    await опознать();
    render(<CabinetPage />);

    expect(
      await screen.findByRole('link', { name: `Открыть расчёт: ${АДРЕС_ВЫВОЗА}` }),
    ).toBeInTheDocument();

    // Узкая ширина окна — карточки: таблица на телефоне превращается в одну
    // колонку с горизонтальной прокруткой (дизайн-договор, разд. 4.5).
    expect(screen.queryByRole('table'), 'на телефоне показана таблица').toBeNull();
  });

  it('открытый раздел восстанавливается из адреса ссылки', async () => {
    открытьАдрес('#/cabinet?tab=services');
    await опознать();
    render(<CabinetPage />);

    expect(
      await screen.findByRole('heading', { name: 'Услуги по документации' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Расчёты' })).toBeNull();
  });

  it('переход в раздел записывает раздел в адрес', async () => {
    const пользователь = userEvent.setup();
    открытьАдрес('#/cabinet');
    await опознать();
    render(<CabinetPage />);

    await пользователь.click(await screen.findByRole('tab', { name: 'Подписка' }));

    expect(
      await screen.findByRole('heading', { name: 'Подписка' }),
    ).toBeInTheDocument();
    expect(window.location.hash, 'раздел не попал в адрес').toContain('tab=subscription');
  });

  it('отказ службы показан заголовком, а не кодом причины', async () => {
    служба.answerWith('GET /v1/calculations', {
      status: 503,
      headers: { 'content-type': 'application/problem+json' },
      body: отказ('upstream-unavailable', 'Служба расчёта временно недоступна', 503),
    });

    await опознать();
    render(<CabinetPage />);

    const сообщение = await screen.findByRole('alert');
    expect(сообщение).toHaveTextContent('Служба расчёта временно недоступна');
    expect(сообщение.textContent, 'код причины вышел на экран').not.toContain('urn:imolt');
  });
});
