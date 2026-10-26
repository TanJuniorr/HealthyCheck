/**
 * Healthy Check — Color Design Tokens
 * A restrained wellness-inspired color palette.
 */

export const Colors = {
  // Primary brand
  primary: '#0EA5A4',
  primaryDark: '#087F8C',
  primaryLight: '#EAF8F7',

  // Neutrals
  background: '#F8FAFB',
  surface: '#FFFFFF',
  textPrimary: '#17252A',
  textSecondary: '#667780',
  textMuted: '#94A3A8',
  border: '#E6ECEF',
  divider: '#F0F3F5',

  // Accent — Orange
  orange: '#F4A261',
  orangeLight: '#FFF2E6',

  // Accent — Blue
  blue: '#5B8DEF',
  blueLight: '#EDF3FF',

  // Accent — Purple
  purple: '#9B85CE',
  purpleLight: '#F4F0FB',

  // Accent — Coral
  coral: '#EA777A',
  coralLight: '#FFF0F0',

  // Semantic
  success: '#39A983',
  successLight: '#E8F8F0',
  error: '#E25C5C',
  errorLight: '#FFF0F0',
  warning: '#F4A261',
  warningLight: '#FFF2E6',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.4)',
  transparent: 'transparent',

  // Tab bar
  tabActive: '#0EA5A4',
  tabInactive: '#94A3A8',
  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E6ECEF',
} as const;

export type ColorKey = keyof typeof Colors;
