import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import type {
  ClientVariableEntitlementConsumption,
  ClientVariableEntitlementConsumptionKind,
  ClientVariableEntitlementKind,
  ClientVariableEntitlementVersion,
} from './clientVariableEntitlementDomain';

export type ClientVariableEntitlementLedger = {
  versions: ClientVariableEntitlementVersion[];
  consumption: ClientVariableEntitlementConsumption[];
};

function required(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Ungültiges Feld: ${field}`);
  return value;
}

function nullable(value: unknown, field: string): string | null {
  return value === null || value === undefined ? null : required(value, field);
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`Ungültiges Feld: ${field}`);
  return parsed;
}

function quantityText(value: unknown, field: string): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return String(value);
  throw new Error(`Ungültiges Feld: ${field}`);
}

function entitlementKind(value: unknown): ClientVariableEntitlementKind {
  const parsed = required(value, 'entitlement_kind');
  if (!['money', 'hours', 'days', 'units'].includes(parsed)) throw new Error('Unbekannte Anspruchsart.');
  return parsed as ClientVariableEntitlementKind;
}

function eventKind(value: unknown): ClientVariableEntitlementConsumptionKind {
  const parsed = required(value, 'event_kind');
  if (!['usage', 'correction', 'cancellation'].includes(parsed)) throw new Error('Unbekannte Verbrauchsereignisart.');
  return parsed as ClientVariableEntitlementConsumptionKind;
}

export function mapClientVariableEntitlementVersionRow(row: Record<string, unknown>): ClientVariableEntitlementVersion {
  return {
    id: required(row.id, 'id'), logicalEntitlementId: required(row.logical_entitlement_id, 'logical_entitlement_id'),
    tenantId: required(row.tenant_id, 'tenant_id'), clientId: required(row.client_id, 'client_id'),
    financingPathId: required(row.financing_path_id, 'financing_path_id'), version: positiveInteger(row.version, 'version'),
    entitlementKind: entitlementKind(row.entitlement_kind), unit: required(row.unit, 'unit'),
    allocatedQuantity: quantityText(row.allocated_quantity, 'allocated_quantity'),
    decisionDocumentId: required(row.decision_document_id, 'decision_document_id'),
    decisionReference: required(row.decision_reference, 'decision_reference'),
    decisionIssuedOn: required(row.decision_issued_on, 'decision_issued_on'),
    validFrom: required(row.valid_from, 'valid_from'), validUntil: nullable(row.valid_until, 'valid_until'),
    predecessorVersionId: nullable(row.predecessor_version_id, 'predecessor_version_id'),
    changeReason: nullable(row.change_reason, 'change_reason'), basisFingerprint: required(row.basis_fingerprint, 'basis_fingerprint'),
    recordedAt: required(row.recorded_at, 'recorded_at'),
  };
}

export function mapClientVariableEntitlementConsumptionRow(row: Record<string, unknown>): ClientVariableEntitlementConsumption {
  return {
    id: required(row.id, 'id'), tenantId: required(row.tenant_id, 'tenant_id'), clientId: required(row.client_id, 'client_id'),
    financingPathId: required(row.financing_path_id, 'financing_path_id'),
    entitlementVersionId: required(row.entitlement_version_id, 'entitlement_version_id'),
    logicalEntitlementId: required(row.logical_entitlement_id, 'logical_entitlement_id'),
    entitlementVersion: positiveInteger(row.entitlement_version, 'entitlement_version'),
    entitlementKind: entitlementKind(row.entitlement_kind), unit: required(row.unit, 'unit'),
    basisFingerprint: required(row.basis_fingerprint, 'basis_fingerprint'), serviceOn: required(row.service_on, 'service_on'),
    quantity: quantityText(row.quantity, 'quantity'), eventKind: eventKind(row.event_kind),
    supersedesEventId: nullable(row.supersedes_event_id, 'supersedes_event_id'),
    evidenceReference: required(row.evidence_reference, 'evidence_reference'), reason: nullable(row.reason, 'reason'),
    recordedAt: required(row.recorded_at, 'recorded_at'),
  };
}

export async function listClientVariableEntitlementLedger(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientVariableEntitlementLedger>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
    const versionResult = await fromUnknownTable(client, 'client_variable_entitlement_versions')
      .select('*').eq('tenant_id', tenantId).eq('client_id', clientId)
      .order('recorded_at', { ascending: true }).order('id', { ascending: true });
    if (versionResult.error) {
      if (isSupabaseMissingTableError(versionResult.error)) return { ok: true, data: { versions: [], consumption: [] }, tableMissing: true };
      return { ok: false, error: toGermanSupabaseError(versionResult.error) };
    }
    const consumptionResult = await fromUnknownTable(client, 'client_variable_entitlement_consumptions')
      .select('*').eq('tenant_id', tenantId).eq('client_id', clientId)
      .order('recorded_at', { ascending: true }).order('id', { ascending: true });
    if (consumptionResult.error) {
      if (isSupabaseMissingTableError(consumptionResult.error)) return { ok: true, data: { versions: [], consumption: [] }, tableMissing: true };
      return { ok: false, error: toGermanSupabaseError(consumptionResult.error) };
    }
    try {
      const versions = (versionResult.data ?? []).map((row) => mapClientVariableEntitlementVersionRow(row as Record<string, unknown>));
      const consumption = (consumptionResult.data ?? []).map((row) => mapClientVariableEntitlementConsumptionRow(row as Record<string, unknown>));
      if (versions.some((row) => row.tenantId !== tenantId || row.clientId !== clientId)
        || consumption.some((row) => row.tenantId !== tenantId || row.clientId !== clientId)) {
        return { ok: false, error: 'Veränderliche Leistungsansprüche konnten nicht mandanten- und falltreu gelesen werden.' };
      }
      return { ok: true, data: { versions, consumption } };
    } catch {
      return { ok: false, error: 'Veränderliche Leistungsansprüche enthalten unvollständige oder unbekannte Originaldaten.' };
    }
  });
}
