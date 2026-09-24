/**
 * Карточка полигона: подробности, история юридических лиц, отзывы и новый
 * отзыв.
 *
 * Карточка отвечает на вопрос «что известно об этом полигоне»: тарифы по всем
 * принимаемым группам, кто владелец сейчас и кто был раньше, что о
 * достоверности сведений говорят те, кто туда ездил (R-031, R-041).
 *
 * Проверки фальсифицируемы: посчитайте среднюю оценку в браузере вместо того,
 * чтобы взять её у службы; дайте отправить отзыв без оценки; покажите код
 * отказа вместо заголовка; потеряйте историю юридических лиц — падает именно
 * та проверка, которая об этом говорит.
 *
 *   npx vitest run tests/LandfillsCard.test.tsx
 *
 * Критерии AC-031a, AC-031b и AC-041a сформулированы как обращения к службе и
 * проверяются на её стороне; критерия на карточку в интерфейсе в реестре нет.
 *
 * @supports: R-031, R-040, R-041, R-048
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LandfillsPage } from '@/pages/landfills';
import { IDENTITY_FROM_MAX, READING_OPEN } from '@/entities/participant';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';
import {
  IKSHA,
  SESSION_REQUIRED,
  VOSTOK,
  installReferencesStub,
  type ReferencesStub,
} from './stubs/references';

const КАРТОЧКА_ВОСТОКА = '#/landfills?landfill=vostok-timohovo';

const PROBLEM_HEADERS = { 'content-type': 'application/problem+json' };

let служба: ReferencesStub;

function открыть(адрес: string): void {
  window.history.replaceState(null, '', адрес);
}

/** Ожидание карточки: её заголовок — имя полигона. */
function заголовокКарточки(имя: string) {
  return screen.findByRole('heading', { name: имя });
}

/**
 * Запросы внутри карточки. Список справочника показывает те же тарифы, и без
 * ограничения областью проверка утверждала бы о любом из них.
 */
function вКарточке(имя: string) {
  return within(screen.getByRole('region', { name: имя }));
}

beforeEach(() => {
  служба = installReferencesStub();
  открыть('#/landfills');
});

afterEach(() => {
  служба.restore();
});

describe('переход к карточке полигона', () => {
  it('на телефоне нажатие на название полигона открывает карточку и кладёт её в адрес', async () => {
    const пользователь = userEvent.setup();
    render(<LandfillsPage />);

    const название = await screen.findByRole('button', { name: VOSTOK.name });
    await пользователь.click(название);

    expect(window.location.hash).toContain('landfill=vostok-timohovo');
    expect(await заголовокКарточки(VOSTOK.name)).toBeInTheDocument();
  });

  it('на рабочем месте карточка открывается из строки таблицы', async () => {
    const пользователь = userEvent.setup();
    setViewportWidth(DESKTOP_WIDTH);
    render(<LandfillsPage />);

    await screen.findByRole('table', { name: /Полигоны справочника/ });
    await пользователь.click(screen.getByRole('button', { name: IKSHA.name }));

    expect(window.location.hash).toContain('landfill=iksha');
    expect(await заголовокКарточки(IKSHA.name)).toBeInTheDocument();
  });

  it('закрытие карточки убирает её из адреса и оставляет прежний отбор', async () => {
    const пользователь = userEvent.setup();
    открыть('#/landfills?group=beton-lom&landfill=vostok-timohovo');
    render(<LandfillsPage />);

    await заголовокКарточки(VOSTOK.name);
    await пользователь.click(screen.getByRole('button', { name: 'Закрыть карточку' }));

    expect(window.location.hash).not.toContain('landfill=');
    expect(window.location.hash).toContain('group=beton-lom');
  });

  it('карточка полигона, которого нет в реестре, показывает заголовок отказа, а не код', async () => {
    открыть('#/landfills?landfill=neizvestnyi');
    render(<LandfillsPage />);

    const отказ = await screen.findByRole('alert');

    expect(отказ).toHaveTextContent('Запись не найдена');
    expect(отказ.textContent).not.toContain('404');
  });
});

describe('содержимое карточки полигона', () => {
  it('карточка показывает историю юридических лиц и не теряет накопленные тарифы', async () => {
    открыть(КАРТОЧКА_ВОСТОКА);
    render(<LandfillsPage />);

    await заголовокКарточки(VOSTOK.name);

    const карточка = вКарточке(VOSTOK.name);
    const история = карточка.getByRole('list', { name: 'История юридических лиц' });
    expect(история).toHaveTextContent('ООО «Тимохово»');
    expect(история).toHaveTextContent('01.01.2023');
    expect(история).toHaveTextContent('ООО «Восток»');

    // Тарифы по всем трём принимаемым группам остаются на месте (AC-041a).
    expect(карточка.getByText('450 ₽/т')).toBeInTheDocument();
    expect(карточка.getByText('300 ₽/т')).toBeInTheDocument();
    expect(карточка.getByText('420 ₽/т')).toBeInTheDocument();
  });

  it('карточка называет дату актуальности каждого тарифа, а не только общую', async () => {
    открыть(КАРТОЧКА_ВОСТОКА);
    render(<LandfillsPage />);

    await заголовокКарточки(VOSTOK.name);

    expect(вКарточке(VOSTOK.name).getAllByText('Обновлено 17.09.2026')).toHaveLength(
      VOSTOK.tariffs.length,
    );
  });

  it('карточка заблокированного полигона предупреждает о недопустимости вывоза', async () => {
    служба.setLandfills([{ ...VOSTOK, status: 'blocked' }]);
    открыть(КАРТОЧКА_ВОСТОКА);
    render(<LandfillsPage />);

    await заголовокКарточки(VOSTOK.name);

    expect(
      screen.getByText('Полигон заблокирован: вывоз на него сейчас недопустим'),
    ).toBeInTheDocument();
  });
});

describe('отзывы о полигоне', () => {
  it('средняя оценка взята из ответа службы, а не пересчитана в браузере', async () => {
    // Оценки отзывов 4 и 5, а средняя службы — 3. Число заведомо расходится со
    // средним арифметическим: так видно, что экран показывает ответ службы, а
    // не считает сам (AC-031a).
    служба.setReviews(
      VOSTOK.id,
      [
        {
          id: 'review-1',
          landfillId: VOSTOK.id,
          rating: 4,
          text: 'статус совпал с действительностью',
          createdAt: '2026-09-16T09:05:00+03:00',
        },
        {
          id: 'review-2',
          landfillId: VOSTOK.id,
          rating: 5,
          text: null,
          createdAt: '2026-09-15T18:40:00+03:00',
        },
      ],
      3,
    );
    открыть(КАРТОЧКА_ВОСТОКА);
    render(<LandfillsPage />);

    await заголовокКарточки(VOSTOK.name);

    expect(await screen.findByText('3 из 5')).toBeInTheDocument();
    expect(screen.getByText('4 из 5')).toBeInTheDocument();
    expect(screen.getByText('5 из 5')).toBeInTheDocument();
  });

  it('у полигона без отзывов средняя оценка названа отсутствующей, а не нулём', async () => {
    открыть(КАРТОЧКА_ВОСТОКА);
    render(<LandfillsPage />);

    await заголовокКарточки(VOSTOK.name);

    expect(await screen.findByText('Оценок пока нет')).toBeInTheDocument();
    expect(screen.queryByText('0 из 5')).toBeNull();
    expect(screen.getByText('Отзывов пока нет')).toBeInTheDocument();
  });

  it('отзыв без оценки не уходит в службу и называет причину отказа', async () => {
    const пользователь = userEvent.setup();
    открыть(КАРТОЧКА_ВОСТОКА);
    render(<LandfillsPage />);

    await заголовокКарточки(VOSTOK.name);
    await пользователь.click(screen.getByRole('button', { name: 'Отправить отзыв' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Укажите оценку: без неё отзыв не попадёт в среднюю',
    );
    expect(служба.sentTo('POST /v1/landfills/:id/reviews')).toHaveLength(0);
  });

  it('отзыв с оценкой уходит в службу и обновляет среднюю её ответом', async () => {
    const пользователь = userEvent.setup();
    открыть(КАРТОЧКА_ВОСТОКА);
    render(<LandfillsPage />);

    await заголовокКарточки(VOSTOK.name);
    const прочитано = служба.sentTo('GET /v1/landfills/:id/reviews').length;

    await пользователь.click(screen.getByRole('radio', { name: '4' }));
    await пользователь.click(screen.getByRole('button', { name: 'Отправить отзыв' }));

    expect(await screen.findByText('Отзыв принят')).toBeInTheDocument();
    expect(служба.bodyOf('POST /v1/landfills/:id/reviews')).toEqual({ rating: 4 });
    // Средняя перечитана у службы, а не досчитана на месте.
    expect(служба.sentTo('GET /v1/landfills/:id/reviews').length).toBeGreaterThan(прочитано);
    expect(screen.getAllByText('4 из 5')).toHaveLength(2);
  });

  it('пояснение отзыва уходит вместе с оценкой, когда оно написано', async () => {
    const пользователь = userEvent.setup();
    открыть(КАРТОЧКА_ВОСТОКА);
    render(<LandfillsPage />);

    await заголовокКарточки(VOSTOK.name);

    await пользователь.click(screen.getByRole('radio', { name: '2' }));
    await пользователь.type(
      screen.getByRole('textbox', { name: 'Что не сошлось с действительностью' }),
      'тариф на месте оказался выше',
    );
    await пользователь.click(screen.getByRole('button', { name: 'Отправить отзыв' }));

    await screen.findByText('Отзыв принят');
    expect(служба.bodyOf('POST /v1/landfills/:id/reviews')).toEqual({
      rating: 2,
      text: 'тариф на месте оказался выше',
    });
  });

  it('отказ службы при отправке отзыва показан заголовком, а не кодом', async () => {
    const пользователь = userEvent.setup();
    служба.answerWith('POST /v1/landfills/:id/reviews', {
      status: 401,
      headers: PROBLEM_HEADERS,
      body: SESSION_REQUIRED,
    });
    открыть(КАРТОЧКА_ВОСТОКА);
    render(<LandfillsPage />);

    await заголовокКарточки(VOSTOK.name);
    await пользователь.click(screen.getByRole('radio', { name: '5' }));
    await пользователь.click(screen.getByRole('button', { name: 'Отправить отзыв' }));

    const отказ = await screen.findByRole('alert');

    expect(отказ).toHaveTextContent('Нужна сессия участника');
    expect(отказ.textContent).not.toContain('401');
  });

  // Один заголовок «Нужна сессия участника» ничего не объясняет: сервис
  // открывается и в браузере, и в MAX, и человек не понимает, чего от него
  // хотят. Причина называется теми же словами, что в редакторе цен, — текст
  // живёт у сущности «участник» и в проекте один (BUG-012, ADR-0006).
  it('отказ по сессии называет причину, а не только заголовок службы', async () => {
    const пользователь = userEvent.setup();
    служба.answerWith('POST /v1/landfills/:id/reviews', {
      status: 401,
      headers: PROBLEM_HEADERS,
      body: SESSION_REQUIRED,
    });
    открыть(КАРТОЧКА_ВОСТОКА);
    render(<LandfillsPage />);

    await заголовокКарточки(VOSTOK.name);
    await пользователь.click(screen.getByRole('radio', { name: '5' }));
    await пользователь.click(screen.getByRole('button', { name: 'Отправить отзыв' }));

    const отказ = await screen.findByRole('alert');

    expect(отказ.textContent, 'причина отказа не названа').toContain(IDENTITY_FROM_MAX);
    expect(отказ.textContent, 'не сказано, что чтение осталось открытым').toContain(READING_OPEN);
    expect(
      отказ.textContent,
      'экран советует открыть мини-приложение, которое уже открыто',
    ).not.toContain('откройте мини-приложение');
  });
});
