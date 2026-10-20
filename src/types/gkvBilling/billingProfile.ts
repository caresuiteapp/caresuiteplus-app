import type { TenantScopedEntity } from '../core/base';

/** SGB XI Pflegeversicherung / SGB V Krankenversicherung — nur Vorbereitung. */
export type GkvStatutorySector = 'sgb_xi' | 'sgb_v' | 'mixed';

export const GKV_STATUTORY_SECTOR_LABELS: Record<GkvStatutorySector, string> = {
  sgb_xi: 'SGB XI (Pflegeversicherung)',
  sgb_v: 'SGB V (Krankenversicherung)',
  mixed: 'Gemischt (SGB XI/V)',
};

export type GkvBillingMode =
  | 'leistungsnachweise_export'
  | 'dta_vorbereitung'
  | 'abrechnungszentrum_export'
  | 'direktabrechnung_spaeter';

export const GKV_BILLING_MODE_LABELS: Record<GkvBillingMode, string> = {
  leistungsnachweise_export: 'Leistungsnachweise exportieren',
  dta_vorbereitung: 'DTA-Export vorbereiten (nicht validiert)',
  abrechnungszentrum_export: 'Export über Abrechnungszentrum',
  direktabrechnung_spaeter: 'Direktabrechnung später',
};

export type GkvIkVerificationStatus = 'unverified' | 'pending' | 'verified' | 'failed';

export const GKV_IK_VERIFICATION_STATUS_LABELS: Record<GkvIkVerificationStatus, string> = {
  unverified: 'Nicht verifiziert',
  pending: 'Prüfung ausstehend',
  verified: 'Verifiziert (Vorbereitung)',
  failed: 'Verifikation fehlgeschlagen',
};

/** Mandanten-IK-Profil für GKV/Pflegekassenabrechnung — gkv_billing_profiles */
export type GkvBillingProfile = TenantScopedEntity & {
  ikNumber: string | null;
  bankAccountHolder: string | null;
  bankIban: string | null;
  bankBic: string | null;
  statutorySector: GkvStatutorySector | null;
  billingMode: GkvBillingMode;
  verificationStatus: GkvIkVerificationStatus;
  verifiedAt: string | null;
  dtaValidatorConfigured: boolean;
  notes: string | null;
};
