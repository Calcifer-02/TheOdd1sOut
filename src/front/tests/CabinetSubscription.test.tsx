/**
 * Подписка и заказ услуг по документации (экраны Э-09, Э-10).
 *
 * Что именно закрыто подпиской, заказчиком не установлено, поэтому проверена
 * форма разграничения: состояние объявлено и меняется заявкой. Согласие на
 * обработку персональных данных проверено отдельно — это условие отправки, а
 * не поле формы (R-054).
 *
 * Проверка фальсифицируема: она падает, если заявка или заказ уйдут без
 * согласия, если согласие подставится за участника, если ИНН не по образцу
 * договора уйдёт на службу и если услуга без цены покажется нулём.
 *
 *   npx vitest run tests/CabinetSubscription.test.tsx
 *
 * @supports: R-049, R-051, R-052, R-054
 */
import { configure, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CabinetPage } from '@/pages/cabinet';
import { forget, signIn } from '@/entities/participant';
import { installCabinetStub, СТАРТОВЫЕ_ПАРАМЕТРЫ, УСЛУГИ, type CabinetStub } from './stubs/cabinet';

// Прогон идёт в несколько потоков на одной машине, и ожидание по
// умолчанию в одну секунду под нагрузкой истекает раньше, чем ответ
// заглушки доходит до разметки. Запас ожидания утверждения не меняет.
configure({ asyncUtilTimeout: 2000 });

let служба: CabinetStub;

async function опознать(раздел: string): Promise<void> {
  window.history.replaceState(null, '', `#/cabinet?tab=${раздел}`);
  window.WebApp = { initData: СТАРТОВЫЕ_ПАРАМЕТРЫ };
  await signIn(true);
}

beforeEach(() => {
  служба = installCabinetStub();
});

afterEach(() => {
  forget();
  delete window.WebApp;
  служба.restore();
});

describe('заявка на подписку', () => {
  it('без согласия на обработку персональных данных не уходит', async () => {
    const пользователь = userEvent.setup();
    await опознать('subscription');
    render(<CabinetPage />);

    await пользователь.type(await screen.findByRole('textbox', { name: 'Название компании' }), 'ООО «Перевозчик»');
    await пользователь.type(screen.getByRole('textbox', { name: 'ИНН' }), '7701234567');
    await пользователь.click(screen.getByRole('button', { name: 'Оставить заявку на подписку' }));

    expect(служба.sentTo('POST /v1/subscription-requests'), 'заявка ушла без согласия участника').toEqual([]);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Без согласия на обработку персональных данных заявка не отправляется',
    );
  });

  it('ИНН не по образцу договора на службу не уходит', async () => {
    const пользователь = userEvent.setup();
    await опознать('subscription');
    render(<CabinetPage />);

    await пользователь.type(await screen.findByRole('textbox', { name: 'Название компании' }), 'ООО «Перевозчик»');
    await пользователь.type(screen.getByRole('textbox', { name: 'ИНН' }), '12345');
    await пользователь.click(screen.getByRole('checkbox', { name: 'Согласен на обработку персональных данных' }));
    await пользователь.click(screen.getByRole('button', { name: 'Оставить заявку на подписку' }));

    expect(служба.sentTo('POST /v1/subscription-requests')).toEqual([]);
    expect(await screen.findByText('ИНН записывается десятью либо двенадцатью цифрами')).toBeInTheDocument();
  });

  /** @ac: AC-051a */
  it('после согласия переводит подписку в состояние ожидания', async () => {
    const пользователь = userEvent.setup();
    await опознать('subscription');
    render(<CabinetPage />);

    await пользователь.type(await screen.findByRole('textbox', { name: 'Название компании' }), 'ООО «Перевозчик»');
    await пользователь.type(screen.getByRole('textbox', { name: 'ИНН' }), '7701234567');
    await пользователь.click(screen.getByRole('checkbox', { name: 'Транспорт зарегистрирован в АИС ОССиГ' }));
    await пользователь.click(screen.getByRole('checkbox', { name: 'Согласен на обработку персональных данных' }));
    await пользователь.click(screen.getByRole('button', { name: 'Оставить заявку на подписку' }));

    // Состояние названо словом и в полосе над разделом, и в самом разделе.
    expect(await screen.findAllByText('Ожидает подтверждения')).not.toHaveLength(0);

    // Повторная заявка ничего не меняет и только заводит вторую запись у
    // менеджера, поэтому форма уходит с экрана.
    expect(screen.queryByRole('button', { name: 'Оставить заявку на подписку' })).toBeNull();

    const тело = служба.bodyOf('POST /v1/subscription-requests');
    expect(тело.role).toBe('carrier');
    expect(тело.companyName).toBe('ООО «Перевозчик»');
    expect(тело.inn).toBe('7701234567');
    expect(тело.registeredInAisOssig).toBe(true);

    // Согласия схема договора здесь не принимает: лишнее поле отвергается
    // целиком (`additionalProperties: false`), и слать его нельзя.
    expect(тело.personalDataConsent, 'в заявке ушло поле, которого договор не объявляет').toBeUndefined();
  });
});

describe('каталог услуг по документации', () => {
  /** @ac: AC-052a */
  it('услугу без цены называет «по запросу», а не нулём', async () => {
    await опознать('services');
    render(<CabinetPage />);

    expect(await screen.findByText(/^от 50 000 ₽$/)).toBeInTheDocument();
    expect(await screen.findByText('по запросу')).toBeInTheDocument();
    expect(screen.queryByText(/^0 ₽$/), 'цена по запросу показана нулём').toBeNull();
  });

  /** @ac: AC-054c */
  it('заказ без согласия на обработку персональных данных не уходит', async () => {
    const пользователь = userEvent.setup();
    await опознать('services');
    render(<CabinetPage />);

    await пользователь.click(await screen.findByRole('button', { name: `Заказать: ${УСЛУГИ[0].name}` }));
    await пользователь.type(screen.getByRole('textbox', { name: 'Адрес объекта' }), 'г Москва, ул Годовикова, д 9');
    await пользователь.click(screen.getByRole('button', { name: `Отправить заказ: ${УСЛУГИ[0].name}` }));

    expect(служба.sentTo('POST /v1/document-service-orders'), 'заказ ушёл без согласия участника').toEqual([]);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Без согласия на обработку персональных данных заказ не отправляется',
    );
  });

  /** @ac: AC-052b */
  it('после согласия заказ уходит с адресом объекта и принимается службой', async () => {
    const пользователь = userEvent.setup();
    await опознать('services');
    render(<CabinetPage />);

    await пользователь.click(await screen.findByRole('button', { name: `Заказать: ${УСЛУГИ[0].name}` }));
    await пользователь.type(screen.getByRole('textbox', { name: 'Адрес объекта' }), 'г Москва, ул Годовикова, д 9');
    await пользователь.click(screen.getByRole('checkbox', { name: 'Согласен на обработку персональных данных' }));
    await пользователь.click(screen.getByRole('button', { name: `Отправить заказ: ${УСЛУГИ[0].name}` }));

    expect(await screen.findByText('Заказ принят, менеджер свяжется в течение рабочего дня')).toBeInTheDocument();

    const тело = служба.bodyOf('POST /v1/document-service-orders');
    expect(тело.serviceId).toBe(УСЛУГИ[0].id);
    expect(тело.objectAddress).toBe('г Москва, ул Годовикова, д 9');
    expect(тело.personalDataConsent).toBe(true);
  });
});
