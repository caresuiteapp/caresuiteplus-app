import type { EntityId, ISODateTime } from '@/types/core/base';

/** Bearbeitbare Mandanten-Stammdaten (Organisation). */
export type TenantSettingsForm = {
  name: string;
  legalName: string;
  street: string;
  houseNumber: string;
  zip: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  /** Standard-Stundensatz Assist (netto, EUR) — z. B. „38,00“ */
  assistDefaultHourlyRate: string;
};

export type TenantSettingsSnapshot = TenantSettingsForm & {
  tenantId: EntityId;
  updatedAt: ISODateTime;
};

export const EMPTY_TENANT_SETTINGS_FORM: TenantSettingsForm = {
  name: '',
  legalName: '',
  street: '',
  houseNumber: '',
  zip: '',
  city: '',
  country: 'Deutschland',
  phone: '',
  email: '',
  website: '',
  logoUrl: '',
  assistDefaultHourlyRate: '',
};
