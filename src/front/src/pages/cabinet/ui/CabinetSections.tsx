/**
 * Содержимое открытого раздела кабинета.
 *
 * Выбор раздела общий для обоих представлений: различаются они оболочкой —
 * боковым меню против вкладок и таблицей против карточек, — а не тем, какие
 * разделы бывают. Второй такой выбор рядом разошёлся бы с первым.
 *
 * @supports: R-008, R-049, R-051, R-052
 * @adr: ADR-0008
 */
import type { ParticipantProfile, SubscriptionStanding } from '@/shared/api/cabinet';
import type { CabinetSection } from '@/widgets/cabinet-nav';
import type { CalculationsState, ServiceOrderState, ServicesState } from '../model/cabinet';
import { CalculationsSection } from './sections/CalculationsSection';
import { ProfileSection } from './sections/ProfileSection';
import { RoutesSection } from './sections/RoutesSection';
import { ServicesSection } from './sections/ServicesSection';
import { SubscriptionSection } from './sections/SubscriptionSection';

/** Всё, что разделу кабинета нужно знать. Собирается один раз на странице. */
export type CabinetView = {
  section: CabinetSection;
  openSection: (next: CabinetSection) => void;
  profile: ParticipantProfile;
  calculations: CalculationsState;
  services: ServicesState;
  order: ServiceOrderState;
  applySubscription: (next: SubscriptionStanding) => void;
  /** Широкий экран: таблица вместо карточек и сетка вместо одной колонки. */
  wide: boolean;
};

export function CabinetSections({ view }: { view: CabinetView }) {
  if (view.section === 'routes') {
    return <RoutesSection openSection={view.openSection} />;
  }

  if (view.section === 'services') {
    return <ServicesSection state={view.services} order={view.order} wide={view.wide} />;
  }

  if (view.section === 'subscription') {
    return (
      <SubscriptionSection
        subscription={view.profile.subscription}
        onAccepted={view.applySubscription}
      />
    );
  }

  if (view.section === 'profile') {
    return <ProfileSection profile={view.profile} />;
  }

  return <CalculationsSection state={view.calculations} wide={view.wide} />;
}
