import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { syncCalendarEventAsync, buildCalendarEventFromShift } from '@/lib/calendar/calendarSyncService';
import { createDemoShift, getDemoShiftScheduleListItems, type ShiftScheduleListItem } from './shiftScheduleDemo';
import { isPflegeDemoFunctional } from '@/lib/pflege/pflegeModuleConfig';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

type Row = Record<string, unknown>;
const text = (value: unknown): string => value == null ? '' : String(value);

function mapShift(row: Row): ShiftScheduleListItem {
  const status = text(row.status);
  return {
    id: text(row.id),
    tenantId: text(row.tenant_id),
    employeeId: row.employee_id ? text(row.employee_id) : null,
    employeeName: text(row.employee_name_snapshot),
    roleLabel: text(row.role_label_snapshot),
    shiftDate: text(row.shift_date),
    startTime: text(row.start_time).slice(0, 5),
    endTime: text(row.end_time).slice(0, 5),
    location: text(row.location),
    status:
      status === 'draft'
        ? 'entwurf'
        : status === 'published'
          ? 'geplant'
          : status === 'confirmed'
            ? 'bestaetigt'
            : status === 'in_progress'
              ? 'in_bearbeitung'
              : status === 'completed'
                ? 'abgeschlossen'
                : status === 'cancelled'
                  ? 'archiviert'
                  : 'aktiv',
    updatedAt: text(row.updated_at),
  };
}

async function demoDelay(ms = 200): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** WP376 — Dienstpläne Liste (Demo / preparedOnly) */
export async function fetchShiftScheduleList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ShiftScheduleListItem[]>> {
  const denied = enforcePermission<ShiftScheduleListItem[]>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase' && getSupabaseClient()) {
    const { data, error } = await fromUnknownTable(getSupabaseClient()!, 'care_staff_shifts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('shift_date', { ascending: true })
      .order('start_time', { ascending: true });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: ((data ?? []) as Row[]).map(mapShift) };
  }

  await demoDelay();
  return { ok: true, data: getDemoShiftScheduleListItems() };
}

/** Dienstplan-Schicht anlegen — Demo-Persistenz */
export async function createShiftScheduleEntry(
  tenantId: string,
  input: {
    employeeId?: string | null;
    employeeName: string;
    roleLabel: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
    location: string;
  },
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ShiftScheduleListItem>> {
  const denied = enforcePermission<ShiftScheduleListItem>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase' && getSupabaseClient()) {
    const supabase = getSupabaseClient()!;
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const { data, error } = await fromUnknownTable(supabase, 'care_staff_shifts')
      .insert({
        tenant_id: tenantId,
        employee_id: input.employeeId ?? null,
        employee_name_snapshot: input.employeeName.trim(),
        role_label_snapshot: input.roleLabel.trim(),
        shift_date: input.shiftDate,
        start_time: input.startTime,
        end_time: input.endTime,
        location: input.location.trim(),
        status: 'draft',
        created_by: userId,
      })
      .select('*')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    const item = mapShift(data as Row);
    syncCalendarEventAsync(buildCalendarEventFromShift(tenantId, item));
    return { ok: true, data: item };
  }

  if (!isPflegeDemoFunctional()) {
    return { ok: false, error: 'Dienstplan ist ausschließlich live verfügbar.' };
  }

  await demoDelay(280);
  const item = createDemoShift(input);
  syncCalendarEventAsync(buildCalendarEventFromShift(tenantId, item));
  return { ok: true, data: item };
}
