import type { RoleKey, ServiceResult } from '@/types';
import type { CalendarModuleKey } from '@/types/calendar';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { appointmentSupabaseRepository } from '@/lib/services/repositories/appointmentRepository.supabase';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { syncCalendarEvent } from '@/lib/calendar/calendarSyncService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isUuid } from '@/lib/validation/uuid';
import type {
  CalendarEventFormInput,
  CalendarEventSaveResult,
} from '@/types/calendar/calendarEventForm';

export type CalendarFormSaveReceipt = ServiceResult<CalendarEventSaveResult> & { persistedSourceId?: string };
export function resolveCalendarFormWritePermission(input: Pick<CalendarEventFormInput, 'sourceContext' | 'moduleKey' | 'sourceType'>): import('@/types/permissions').PermissionKey | null {
  if (input.sourceContext === 'appointment_management' || input.sourceType === 'appointment' || input.moduleKey === 'office' || input.moduleKey === 'all') return 'office.appointments.edit';
  if (input.moduleKey === 'assist') return 'assist.assignments.manage';
  if (input.moduleKey === 'pflege') return 'pflege.plans.manage';
  return null;
}

async function appointmentPersonName(tenantId: string, table: 'clients' | 'employees', id?: string | null): Promise<ServiceResult<string | null>> {
  if (!id?.trim()) return { ok: true, data: null };
  if (!isUuid(id.trim())) return { ok: false, error: 'Bitte eine vorhandene Person aus der Auswahl wählen.' };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Datenverbindung nicht verfügbar.' };
  const { data, error } = await fromUnknownTable(supabase, table).select('first_name, last_name')
    .eq('tenant_id', tenantId).eq('id', id.trim()).maybeSingle();
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (!data) return { ok: false, error: 'Die ausgewählte Person ist in diesem Mandanten nicht verfügbar.' };
  const row = data as { first_name?: string; last_name?: string };
  return { ok: true, data: [row.first_name, row.last_name].filter(Boolean).join(' ') };
}

function partialAppointment(id: string, cause: unknown): CalendarFormSaveReceipt {
  return { ok: false, persistedSourceId: id, error: `Termin wurde gespeichert, aber der Kalenderabgleich ist noch offen: ${cause instanceof Error ? cause.message : String(cause)} Bitte den Abgleich erneut versuchen.` };
}

async function generateSourceId(): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return (await import('expo-crypto')).randomUUID();
}

function resolveModuleKey(moduleKey: CalendarModuleKey): CalendarModuleKey {
  return moduleKey === 'all' ? 'office' : moduleKey;
}

export async function createCalendarEventFromForm(
  input: CalendarEventFormInput,
  actorRoleKey?: RoleKey | null,
): Promise<CalendarFormSaveReceipt> {
  const sourceType = input.sourceContext === 'appointment_management' ? 'appointment' : input.sourceType;
  const permission = resolveCalendarFormWritePermission(input);
  if (permission) {
    const denied = enforcePermission<CalendarEventSaveResult>(
      actorRoleKey,
      permission,
    );
    if (denied) return denied;
  }

  if (!input.title.trim()) {
    return { ok: false, error: 'Titel ist Pflicht.' };
  }
  if (!Number.isFinite(Date.parse(input.startAt)) || !Number.isFinite(Date.parse(input.endAt)) || Date.parse(input.endAt) <= Date.parse(input.startAt)) {
    return { ok: false, error: 'Bitte einen gültigen Beginn und ein späteres Ende angeben.' };
  }
  if (sourceType === 'assist_visit') {
    return { ok: false, error: 'Einsätze bitte in der Einsatzplanung bearbeiten, damit Aufgaben, Budget und Portale gemeinsam aktualisiert werden.' };
  }

  const tenantErr = assertTenantForMode(input.tenantId);
  if (tenantErr) return tenantErr;

  const moduleKey = resolveModuleKey(input.moduleKey);
  const isOfficeAppointment = sourceType === 'appointment';
  let sourceId = input.existingSourceId ?? (isOfficeAppointment ? '' : await generateSourceId());
  if (getServiceMode() === 'supabase' && input.existingSourceId && !isUuid(input.existingSourceId)) {
    return { ok: false, error: 'Der gespeicherte Kalendereintrag besitzt keine gültige Quell-ID.' };
  }
  if (sourceType === 'intake_appointment' && (moduleKey !== 'office' || !input.existingSourceId || input.relatedClientId !== input.existingSourceId || input.isClientPortalVisible || input.isEmployeePortalVisible)) {
    return { ok: false, error: 'Der Ersttermin bleibt intern mit seiner ursprünglichen Aufnahme verknüpft. Die Personenzuordnung und Portalfreigaben können hier nicht geändert werden.' };
  }
  let sourcePersisted = false;
  let calendarStatus: import('@/types').WorkflowStatus = 'aktiv';

  if (isOfficeAppointment) {
    if (getServiceMode() === 'supabase') {
      const [client, employee] = await Promise.all([
        appointmentPersonName(input.tenantId, 'clients', input.relatedClientId),
        appointmentPersonName(input.tenantId, 'employees', input.relatedEmployeeId),
      ]);
      if (!client.ok) return client;
      if (!employee.ok) return employee;
      const appointmentInput = {
        title: input.title,
        clientName: client.data,
        employeeName: employee.data,
        startsAt: input.startAt,
        endsAt: input.endAt,
        location: input.locationName?.trim() || undefined,
      };
      const apptResult = input.existingSourceId
        ? await appointmentSupabaseRepository.update(input.tenantId, sourceId, appointmentInput)
        : await appointmentSupabaseRepository.create(input.tenantId, { ...appointmentInput, status: 'aktiv' });
      if (!apptResult.ok) return apptResult;
      sourceId = apptResult.data.id;
      calendarStatus = (apptResult.data as { status?: import('@/types').WorkflowStatus }).status ?? 'aktiv';
      sourcePersisted = true;
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

  try {
    const syncResult = await syncCalendarEvent({
      tenantId: input.tenantId,
      moduleKey,
      sourceType,
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
      status: calendarStatus,
    });

    if (!syncResult.ok) return sourcePersisted ? partialAppointment(sourceId, syncResult.error) : syncResult;

    return {
      ok: true,
      data: {
        sourceId,
        calendarEventId: syncResult.data.id,
      },
    };
  } catch (cause) {
    return sourcePersisted ? partialAppointment(sourceId, cause)
      : { ok: false, error: cause instanceof Error ? cause.message : 'Kalendereintrag konnte nicht gespeichert werden.' };
  }
}

export async function updateCalendarEventFromForm(
  input: CalendarEventFormInput,
  actorRoleKey?: RoleKey | null,
): Promise<CalendarFormSaveReceipt> {
  if (!input.existingSourceId) {
    return { ok: false, error: 'Bearbeiten: source_id fehlt.' };
  }
  return createCalendarEventFromForm(
    { ...input, existingSourceId: input.existingSourceId },
    actorRoleKey,
  );
}
