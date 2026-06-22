import type { AppointmentCreateInput } from '@/lib/office/appointmentCreateService';
import type { RoleKey, ServiceResult } from '@/types';
import { createCalendarEventFromForm } from '@/lib/calendar/calendarEventSaveService';

/** @deprecated Use createCalendarEventFromForm from calendarEventSaveService */
export type { AppointmentCreateInput };

/** WP206 — delegates to unified calendar save service */
export async function createAppointment(
  tenantId: string,
  input: AppointmentCreateInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const now = new Date();
  const end = new Date(now.getTime() + 60 * 60_000);
  const result = await createCalendarEventFromForm(
    {
      tenantId,
      moduleKey: 'office',
      calendarScope: 'office',
      sourceContext: 'appointment_management',
      sourceType: 'appointment',
      eventType: 'termin',
      title: input.title,
      startAt: input.startsAt ?? now.toISOString(),
      endAt: end.toISOString(),
      locationName: input.location ?? null,
      relatedClientId: input.clientName ?? null,
      isOfficeVisible: true,
      isModuleVisible: true,
    },
    actorRoleKey,
  );
  if (!result.ok) return result;
  return { ok: true, data: { id: result.data.sourceId } };
}
