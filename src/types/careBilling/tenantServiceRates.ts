import type { TenantScopedEntity } from '../core/base';
import type { CareServiceAreaKey, BillingUnit, RoundingRule, TravelCostRule } from './careServiceTypes';
import type { InvoiceTaxMode } from '../documents/invoice';

export type TenantServiceRate = TenantScopedEntity & {
  serviceAreaKey: CareServiceAreaKey;
  hourlyRateNetCents: number;
  hourlyRateGrossCents: number;
  taxRatePercent: number;
  taxMode: InvoiceTaxMode;
  validFrom: string;
  validTo: string | null;
  billingUnit: BillingUnit;
  roundingRule: RoundingRule;
  minimumDurationMinutes: number;
  travelCostRule: TravelCostRule;
  isActive: boolean;
};

export type TenantTaxConfig = {
  tenantId: string;
  isTaxLiable: boolean;
  defaultTaxMode: InvoiceTaxMode;
  kleinunternehmerEnabled: boolean;
  updatedAt: string;
};
