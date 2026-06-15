/** WP119 — Onboarding Qualität */
export const WP_COMPLETION = {
  wp: 119,
  topic: 'Onboarding Qualität',
  status: 'complete' as const,
  implementation: 'src/lib/onboarding/onboardingService.ts',
} as const;

export function isOnboardingDraftComplete(draft: { companyName?: string; email?: string }): boolean {
  return Boolean(draft.companyName?.trim() && draft.email?.trim());
}
