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
import {
  PROJECT_PHOTOS,
  PROJECT_PHOTOS_NOTE,
  COMPANY_CLIENTS_NOTE,
  COMPANY_CLIENT_LOGOS,
  COMPANY_CONTACTS,
  COMPANY_PROJECTS,
  COMPANY_SERVICES,
} from '../model/company';
import { COMPANY_CSS } from './styles';

/** Происхождение показанных снимков без повторов: один автор — одна запись. */
const PHOTO_CREDITS = [...new Set(Object.values(PROJECT_PHOTOS).filter(photo => photo !== undefined))];

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
      </section>

      <section className="imolt-company-block" aria-labelledby="company-projects">
        <h2 className="imolt-section" id="company-projects">
          Выполненные проекты
        </h2>
        <ul className="imolt-company-projects">
          {COMPANY_PROJECTS.map(project => (
            <li className="imolt-company-project" key={project.name}>
              {/* Снимок иллюстративный и смысла не несёт: он снят на другом
                  объекте, а что сделано здесь — говорят название и объём рядом.
                  Пустой alt убирает его из дерева доступности (разд. 4.5). Снимка
                  нет — остаётся контурный рисунок. */}
              {PROJECT_PHOTOS[project.drawing] === undefined ? (
                <Illustration kind={project.drawing} />
              ) : (
                <img className="imolt-company-photo" src={PROJECT_PHOTOS[project.drawing]?.src} alt="" loading="lazy" />
              )}
              <strong>{project.name}</strong>
              <span className="imolt-company-amount">{project.amount}</span>
              <span className="imolt-lead">{project.client}</span>
              <span className="imolt-lead">{project.note}</span>
            </li>
          ))}
        </ul>
        {/* Лицензии CC BY-SA требуют назвать автора и лицензию, а честность — сказать,
            что снимки сделаны не на этих объектах (Q-026). */}
        <p className="imolt-company-source">
          {PROJECT_PHOTOS_NOTE} Авторы и лицензии:{' '}
          {PHOTO_CREDITS.map((photo, index) => (
            <span key={photo.src}>
              {index > 0 ? ', ' : ''}
              <a className="imolt-link" href={photo.source} rel="noreferrer noopener" target="_blank">
                {photo.author}
              </a>{' '}
              ({photo.license})
            </span>
          ))}
          .
        </p>
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
        {/* Одна строка с непрерывной прокруткой вместо трёх рядов плиток:
            пятнадцать логотипов занимали больше места, чем услуги и проекты
            вместе (замечание заказчика от 26.09.2026). Лента едет сама, но
            движение — украшение: при выключенном движении в системе она
            стоит, а на наведение и на фокус останавливается. */}
        <div className="imolt-company-clients-track">
          <ul className="imolt-company-clients">
            {COMPANY_CLIENT_LOGOS.map(logo => (
              <li className="imolt-company-client" key={logo}>
                <img className="imolt-company-logo" src={logo} alt="" loading="lazy" />
              </li>
            ))}
          </ul>
          {/* Второй такой же ряд нужен, чтобы лента замыкалась без рывка: он
              скрыт от вспомогательных технологий, иначе диктор зачитал бы
              тридцать картинок вместо пятнадцати. */}
          <ul className="imolt-company-clients" aria-hidden="true">
            {COMPANY_CLIENT_LOGOS.map(logo => (
              <li className="imolt-company-client" key={`${logo}-copy`}>
                <img className="imolt-company-logo" src={logo} alt="" loading="lazy" />
              </li>
            ))}
          </ul>
        </div>
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
