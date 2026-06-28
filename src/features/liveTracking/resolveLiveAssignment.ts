/**
 * Central resolver: assignmentId ↔ visitId bridge for all live-tracking portals.
 * Handles route params, legacy_assignment_id, and missing assignment mirror rows.
 */
import type { ServiceResult } from '@/types';
import {
  assignmentSupabaseRepository,
  type AssignmentDetail,
} from '@/lib/assist/repositories/assignmentRepository.supabase';
import { visitSupabaseRepository } from '@/lib/assist/repositories/visitRepository.supabase';
import { mapVisitDetailToAssignmentDetail } from '@/lib/portal/employeePortalAssignmentBridge';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { getServiceMode } from '@/lib/services/mode';
import { isUuid } from '@/lib/validation/uuid';

export type LiveAssignmentResolution = {
  assignmentId: string;
  visitId: string;
  clientId: string;
  employeeId: string | null;
  detail: AssignmentDetail;
  source: 'assignments' | 'assist_visits' | 'legacy_bridge';
};

export type ResolveLiveAssignmentInput = {
  tenantId: string;
  /** Route param — may be assignment id, visit id, or legacy assignment id */
  rawId: string;
  employeeId?: string | null;
  clientId?: string | null;
};

async function findVisitIdByLegacyAssignment(
  tenantId: string,
  legacyId: string,
): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase || !isUuid(legacyId)) return null;

  const { data, error } = await fromUnknownTable(supabase, 'assist_visits')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('legacy_assignment_id', legacyId)
    .maybeSingle();

  if (error || !data) return null;
  return String((data as { id: string }).id);
}

function assertScope(
  resolution: Omit<LiveAssignmentResolution, 'detail' | 'source'> & { detail: AssignmentDetail },
  input: ResolveLiveAssignmentInput,
): ServiceResult<never> | null {
  if (input.employeeId && resolution.employeeId && resolution.employeeId !== input.employeeId) {
    return { ok: false, error: 'Einsatz nicht zugewiesen.' };
  }
  if (input.clientId && resolution.clientId !== input.clientId) {
    return { ok: false, error: 'Kein Zugriff auf diesen Einsatz.' };
  }
  return null;
}

/** Resolve a live assignment from any portal route id. Supabase-first; demo falls back to visit repo. */
export async function resolveLiveAssignment(
  input: ResolveLiveAssignmentInput,
): Promise<ServiceResult<LiveAssignmentResolution | null>> {
  const { tenantId, rawId } = input;
  if (!tenantId?.trim() || !rawId?.trim()) {
    return { ok: false, error: 'Einsatzdaten unvollständig.' };
  }
  if (!isUuid(rawId)) {
    return { ok: true, data: null };
  }

  if (getServiceMode() !== 'supabase') {
    const fromAssignments = await assignmentSupabaseRepository.getById(tenantId, rawId);
    if (!fromAssignments.ok) return fromAssignments;
    if (fromAssignments.data) {
      const scope = assertScope(
        {
          assignmentId: fromAssignments.data.id,
          visitId: fromAssignments.data.id,
          clientId: fromAssignments.data.clientId,
          employeeId: fromAssignments.data.employeeId || null,
          detail: fromAssignments.data,
        },
        input,
      );
      if (scope) return scope;
      return {
        ok: true,
        data: {
          assignmentId: fromAssignments.data.id,
          visitId: fromAssignments.data.id,
          clientId: fromAssignments.data.clientId,
          employeeId: fromAssignments.data.employeeId || null,
          detail: fromAssignments.data,
          source: 'assignments',
        },
      };
    }
    return { ok: true, data: null };
  }

  const fromAssignments = await assignmentSupabaseRepository.getById(tenantId, rawId);
  if (!fromAssignments.ok) return fromAssignments;
  if (fromAssignments.data) {
    const visitId =
      (await visitSupabaseRepository.resolveVisitId(tenantId, rawId)) ?? fromAssignments.data.id;
    const scope = assertScope(
      {
        assignmentId: fromAssignments.data.id,
        visitId,
        clientId: fromAssignments.data.clientId,
        employeeId: fromAssignments.data.employeeId || null,
        detail: fromAssignments.data,
      },
      input,
    );
    if (scope) return scope;
    return {
      ok: true,
      data: {
        assignmentId: fromAssignments.data.id,
        visitId,
        clientId: fromAssignments.data.clientId,
        employeeId: fromAssignments.data.employeeId || null,
        detail: fromAssignments.data,
        source: 'assignments',
      },
    };
  }

  const fromVisit = await visitSupabaseRepository.getById(tenantId, rawId);
  if (!fromVisit.ok) return fromVisit;
  if (fromVisit.data) {
    const detail = mapVisitDetailToAssignmentDetail(fromVisit.data);
    const scope = assertScope(
      {
        assignmentId: fromVisit.data.id,
        visitId: fromVisit.data.id,
        clientId: fromVisit.data.clientId,
        employeeId: fromVisit.data.employeeId ?? null,
        detail,
      },
      input,
    );
    if (scope) return scope;
    return {
      ok: true,
      data: {
        assignmentId: fromVisit.data.id,
        visitId: fromVisit.data.id,
        clientId: fromVisit.data.clientId,
        employeeId: fromVisit.data.employeeId ?? null,
        detail,
        source: 'assist_visits',
      },
    };
  }

  const legacyVisitId = await findVisitIdByLegacyAssignment(tenantId, rawId);
  if (legacyVisitId) {
    const legacyVisit = await visitSupabaseRepository.getById(tenantId, legacyVisitId);
    if (!legacyVisit.ok) return legacyVisit;
    if (legacyVisit.data) {
      const detail = mapVisitDetailToAssignmentDetail(legacyVisit.data);
      const scope = assertScope(
        {
          assignmentId: rawId,
          visitId: legacyVisitId,
          clientId: legacyVisit.data.clientId,
          employeeId: legacyVisit.data.employeeId ?? null,
          detail,
        },
        input,
      );
      if (scope) return scope;
      return {
        ok: true,
        data: {
          assignmentId: rawId,
          visitId: legacyVisitId,
          clientId: legacyVisit.data.clientId,
          employeeId: legacyVisit.data.employeeId ?? null,
          detail,
          source: 'legacy_bridge',
        },
      };
    }
  }

  return { ok: true, data: null };
}

/** Resolve visit id for persistence writes (tracking sessions, location points). */
export async function resolveLiveVisitId(
  tenantId: string,
  assignmentOrVisitId: string,
): Promise<string | null> {
  const resolved = await resolveLiveAssignment({ tenantId, rawId: assignmentOrVisitId });
  if (!resolved.ok || !resolved.data) {
    return visitSupabaseRepository.resolveVisitId(tenantId, assignmentOrVisitId);
  }
  return resolved.data.visitId;
}

/** Server-side RPC fallback when client RLS blocks direct reads. */
export async function resolveLiveAssignmentViaRpc(
  tenantId: string,
  rawId: string,
): Promise<ServiceResult<LiveAssignmentResolution | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return resolveLiveAssignment({ tenantId, rawId });
  }

  const { data, error } = await (
    supabase as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc('resolve_live_assignment', {
    p_tenant_id: tenantId,
    p_raw_id: rawId,
  });

  if (error) {
    const msg = toGermanSupabaseError(error);
    if (msg.includes('resolve_live_assignment') || msg.includes('function')) {
      return resolveLiveAssignment({ tenantId, rawId });
    }
    return { ok: false, error: msg };
  }

  const rows = data as Array<Record<string, unknown>> | null;
  const row = rows?.[0] ?? null;
  if (!row?.assignment_id) {
    return resolveLiveAssignment({ tenantId, rawId });
  }

  const assignmentId = String(row.assignment_id);
  const visitId = String(row.visit_id ?? assignmentId);
  const detailResult = await assignmentSupabaseRepository.getById(tenantId, assignmentId);
  if (detailResult.ok && detailResult.data) {
    return {
      ok: true,
      data: {
        assignmentId,
        visitId,
        clientId: String(row.client_id ?? detailResult.data.clientId),
        employeeId: row.employee_id ? String(row.employee_id) : detailResult.data.employeeId || null,
        detail: detailResult.data,
        source: 'assignments',
      },
    };
  }

  const visitResult = await visitSupabaseRepository.getById(tenantId, visitId);
  if (visitResult.ok && visitResult.data) {
    return {
      ok: true,
      data: {
        assignmentId,
        visitId,
        clientId: visitResult.data.clientId,
        employeeId: visitResult.data.employeeId ?? null,
        detail: mapVisitDetailToAssignmentDetail(visitResult.data),
        source: 'legacy_bridge',
      },
    };
  }

  return resolveLiveAssignment({ tenantId, rawId });
}
