/**
 * Представление компании на базовой странице: услуги, выполненные проекты,
 * клиенты и контакты.
 *
 * Базовая страница — первое, что видит пришедший по ссылке. Форма расчёта
 * отвечает на вопрос «сколько», но не отвечает на «кто это», «что уже
 * сделано» и «как связаться»: без ответов расчёт выглядит формой без хозяина,
 * и заявку по нему не оставляют (R-087, замечание заказчика от 24.09.2026).
 *
 * Представление одно на оба размера окна: разделы стоят друг под другом, а
 * число колонок внутри раздела меняет правило стиля. Разного дерева разметки
 * здесь не нужно, и заводить его ради единообразия нельзя — скрытая ветка
 * осталась бы в дереве доступности (R-085).
 *
 * Содержимое берётся из одного модуля сведений: второй перечень услуг в
 * разметке разошёлся бы с первым молча (ADR-0008, инвариант 1).
 *
 * @req: R-087
 * @adr: ADR-0008
 */
import { useStyles } from '@/shared/ui';
import { Illustration } from '@/shared/ui/illustrations';
import { formatDate } from '@/shared/lib/formatting';
import {
  COMPANY_CLIENTS_NOTE,
  COMPANY_CLIENT_LOGOS,
  COMPANY_CONTACTS,
  COMPANY_PROJECTS,
  COMPANY_SERVICES,
  COMPANY_SOURCE,
  COMPANY_SOURCE_DATE,
} from '../model/company';
import { COMPANY_CSS } from './styles';

export function CompanyProfile() {
  useStyles('company-profile', COMPANY_CSS);

  return (
    <div className="imolt-company">
      <section className="imolt-company-block" aria-labelledby="company-services">
        <h2 className="imolt-section" id="company-services">
          Наши услуги
        </h2>
        <ul className="imolt-company-services">
          {COMPANY_SERVICES.map(service => (
            <li className="imolt-company-service" key={service.name}>
              <strong>{service.name}</strong>
              <span className="imolt-company-price">{service.price}</span>
              <span className="imolt-lead">{service.note}</span>
            </li>
          ))}
        </ul>
        {/* Цена без даты и источника — обещание без срока годности: критерий
            AC-087a требует назвать оба прямо под перечнем. */}
        <p className="imolt-company-source">
          Начальные цены компании на {formatDate(COMPANY_SOURCE_DATE)}, источник — {COMPANY_SOURCE}. Итог вывоза
          считается отдельно по каждому полигону и от этих цен не зависит.
        </p>
      </section>

      <section className="imolt-company-block" aria-labelledby="company-projects">
        <h2 className="imolt-section" id="company-projects">
          Выполненные проекты
        </h2>
        <ul className="imolt-company-projects">
          {COMPANY_PROJECTS.map(project => (
            <li className="imolt-company-project" key={project.name}>
              {/* Рисунок сопровождает подпись, а не заменяет её: смысл несёт
                  название проекта и объём работ рядом (разд. 4.5). */}
              <Illustration kind={project.drawing} />
              <strong>{project.name}</strong>
              <span className="imolt-company-amount">{project.amount}</span>
              <span className="imolt-lead">{project.client}</span>
              <span className="imolt-lead">{project.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="imolt-company-block" aria-labelledby="company-clients">
        <h2 className="imolt-section" id="company-clients">
          Наши клиенты
        </h2>
        <p className="imolt-lead">{COMPANY_CLIENTS_NOTE}</p>
        {/* Логотипы — украшение: названий рядом нет, потому что на сайте
            компании они стоят без подписей и без alt-текста, а выдуманное название —
            ложное утверждение о реальном юридическом лице (AC-087c, Q-026).
            Пустой alt убирает картинку из дерева доступности, и читатель экранного диктора
            слышит заголовок и подпись, а не пятнадцать безымянных картинок. */}
        <ul className="imolt-company-clients">
          {COMPANY_CLIENT_LOGOS.map(logo => (
            <li className="imolt-company-client" key={logo}>
              <img className="imolt-company-logo" src={logo} alt="" loading="lazy" />
            </li>
          ))}
        </ul>
      </section>

      <section className="imolt-company-block" aria-labelledby="company-contacts">
        <h2 className="imolt-section" id="company-contacts">
          Наши контакты
        </h2>
        <ul className="imolt-company-contacts">
          {COMPANY_CONTACTS.map(contact => (
            <li className="imolt-company-contact" key={contact.label}>
              <span className="imolt-lead">{contact.label}</span>
              <a className="imolt-link" href={contact.href}>
                {contact.value}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
