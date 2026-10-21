import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import type {
  ClientContractLifecycleEvent,
  ClientContractLifecycleKind,
  ClientContractServiceBinding,
} from './clientContractLifecycleDomain';

export type ClientContractLifecycleLedger = {
  events: ClientContractLifecycleEvent[];
  serviceBindings: ClientContractServiceBinding[];
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

export function mapClientContractLifecycleEventRow(row: Record<string, unknown>): ClientContractLifecycleEvent {
  const kind = required(row.event_kind, 'event_kind');
  if (!['initial', 'amendment', 'closure'].includes(kind)) throw new Error('Unbekannte Lebenszyklusart.');
  return {
    id: required(row.id, 'id'), logicalContractId: required(row.logical_contract_id, 'logical_contract_id'),
    sourceContractId: required(row.source_contract_id, 'source_contract_id'),
    tenantId: required(row.tenant_id, 'tenant_id'), clientId: required(row.client_id, 'client_id'),
    version: positiveInteger(row.version, 'version'), kind: kind as ClientContractLifecycleKind,
    effectiveOn: required(row.effective_on, 'effective_on'), changeReason: nullable(row.change_reason, 'change_reason'),
    consequences: nullable(row.consequences, 'consequences'), predecessorEventId: nullable(row.predecessor_event_id, 'predecessor_event_id'),
    contractNumber: required(row.contract_number, 'contract_number'), contractPartner: required(row.contract_partner, 'contract_partner'),
    serviceBasis: required(row.service_basis, 'service_basis'), documentReference: required(row.document_reference, 'document_reference'),
    contentFingerprint: required(row.content_fingerprint, 'content_fingerprint'), recordedAt: required(row.recorded_at, 'recorded_at'),
  };
}

export function mapClientContractServiceBindingRow(row: Record<string, unknown>): ClientContractServiceBinding {
  return {
    id: required(row.id, 'id'), tenantId: required(row.tenant_id, 'tenant_id'), clientId: required(row.client_id, 'client_id'),
    logicalContractId: required(row.logical_contract_id, 'logical_contract_id'), lifecycleEventId: required(row.lifecycle_event_id, 'lifecycle_event_id'),
    lifecycleVersion: positiveInteger(row.lifecycle_version, 'lifecycle_version'), lifecycleFingerprint: required(row.lifecycle_fingerprint, 'lifecycle_fingerprint'),
    serviceEvidenceId: required(row.service_evidence_id, 'service_evidence_id'), serviceOccurredOn: required(row.service_occurred_on, 'service_occurred_on'),
    linkedAt: required(row.linked_at, 'linked_at'),
  };
}

export async function listClientContractLifecycleLedger(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientContractLifecycleLedger>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
    const eventResult = await fromUnknownTable(client, 'client_contract_lifecycle_events')
      .select('*').eq('tenant_id', tenantId).eq('client_id', clientId).order('recorded_at', { ascending: true });
    if (eventResult.error) {
      if (isSupabaseMissingTableError(eventResult.error)) return { ok: true, data: { events: [], serviceBindings: [] }, tableMissing: true };
      return { ok: false, error: toGermanSupabaseError(eventResult.error) };
    }
    const bindingResult = await fromUnknownTable(client, 'client_contract_service_bindings')
      .select('*').eq('tenant_id', tenantId).eq('client_id', clientId).order('linked_at', { ascending: true });
    if (bindingResult.error) {
      if (isSupabaseMissingTableError(bindingResult.error)) return { ok: true, data: { events: [], serviceBindings: [] }, tableMissing: true };
      return { ok: false, error: toGermanSupabaseError(bindingResult.error) };
    }
    try {
      const events = (eventResult.data ?? []).map((row) => mapClientContractLifecycleEventRow(row as Record<string, unknown>));
      const serviceBindings = (bindingResult.data ?? []).map((row) => mapClientContractServiceBindingRow(row as Record<string, unknown>));
      if ([...events, ...serviceBindings].some((row) => row.tenantId !== tenantId || row.clientId !== clientId)) {
        return { ok: false, error: 'Vertragshistorie konnte nicht mandanten- und falltreu gelesen werden.' };
      }
      return { ok: true, data: { events, serviceBindings } };
    } catch {
      return { ok: false, error: 'Vertragshistorie enthält unvollständige oder unbekannte Originaldaten.' };
    }
  });
}
