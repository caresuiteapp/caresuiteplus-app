import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { syncCalendarEventAsync, buildCalendarEventFromShift } from '@/lib/calendar/calendarSyncService';
import { createDemoShift, getDemoShiftScheduleListItems, type ShiftScheduleListItem } from './shiftScheduleDemo';
import { isPflegeDemoFunctional } from '@/lib/pflege/pflegeModuleConfig';

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

  if (getServiceMode() === 'supabase') {
    // Demo-funktional fallback until shift schedule live repo ships
  }

  await demoDelay();
  return { ok: true, data: getDemoShiftScheduleListItems() };
}

/** Dienstplan-Schicht anlegen — Demo-Persistenz */
export async function createShiftScheduleEntry(
  tenantId: string,
  input: {
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

  if (!isPflegeDemoFunctional()) {
    return { ok: false, error: 'Dienstplan anlegen: Demo-Modus erforderlich.' };
  }

  await demoDelay(280);
  const item = createDemoShift(input);
  syncCalendarEventAsync(buildCalendarEventFromShift(tenantId, item));
  return { ok: true, data: item };
}
