import type { RoleKey, ServiceResult } from '@/types';
import type { CalendarModuleKey } from '@/types/calendar';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { appointmentSupabaseRepository } from '@/lib/services/repositories/appointmentRepository.supabase';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { syncCalendarEvent } from '@/lib/calendar/calendarSyncService';
import type {
  CalendarEventFormInput,
  CalendarEventSaveResult,
} from '@/types/calendar/calendarEventForm';

function generateSourceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function resolveModuleKey(moduleKey: CalendarModuleKey): CalendarModuleKey {
  return moduleKey === 'all' ? 'office' : moduleKey;
}

export async function createCalendarEventFromForm(
  input: CalendarEventFormInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CalendarEventSaveResult>> {
  if (input.sourceContext === 'appointment_management') {
    const denied = enforcePermission<CalendarEventSaveResult>(
      actorRoleKey,
      'office.appointments.view',
    );
    if (denied) return denied;
  }

  if (!input.title.trim()) {
    return { ok: false, error: 'Titel ist Pflicht.' };
  }

  const tenantErr = assertTenantForMode(input.tenantId);
  if (tenantErr) return tenantErr;

  const moduleKey = resolveModuleKey(input.moduleKey);
  const isOfficeAppointment = input.sourceType === 'appointment' && !input.existingSourceId;
  let sourceId = input.existingSourceId ?? generateSourceId();

  if (isOfficeAppointment) {
    if (getServiceMode() === 'supabase') {
      const apptResult = await appointmentSupabaseRepository.create(input.tenantId, {
        title: input.title,
        clientName: input.relatedClientId?.trim() || undefined,
        startsAt: input.startAt,
        location: input.locationName?.trim() || undefined,
      });
      if (!apptResult.ok) return apptResult;
      sourceId = apptResult.data.id;
    } else if (input.tenantId !== DEMO_TENANT_ID) {
      return { ok: false, error: 'Mandant nicht gefunden.' };
    } else {
      await new Promise((r) => setTimeout(r, 180));
      sourceId = `appt-${Date.now()}`;
    }
  }

  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: { sourceId } };
  }

  const syncResult = await syncCalendarEvent({
    tenantId: input.tenantId,
    moduleKey,
    sourceType: input.sourceType,
    sourceId,
    eventType: input.eventType,
    title: input.title.trim(),
    description: input.description ?? null,
    internalNote: input.internalNote ?? null,
    publicNote: input.publicNote ?? null,
    startAt: input.startAt,
    endAt: input.endAt,
    allDay: input.allDay ?? false,
    locationName: input.locationName?.trim() || null,
    room: input.room?.trim() || null,
    address: input.address?.trim() || null,
    relatedClientId: input.relatedClientId?.trim() || null,
    relatedEmployeeId: input.relatedEmployeeId?.trim() || null,
    relatedWardId: input.relatedWardId?.trim() || null,
    relatedCaseId: input.relatedCaseId?.trim() || null,
    isOfficeVisible: input.isOfficeVisible ?? (moduleKey === 'office' || input.moduleKey === 'all'),
    isModuleVisible: input.isModuleVisible ?? true,
    isClientPortalVisible: input.isClientPortalVisible ?? false,
    isEmployeePortalVisible: input.isEmployeePortalVisible ?? false,
    colorKey: input.colorKey ?? moduleKey,
    status: 'aktiv',
  });

  if (!syncResult.ok) return syncResult;

  return {
    ok: true,
    data: {
      sourceId,
      calendarEventId: syncResult.data.id,
    },
  };
}

export async function updateCalendarEventFromForm(
  input: CalendarEventFormInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CalendarEventSaveResult>> {
  if (!input.existingSourceId) {
    return { ok: false, error: 'Bearbeiten: source_id fehlt.' };
  }
  return createCalendarEventFromForm(
    { ...input, existingSourceId: input.existingSourceId },
    actorRoleKey,
  );
}
