/**
 * Токены дизайн-договора (`ux/ЗАПРОС_НА_ДИЗАЙН.md`, разд. 4).
 *
 * Это единственное место интерфейса, где стоят прямые визуальные значения:
 * инвариант 1 решения ADR-0008. Компоненты берут роль (`colors.textSecondary`,
 * `colors.statusBlocked`), а не цвет, поэтому смена роли меняет всё согласованно,
 * а прямое значение вне этого модуля ловится проверкой.
 *
 * Слоёв два, как требует карточка практики PRACT-017: `palette` — исходные
 * значения, `colors` и остальные — семантические роли поверх них.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */

/** Исходные значения. Вне этого модуля не используются. */
const palette = {
  grey100: '#EFEEF1',
  grey050: '#F5F4F7',
  white: '#FFFFFF',
  black: '#111111',
  grey600: '#707070',
  grey500: '#848484',
  grey400: '#9C9C9C',
  grey300: '#D7D7D9',
  grey200: '#E2E2E2',
  grey150: '#EDEDEF',
  lime: '#E7F53D',
  limeDark: '#DDEB2E',
  limeMuted: '#F0F3C8',
  limeSoft: '#F8FDB5',
  orange: '#FF4719',
  blue: '#1F5BFF',
  green: '#1F8A4C',
  greenSoft: '#E6F4EC',
  red: '#D3321B',
  redSoft: '#FBE9E5',
  amber: '#B7791F',
  amberSoft: '#FFF4E0',
} as const;

/** Роли цвета. Границы применения — раздел 4.1 дизайн-договора. */
export const colors = {
  bgPage: palette.grey100,
  bgSurface: palette.white,
  bgSurfaceMuted: palette.grey050,
  textPrimary: palette.black,
  textSecondary: palette.grey600,
  textPlaceholder: palette.grey500,
  borderDefault: palette.grey300,
  borderDivider: palette.grey200,
  iconDefault: palette.grey400,
  iconActive: palette.black,
  accentPrimary: palette.lime,
  accentPrimaryHover: palette.limeDark,
  accentPrimaryDisabled: palette.limeMuted,
  accentRowHover: palette.limeSoft,
  accentDark: palette.black,
  brand: palette.orange,
  link: palette.blue,
  statusActiveText: palette.green,
  statusActiveBg: palette.greenSoft,
  statusBlockedText: palette.red,
  statusBlockedBg: palette.redSoft,
  statusStaleText: palette.amber,
  statusStaleBg: palette.amberSoft,
  statusUnknownText: palette.grey600,
  statusUnknownBg: palette.grey150,
  onAccentDark: palette.white,
  disabledText: palette.grey400,
} as const;

/**
 * Гарнитуры. Заголовки и интерфейс — Montserrat, числа — Inter с табличными
 * цифрами: в сравнении полигонов суммы обязаны выравниваться по разрядам.
 */
export const fonts = {
  ui: "Montserrat, system-ui, -apple-system, 'Segoe UI', sans-serif",
  numeric: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
} as const;

/** Шкала отступов, кратная восьми (разд. 4.3). */
export const space = {
  xxs: 4,
  xs: 8,
  s: 12,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 40,
} as const;

/** Скругления: карточка, поле, значок статуса, «таблетка». */
export const radius = {
  card: 20,
  field: 12,
  badge: 6,
  pill: 999,
} as const;

export const layout = {
  /** Ширина макета мобильного размера; шире — те же карточки по центру. */
  screenWidth: 390,
  gutter: 16,
  /** Наименьшая цель касания (разд. 4.5). */
  touchTarget: 44,
  /** Высота управления: поле, кнопка и переключатель одной высоты. */
  fieldHeight: 48,
  /** Ширина поля количества: в нём две-три цифры, не больше. */
  amountWidth: 120,
  shadow: '0 8px 24px rgba(17, 17, 17, 0.12)',
} as const;
