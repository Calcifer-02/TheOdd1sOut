/**
 * Кабинет без сессии на телефоне: объяснение входа одной колонкой
 * (экран Э-09).
 *
 * Одна колонка здесь уместна: экран узкий, и перечень возможностей кабинета
 * оттеснил бы вниз единственное доступное действие — переход в переписку
 * (дизайн-договор, разд. 4.5).
 *
 * @req: R-050
 * @supports: R-049, R-085
 * @adr: ADR-0006
 */
import { ENTRY_LEAD, ENTRY_TITLE } from '../model/entry';
import { SignInAction } from './SignInAction';

export function SignInMobile() {
  return (
    <div className="imolt-cabinet">
      <div className="imolt-cabinet-entry imolt-cabinet-entry--narrow">
        <section className="imolt-card imolt-cabinet-signin" aria-labelledby="imolt-cabinet-signin">
          <h1 className="imolt-title" id="imolt-cabinet-signin">
            {ENTRY_TITLE}
          </h1>
          <p className="imolt-lead">{ENTRY_LEAD}</p>
          <SignInAction />
        </section>
      </div>
    </div>
  );
}
