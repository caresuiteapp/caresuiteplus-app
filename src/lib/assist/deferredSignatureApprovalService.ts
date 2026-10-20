import type { ServiceResult, RoleKey } from '@/types';
import { fetchVisitDispositionDetail } from '@/lib/assist/visitService';
import { releaseAdministrativeDeferredClientSignatureRequest } from '@/lib/portal/deferredVisitClientSignatureService';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';

export type DeferredSignatureApprovalRequest = {
  id: string;
  tenantId: string;
  visitId: string;
  clientId: string;
  employeeId: string | null;
  serviceDate: string;
  serviceName: string;
  plannedStartAt: string;
  plannedEndAt: string;
  actualStartAt: string | null;
  actualEndAt: string | null;
  clientName: string;
  employeeName: string;
  documentation: string;
  requestReason: string;
  requestedAt: string;
};

function previewValue(preview: unknown, key: string): string {
  if (!preview || typeof preview !== 'object' || Array.isArray(preview)) return '';
  const value = (preview as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

export async function fetchPendingDeferredSignatureApprovals(
  tenantId: string,
): Promise<ServiceResult<DeferredSignatureApprovalRequest[]>> {
  if (getServiceMode() !== 'supabase') return { ok: true, data: [] };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  const { data, error } = await fromUnknownTable(supabase, 'assist_visit_signature_requests')
    .select('id, tenant_id, visit_id, client_id, employee_id, request_reason, service_date, service_name, planned_start_at, planned_end_at, actual_start_at, actual_end_at, proof_preview, requested_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending_admin_approval')
    .order('requested_at', { ascending: true });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      visitId: String(row.visit_id),
      clientId: String(row.client_id),
      employeeId: row.employee_id ? String(row.employee_id) : null,
      serviceDate: String(row.service_date),
      serviceName: String(row.service_name),
      plannedStartAt: String(row.planned_start_at),
      plannedEndAt: String(row.planned_end_at),
      actualStartAt: row.actual_start_at ? String(row.actual_start_at) : null,
      actualEndAt: row.actual_end_at ? String(row.actual_end_at) : null,
      clientName: previewValue(row.proof_preview, 'client_name') || 'Klient:in',
      employeeName: previewValue(row.proof_preview, 'employee_name') || 'Mitarbeiter:in',
      documentation: previewValue(row.proof_preview, 'documentation'),
      requestReason: String(row.request_reason ?? previewValue(row.proof_preview, 'request_reason')),
      requestedAt: String(row.requested_at),
    })),
  };
}

async function decide(
  requestId: string,
  decision: 'approved' | 'rejected',
  reason?: string,
): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  const { error } = await supabase.rpc('admin_decide_deferred_signature_approval' as never, {
    p_request_id: requestId,
    p_decision: decision,
    p_reason: reason?.trim() || null,
  } as never);
  return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
}

export async function approveDeferredSignatureRequest(
  request: DeferredSignatureApprovalRequest,
  roleKey: RoleKey | null,
): Promise<ServiceResult<void>> {
  const visit = await fetchVisitDispositionDetail(request.visitId, request.tenantId, roleKey);
  if (!visit.ok) return { ok: false, error: visit.error };
  const released = await releaseAdministrativeDeferredClientSignatureRequest(
    request.tenantId,
    visit.data,
  );
  if (!released.ok) return { ok: false, error: released.error };
  return decide(request.id, 'approved');
}

export function rejectDeferredSignatureRequest(
  requestId: string,
  reason: string,
): Promise<ServiceResult<void>> {
  return decide(requestId, 'rejected', reason);
}
