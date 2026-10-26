/**
 * Healthy Check — Spacing & Layout Design Tokens
 * 4-point increment system.
 */

export const Spacing = {
  /** 4px */
  xs: 4,
  /** 8px */
  sm: 8,
  /** 12px */
  md: 12,
  /** 16px */
  lg: 16,
  /** 20px — screen horizontal padding */
  xl: 20,
  /** 24px — section spacing */
  xxl: 24,
  /** 32px — large section spacing */
  xxxl: 32,
  /** 40px */
  huge: 40,
  /** 48px */
  massive: 48,

  screenPadding: 20,
} as const;

export const Radius = {
  /** 4px */
  xs: 4,
  /** 8px — small badges */
  sm: 8,
  /** 12px — input fields */
  md: 12,
  /** 16px — buttons, cards */
  lg: 16,
  /** 20px — larger cards */
  xl: 20,
  /** Fully rounded pills */
  full: 999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#17252A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#17252A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  lg: {
    shadowColor: '#17252A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
} as const;

export const Layout = {
  /** Standard bottom tab bar height */
  tabBarHeight: 60,
  /** Header height */
  headerHeight: 56,
  /** Min touch target */
  minTouchTarget: 44,
} as const;
