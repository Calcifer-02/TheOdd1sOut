/**
 * Представление компании на базовой странице (R-087).
 *
 * Базовая страница отвечает не только на вопрос «сколько», но и на «кто это»,
 * «что уже сделано» и «как связаться». Проверки спрашивают страницу по ролям и
 * доступным именам: раздел без заголовка, ссылка без адреса и картинка без
 * подписи роняют проверку, а не обходятся селектором по классу.
 *
 * Отдельно держится честность содержимого: раздел клиентов не выдумывает
 * названий организаций, а у начальных цен названы источник и дата.
 *
 * Проверки фальсифицируемы: уберите раздел со страницы, снимите цену у услуги,
 * снимите объём или рисунок у проекта, заполните раздел клиентов выдуманными
 * именами, оставьте контакты обычным текстом вместо ссылок, сделайте логотип
 * снова надписью — упадёт именно та проверка, которая об этом говорит.
 *
 *   npx vitest run tests/CompanyProfile.test.tsx
 *
 * @ac: AC-087a, AC-087b, AC-087c, AC-087d, AC-087e
 */
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { COMPANY_PROJECTS, COMPANY_SERVICES } from '@/widgets/company-profile';
import type { ApiStub } from './apiStub';
import { installApiStub } from './apiStub';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';

let stub: ApiStub;

beforeEach(() => {
  stub = installApiStub();
  setViewportWidth(DESKTOP_WIDTH);
  window.location.hash = '#/';
});

afterEach(() => {
  stub.restore();
  window.location.hash = '';
});

/** Раздел базовой страницы по его заголовку. */
function раздел(title: string): HTMLElement {
  return screen.getByRole('region', { name: title });
}

describe('услуги компании на базовой странице', () => {
  it('перечисляет каждую услугу с начальной ценой', () => {
    render(<App />);

    const услуги = раздел('Наши услуги');

    for (const service of COMPANY_SERVICES) {
      const название = within(услуги).getByText(service.name);
      const карточка = название.closest('.imolt-company-service');

      // Цена спрашивается внутри карточки своей услуги: у двух услуг она
      // совпадает, и поиск по всему разделу нашёл бы чужую.
      expect(карточка, `услуга «${service.name}» не названа`).not.toBeNull();
      expect(карточка?.textContent, 'цена без числа — не обещание, а намёк').toContain(service.price);
    }
  });

  it('называет источник и дату начальных цен', () => {
    // Цена без даты — обещание без срока годности, а без источника её нечем
    // подтвердить (AC-087a).
    render(<App />);

    const услуги = раздел('Наши услуги');

    expect(within(услуги).getByText(/имолт\.рф/u)).toBeInTheDocument();
    expect(within(услуги).getByText(/24\.09\.2026/u)).toBeInTheDocument();
  });

  it('разводит прейскурант компании и итог расчёта', () => {
    // «от 400 ₽ за м³» — обещание входа, итог расчёта — цена конкретного
    // вывоза. Слитые в одно, эти числа обманывают читателя.
    render(<App />);

    expect(within(раздел('Наши услуги')).getByText(/от этих цен не зависит/u)).toBeInTheDocument();
  });
});

describe('выполненные проекты на базовой странице', () => {
  it('показывает каждый проект с объёмом работ', () => {
    render(<App />);

    const проекты = раздел('Выполненные проекты');

    for (const project of COMPANY_PROJECTS) {
      expect(within(проекты).getByText(project.name), `проект «${project.name}» не назван`).toBeInTheDocument();
    }

    expect(within(проекты).getByText('122 000 м³'), 'объём работ — главное число проекта').toBeInTheDocument();
    expect(within(проекты).getByText('70 000 т грунта')).toBeInTheDocument();
  });

  it('даёт каждому проекту рисунок, не несущий смысла в одиночку', () => {
    // Рисунок сопровождает подпись: он скрыт от вспомогательной технологии,
    // а смысл несут название и объём рядом (AC-087b, разд. 4.5).
    render(<App />);

    const рисунки = раздел('Выполненные проекты').querySelectorAll('.imolt-illustration');

    expect(рисунки).toHaveLength(COMPANY_PROJECTS.length);
    for (const рисунок of рисунки) {
      expect(рисунок).toHaveAttribute('aria-hidden', 'true');
    }
  });
});

describe('клиенты компании на базовой странице', () => {
  it('называет, что перечень ожидается от компании', () => {
    render(<App />);

    expect(within(раздел('Наши клиенты')).getByText(/ожидается от компании/u)).toBeInTheDocument();
  });

  it('не показывает ни одного названия организации', () => {
    // Выдуманное название клиента — не заглушка, а ложное утверждение о
    // реальном юридическом лице (AC-087c, Q-026).
    render(<App />);

    const текст = раздел('Наши клиенты').textContent ?? '';

    expect(текст, 'организационная форма в разделе клиентов означает выдуманное имя').not.toMatch(
      /ООО|АО|ЗАО|ПАО|ИП\s/u,
    );
  });
});

describe('контакты компании на базовой странице', () => {
  it('открывает телефон и почту нажатием', () => {
    render(<App />);

    const контакты = раздел('Наши контакты');

    expect(within(контакты).getByRole('link', { name: '+7 495 532 02 73' })).toHaveAttribute(
      'href',
      'tel:+74955320273',
    );
    expect(within(контакты).getByRole('link', { name: 'hello@imolt.com' })).toHaveAttribute(
      'href',
      'mailto:hello@imolt.com',
    );
  });
});

describe('возврат на базовую страницу', () => {
  it('логотип в шапке — ссылка на базовую страницу', () => {
    // С экрана справочника или редактора цен возврата не было вовсе: читатель
    // искал вкладку или правил адрес руками (AC-087e, BUG-029).
    window.location.hash = '#/landfills';
    render(<App />);

    expect(screen.getByRole('link', { name: 'ИМОЛТ' })).toHaveAttribute('href', '#');
  });

  it('на самой базовой странице логотип объявлен текущей страницей', () => {
    render(<App />);

    expect(screen.getByRole('link', { name: 'ИМОЛТ' })).toHaveAttribute('aria-current', 'page');
  });
});
