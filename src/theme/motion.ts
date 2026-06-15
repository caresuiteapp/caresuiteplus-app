/** WP034 — Motion Design Tokens (Designsystem) */
export const WP_COMPLETION = {
  wp: 34,
  topic: 'Motion Tokens',
  status: 'complete' as const,
  implementation: 'src/theme/motion.ts',
} as const;

export const motion = {
  fast: 220,
  medium: 360,
  spring: { damping: 18, stiffness: 240, mass: 1 },
} as const;
