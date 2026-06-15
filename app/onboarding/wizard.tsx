import { Redirect, type Href } from 'expo-router';

/** WP103 — Onboarding-Wizard-Einstieg */
export default function OnboardingWizardRoute() {
  return <Redirect href={'/onboarding/company-setup' as Href} />;
}
