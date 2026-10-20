/** WP037 — Spacing Design Tokens */
export const WP_COMPLETION = {
  wp: 37,
  topic: 'Spacing Tokens',
  status: 'complete' as const,
  implementation: 'src/theme/spacing.ts',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;
