import type { CareServiceAreaKey, TenantServiceRate, TenantTaxConfig } from '@/types/careBilling';
import type { InvoiceTaxMode } from '@/types/documents/invoice';
import { isCareServiceAreaPreparedOnly } from '@/types/careBilling';
import { listServiceRates, readTaxConfig, writeTaxConfig } from './careBillingStore';

export function createDefaultTaxConfig(tenantId: string): TenantTaxConfig {
  return {
    tenantId,
    isTaxLiable: false,
    defaultTaxMode: 'ustg_4_16_exempt',
    kleinunternehmerEnabled: false,
    updatedAt: new Date().toISOString(),
  };
}

export function resolveTaxModeForService(
  tenantId: string,
  serviceAreaKey: CareServiceAreaKey,
  isSelfPayer: boolean,
): InvoiceTaxMode {
  const config = readTaxConfig(tenantId) ?? createDefaultTaxConfig(tenantId);

  if (config.kleinunternehmerEnabled) {
    return 'kleinunternehmer_19';
  }

  if (isSelfPayer && config.isTaxLiable) {
    return 'standard_vat_19';
  }

  if (serviceAreaKey === 'selbstzahlerleistungen' && config.isTaxLiable) {
    return 'standard_vat_19';
  }

  return 'ustg_4_16_exempt';
}

export function findActiveServiceRate(
  tenantId: string,
  serviceAreaKey: CareServiceAreaKey,
  serviceDate: string,
): TenantServiceRate | null {
  const rates = listServiceRates(tenantId).filter(
    (r) =>
      r.serviceAreaKey === serviceAreaKey &&
      r.isActive &&
      r.validFrom <= serviceDate &&
      (r.validTo == null || r.validTo >= serviceDate),
  );
  return rates.sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] ?? null;
}

export function roundBillableMinutes(
  durationMinutes: number,
  rate: TenantServiceRate,
): number {
  const min = rate.minimumDurationMinutes;
  let billable = Math.max(durationMinutes, min);

  switch (rate.roundingRule) {
    case 'up_to_quarter_hour':
      billable = Math.ceil(billable / 15) * 15;
      break;
    case 'up_to_half_hour':
      billable = Math.ceil(billable / 30) * 30;
      break;
    case 'commercial':
      billable = Math.round(billable);
      break;
    default:
      break;
  }

  return billable;
}

export function calculateAmountFromRate(
  billableMinutes: number,
  hourlyRateNetCents: number,
): number {
  return Math.round((billableMinutes / 60) * hourlyRateNetCents);
}

export function assertServiceRateAvailable(
  tenantId: string,
  serviceAreaKey: CareServiceAreaKey,
  serviceDate: string,
): { ok: true; rate: TenantServiceRate } | { ok: false; error: string } {
  if (isCareServiceAreaPreparedOnly(serviceAreaKey)) {
    return {
      ok: false,
      error: `Leistungsart „${serviceAreaKey}" ist nur vorbereitet — keine produktive Abrechnung.`,
    };
  }

  const rate = findActiveServiceRate(tenantId, serviceAreaKey, serviceDate);
  if (!rate || rate.hourlyRateNetCents <= 0) {
    return { ok: false, error: 'Stundensatz fehlt oder ist ungültig.' };
  }

  return { ok: true, rate };
}

export function upsertTenantTaxConfig(
  tenantId: string,
  patch: Partial<Omit<TenantTaxConfig, 'tenantId' | 'updatedAt'>>,
): TenantTaxConfig {
  const existing = readTaxConfig(tenantId) ?? createDefaultTaxConfig(tenantId);
  const updated: TenantTaxConfig = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  return writeTaxConfig(tenantId, updated);
}
