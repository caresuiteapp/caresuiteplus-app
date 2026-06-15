/** WP115 — Onboarding Abrechnung */
export const WP_COMPLETION = {
  wp: 115,
  topic: 'Onboarding Abrechnung',
  status: 'complete' as const,
  implementation: 'src/lib/onboarding/onboardingService.ts',
} as const;

export const ONBOARDING_BILLING_NOTE = "Mandant wird nach Onboarding abgerechnet.";
