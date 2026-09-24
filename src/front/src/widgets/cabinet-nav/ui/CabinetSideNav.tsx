/**
 * Боковое меню кабинета: разделы столбцом слева (экран Э-10, широкий экран).
 *
 * Разметка у бокового меню и у вкладок разная — список переходов против
 * набора вкладок, — поэтому это разные компоненты, а не одна разметка с
 * `display: none`: скрытая правилом стиля ветка остаётся в дереве
 * доступности и читается экранным диктором дважды.
 *
 * @supports: R-049
 * @adr: ADR-0008
 */
import { useStyles } from '@/shared/ui';
import { colors, fonts, layout, radius, space } from '@/shared/ui/tokens';
import { CABINET_SECTIONS, type CabinetSection } from '../model/sections';

const SIDE_NAV_CSS = `
.imolt-cabinet-nav {
  display: grid;
  gap: 2px;
  padding: ${space.s}px;
  border-radius: ${radius.card}px;
  background: ${colors.bgSurface};
}
.imolt-cabinet-nav button {
  min-height: ${layout.fieldHeight}px;
  padding: 0 ${space.m}px;
  border: 0;
  border-radius: ${radius.field}px;
  background: transparent;
  font-family: ${fonts.ui};
  font-size: 15px;
  line-height: 21px;
  font-weight: 500;
  color: ${colors.textPrimary};
  text-align: left;
  cursor: pointer;
}
.imolt-cabinet-nav button:hover { background: ${colors.bgSurfaceMuted}; }
.imolt-cabinet-nav button[aria-current='page'] {
  background: ${colors.accentDark};
  color: ${colors.onAccentDark};
}
`;

export function CabinetSideNav({
  section,
  onPick,
}: {
  section: CabinetSection;
  onPick: (section: CabinetSection) => void;
}) {
  useStyles('cabinet-nav', SIDE_NAV_CSS);

  return (
    <nav className="imolt-cabinet-nav" aria-label="Разделы кабинета">
      {CABINET_SECTIONS.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-current={item.value === section ? 'page' : undefined}
          onClick={() => onPick(item.value)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
