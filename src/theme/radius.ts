/** WP035 — Radius Design Tokens (Designsystem) */
export const WP_COMPLETION = {
  wp: 35,
  topic: 'Radius Tokens',
  status: 'complete' as const,
  implementation: 'src/theme/radius.ts',
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  card: 24,
  capsule: 999,
} as const;
