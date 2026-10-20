import type { ServiceResult } from '@/types';
import type { GkvCostCarrier } from '@/types/gkvBilling';
import {
  findGkvCostCarrierById,
  listGkvCostCarriers,
  searchGkvCostCarriersStore,
  upsertGkvCostCarrier,
} from './gkvBillingStore';
import { isValidIkFormat } from './gkvProductionGuard';

export function searchGkvCostCarriers(tenantId: string, query: string): GkvCostCarrier[] {
  return searchGkvCostCarriersStore(tenantId, query);
}

export function getGkvCostCarrier(tenantId: string, costCarrierId: string): GkvCostCarrier | null {
  return findGkvCostCarrierById(tenantId, costCarrierId);
}

export function listAllGkvCostCarriers(tenantId: string): GkvCostCarrier[] {
  return listGkvCostCarriers(tenantId);
}

export type UpsertGkvCostCarrierInput = Omit<
  GkvCostCarrier,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt'
> & { id?: string };

export function saveGkvCostCarrier(
  tenantId: string,
  input: UpsertGkvCostCarrierInput,
): ServiceResult<GkvCostCarrier> {
  if (input.ikNumber && !isValidIkFormat(input.ikNumber)) {
    return { ok: false, error: 'Kostenträger-IK muss 9 Ziffern haben — ungültiges Format.' };
  }

  const now = new Date().toISOString();
  const existing = findGkvCostCarrierById(tenantId, input.costCarrierId);
  const carrier: GkvCostCarrier = {
    id: input.id ?? existing?.id ?? `gkv-cc-${tenantId}-${input.costCarrierId}`,
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
    lastCheckedAt: input.lastCheckedAt ?? now,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  upsertGkvCostCarrier(tenantId, carrier);
  return { ok: true, data: carrier };
}

export function importGkvCostCarrierFromFile(
  tenantId: string,
  input: UpsertGkvCostCarrierInput,
): ServiceResult<GkvCostCarrier> {
  return saveGkvCostCarrier(tenantId, {
    ...input,
    source: 'kostentraegerdatei',
    lastCheckedAt: new Date().toISOString(),
  });
}
