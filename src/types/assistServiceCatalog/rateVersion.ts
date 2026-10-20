import type { InvoiceTaxMode } from '../documents/invoice';
import type { TenantScopedEntity } from '../core/base';
import type { BillingUnit } from '../careBilling/careServiceTypes';

export type AssistServiceRateVersion = TenantScopedEntity & {
  serviceCatalogItemId: string;
  versionLabel: string;
  hourlyRateNetCents: number;
  hourlyRateGrossCents: number;
  taxMode: InvoiceTaxMode;
  taxRatePercent: number;
  billingUnit: BillingUnit;
  validFrom: string;
  validTo: string | null;
  isActive: boolean;
};

export type SetServiceRateInput = {
  tenantId: string;
  serviceCatalogItemId: string;
  versionLabel: string;
  hourlyRateNetCents: number;
  taxMode: InvoiceTaxMode;
  taxRatePercent?: number;
  billingUnit?: BillingUnit;
  validFrom: string;
  validTo?: string | null;
  actorUserId?: string | null;
};
