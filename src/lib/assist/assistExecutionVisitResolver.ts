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

/** Lightweight batch resolver for list overlays — avoids per-row resolveLiveAssignment storms. */
export async function batchResolveVisitAndAssignmentIds(
  tenantId: string,
  rawIds: string[],
): Promise<Map<string, VisitAssignmentIdPair>> {
  const result = new Map<string, VisitAssignmentIdPair>();
  if (rawIds.length === 0) return result;

  const uniqueRawIds = [...new Set(rawIds)];

  for (const rawId of uniqueRawIds) {
    const masterId = resolveVisitMasterId(rawId);
    if (!isUuid(masterId)) {
      result.set(rawId, { visitId: masterId, assignmentId: masterId });
    }
  }

  if (getServiceMode() !== 'supabase') {
    for (const rawId of uniqueRawIds) {
      if (result.has(rawId)) continue;
      const masterId = resolveVisitMasterId(rawId);
      result.set(rawId, { visitId: masterId, assignmentId: masterId });
    }
    return result;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    for (const rawId of uniqueRawIds) {
      if (result.has(rawId)) continue;
      const masterId = resolveVisitMasterId(rawId);
      result.set(rawId, { visitId: masterId, assignmentId: masterId });
    }
    return result;
  }

  const uuidMasterIds = [
    ...new Set(uniqueRawIds.map((id) => resolveVisitMasterId(id)).filter(isUuid)),
  ];

  if (uuidMasterIds.length === 0) return result;

  const [visitsById, visitsByLegacy] = await Promise.all([
    fromUnknownTable(supabase, 'assist_visits')
      .select('id, legacy_assignment_id')
      .eq('tenant_id', tenantId)
      .in('id', uuidMasterIds),
    fromUnknownTable(supabase, 'assist_visits')
      .select('id, legacy_assignment_id')
      .eq('tenant_id', tenantId)
      .in('legacy_assignment_id', uuidMasterIds),
  ]);

  const visitIdToPair = new Map<string, VisitAssignmentIdPair>();
  const legacyToVisitId = new Map<string, string>();

  for (const row of (visitsById.data ?? []) as Array<{
    id: string;
    legacy_assignment_id?: string | null;
  }>) {
    const legacy = row.legacy_assignment_id?.trim();
    visitIdToPair.set(row.id, {
      visitId: row.id,
      assignmentId: legacy || row.id,
    });
  }

  for (const row of (visitsByLegacy.data ?? []) as Array<{
    id: string;
    legacy_assignment_id?: string | null;
  }>) {
    const legacy = row.legacy_assignment_id?.trim();
    if (legacy) legacyToVisitId.set(legacy, row.id);
  }

  for (const rawId of uniqueRawIds) {
    if (result.has(rawId)) continue;

    const masterId = resolveVisitMasterId(rawId);
    const byVisitId = visitIdToPair.get(masterId);
    if (byVisitId) {
      result.set(rawId, byVisitId);
      continue;
    }

    const linkedVisitId = legacyToVisitId.get(masterId);
    if (linkedVisitId) {
      result.set(rawId, {
        visitId: linkedVisitId,
        assignmentId: masterId,
      });
      continue;
    }

    result.set(rawId, { visitId: masterId, assignmentId: masterId });
  }

  return result;
}

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
