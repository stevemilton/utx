// UTx Design System

export const colors = {
  // Primary colors
  primary: '#FF6B35', // Orange - energetic, rowing oar inspired
  primaryLight: '#FF8F66',
  primaryDark: '#E55A2B',

  // Neutral colors
  background: '#000000',
  backgroundSecondary: '#111111',
  backgroundTertiary: '#1A1A1A',
  surface: '#222222',
  surfaceLight: '#333333',

  // Text colors
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textTertiary: '#666666',
  textInverse: '#000000',

  // Status colors
  success: '#22C55E',
  successLight: 'rgba(34, 197, 94, 0.15)',
  warning: '#EAB308',
  error: '#EF4444',
  info: '#3B82F6',

  // Base colors
  white: '#FFFFFF',
  black: '#000000',

  // HR Zone colors
  zone1: '#94A3B8', // Recovery - gray
  zone2: '#22C55E', // Easy Aerobic - green
  zone3: '#EAB308', // Aerobic - yellow
  zone4: '#F97316', // Threshold - orange
  zone5: '#EF4444', // Max - red

  // Effort score colors
  effortLow: '#22C55E', // 1-4
  effortMedium: '#EAB308', // 5-7
  effortHigh: '#EF4444', // 8-10

  // Other
  border: '#333333',
  borderLight: '#444444',
  overlay: 'rgba(0, 0, 0, 0.7)',
  pbGold: '#FFD700',
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
};

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
