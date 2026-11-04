/**
 * Healthy Check — color tokens for light and dark appearances.
 *
 * `Colors` stays as the shared token API used by existing screens. Its values
 * follow the active app appearance; themed StyleSheet values use the same
 * palettes through `useThemedStyles`.
 */

export const LightColors = {
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

export const DarkColors: Record<keyof typeof LightColors, string> = {
  primary: '#54D2CB',
  primaryDark: '#79E1DA',
  primaryLight: '#183A3A',

  background: '#101719',
  surface: '#1A2427',
  textPrimary: '#F1F6F6',
  textSecondary: '#B5C3C6',
  textMuted: '#91A2A6',
  border: '#344246',
  divider: '#2A363A',

  orange: '#FFB978',
  orangeLight: '#3A2D22',
  blue: '#8BAEFF',
  blueLight: '#222F49',
  purple: '#B7A2EE',
  purpleLight: '#302943',
  coral: '#FF9295',
  coralLight: '#3C272B',

  success: '#66D2A4',
  successLight: '#1D382F',
  error: '#FF8585',
  errorLight: '#3C272B',
  warning: '#FFB978',
  warningLight: '#3A2D22',

  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.65)',
  transparent: 'transparent',

  tabActive: '#54D2CB',
  tabInactive: '#91A2A6',
  tabBarBg: '#1A2427',
  tabBarBorder: '#344246',
};

export type ColorKey = keyof typeof LightColors;

let darkAppearanceActive = false;

export function setActiveColorScheme(isDark: boolean) {
  darkAppearanceActive = isDark;
}

export const Colors: typeof LightColors = new Proxy(LightColors, {
  get(target, property: keyof typeof LightColors) {
    if (typeof property !== 'string' || !(property in target)) return target[property];
    return darkAppearanceActive ? DarkColors[property] : target[property];
  },
});
