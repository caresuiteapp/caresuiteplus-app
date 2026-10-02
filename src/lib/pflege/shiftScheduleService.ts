import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { syncCalendarEventAsync, buildCalendarEventFromShift } from '@/lib/calendar/calendarSyncService';
import { createDemoShift, getDemoShiftScheduleListItems, type ShiftScheduleListItem } from './shiftScheduleDemo';
import { isPflegeDemoFunctional } from '@/lib/pflege/pflegeModuleConfig';
import { getSupabaseClient } from '@/lib/supabase/client';
import { callCareOperationsRpc, readCareRows } from './ambulatoryOperationsService';
import { validateShift } from './ambulatoryOperationsDomain';

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
    breakMinutes: Number(row.break_minutes ?? 0),
    breakStart: text(row.break_start).slice(0, 5),
    cancellationReason: text(row.cancellation_reason),
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
    const result = await readCareRows('care_staff_shifts', tenantId);
    if (!result.ok) return result;
    return { ok: true, data: result.data.map(mapShift).sort((a, b) => a.shiftDate.localeCompare(b.shiftDate) || a.startTime.localeCompare(b.startTime)) };
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
    breakMinutes?: number;
    breakStart?: string;
  },
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ShiftScheduleListItem>> {
  const denied = enforcePermission<ShiftScheduleListItem>(actorRoleKey, 'pflege.plans.manage');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase' && getSupabaseClient()) {
    const invalid = validateShift(input); if (invalid) return { ok: false, error: invalid };
    const saved = await callCareOperationsRpc(tenantId, 'create_ambulatory_care_shift', { p_payload: input });
    if (!saved.ok) return saved;
    const all = await fetchShiftScheduleList(tenantId, actorRoleKey); if (!all.ok) return all;
    const item = all.data.find((v) => v.id === saved.data.id);
    if (!item) return { ok: false, error: 'Schicht wurde gespeichert. Bitte die Liste aktualisieren.' };
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

export async function advanceCareShift(tenantId: string, item: ShiftScheduleListItem, status: 'published' | 'confirmed' | 'cancelled', reason: string, role?: RoleKey | null) {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.plans.manage'); if (denied) return denied;
  return callCareOperationsRpc(tenantId, 'advance_ambulatory_care_shift', { p_id: item.id, p_expected_at: item.updatedAt, p_status: status, p_reason: reason });
}
