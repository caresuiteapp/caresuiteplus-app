import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServiceResult } from '@/types';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

export type LegacyAssignmentSyncInput = {
  visitId: string;
  tenantId: string;
  clientId: string;
  employeeId: string | null;
  assignmentDate: string;
  plannedStartAt: string;
  plannedEndAt: string;
  title: string;
  description?: string | null;
  addressSnapshot?: string | null;
  internalNotes?: string | null;
  clientVisibleNotes?: string | null;
  /** Remote assignment_status value, e.g. planned | on_the_way */
  canonicalStatus: string;
  saveAsDraft: boolean;
  createdBy?: string | null;
};

/** Mirror assist_visits row into legacy assignments table for portal + execution flows. */
export async function upsertLegacyAssignmentFromVisit(
  supabase: SupabaseClient,
  input: LegacyAssignmentSyncInput,
): Promise<ServiceResult<{ assignmentId: string | null }>> {
  if (input.saveAsDraft) {
    return { ok: true, data: { assignmentId: null } };
  }

  const assignmentRow = {
    id: input.visitId,
    tenant_id: input.tenantId,
    client_id: input.clientId,
    employee_id: input.employeeId,
    assignment_date: input.assignmentDate,
    planned_start_at: input.plannedStartAt,
    planned_end_at: input.plannedEndAt,
    title: input.title.trim(),
    description: input.description ?? null,
    address_snapshot: input.addressSnapshot ?? null,
    internal_notes: input.internalNotes ?? null,
    client_visible_notes: input.clientVisibleNotes ?? null,
    status: input.canonicalStatus,
    product_key: 'assist',
    created_by: input.createdBy ?? null,
  };

  const { error } = await fromUnknownTable(supabase, 'assignments').upsert(assignmentRow, {
    onConflict: 'id',
  });
  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const { error: linkError } = await fromUnknownTable(supabase, 'assist_visits')
    .update({ legacy_assignment_id: input.visitId })
    .eq('tenant_id', input.tenantId)
    .eq('id', input.visitId);

  if (linkError) {
    return { ok: false, error: toGermanSupabaseError(linkError) };
  }

  return { ok: true, data: { assignmentId: input.visitId } };
}

export async function syncLegacyAssignmentStatusFromVisit(
  supabase: SupabaseClient,
  tenantId: string,
  visitId: string,
  remoteStatus: string,
  timestampPatch?: Record<string, unknown>,
): Promise<ServiceResult<void>> {
  const patch: Record<string, unknown> = {
    status: remoteStatus,
    updated_at: new Date().toISOString(),
    ...timestampPatch,
  };

  const { error } = await fromUnknownTable(supabase, 'assignments')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', visitId);

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: undefined };
}

export async function syncLegacyAssignmentTasksFromVisit(
  supabase: SupabaseClient,
  tenantId: string,
  visitId: string,
  taskTitles: string[],
): Promise<ServiceResult<void>> {
  if (taskTitles.length === 0) {
    return { ok: true, data: undefined };
  }

  const { data: existingTasks, error: existingError } = await fromUnknownTable(
    supabase,
    'assignment_tasks',
  )
    .select('id, title, sort_order')
    .eq('tenant_id', tenantId)
    .eq('assignment_id', visitId);

  if (existingError) {
    return { ok: false, error: toGermanSupabaseError(existingError) };
  }

  const existingTitles = new Set(
    ((existingTasks ?? []) as Array<{ title?: string | null }>).map((row) =>
      String(row.title ?? '').trim(),
    ),
  );

  const missing = taskTitles
    .map((title) => title.trim())
    .filter(Boolean)
    .filter((title) => !existingTitles.has(title));

  if (missing.length === 0) {
    return { ok: true, data: undefined };
  }

  const baseOrder =
    ((existingTasks ?? []) as Array<{ sort_order?: number | null }>).reduce(
      (max, row) => Math.max(max, Number(row.sort_order ?? -1)),
      -1,
    ) + 1;

  const taskRows = missing.map((title, index) => ({
    tenant_id: tenantId,
    assignment_id: visitId,
    title,
    status: 'open' as const,
    is_required: true,
    requires_note_if_not_done: true,
    sort_order: baseOrder + index,
  }));

  const { error: insertError } = await fromUnknownTable(supabase, 'assignment_tasks').insert(
    taskRows,
  );
  if (insertError) {
    return { ok: false, error: toGermanSupabaseError(insertError) };
  }

  return { ok: true, data: undefined };
}
