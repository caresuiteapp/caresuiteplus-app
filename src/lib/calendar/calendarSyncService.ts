import type { ServiceResult } from '@/types';
import type {
  CalendarEventRecord,
  CalendarEventRecordType,
  CalendarSourceType,
} from '@/types/calendar';
import type { AppointmentListItem } from '@/types/modules/appointmentList';
import type { AssignmentListItem } from '@/types/modules/assist';
import type { CourseListItem } from '@/types/modules/akademie';
import type { EmployeeAbsence } from '@/types/modules/employeeAbsence';
import { normalizeAllDayFloatingUtcBounds } from '@/lib/office/calendarDateUtils';
import type { InternalTask } from '@/types/modules/internalTasks';
import type { ConsultationFollowUp } from '@/types/modules/consultation';
import type { ShiftScheduleListItem } from '@/lib/pflege/shiftScheduleDemo';
import type { LessonListItem } from '@/data/demo/akademieLessons';
import type { StationaerCalendarEntity } from '@/types/modules/stationaerCalendar';
import type { StationaerCalendarSourceType } from '@/types/calendar';
import { calendarEventRepository } from '@/lib/calendar/calendarEventRepository';
import {
  isStationaerCalendarSourceType,
  resolveStationaerSourceDefinition,
} from '@/lib/calendar/calendarSourceRegistry';
import { getSupabaseClient } from '@/lib/supabase/client';

export type CalendarSyncPayload = Partial<CalendarEventRecord> & {
  tenantId: string;
  sourceType: CalendarSourceType;
  sourceId: string;
  title: string;
  startAt: string;
  endAt: string;
};

function fireAndForget(promise: Promise<unknown>): void {
  void promise.catch((err) => {
    console.warn('[calendarSync] sync failed:', err);
  });
}

function resolveAbsenceSourceType(absenceType: EmployeeAbsence['absenceType']): CalendarSourceType {
  if (absenceType === 'vacation') return 'vacation';
  if (absenceType === 'sick_leave' || absenceType === 'child_sick_leave') return 'sick_leave';
  if (absenceType === 'training') return 'training';
  return 'absence';
}

function resolveAbsenceEventType(absenceType: EmployeeAbsence['absenceType']): CalendarEventRecordType {
  if (absenceType === 'vacation') return 'urlaub';
  if (absenceType === 'sick_leave' || absenceType === 'child_sick_leave') return 'krankheit';
  if (absenceType === 'training') return 'schulung';
  return 'abwesenheit';
}

export function buildCalendarEventFromAppointment(
  tenantId: string,
  item: AppointmentListItem,
): CalendarSyncPayload {
  return {
    tenantId,
    moduleKey: 'office',
    sourceType: 'appointment',
    sourceId: item.id,
    eventType: 'termin',
    title: item.clientName ? `${item.title} · ${item.clientName}` : item.title,
    description: null,
    startAt: item.startsAt,
    endAt: item.endsAt,
    status: item.status,
    relatedClientId: item.clientId ?? null,
    relatedEmployeeId: item.employeeId ?? null,
    isOfficeVisible: true,
    isModuleVisible: true,
    colorKey: 'office',
  };
}

export function buildCalendarEventFromAssignment(
  tenantId: string,
  item: AssignmentListItem,
): CalendarSyncPayload {
  return {
    tenantId,
    moduleKey: 'assist',
    sourceType: 'assist_visit',
    sourceId: item.id,
    eventType: 'einsatz',
    title: item.serviceName?.trim() || item.title,
    description: [item.clientName, item.employeeName].filter(Boolean).join(' · ') || null,
    startAt: item.scheduledStart,
    endAt: item.scheduledEnd,
    status: item.status,
    relatedEmployeeId: item.employeeId ?? null,
    isOfficeVisible: true,
    isModuleVisible: true,
    isClientPortalVisible: false,
    isEmployeePortalVisible: true,
    colorKey: 'assist',
  };
}

export function buildCalendarEventFromVisitDetail(input: {
  tenantId: string;
  id: string;
  title: string;
  plannedStartAt: string;
  plannedEndAt: string;
  clientId: string;
  employeeId: string | null;
  clientName?: string | null;
  employeeName?: string | null;
  serviceName?: string | null;
  canonicalStatus: string;
  portalReleaseEnabled: boolean;
  employeePortalVisible: boolean;
}): CalendarSyncPayload {
  const serviceTitle = input.serviceName?.trim() || input.title;
  const descriptionParts = [input.clientName, input.employeeName].filter(Boolean);
  return {
    tenantId: input.tenantId,
    moduleKey: 'assist',
    sourceType: 'assist_visit',
    sourceId: input.id,
    eventType: 'einsatz',
    title: serviceTitle,
    description: descriptionParts.length > 0 ? descriptionParts.join(' · ') : null,
    startAt: input.plannedStartAt,
    endAt: input.plannedEndAt,
    status: input.canonicalStatus,
    relatedClientId: input.clientId,
    relatedEmployeeId: input.employeeId,
    isOfficeVisible: true,
    isModuleVisible: true,
    isClientPortalVisible: input.portalReleaseEnabled,
    isEmployeePortalVisible: input.employeePortalVisible,
    colorKey: 'assist',
  };
}

function resolveAbsenceCalendarTitle(absence: EmployeeAbsence): string {
  const note = absence.employeeVisibleNote?.trim() || absence.internalNotes?.trim();
  if (note) return note;
  if (absence.absenceType === 'vacation') return 'Urlaub';
  if (absence.absenceType === 'sick_leave' || absence.absenceType === 'child_sick_leave') {
    return 'Krankheit';
  }
  if (absence.absenceType === 'training') return 'Fortbildung';
  return 'Abwesenheit';
}

function mapAbsenceStatusToCalendar(status: EmployeeAbsence['status']): string {
  if (status === 'approved' || status === 'active') return 'aktiv';
  if (status === 'cancelled' || status === 'rejected') return 'cancelled';
  return status;
}

export function buildCalendarEventFromAbsence(absence: EmployeeAbsence): CalendarSyncPayload {
  const sourceType = resolveAbsenceSourceType(absence.absenceType);
  const bounds = absence.allDay
    ? normalizeAllDayFloatingUtcBounds(absence.startsAt, absence.endsAt)
    : { startAt: absence.startsAt, endAt: absence.endsAt };

  return {
    tenantId: absence.tenantId,
    moduleKey: 'office',
    sourceType,
    sourceId: absence.id,
    eventType: resolveAbsenceEventType(absence.absenceType),
    title: resolveAbsenceCalendarTitle(absence),
    startAt: bounds.startAt,
    endAt: bounds.endAt,
    allDay: absence.allDay,
    timezone: 'Europe/Berlin',
    status: mapAbsenceStatusToCalendar(absence.status),
    relatedEmployeeId: absence.employeeId,
    isOfficeVisible: true,
    isModuleVisible: true,
    isEmployeePortalVisible: true,
    colorKey: 'absence',
  };
}

export function buildCalendarEventFromShift(
  tenantId: string,
  shift: ShiftScheduleListItem,
): CalendarSyncPayload {
  const startAt = `${shift.shiftDate}T${shift.startTime}:00.000Z`;
  const endAt = `${shift.shiftDate}T${shift.endTime}:00.000Z`;
  return {
    tenantId,
    moduleKey: 'pflege',
    sourceType: 'care_visit',
    sourceId: shift.id,
    eventType: 'pflegevisite',
    title: `${shift.roleLabel} · ${shift.employeeName}`,
    startAt,
    endAt,
    status: shift.status,
    locationName: shift.location,
    isOfficeVisible: true,
    isModuleVisible: true,
    colorKey: 'pflege',
  };
}

export function buildCalendarEventFromFollowUp(followUp: ConsultationFollowUp): CalendarSyncPayload {
  const dueAt = followUp.dueAt;
  const endAt = new Date(new Date(dueAt).getTime() + 60 * 60 * 1000).toISOString();
  return {
    tenantId: followUp.tenantId,
    moduleKey: 'beratung',
    sourceType: 'consultation_appointment',
    sourceId: followUp.id,
    eventType: 'wiedervorlage',
    title: followUp.note?.trim() || 'Wiedervorlage Beratung',
    startAt: dueAt,
    endAt,
    status: followUp.status,
    relatedCaseId: followUp.caseId,
    isOfficeVisible: true,
    isModuleVisible: true,
    colorKey: 'beratung',
  };
}

export function buildCalendarEventFromLesson(
  tenantId: string,
  lesson: LessonListItem,
): CalendarSyncPayload {
  const startAt = lesson.createdAt;
  const endAt = new Date(
    new Date(startAt).getTime() + (lesson.durationMinutes ?? 60) * 60 * 1000,
  ).toISOString();
  return {
    tenantId,
    moduleKey: 'akademie',
    sourceType: 'academy_training',
    sourceId: lesson.id,
    eventType: 'schulung',
    title: lesson.title,
    startAt,
    endAt,
    status: lesson.status,
    isOfficeVisible: true,
    isModuleVisible: true,
    colorKey: 'akademie',
  };
}

export function buildCalendarEventFromMandatoryCourse(
  tenantId: string,
  course: CourseListItem,
): CalendarSyncPayload {
  const startAt = course.startsAt ?? new Date().toISOString();
  const endAt = new Date(new Date(startAt).getTime() + course.durationMinutes * 60 * 1000).toISOString();
  return {
    tenantId,
    moduleKey: 'akademie',
    sourceType: 'academy_training',
    sourceId: course.id,
    eventType: 'schulung',
    title: course.title,
    startAt,
    endAt,
    status: course.status,
    isOfficeVisible: true,
    isModuleVisible: true,
    colorKey: 'akademie',
  };
}

export function buildCalendarEventFromTask(task: InternalTask): CalendarSyncPayload {
  if (!task.dueAt) {
    throw new Error('Task ohne Fälligkeit kann nicht synchronisiert werden.');
  }
  const endAt = new Date(new Date(task.dueAt).getTime() + 60 * 60 * 1000).toISOString();
  return {
    tenantId: task.tenantId,
    moduleKey: 'office',
    sourceType: 'task_deadline',
    sourceId: task.id,
    eventType: 'frist',
    title: task.title,
    description: task.description,
    startAt: task.dueAt,
    endAt,
    status: task.status,
    relatedEmployeeId: task.assignedToEmployeeId,
    isOfficeVisible: true,
    isModuleVisible: true,
    colorKey: 'office',
  };
}

export function buildCalendarEventFromStationaerEntity(
  entity: StationaerCalendarEntity,
): CalendarSyncPayload {
  const def = resolveStationaerSourceDefinition(entity.sourceType);
  return {
    tenantId: entity.tenantId,
    moduleKey: 'stationaer',
    sourceType: entity.sourceType,
    sourceId: entity.id,
    eventType: def.eventType,
    title: entity.title,
    description: entity.description,
    startAt: entity.startAt,
    endAt: entity.endAt,
    allDay: entity.allDay,
    status: entity.status,
    relatedClientId: entity.relatedResidentId,
    relatedEmployeeId: entity.relatedEmployeeId,
    relatedWardId: entity.relatedWardId,
    room: entity.room,
    locationType: entity.locationType,
    locationName: entity.locationName,
    isOfficeVisible: true,
    isModuleVisible: true,
    isClientPortalVisible: entity.isClientPortalVisible,
    isEmployeePortalVisible: entity.isEmployeePortalVisible,
    colorKey: 'stationaer',
  };
}

export function buildCalendarEventFromStationaryActivity(
  tenantId: string,
  input: {
    id: string;
    title: string;
    scheduledAt: string;
    durationMinutes?: number;
    location?: string;
    locationType?: string;
    wardId?: string | null;
    status?: string;
    portalVisible?: boolean;
  },
): CalendarSyncPayload {
  const startAt = input.scheduledAt;
  const endAt = new Date(
    new Date(startAt).getTime() + (input.durationMinutes ?? 90) * 60 * 1000,
  ).toISOString();
  return buildCalendarEventFromStationaerEntity({
    id: input.id,
    tenantId,
    sourceType: 'stationary_activity',
    title: input.title,
    description: null,
    startAt,
    endAt,
    allDay: false,
    status: (input.status ?? 'aktiv') as StationaerCalendarEntity['status'],
    relatedResidentId: null,
    relatedWardId: input.wardId ?? null,
    relatedEmployeeId: null,
    room: null,
    locationType: input.locationType ?? 'common_area',
    locationName: input.location ?? null,
    isClientPortalVisible: input.portalVisible ?? true,
    isEmployeePortalVisible: true,
    isRelativePortalVisible: input.portalVisible ?? true,
    updatedAt: new Date().toISOString(),
  });
}

export async function syncCalendarEvent(
  payload: CalendarSyncPayload,
): Promise<ServiceResult<CalendarEventRecord>> {
  if (!payload.sourceId?.trim()) {
    console.warn('[calendarSync] sourceId fehlt — kein Kalenderereignis angelegt.', {
      tenantId: payload.tenantId,
      sourceType: payload.sourceType,
    });
    return { ok: false, error: 'Kalendersync: source_id fehlt.' };
  }
  return calendarEventRepository.upsert(payload);
}

export function syncCalendarEventAsync(payload: CalendarSyncPayload): void {
  fireAndForget(syncCalendarEvent(payload));
}

export async function archiveCalendarEventBySource(
  tenantId: string,
  sourceType: CalendarSourceType,
  sourceId: string,
): Promise<ServiceResult<void>> {
  if (!sourceId?.trim()) {
    console.warn('[calendarSync] archive: sourceId fehlt.', { tenantId, sourceType });
    return { ok: false, error: 'Kalendersync: source_id fehlt.' };
  }
  return calendarEventRepository.archiveBySource(tenantId, sourceType, sourceId);
}

export function archiveCalendarEventBySourceAsync(
  tenantId: string,
  sourceType: CalendarSourceType,
  sourceId: string,
): void {
  fireAndForget(archiveCalendarEventBySource(tenantId, sourceType, sourceId));
}

export async function cancelCalendarEventBySource(
  tenantId: string,
  sourceType: CalendarSourceType,
  sourceId: string,
): Promise<ServiceResult<void>> {
  if (!sourceId?.trim()) {
    console.warn('[calendarSync] cancel: sourceId fehlt.', { tenantId, sourceType });
    return { ok: false, error: 'Kalendersync: source_id fehlt.' };
  }
  return calendarEventRepository.updateStatusBySource(tenantId, sourceType, sourceId, 'cancelled');
}

export function cancelCalendarEventBySourceAsync(
  tenantId: string,
  sourceType: CalendarSourceType,
  sourceId: string,
): void {
  fireAndForget(cancelCalendarEventBySource(tenantId, sourceType, sourceId));
}

export async function syncCalendarEventFromSource(
  tenantId: string,
  sourceType: CalendarSourceType,
  sourceId: string,
): Promise<ServiceResult<CalendarEventRecord | null>> {
  if (!sourceId?.trim()) {
    console.warn('[calendarSync] syncFromSource: sourceId fehlt.', { tenantId, sourceType });
    return { ok: false, error: 'Kalendersync: source_id fehlt.' };
  }

  switch (sourceType) {
    case 'appointment': {
      const { fetchAppointmentList } = await import('@/lib/office/appointmentListService');
      const list = await fetchAppointmentList(tenantId);
      if (!list.ok) return list;
      const item = list.data.find((a) => a.id === sourceId);
      if (!item) return { ok: true, data: null };
      return syncCalendarEvent(buildCalendarEventFromAppointment(tenantId, item));
    }
    case 'assist_visit': {
      const { visitSupabaseRepository } = await import('@/lib/assist/repositories/visitRepository.supabase');
      const visit = await visitSupabaseRepository.getById(tenantId, sourceId);
      if (!visit.ok) return visit;
      if (!visit.data) return { ok: true, data: null };
      return syncCalendarEvent(
        buildCalendarEventFromVisitDetail({
          tenantId,
          id: visit.data.id,
          title: visit.data.title,
          plannedStartAt: visit.data.scheduledStart,
          plannedEndAt: visit.data.scheduledEnd,
          clientId: visit.data.clientId,
          employeeId: visit.data.employeeId,
          clientName: visit.data.clientName,
          employeeName: visit.data.employeeName,
          serviceName: visit.data.serviceName,
          canonicalStatus: visit.data.assignmentStatus,
          portalReleaseEnabled: visit.data.portalReleaseEnabled,
          employeePortalVisible: visit.data.employeePortalVisible,
        }),
      );
    }
    default: {
      if (isStationaerCalendarSourceType(sourceType)) {
        const { stationaerCalendarSupabaseRepository } = await import(
          '@/lib/services/repositories/stationaerCalendarRepository.supabase'
        );
        const entity = await stationaerCalendarSupabaseRepository.getById(tenantId, sourceId);
        if (!entity.ok) return entity;
        if (!entity.data) return { ok: true, data: null };
        return syncCalendarEvent(buildCalendarEventFromStationaerEntity(entity.data));
      }
      return { ok: false, error: `Sync für source_type „${sourceType}" nicht implementiert.` };
    }
  }
}

export async function syncCalendarEventFromAppointment(
  tenantId: string,
  item: AppointmentListItem,
): Promise<ServiceResult<CalendarEventRecord>> {
  return syncCalendarEvent(buildCalendarEventFromAppointment(tenantId, item));
}

export async function syncCalendarEventFromAssignment(
  tenantId: string,
  item: AssignmentListItem,
): Promise<ServiceResult<CalendarEventRecord>> {
  return syncCalendarEvent(buildCalendarEventFromAssignment(tenantId, item));
}

export async function syncCalendarEventFromAbsence(
  absence: EmployeeAbsence,
): Promise<ServiceResult<CalendarEventRecord>> {
  return syncCalendarEvent(buildCalendarEventFromAbsence(absence));
}

export function syncCalendarEventFromAbsenceAsync(absence: EmployeeAbsence): void {
  fireAndForget(syncCalendarEventFromAbsence(absence));
}

export function syncCalendarEventFromStationaerEntityAsync(entity: StationaerCalendarEntity): void {
  fireAndForget(syncCalendarEvent(buildCalendarEventFromStationaerEntity(entity)));
}

export function archiveStationaerCalendarEventAsync(
  tenantId: string,
  sourceType: StationaerCalendarSourceType,
  sourceId: string,
): void {
  archiveCalendarEventBySourceAsync(tenantId, sourceType, sourceId);
}

export function cancelStationaerCalendarEventAsync(
  tenantId: string,
  sourceType: StationaerCalendarSourceType,
  sourceId: string,
): void {
  cancelCalendarEventBySourceAsync(tenantId, sourceType, sourceId);
}

export async function syncLegacySourcesBatch(
  tenantId: string,
  appointments: AppointmentListItem[],
  assignments: AssignmentListItem[],
): Promise<void> {
  if (!getSupabaseClient()) return;
  await Promise.all([
    ...appointments.map((item) => syncCalendarEventFromAppointment(tenantId, item)),
    ...assignments.map((item) => syncCalendarEventFromAssignment(tenantId, item)),
  ]);
}
