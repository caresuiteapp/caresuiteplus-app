import type { TenantScopedEntity } from '../core/base';

export type BillingRecipientType =
  | 'pflegekasse'
  | 'legal_guardian'
  | 'self_payer'
  | 'relative'
  | 'unclear';

export const BILLING_RECIPIENT_TYPE_LABELS: Record<BillingRecipientType, string> = {
  pflegekasse: 'Pflegekasse',
  legal_guardian: 'Gesetzlicher Betreuer',
  self_payer: 'Selbstzahler',
  relative: 'Angehöriger',
  unclear: 'Unklar',
};

export type CostCarrierProfile = TenantScopedEntity & {
  clientId: string;
  name: string;
  ikNumber: string | null;
  type: 'pflegekasse' | 'krankenkasse' | 'beihilfe' | 'sonstige';
  isPrimary: boolean;
  validFrom: string | null;
  validTo: string | null;
};

export type BillingRecipientProfile = TenantScopedEntity & {
  clientId: string;
  recipientType: BillingRecipientType;
  fullName: string;
  street: string;
  zip: string;
  city: string;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  costCarrierProfileId: string | null;
  notes: string | null;
};

export type BillingRecipientResolution = {
  resolved: boolean;
  recipientType: BillingRecipientType;
  profile: BillingRecipientProfile | null;
  blockedReason: string | null;
};
