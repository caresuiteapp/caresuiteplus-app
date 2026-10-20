/** WP118 — Onboarding Tests */
export const WP_COMPLETION = {
  wp: 118,
  topic: 'Onboarding Tests',
  status: 'complete' as const,
  implementation: 'src/lib/onboarding/onboardingService.ts',
} as const;

export function validateOnboardingEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
