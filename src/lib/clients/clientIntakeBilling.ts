import type { BillingType } from '@/types/modules/client/clientBilling';

const INTAKE_TO_PROFILE_BILLING: Partial<Record<string, BillingType>> = {
  selbstzahler: 'selbstzahler',
  pflegekasse: 'pflegekasse',
  beihilfe: 'beihilfe',
  kostenuebernahme: 'beihilfe',
};

/** Leitet aus Mehrfachauswahl einen Profil-Abrechnungstyp ab. */
export function resolveIntakeBillingProfileType(billingTypes: string[]): BillingType {
  if (billingTypes.length === 0) return 'sonstige';
  if (billingTypes.length > 1 || billingTypes.includes('kombination')) return 'kombi';
  return INTAKE_TO_PROFILE_BILLING[billingTypes[0]!] ?? 'sonstige';
}

export function formatIntakeBillingTypesLabel(billingTypes: string[], labels: Record<string, string>): string {
  if (billingTypes.length === 0) return '—';
  return billingTypes.map((key) => labels[key] ?? key).join(', ');
}
