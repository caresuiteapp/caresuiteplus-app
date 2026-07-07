import type { ServiceResult } from '@/types';
import type { OfficeAuditEntry } from '@/lib/officeCore/auditLogService';
import {
  mapClientAuditRow,
  mapClientDocumentEventRow,
  mapCostCarrierAuditRow,
  mergeOfficeAuditEntries,
  type ClientAuditRow,
  type ClientDocumentEventRow,
  type CostCarrierAuditRow,
} from '@/lib/officeCore/auditLogMapper';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '../errors';

const LIST_LIMIT = 100;
export const DASHBOARD_AUDIT_LIMIT = 25;

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

/** WP222 — Live Supabase Repository (Office audit log aggregation) */
export const officeAuditLogSupabaseRepository = {
  wpNumber: 222 as const,
  sources: ['client_audit_entries', 'cost_carrier_audit_events', 'client_document_events'] as const,

  async list(
    tenantId: string,
    limit = LIST_LIMIT,
  ): Promise<ServiceResult<OfficeAuditEntry[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const [clientAudit, costCarrierAudit, documentEvents] = await Promise.all([
      fromUnknownTable(supabase, 'client_audit_entries')
        .select('id, action, details, actor_name, created_at, client_id')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('cost_carrier_audit_events')
        .select('id, action, entity_type, entity_id, actor_user_id, metadata, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit),
      fromUnknownTable(supabase, 'client_document_events')
        .select('id, event_type, summary, created_at, client_id, profiles(full_name, first_name, last_name)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);

    const errors = [clientAudit.error, costCarrierAudit.error, documentEvents.error].filter(Boolean);
    const hasData =
      (clientAudit.data?.length ?? 0) > 0 ||
      (costCarrierAudit.data?.length ?? 0) > 0 ||
      (documentEvents.data?.length ?? 0) > 0;

    if (errors.length === 3 && !hasData) {
      return { ok: false, error: toGermanSupabaseError(errors[0]) };
    }

    const entries = mergeOfficeAuditEntries([
      ...((clientAudit.data ?? []) as ClientAuditRow[]).map(mapClientAuditRow),
      ...((costCarrierAudit.data ?? []) as CostCarrierAuditRow[]).map(mapCostCarrierAuditRow),
      ...((documentEvents.data ?? []) as ClientDocumentEventRow[]).map(mapClientDocumentEventRow),
    ]);

    return { ok: true, data: entries.slice(0, limit) };
  },
};
