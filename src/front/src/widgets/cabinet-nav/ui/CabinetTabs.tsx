/**
 * Разделы кабинета вкладками: узкий экран (экран Э-10, телефон).
 *
 * На телефоне столбец переходов съел бы весь экран, поэтому разделы идут
 * полосой вкладок. Это другая разметка, а не другое оформление бокового
 * меню, — отсюда отдельный компонент.
 *
 * @supports: R-049
 * @adr: ADR-0008
 */
import { Tabs } from '@/shared/ui';
import { CABINET_SECTIONS, type CabinetSection } from '../model/sections';

export function CabinetTabs({
  section,
  onPick,
}: {
  section: CabinetSection;
  onPick: (section: CabinetSection) => void;
}) {
  return (
    <Tabs
      label="Разделы кабинета"
      value={section}
      options={CABINET_SECTIONS}
      onPick={onPick}
    />
  );
}
