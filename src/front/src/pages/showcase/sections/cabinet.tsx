/**
 * Раздел витрины: компоненты кабинета, входа и подписки (R-084).
 *
 * Показываются все состояния, которые компоненты объявляют: три состояния
 * подписки, профиль с реквизитами и профиль до заявки, навигация по разделам
 * в обоих представлениях. Второй реализации здесь нет — витрина собрана из
 * тех же модулей, что и экран (AC-084b).
 *
 * Данные образцов взяты из макета кабинета (`ux/Кабинет.dc.html`): выдумывать
 * реквизиты для витрины незачем, а расчётные величины ей не нужны.
 *
 * @supports: R-084
 */
import { useState } from 'react';
import { ParticipantSummary, ProfileCard, SubscriptionBadge } from '@/entities/participant';
import { CabinetSideNav, CabinetTabs, type CabinetSection as SectionKey } from '@/widgets/cabinet-nav';
import type { ParticipantProfile } from '@/shared/api/cabinet';
import { Section } from '../ui/Section';

/** Участник с заявкой на подписку: реквизиты пришли из неё. */
const CARRIER_PROFILE: ParticipantProfile = {
  id: 'p-1',
  maxUserId: '812345',
  displayName: 'Иван',
  role: 'carrier',
  companyName: 'ООО «СтройВывоз МСК»',
  inn: '7725901233',
  registeredInAisOssig: true,
  subscription: { state: 'pending' },
};

/** Участник до заявки: сервис знает о нём только учётную запись платформы. */
const NEW_PARTICIPANT: ParticipantProfile = {
  id: 'p-2',
  maxUserId: '900001',
  displayName: 'Пётр',
  role: null,
  companyName: null,
  inn: null,
  registeredInAisOssig: null,
  subscription: { state: 'none' },
};

export function CabinetSection() {
  const [side, setSide] = useState<SectionKey>('calculations');
  const [tab, setTab] = useState<SectionKey>('services');

  return (
    <>
      <Section title="Состояние подписки">
        <div className="imolt-row">
          <SubscriptionBadge subscription={{ state: 'none' }} />
        </div>
        <div className="imolt-row">
          <SubscriptionBadge subscription={{ state: 'pending' }} />
        </div>
        <div className="imolt-row">
          <SubscriptionBadge subscription={{ state: 'active', activeUntil: '2026-12-31' }} />
        </div>
      </Section>

      <Section title="Профиль в шапке: заглушка и опознанный участник">
        <ParticipantSummary profile={null} />
        <ParticipantSummary profile={CARRIER_PROFILE} />
        <ParticipantSummary profile={CARRIER_PROFILE} compact />
      </Section>

      <Section title="Профиль участника">
        <ProfileCard profile={CARRIER_PROFILE} />
        <ProfileCard profile={NEW_PARTICIPANT} />
      </Section>

      <Section title="Разделы кабинета: боковое меню">
        <CabinetSideNav section={side} onPick={setSide} />
      </Section>

      <Section title="Разделы кабинета: вкладки">
        <CabinetTabs section={tab} onPick={setTab} />
      </Section>
    </>
  );
}
