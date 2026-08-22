/**
 * Design tokens for Stars.
 *
 * Every colour a screen uses comes from a `Palette`, never from a literal, so
 * that all four themes stay in step and adding a fifth is a data change.
 */

export type ThemeName = 'light' | 'dark' | 'ocean' | 'sand';

export type Palette = {
  name: ThemeName;
  /** Drives the status bar, keyboard appearance and native scroll indicators. */
  mode: 'light' | 'dark';

  bg: string;
  surface: string;
  surfaceAlt: string;
  elevated: string;

  border: string;
  borderStrong: string;

  text: string;
  textMuted: string;
  textFaint: string;
  onPrimary: string;

  primary: string;
  primaryHover: string;
  primarySoft: string;

  accent: string;
  accentSoft: string;

  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;

  overlay: string;
  skeleton: string;
  /** Gradient used behind hero sections and the roadmap header. */
  heroGradient: [string, string];
};

const light: Palette = {
  name: 'light',
  mode: 'light',
  bg: '#F4F6FB',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF1F8',
  elevated: '#FFFFFF',
  border: '#E1E7F0',
  borderStrong: '#CBD5E5',
  text: '#0F172A',
  textMuted: '#5A6782',
  textFaint: '#94A2BC',
  onPrimary: '#FFFFFF',
  primary: '#2C5CE6',
  primaryHover: '#1E48C4',
  primarySoft: '#E6ECFD',
  accent: '#C98A21',
  accentSoft: '#FBF1DE',
  success: '#12805C',
  successSoft: '#DCF5EC',
  warning: '#B4690E',
  warningSoft: '#FDF0DA',
  danger: '#C7362F',
  dangerSoft: '#FCE8E7',
  info: '#1F6FB2',
  infoSoft: '#E2F0FB',
  overlay: 'rgba(15,23,42,0.45)',
  skeleton: '#E5EAF3',
  heroGradient: ['#2C5CE6', '#1B3FA8'],
};

const dark: Palette = {
  name: 'dark',
  mode: 'dark',
  bg: '#0B1220',
  surface: '#141D2E',
  surfaceAlt: '#1C2740',
  elevated: '#1A2438',
  border: '#26324A',
  borderStrong: '#3A4863',
  text: '#F3F6FC',
  textMuted: '#9CABC6',
  textFaint: '#6B7A96',
  onPrimary: '#08101F',
  primary: '#6D9BFF',
  primaryHover: '#8AB0FF',
  primarySoft: '#1B2B4D',
  accent: '#F2B85C',
  accentSoft: '#3A2E18',
  success: '#4ADE9E',
  successSoft: '#12301F',
  warning: '#F5B944',
  warningSoft: '#38290F',
  danger: '#FF7A72',
  dangerSoft: '#3A1A19',
  info: '#6BC2F5',
  infoSoft: '#12293A',
  overlay: 'rgba(2,6,17,0.66)',
  skeleton: '#1E2A42',
  heroGradient: ['#1B3FA8', '#0B1220'],
};

const ocean: Palette = {
  name: 'ocean',
  mode: 'dark',
  bg: '#04182E',
  surface: '#0A2743',
  surfaceAlt: '#0F3355',
  elevated: '#0D2E4C',
  border: '#164066',
  borderStrong: '#265A88',
  text: '#EAF4FF',
  textMuted: '#93B7D8',
  textFaint: '#628BB0',
  onPrimary: '#02121F',
  primary: '#37C2F0',
  primaryHover: '#5FD3F8',
  primarySoft: '#0C3A5C',
  accent: '#5FE3C0',
  accentSoft: '#0A3B36',
  success: '#3FDDA6',
  successSoft: '#08352A',
  warning: '#F6C560',
  warningSoft: '#3A2E12',
  danger: '#FF8C82',
  dangerSoft: '#3E1D1C',
  info: '#63C8F7',
  infoSoft: '#0B3350',
  overlay: 'rgba(1,10,20,0.68)',
  skeleton: '#103150',
  heroGradient: ['#0E5B8A', '#04182E'],
};

const sand: Palette = {
  name: 'sand',
  mode: 'light',
  bg: '#FAF6EF',
  surface: '#FFFDF9',
  surfaceAlt: '#F3EBDD',
  elevated: '#FFFFFF',
  border: '#E8DDC9',
  borderStrong: '#D2C1A3',
  text: '#231C10',
  textMuted: '#6B5D46',
  textFaint: '#9C8C71',
  onPrimary: '#FFFDF9',
  primary: '#8A5A18',
  primaryHover: '#6F4711',
  primarySoft: '#F5E7D0',
  accent: '#2F6F5E',
  accentSoft: '#E0EFE9',
  success: '#2A6B4F',
  successSoft: '#DFF0E7',
  warning: '#A96A11',
  warningSoft: '#F9EBD3',
  danger: '#AE3B2C',
  dangerSoft: '#F9E4E0',
  info: '#2A6084',
  infoSoft: '#E1EDF5',
  overlay: 'rgba(35,28,16,0.45)',
  skeleton: '#EFE5D4',
  heroGradient: ['#8A5A18', '#4A2F0B'],
};

export const PALETTES: Record<ThemeName, Palette> = { light, dark, ocean, sand };

export const THEME_ORDER: ThemeName[] = ['light', 'dark', 'ocean', 'sand'];

/** 4-point spacing scale. `space(3)` === 12. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Scroll room to leave under the last row of a list so a floating action button
 * cannot cover it: the button is 56 tall and sits `spacing.lg` off the bottom.
 *
 * Belongs on the list's own contentContainerStyle. Padding the screen container
 * instead would move the button up with it.
 */
export const fabClearance = 96;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  subheading: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  micro: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Consistent elevation. iOS gets a soft shadow, Android gets elevation. */
export const shadow = (level: 0 | 1 | 2 | 3, palette: Palette) => {
  if (level === 0) return {};
  const opacity = palette.mode === 'dark' ? 0.4 : 0.1;
  const config = {
    1: { height: 1, radius: 3, elevation: 2 },
    2: { height: 4, radius: 10, elevation: 5 },
    3: { height: 10, radius: 22, elevation: 10 },
  }[level];
  return {
    shadowColor: '#000',
    shadowOpacity: opacity,
    shadowOffset: { width: 0, height: config.height },
    shadowRadius: config.radius,
    elevation: config.elevation,
  };
};
