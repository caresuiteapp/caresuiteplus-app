/**
 * P0 — Assist/Office problem inbox for execution workflow blockers.
 */
import type { ServiceResult } from '@/types';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import { hasAssistWfmEvent } from '@/lib/wfm/wfmWorkSessionRepository';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';

export type AssistExecutionProblemCode =
  | 'ended_missing_documentation'
  | 'documentation_missing_signature'
  | 'signature_missing_proof'
  | 'proof_missing_pdf'
  | 'proof_missing_client_document'
  | 'proof_not_portal_visible'
  | 'budget_reservation_not_executed'
  | 'budget_usage_missing_after_approval'
  | 'wfm_sync_missing'
  | 'assignment_visit_execution_drift';

export type AssistExecutionProblemItem = {
  code: AssistExecutionProblemCode;
  assignmentId: string;
  visitId: string | null;
  clientId: string | null;
  employeeId: string | null;
  title: string;
  message: string;
};

/** Remote DB enum values (assignments.status is English in production). */
const FINISHED_REMOTE_STATUSES = [
  'finished',
  'documentation_open',
  'signature_open',
  'completed',
] as const;

async function hasBudgetReservationNotExecuted(
  tenantId: string,
  visitId: string,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { data } = await fromUnknownTable(supabase, 'client_budget_transactions')
    .select('id, lifecycle_status')
    .eq('tenant_id', tenantId)
    .eq('reference_type', 'assist_visit')
    .eq('reference_id', visitId)
    .eq('transaction_type', 'reservation')
    .limit(5);

  const rows = data ?? [];
  if (rows.length === 0) return false;
  return rows.some((row) => {
    const status = String(row.lifecycle_status ?? 'geplant');
    return status === 'geplant';
  });
}

async function hasMissingBudgetUsageAfterApproval(
  tenantId: string,
  visitId: string,
  proofId: string,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { data: usageByProof } = await fromUnknownTable(supabase, 'client_budget_transactions')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('reference_type', 'assist_visit_proof')
    .eq('reference_id', proofId)
    .eq('transaction_type', 'usage')
    .maybeSingle();

  if (usageByProof?.id) return false;

  const { data: reservation } = await fromUnknownTable(supabase, 'client_budget_transactions')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('reference_type', 'assist_visit')
    .eq('reference_id', visitId)
    .eq('transaction_type', 'reservation')
    .limit(1)
    .maybeSingle();

  return Boolean(reservation?.id);
}

export async function fetchAssistExecutionProblems(
  tenantId: string,
  limit = 50,
): Promise<ServiceResult<AssistExecutionProblemItem[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase ist nicht verfügbar.' };

  const { data: assignments, error: assignError } = await fromUnknownTable(supabase, 'assignments')
    .select('id, client_id, employee_id, status, documentation_notes, title')
    .eq('tenant_id', tenantId)
    .in('status', [...FINISHED_REMOTE_STATUSES])
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (assignError) {
    if (isSupabaseMissingTableError(assignError)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(assignError) };
  }

  const problems: AssistExecutionProblemItem[] = [];

  for (const row of assignments ?? []) {
    const assignmentId = String(row.id);
    const title = String(row.title ?? 'Einsatz');
    const hasDocNotes = Boolean(String(row.documentation_notes ?? '').trim());
    const status = remoteStatusToAssignment(String(row.status ?? ''));
    const employeeId = row.employee_id ? String(row.employee_id) : null;
    const clientId = row.client_id ? String(row.client_id) : null;

    const { data: visitRow } = await fromUnknownTable(supabase, 'assist_visits')
      .select('id, documentation_status, proof_status, proof_template_key, execution_status')
      .eq('tenant_id', tenantId)
      .eq('legacy_assignment_id', assignmentId)
      .maybeSingle();

    const visitId = visitRow?.id ? String(visitRow.id) : null;

    if (
      visitId &&
      ['finished', 'documentation_open', 'signature_open', 'completed'].includes(String(row.status ?? '')) &&
      String(visitRow?.execution_status ?? 'pending') === 'pending'
    ) {
      problems.push({
        code: 'assignment_visit_execution_drift',
        assignmentId,
        visitId,
        clientId,
        employeeId,
        title,
        message: 'Assignment beendet, aber assist_visits.execution_status ist noch pending.',
      });
    }

    let hasDocRow = hasDocNotes;
    if (visitId) {
      const { data: docRow } = await fromUnknownTable(supabase, 'assist_visit_documentation')
        .select('submitted_at')
        .eq('tenant_id', tenantId)
        .eq('visit_id', visitId)
        .maybeSingle();
      hasDocRow = hasDocRow || Boolean(docRow?.submitted_at);
    }

    const requiresSignature =
      visitRow?.proof_template_key && String(visitRow.proof_template_key) !== 'none';

    if (['beendet', 'dokumentation_offen'].includes(status) && !hasDocRow) {
      problems.push({
        code: 'ended_missing_documentation',
        assignmentId,
        visitId,
        clientId,
        employeeId,
        title,
        message: 'Einsatz beendet, Dokumentation fehlt.',
      });
      continue;
    }

    if (requiresSignature && visitId && hasDocRow) {
      const { data: sigRow } = await fromUnknownTable(supabase, 'assist_visit_signatures')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('visit_id', visitId)
        .limit(1)
        .maybeSingle();

      if (!sigRow?.id && ['beendet', 'dokumentation_offen', 'unterschrift_offen'].includes(status)) {
        problems.push({
          code: 'documentation_missing_signature',
          assignmentId,
          visitId,
          clientId,
          employeeId,
          title,
          message: 'Dokumentation vorhanden, Unterschrift fehlt.',
        });
        continue;
      }
    }

    if (visitId && ['beendet', 'dokumentation_offen', 'unterschrift_offen', 'abgeschlossen'].includes(status)) {
      const budgetNotExecuted = await hasBudgetReservationNotExecuted(tenantId, visitId);
      if (budgetNotExecuted) {
        problems.push({
          code: 'budget_reservation_not_executed',
          assignmentId,
          visitId,
          clientId,
          employeeId,
          title,
          message: 'Budget-Reservierung nicht auf „durchgeführt“ gesetzt.',
        });
      }
    }

    if (visitId && status === 'abgeschlossen' && employeeId) {
      const wfmSynced = await hasAssistWfmEvent(
        tenantId,
        employeeId,
        'visit_ended',
        visitId,
      );
      const { data: serviceEnd } = await fromUnknownTable(supabase, 'assist_time_events')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('visit_id', visitId)
        .eq('event_type', 'service_end')
        .limit(1)
        .maybeSingle();

      if (serviceEnd?.id && !wfmSynced) {
        problems.push({
          code: 'wfm_sync_missing',
          assignmentId,
          visitId,
          clientId,
          employeeId,
          title,
          message: 'Einsatz abgeschlossen, Arbeitszeit nicht im Zeitkonto synchronisiert.',
        });
      }
    }

    if (visitId) {
      const { data: proofRow } = await fromUnknownTable(supabase, 'assist_visit_proofs')
        .select('id, pdf_storage_path, storage_path, payload_hash, portal_visible, status')
        .eq('tenant_id', tenantId)
        .eq('visit_id', visitId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (hasDocRow && !proofRow?.id && ['dokumentation_offen', 'unterschrift_offen', 'abgeschlossen'].includes(status)) {
        problems.push({
          code: 'signature_missing_proof',
          assignmentId,
          visitId,
          clientId,
          employeeId,
          title,
          message: 'Leistungsnachweis fehlt.',
        });
        continue;
      }

      if (proofRow?.id && !proofRow.pdf_storage_path && !proofRow.storage_path) {
        problems.push({
          code: 'proof_missing_pdf',
          assignmentId,
          visitId,
          clientId,
          employeeId,
          title,
          message: 'Nachweis ohne PDF/Snapshot-Datei.',
        });
      }

      if (
        proofRow?.id &&
        proofRow.status === 'approved' &&
        proofRow.portal_visible &&
        proofRow.pdf_storage_path
      ) {
        const { data: clientDoc } = await fromUnknownTable(supabase, 'client_documents')
          .select('id, portal_visible')
          .eq('tenant_id', tenantId)
          .eq('id', proofRow.id)
          .maybeSingle();

        if (!clientDoc?.id || !clientDoc.portal_visible) {
          problems.push({
            code: 'proof_missing_client_document',
            assignmentId,
            visitId,
            clientId,
            employeeId,
            title,
            message: 'Nachweis freigegeben, aber kein Dokumenten-Mirror in Klient:innenakte.',
          });
        }

        if (clientId && (await hasMissingBudgetUsageAfterApproval(tenantId, visitId, String(proofRow.id)))) {
          problems.push({
            code: 'budget_usage_missing_after_approval',
            assignmentId,
            visitId,
            clientId,
            employeeId,
            title,
            message: 'Nachweis freigegeben, Budget-Verbrauch fehlt.',
          });
        }
      }

      if (proofRow?.id && proofRow.status === 'approved' && !proofRow.portal_visible) {
        problems.push({
          code: 'proof_not_portal_visible',
          assignmentId,
          visitId,
          clientId,
          employeeId,
          title,
          message: 'Nachweis freigegeben, aber nicht im Klient:innenportal sichtbar.',
        });
      }
    }
  }

  return { ok: true, data: problems.slice(0, limit) };
}

export async function countAssistExecutionProblems(tenantId: string): Promise<number> {
  const result = await fetchAssistExecutionProblems(tenantId, 200);
  return result.ok ? result.data.length : 0;
}
