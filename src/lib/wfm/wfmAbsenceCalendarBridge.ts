import type { EmployeeAbsence, AbsenceType } from '@/types/modules/employeeAbsence';
import type { WfmAbsence, WfmAbsenceType } from '@/types/modules/wfm';
import {
  syncCalendarEventFromAbsence,
  syncCalendarEventFromAbsenceAsync,
  cancelCalendarEventBySource,
  cancelCalendarEventBySourceAsync,
  buildCalendarEventFromAbsence,
} from '@/lib/calendar/calendarSyncService';
import type { ServiceResult } from '@/types';

function mapWfmTypeToAbsenceType(type: WfmAbsenceType): AbsenceType {
  switch (type) {
    case 'vacation':
      return 'vacation';
    case 'sick_leave':
      return 'sick_leave';
    case 'child_sick_leave':
      return 'child_sick_leave';
    case 'unpaid_leave':
      return 'unpaid_leave';
    case 'training':
      return 'training';
    case 'public_holiday':
      return 'public_holiday';
    case 'blocked_time':
      return 'blocked_time';
    case 'business_trip':
    case 'school':
    case 'maternity':
    case 'parental_leave':
    case 'special_leave':
    default:
      return 'other';
  }
}

/** Maps WFM absence to legacy EmployeeAbsence shape for calendar sync (idempotent upsert by source_id). */
export function mapWfmAbsenceToEmployeeAbsence(absence: WfmAbsence): EmployeeAbsence {
  const rejectionReason =
    absence.status === 'rejected' && absence.internalNote.trim()
      ? absence.internalNote.trim()
      : null;

  return {
    id: absence.id,
    tenantId: absence.tenantId,
    employeeId: absence.employeeId,
    absenceType: mapWfmTypeToAbsenceType(absence.absenceType),
    status: absence.status,
    startsAt: absence.startsAt,
    endsAt: absence.endsAt,
    allDay: absence.allDay,
    internalNotes: absence.internalNote,
    employeeVisibleNote: absence.employeeNote,
    sickDetails: null,
    auDocumentId: null,
    certificateDocumentId: null,
    replacementRequired: false,
    hideDetailsFromAdmin: false,
    requestedDays: absence.requestedDays,
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason,
    cancelledAt: absence.status === 'cancelled' ? absence.updatedAt : null,
    qualificationUpdated: false,
    createdBy: null,
    updatedBy: null,
    createdAt: absence.createdAt,
    updatedAt: absence.updatedAt,
  };
}

export function syncWfmAbsenceToCalendarAsync(absence: WfmAbsence): void {
  if (absence.status !== 'approved' && absence.status !== 'active') return;
  syncCalendarEventFromAbsenceAsync(mapWfmAbsenceToEmployeeAbsence(absence));
}

export async function syncWfmAbsenceToCalendar(
  absence: WfmAbsence,
): Promise<ServiceResult<void>> {
  if (absence.status !== 'approved' && absence.status !== 'active') {
    return { ok: true, data: undefined };
  }
  const result = await syncCalendarEventFromAbsence(mapWfmAbsenceToEmployeeAbsence(absence));
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: undefined };
}

export async function cancelWfmAbsenceCalendar(
  absence: WfmAbsence,
): Promise<ServiceResult<void>> {
  const payload = buildCalendarEventFromAbsence(mapWfmAbsenceToEmployeeAbsence(absence));
  return cancelCalendarEventBySource(absence.tenantId, payload.sourceType, absence.id);
}

export function cancelWfmAbsenceCalendarAsync(absence: WfmAbsence): void {
  const payload = buildCalendarEventFromAbsence(mapWfmAbsenceToEmployeeAbsence(absence));
  cancelCalendarEventBySourceAsync(absence.tenantId, payload.sourceType, absence.id);
}

export function buildCalendarPayloadFromWfmAbsence(absence: WfmAbsence) {
  return buildCalendarEventFromAbsence(mapWfmAbsenceToEmployeeAbsence(absence));
}

export { normalizeAllDayFloatingUtcBounds as normalizeWfmAbsenceCalendarBounds } from '@/lib/office/calendarDateUtils';
