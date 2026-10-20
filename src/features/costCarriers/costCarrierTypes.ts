import type { Database } from '@/lib/supabase/database.types';
import type { CostBearerTypeKey } from '@/lib/clients/clientIntakeCostBearerConfig';

/** DB carrier_type values in cost_carrier_system_templates. */
export const COST_CARRIER_DB_TYPES = [
  'care_insurance',
  'health_insurance',
  'private_insurance',
  'social_welfare_office',
  'employers_liability_insurance',
  'accident_insurance',
] as const;

export type CostCarrierDbType = (typeof COST_CARRIER_DB_TYPES)[number];

export type CostCarrierSystemTemplateRow =
  Database['public']['Functions']['search_cost_carrier_system_templates']['Returns'][number];

export type CostCarrierSystemTemplate = {
  id: string;
  templateKey: string;
  carrierType: CostCarrierDbType;
  uiLabel: string;
  name: string;
  legalName: string | null;
  shortName: string | null;
  ikNumber: string;
  street: string;
  zip: string;
  city: string;
  federalState: string | null;
  country: string;
  phone: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
  dataStatus: string;
  notes: string | null;
};

export type CostCarrierAddressSnapshot = {
  street: string;
  postalCode: string;
  city: string;
  country?: string;
};

export type CostCarrierSearchResult =
  | { ok: true; data: CostCarrierSystemTemplate[] }
  | { ok: false; error: string };

export const UI_TO_DB_CARRIER_TYPE: Record<
  Extract<
    CostBearerTypeKey,
    | 'pflegekasse'
    | 'krankenkasse'
    | 'privatversicherung'
    | 'sozialamt'
    | 'berufsgenossenschaft'
    | 'unfallversicherung'
  >,
  CostCarrierDbType
> = {
  pflegekasse: 'care_insurance',
  krankenkasse: 'health_insurance',
  privatversicherung: 'private_insurance',
  sozialamt: 'social_welfare_office',
  berufsgenossenschaft: 'employers_liability_insurance',
  unfallversicherung: 'accident_insurance',
};

export const DB_CARRIER_TYPE_COUNTS: Record<CostCarrierDbType, number> = {
  accident_insurance: 24,
  care_insurance: 93,
  employers_liability_insurance: 9,
  health_insurance: 93,
  private_insurance: 52,
  social_welfare_office: 401,
};

export function isCostCarrierDbType(value: string): value is CostCarrierDbType {
  return (COST_CARRIER_DB_TYPES as readonly string[]).includes(value);
}

export function mapUiCostBearerTypeToDbCarrierType(type: CostBearerTypeKey): CostCarrierDbType | null {
  if (type in UI_TO_DB_CARRIER_TYPE) {
    return UI_TO_DB_CARRIER_TYPE[type as keyof typeof UI_TO_DB_CARRIER_TYPE];
  }
  return null;
}

export function mapDbCarrierTypeToUiCostBearerType(type: string): CostBearerTypeKey | null {
  const entry = Object.entries(UI_TO_DB_CARRIER_TYPE).find(([, dbType]) => dbType === type);
  return entry ? (entry[0] as CostBearerTypeKey) : null;
}

export function formatCostCarrierAddress(
  template: Pick<CostCarrierSystemTemplate, 'street' | 'zip' | 'city'>,
): string {
  const parts = [template.street, `${template.zip} ${template.city}`.trim()].filter(Boolean);
  return parts.join(', ');
}
