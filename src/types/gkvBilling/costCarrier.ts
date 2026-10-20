import type { TenantScopedEntity } from '../core/base';

export type GkvCostCarrierType =
  | 'pflegekasse'
  | 'krankenkasse'
  | 'beihilfe'
  | 'abrechnungszentrum'
  | 'sonstige';

export const GKV_COST_CARRIER_TYPE_LABELS: Record<GkvCostCarrierType, string> = {
  pflegekasse: 'Pflegekasse',
  krankenkasse: 'Krankenkasse',
  beihilfe: 'Beihilfe',
  abrechnungszentrum: 'Abrechnungszentrum',
  sonstige: 'Sonstige',
};

export type GkvCostCarrierSource = 'manual' | 'kostentraegerdatei' | 'import' | 'api';

export const GKV_COST_CARRIER_SOURCE_LABELS: Record<GkvCostCarrierSource, string> = {
  manual: 'Manuell',
  kostentraegerdatei: 'Kostenträgerdatei',
  import: 'Import',
  api: 'API',
};

/** Kostenträger-Stammdaten — gkv_cost_carriers */
export type GkvCostCarrier = TenantScopedEntity & {
  costCarrierId: string;
  name: string;
  type: GkvCostCarrierType;
  ikNumber: string | null;
  billingAddress: Record<string, string> | null;
  electronicBillingSupported: boolean;
  dtaSupported: boolean;
  contactData: Record<string, string> | null;
  validFrom: string | null;
  validTo: string | null;
  source: GkvCostCarrierSource;
  lastCheckedAt: string | null;
};
