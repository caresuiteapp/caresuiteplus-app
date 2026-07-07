import {
  resolveLiveAssignment,
  resolveLiveVisitId,
} from '@/features/liveTracking/resolveLiveAssignment';
import { visitSupabaseRepository } from '@/lib/assist/repositories/visitRepository.supabase';
import { getServiceMode } from '@/lib/services/mode';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { isUuid } from '@/lib/validation/uuid';

export type VisitAssignmentIdPair = {
  visitId: string;
  assignmentId: string;
};

/** Resolve assist_visits.id and assignments.id for office enrichment (legacy_assignment_id aware). */
export async function resolveVisitAndAssignmentIds(
  tenantId: string,
  rawId: string,
): Promise<VisitAssignmentIdPair> {
  const masterId = resolveVisitMasterId(rawId);
  if (!isUuid(masterId)) {
    return { visitId: masterId, assignmentId: masterId };
  }

  if (getServiceMode() === 'supabase') {
    const resolved = await resolveLiveAssignment({ tenantId, rawId: masterId });
    if (resolved.ok && resolved.data) {
      return {
        visitId: resolved.data.visitId,
        assignmentId: resolveVisitMasterId(resolved.data.assignmentId),
      };
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: visitRow } = await fromUnknownTable(supabase, 'assist_visits')
        .select('id, legacy_assignment_id')
        .eq('tenant_id', tenantId)
        .eq('id', masterId)
        .maybeSingle();

      if (visitRow) {
        const legacyAssignmentId = (visitRow as { legacy_assignment_id?: string | null })
          .legacy_assignment_id;
        return {
          visitId: masterId,
          assignmentId: legacyAssignmentId?.trim() || masterId,
        };
      }

      const linkedVisitId = await visitSupabaseRepository.resolveVisitId(tenantId, masterId);
      if (linkedVisitId) {
        return { visitId: linkedVisitId, assignmentId: masterId };
      }
    }
  }

  return { visitId: masterId, assignmentId: masterId };
}

/** Resolve assist_visits.id from visit or legacy assignment id — Supabase only. */
export async function resolveAssistVisitIdForPersistence(
  tenantId: string,
  assignmentOrVisitId: string,
): Promise<string | null> {
  if (getServiceMode() !== 'supabase' || !isUuid(resolveVisitMasterId(assignmentOrVisitId))) return null;
  return resolveLiveVisitId(tenantId, resolveVisitMasterId(assignmentOrVisitId));
}
