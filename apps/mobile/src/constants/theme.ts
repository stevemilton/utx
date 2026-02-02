// UTx Design System v4 - Light Mode Premium Design
// Inspired by Whoop/Strava aesthetic

export const colors = {
  // Primary colors - Petrol Blue
  primary: '#0D4F4F',
  primaryLight: '#1A6B6B',
  primaryDark: '#083838',
  primarySubtle: 'rgba(13, 79, 79, 0.08)',

  // Light mode backgrounds
  background: '#FFFFFF',
  backgroundSecondary: '#F8F9FA',
  backgroundTertiary: '#F0F2F4',
  surface: '#FFFFFF',
  surfaceHover: '#F5F5F5',
  surfaceLight: '#FAFAFA',

  // Text colors - dark on light
  textPrimary: '#1A1A1A',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Status colors
  success: '#10B981',
  successLight: 'rgba(16, 185, 129, 0.1)',
  warning: '#F59E0B',
  warningLight: 'rgba(245, 158, 11, 0.1)',
  error: '#EF4444',
  errorLight: 'rgba(239, 68, 68, 0.1)',
  info: '#3B82F6',
  infoLight: 'rgba(59, 130, 246, 0.1)',

  // Base colors
  white: '#FFFFFF',
  black: '#000000',

  // HR Zone colors (keep vibrant for data viz)
  zone1: '#94A3B8', // Recovery - gray
  zone2: '#10B981', // Easy Aerobic - green
  zone3: '#F59E0B', // Aerobic - amber
  zone4: '#F97316', // Threshold - orange
  zone5: '#EF4444', // Max - red

  // Effort score colors
  effortLow: '#10B981', // 1-4 green
  effortMedium: '#F59E0B', // 5-7 amber
  effortHigh: '#EF4444', // 8-10 red

  // Borders - light mode
  border: 'rgba(0, 0, 0, 0.06)',
  borderLight: 'rgba(0, 0, 0, 0.04)',
  borderStrong: 'rgba(0, 0, 0, 0.12)',

  // Other
  overlay: 'rgba(0, 0, 0, 0.5)',
  pbGold: '#D4A418',
  strava: '#FC4C02',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
};

export const fontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 24,
  xxxl: 32,
  display: 48,
  hero: 56, // For large split times
};

export const fontWeight = {
  light: '300' as const, // For hero numbers
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// Light mode shadows (subtle)
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
};

export const theme = {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
};

export type Theme = typeof theme;
