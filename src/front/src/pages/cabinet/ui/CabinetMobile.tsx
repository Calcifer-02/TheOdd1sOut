/**
 * Кабинет на телефоне: разделы вкладками, содержимое в одну колонку
 * (экран Э-10).
 *
 * @supports: R-049
 * @adr: ADR-0008
 */
import { CabinetTabs } from '@/widgets/cabinet-nav';
import { CabinetSections, type CabinetView } from './CabinetSections';
import { SubscriptionBanner } from './SubscriptionBanner';

export function CabinetMobile({ view }: { view: CabinetView }) {
  return (
    <div className="imolt-cabinet">
      <SubscriptionBanner subscription={view.profile.subscription} />
      <CabinetTabs section={view.section} onPick={view.openSection} />
      <div className="imolt-cabinet-main">
        <CabinetSections view={view} />
      </div>
    </div>
  );
}
