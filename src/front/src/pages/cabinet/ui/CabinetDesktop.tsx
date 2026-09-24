/**
 * Кабинет на рабочем месте: боковое меню слева, раздел справа (экран Э-10).
 *
 * Две колонки и список переходов столбцом — другое дерево разметки, а не
 * другое оформление вкладок: скрытая правилом стиля вторая ветка осталась бы
 * в дереве доступности и читалась бы экранным диктором (дизайн-договор,
 * разд. 4.5).
 *
 * @supports: R-049
 * @adr: ADR-0008
 */
import { CabinetSideNav } from '@/widgets/cabinet-nav';
import { CabinetSections, type CabinetView } from './CabinetSections';
import { SubscriptionBanner } from './SubscriptionBanner';

export function CabinetDesktop({ view }: { view: CabinetView }) {
  return (
    <div className="imolt-cabinet">
      <div className="imolt-cabinet-layout imolt-cabinet-layout--wide">
        <aside className="imolt-cabinet-aside">
          <CabinetSideNav section={view.section} onPick={view.openSection} />
          <SubscriptionBanner subscription={view.profile.subscription} />
        </aside>
        <div className="imolt-cabinet-main">
          <CabinetSections view={view} />
        </div>
      </div>
    </div>
  );
}
