/**
 * Healthy Check — Typography Design Tokens
 * Clean, readable type scale using system fonts with Inter preference.
 */

import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

const fontFamilyMedium = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
});

export const Typography = {
  // Large screen title — 28–30, Bold
  largeTitle: {
    fontFamily,
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: -0.3,
  },

  // Screen title — 22–24, Semibold
  screenTitle: {
    fontFamily,
    fontSize: 22,
    fontWeight: '600' as const,
    lineHeight: 28,
    letterSpacing: -0.2,
  },

  // Section heading — 18–20, Semibold
  sectionTitle: {
    fontFamily,
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },

  // Card heading — 15–17, Semibold
  cardTitle: {
    fontFamily,
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
  },

  // Body text — 14–16, Regular
  body: {
    fontFamily,
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },

  // Body small
  bodySmall: {
    fontFamily,
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },

  // Supporting text — 12–14, Regular
  supporting: {
    fontFamily,
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },

  // Small label — 11–12, Medium
  label: {
    fontFamily: fontFamilyMedium,
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
    letterSpacing: 0.2,
  },

  // Tiny label
  labelSmall: {
    fontFamily: fontFamilyMedium,
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 14,
    letterSpacing: 0.3,
  },

  // Large statistic — 28–36, Bold
  statLarge: {
    fontFamily,
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 38,
    letterSpacing: -0.5,
  },

  // Medium statistic
  statMedium: {
    fontFamily,
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 30,
    letterSpacing: -0.3,
  },

  // Button text
  button: {
    fontFamily,
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
  },

  // Button small
  buttonSmall: {
    fontFamily,
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },

  // Tab label
  tabLabel: {
    fontFamily: fontFamilyMedium,
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 14,
  },
} as const;
