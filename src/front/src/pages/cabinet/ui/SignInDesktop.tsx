/**
 * Кабинет без сессии на рабочем месте: объяснение входа основной колонкой и
 * перечень возможностей кабинета боковой (экран Э-09).
 *
 * Состояние «участник не опознан» — единственное, которое видно на стенде:
 * подпись стартовых параметров проверяется по ключу бота, и подделать её
 * нечем (ADR-0006). Поэтому оно обязано выглядеть рабочим местом, а не
 * карточкой в половину окна: заказчик прочитал прежнюю раскладку как
 * обрезанную колонку телефона (R-085).
 *
 * Дерево своё, а не то же с другим оформлением: скрытая правилом стиля
 * вторая ветка осталась бы в дереве доступности и читалась бы экранным
 * диктором (R-085, AC-085a; дизайн-договор, разд. 4.5).
 *
 * Перечень возможностей ничего не обещает сверх устройства доступа: он
 * называет разделы, которые откроются после опознания, теми же словами, что
 * стоят в самих разделах.
 *
 * @req: R-050
 * @supports: R-049, R-052, R-085
 * @adr: ADR-0006
 */
import { CABINET_BENEFITS, ENTRY_BENEFITS_TITLE, ENTRY_LEAD, ENTRY_TITLE, benefitLabel } from '../model/entry';
import { SignInAction } from './SignInAction';

export function SignInDesktop() {
  return (
    <div className="imolt-cabinet">
      <div className="imolt-cabinet-entry imolt-cabinet-entry--wide">
        <section className="imolt-card imolt-cabinet-signin" aria-labelledby="imolt-cabinet-signin">
          <h1 className="imolt-title" id="imolt-cabinet-signin">
            {ENTRY_TITLE}
          </h1>
          <p className="imolt-lead">{ENTRY_LEAD}</p>
          <SignInAction />
        </section>

        <aside className="imolt-card imolt-cabinet-benefits" aria-labelledby="imolt-cabinet-benefits">
          <h2 className="imolt-section" id="imolt-cabinet-benefits">
            {ENTRY_BENEFITS_TITLE}
          </h2>
          {/* Пара «раздел – что в нём» выражена списком описаний: это её
              родная разметка, и связь пояснения с именем раздела не
              приходится дорисовывать атрибутами. */}
          <dl className="imolt-cabinet-benefit-list">
            {CABINET_BENEFITS.map(benefit => (
              <div className="imolt-cabinet-benefit" key={benefit.section}>
                <dt className="imolt-cabinet-benefit-name">{benefitLabel(benefit.section)}</dt>
                <dd className="imolt-cabinet-benefit-detail">{benefit.detail}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </div>
  );
}
