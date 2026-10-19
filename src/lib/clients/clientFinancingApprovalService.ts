import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import type { ClientFinancingApproval, ClientFinancingDecision } from '@/lib/clients/clientFinancingApprovalDomain';

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Ungültiges Feld: ${field}`);
  return value;
}

function nullableText(value: unknown, field: string): string | null {
  if (value === null) return null;
  return text(value, field);
}

export function mapClientFinancingApprovalRow(row: Record<string, unknown>): ClientFinancingApproval {
  const decision = text(row.decision, 'decision');
  if (!['pending', 'approved', 'rejected', 'withdrawn'].includes(decision)) throw new Error('Unbekannte Genehmigungsentscheidung.');
  const version = row.version;
  if (!Number.isInteger(version) || Number(version) < 1) throw new Error('Ungültige Genehmigungsversion.');
  return {
    id: text(row.id, 'id'),
    logicalApprovalId: text(row.logical_approval_id, 'logical_approval_id'),
    tenantId: text(row.tenant_id, 'tenant_id'),
    clientId: text(row.client_id, 'client_id'),
    financingPathId: text(row.financing_path_id, 'financing_path_id'),
    applicationReference: text(row.application_reference, 'application_reference'),
    appliedOn: text(row.applied_on, 'applied_on'),
    requestedFrom: text(row.requested_from, 'requested_from'),
    requestedUntil: nullableText(row.requested_until, 'requested_until'),
    decision: decision as ClientFinancingDecision,
    decisionReference: nullableText(row.decision_reference, 'decision_reference'),
    decidedOn: nullableText(row.decided_on, 'decided_on'),
    approvedFrom: nullableText(row.approved_from, 'approved_from'),
    approvedUntil: nullableText(row.approved_until, 'approved_until'),
    followUpDueOn: nullableText(row.follow_up_due_on, 'follow_up_due_on'),
    version: Number(version),
    supersedesApprovalId: nullableText(row.supersedes_approval_id, 'supersedes_approval_id'),
    createdAt: text(row.created_at, 'created_at'),
  };
}

export async function listClientFinancingApprovals(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientFinancingApproval[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
    const { data, error } = await fromUnknownTable(client, 'client_financing_approvals')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .is('replaced_at', null)
      .order('applied_on', { ascending: false })
      .order('id', { ascending: true });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    try {
      const approvals = (Array.isArray(data) ? data : []).map((row) =>
        mapClientFinancingApprovalRow(row as Record<string, unknown>));
      if (approvals.some((approval) => approval.tenantId !== tenantId || approval.clientId !== clientId)) {
        return { ok: false, error: 'Genehmigungen konnten nicht mandanten- und falltreu gelesen werden.' };
      }
      return { ok: true, data: approvals };
    } catch {
      return { ok: false, error: 'Genehmigungen enthalten unvollständige oder unbekannte Originaldaten.' };
    }
  });
}
