/** WP114 — Onboarding Workflow */
export const WP_COMPLETION = {
  wp: 114,
  topic: 'Onboarding Workflow',
  status: 'complete' as const,
  implementation: 'src/lib/onboarding/onboardingService.ts',
} as const;

export const ONBOARDING_WORKFLOW_STEPS = ["welcome", "register", "company", "modules"] as const;
