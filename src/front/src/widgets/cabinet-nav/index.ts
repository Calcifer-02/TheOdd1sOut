/**
 * Публичный вход навигации по разделам кабинета.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
export { CabinetSideNav } from './ui/CabinetSideNav';
export { CabinetTabs } from './ui/CabinetTabs';
export {
  CABINET_SECTIONS,
  DEFAULT_CABINET_SECTION,
  SECTION_QUERY_KEY,
  sectionOf,
  type CabinetSection,
} from './model/sections';
