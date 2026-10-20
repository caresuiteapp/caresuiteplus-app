import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { fetchLatestVisitProof } from '@/lib/assist/assistVisitProofPersistenceService';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';

export type PortalSyncChainRow = {
  visitId: string;
  assignmentId?: string | null;
  employeePortalStatus?: string;
  assistProofStatus?: string | null;
  officeReleaseStatus?: string | null;
  portalVisible?: boolean;
  pdfStoragePath?: string | null;
  signatureComplete?: boolean;
  label?: string;
};

type VisitRow = {
  id: string;
  title: string | null;
  execution_status: string | null;
  portal_status: string | null;
  proof_status: string | null;
  legacy_assignment_id: string | null;
  client_id: string;
};

function mapExecutionStatus(status: string | null | undefined): string {
  switch (status) {
    case 'in_progress':
      return 'gestartet';
    case 'completed':
      return 'abgeschlossen';
    case 'scheduled':
      return 'geplant';
    default:
      return status ?? '—';
  }
}

export async function listPortalSyncRowsForClient(
  tenantId: string,
  clientId: string,
  options?: { limit?: number },
): Promise<ServiceResult<PortalSyncChainRow[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const limit = options?.limit ?? 20;

    const { data, error } = await fromUnknownTable(client, 'assist_visits')
      .select(
        'id, title, execution_status, portal_status, proof_status, legacy_assignment_id, client_id',
      )
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('planned_start_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    const visits = (data ?? []) as VisitRow[];
    const rows: PortalSyncChainRow[] = [];

    for (const visit of visits) {
      const proofResult = await fetchLatestVisitProof(tenantId, visit.id);
      const proof = proofResult.ok ? proofResult.data : null;

      rows.push({
        visitId: visit.id,
        assignmentId: visit.legacy_assignment_id,
        employeePortalStatus: mapExecutionStatus(visit.execution_status),
        assistProofStatus: proof?.status ?? visit.proof_status ?? null,
        officeReleaseStatus: proof?.portalReleaseStatus ?? visit.portal_status ?? null,
        portalVisible: proof?.portalVisible ?? false,
        pdfStoragePath: proof?.pdfStoragePath ?? null,
        signatureComplete: Boolean(proof?.signatureId || proof?.approvedAt),
        label: visit.title ?? undefined,
      });
    }

    return { ok: true, data: rows.filter((row) => row.assistProofStatus || row.employeePortalStatus !== '—') };
  });
}
