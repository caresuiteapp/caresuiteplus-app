import type { ServiceResult } from '@/types';
import type { AssistServiceRateVersion, SetServiceRateInput } from '@/types/assistServiceCatalog';
import type { CareServiceAreaKey, TenantServiceRate } from '@/types/careBilling';
import { calculateCareBillingTax } from '@/lib/careBilling/careBillingTaxService';
import { saveServiceRate } from '@/lib/careBilling/careBillingStore';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  getAssistService,
  listServiceRateVersions,
  saveServiceRateVersion,
} from './assistServiceCatalogStore';
import { mapAssistCategoryToCareServiceArea } from './categoryValidationService';
import { recordAssistServiceCatalogAudit } from './auditService';

export function setServiceHourlyRate(input: SetServiceRateInput): ServiceResult<AssistServiceRateVersion> {
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Stundensätze im Live-Modus noch nicht angebunden.' };
  }

  const service = getAssistService(input.tenantId, input.serviceCatalogItemId);
  if (!service) return { ok: false, error: 'Leistung nicht gefunden.' };
  if (!service.billable) {
    return { ok: false, error: 'Stundensatz nur für abrechenbare Leistungen setzbar.' };
  }

  const taxRatePercent = input.taxRatePercent ?? 0;
  const tax = calculateCareBillingTax(
    input.taxMode,
    input.hourlyRateNetCents,
    `Stundensatz ${service.title}`,
  );
  const now = new Date().toISOString();

  for (const version of listServiceRateVersions(input.tenantId, input.serviceCatalogItemId)) {
    if (version.isActive && version.validFrom <= input.validFrom) {
      saveServiceRateVersion(input.tenantId, {
        ...version,
        isActive: false,
        validTo: input.validFrom,
        updatedAt: now,
      });
    }
  }

  const rateVersion: AssistServiceRateVersion = {
    id: `asc-rate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId: input.tenantId,
    serviceCatalogItemId: input.serviceCatalogItemId,
    versionLabel: input.versionLabel.trim(),
    hourlyRateNetCents: input.hourlyRateNetCents,
    hourlyRateGrossCents: tax.grossAmountCents,
    taxMode: input.taxMode,
    taxRatePercent,
    billingUnit: input.billingUnit ?? 'hour',
    validFrom: input.validFrom,
    validTo: input.validTo ?? null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  saveServiceRateVersion(input.tenantId, rateVersion);

  const careArea = mapAssistCategoryToCareServiceArea(service.category);
  if (careArea && service.budgetEligible) {
    const tenantRate: TenantServiceRate = {
      id: `tsr-${rateVersion.id}`,
      tenantId: input.tenantId,
      serviceAreaKey: careArea as CareServiceAreaKey,
      hourlyRateNetCents: input.hourlyRateNetCents,
      hourlyRateGrossCents: tax.grossAmountCents,
      taxRatePercent,
      taxMode: input.taxMode,
      validFrom: input.validFrom,
      validTo: input.validTo ?? null,
      billingUnit: input.billingUnit ?? 'hour',
      roundingRule: 'up_to_quarter_hour',
      minimumDurationMinutes: 30,
      travelCostRule: 'none',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    saveServiceRate(input.tenantId, tenantRate);
  }

  recordAssistServiceCatalogAudit(input.tenantId, {
    serviceCatalogItemId: service.id,
    action: 'rate_version_set',
    summary: `Stundensatz ${input.versionLabel}: ${(input.hourlyRateNetCents / 100).toFixed(2)} EUR netto`,
    payload: { versionLabel: input.versionLabel, validFrom: input.validFrom },
    actorUserId: input.actorUserId ?? null,
  });

  return { ok: true, data: rateVersion };
}

export function findActiveServiceRateVersion(
  tenantId: string,
  serviceCatalogItemId: string,
  serviceDate: string,
): AssistServiceRateVersion | null {
  const versions = listServiceRateVersions(tenantId, serviceCatalogItemId).filter(
    (version) =>
      version.isActive &&
      version.validFrom <= serviceDate &&
      (version.validTo == null || version.validTo >= serviceDate),
  );
  return versions.sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] ?? null;
}

export function listServiceRateHistory(
  tenantId: string,
  serviceCatalogItemId: string,
): ServiceResult<AssistServiceRateVersion[]> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Stundensätze im Live-Modus noch nicht angebunden.' };
  }

  return {
    ok: true,
    data: listServiceRateVersions(tenantId, serviceCatalogItemId).sort((a, b) =>
      b.validFrom.localeCompare(a.validFrom),
    ),
  };
}
