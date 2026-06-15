/** WP120 — Onboarding Abschluss */
export const WP_COMPLETION = {
  wp: 120,
  topic: 'Onboarding Abschluss',
  status: 'complete' as const,
  implementation: 'src/lib/onboarding/onboardingService.ts',
} as const;

export const ONBOARDING_COMPLETE_WP = 120 as const;
