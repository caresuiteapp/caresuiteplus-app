import type { ServiceResult } from '@/types';
import type { CostCarrier, TenantIkProfile, ConnectBillingMode } from '@/types/connect/billing';
import { runService } from '@/lib/services/serviceRunner';
import { assertTenant } from '@/lib/services/serviceRunner';
import {
  appendBillingAudit,
  findCostCarrierById,
  listCostCarriers,
  readIkProfile,
  searchCostCarriersStore,
  setBillingMode,
  upsertCostCarrier,
  writeIkProfile,
} from './connectBillingStore';

export function getTenantIkProfile(tenantId: string): TenantIkProfile | null {
  return readIkProfile(tenantId);
}

export function updateTenantBillingMode(
  tenantId: string,
  billingMode: ConnectBillingMode,
  actorUserId?: string | null,
): ServiceResult<TenantIkProfile> {
  const profile = setBillingMode(tenantId, billingMode);
  appendBillingAudit({
    id: `audit-mode-${Date.now()}`,
    tenantId,
    action: 'billing.mode_updated',
    entityType: 'tenant_ik_profiles',
    entityId: profile.id,
    summary: `Abrechnungsmodus geändert: ${billingMode}`,
    createdAt: new Date().toISOString(),
  });
  return { ok: true, data: profile };
}

export type UpsertTenantIkProfileInput = Partial<
  Pick<
    TenantIkProfile,
    | 'ikNumber'
    | 'bankAccountHolder'
    | 'bankIban'
    | 'bankBic'
    | 'approvalStatus'
    | 'serviceAreas'
    | 'billingType'
    | 'billingMode'
    | 'verificationStatus'
    | 'notes'
  >
>;

export function upsertTenantIkProfile(
  tenantId: string,
  input: UpsertTenantIkProfileInput,
): ServiceResult<TenantIkProfile> {
  const now = new Date().toISOString();
  const existing = readIkProfile(tenantId);
  const profile: TenantIkProfile = {
    id: existing?.id ?? `tik-${tenantId}`,
    tenantId,
    ikNumber: input.ikNumber ?? existing?.ikNumber ?? null,
    bankAccountHolder: input.bankAccountHolder ?? existing?.bankAccountHolder ?? null,
    bankIban: input.bankIban ?? existing?.bankIban ?? null,
    bankBic: input.bankBic ?? existing?.bankBic ?? null,
    approvalStatus: input.approvalStatus ?? existing?.approvalStatus ?? 'pending',
    serviceAreas: input.serviceAreas ?? existing?.serviceAreas ?? [],
    billingType: input.billingType ?? existing?.billingType ?? null,
    billingMode: input.billingMode ?? existing?.billingMode ?? 'leistungsnachweise_export',
    verificationStatus: input.verificationStatus ?? existing?.verificationStatus ?? 'unverified',
    verifiedAt:
      input.verificationStatus === 'verified'
        ? now
        : existing?.verifiedAt ?? null,
    notes: input.notes ?? existing?.notes ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  writeIkProfile(tenantId, profile);
  appendBillingAudit({
    id: `audit-ik-${Date.now()}`,
    tenantId,
    action: 'billing.ik_profile_updated',
    entityType: 'tenant_ik_profiles',
    entityId: profile.id,
    summary: profile.ikNumber
      ? 'IK-Profil aktualisiert (Vorbereitung).'
      : 'IK-Profil ohne IK-Nummer gespeichert.',
    createdAt: now,
  });
  return { ok: true, data: profile };
}

export function searchCostCarriers(tenantId: string, query: string): CostCarrier[] {
  return searchCostCarriersStore(tenantId, query);
}

export function getCostCarrier(tenantId: string, costCarrierId: string): CostCarrier | null {
  return findCostCarrierById(tenantId, costCarrierId);
}

export type UpsertCostCarrierInput = Omit<
  CostCarrier,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt'
> & { id?: string };

export function saveCostCarrier(
  tenantId: string,
  input: UpsertCostCarrierInput,
): ServiceResult<CostCarrier> {
  const now = new Date().toISOString();
  const existing = findCostCarrierById(tenantId, input.costCarrierId);
  const carrier: CostCarrier = {
    id: input.id ?? existing?.id ?? `cc-${tenantId}-${input.costCarrierId}`,
    tenantId,
    costCarrierId: input.costCarrierId,
    name: input.name,
    type: input.type,
    ikNumber: input.ikNumber,
    billingAddress: input.billingAddress,
    electronicBillingSupported: input.electronicBillingSupported,
    dtaSupported: input.dtaSupported,
    contactData: input.contactData,
    validFrom: input.validFrom,
    validTo: input.validTo,
    source: input.source,
    lastCheckedAt: input.lastCheckedAt,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  upsertCostCarrier(tenantId, carrier);
  return { ok: true, data: carrier };
}

export async function fetchTenantIkProfile(tenantId: string): Promise<ServiceResult<TenantIkProfile | null>> {
  return runService(async () => ({ ok: true, data: getTenantIkProfile(tenantId) }), { delayMs: 100 });
}

export async function fetchCostCarriers(
  tenantId: string,
  query = '',
): Promise<ServiceResult<CostCarrier[]>> {
  return runService(async () => ({ ok: true, data: searchCostCarriers(tenantId, query) }), {
    delayMs: 100,
  });
}

export function assertTenantIkForTenant(
  tenantId: string,
  expectedTenantId: string,
): ServiceResult<null> | null {
  const denied = assertTenant(tenantId, expectedTenantId);
  if (denied) return denied;
  return null;
}

export function listAllCostCarriers(tenantId: string): CostCarrier[] {
  return listCostCarriers(tenantId);
}
