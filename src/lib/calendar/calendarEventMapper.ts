import type { CalendarEventRecord, CalendarEventRecordType, CalendarSourceType } from '@/types/calendar';
import type { CalendarEvent, CalendarEventType } from '@/types/modules/calendarEvent';
import { resolveCalendarEventColor } from '@/lib/calendar/calendarColors';
import { resolveCalendarEventHref } from '@/lib/calendar/calendarRouteRegistry';

type CalendarEventRow = {
  id: string;
  tenant_id: string;
  module_key: string;
  source_type: string;
  source_id: string | null;
  event_type: string;
  title: string;
  description: string | null;
  internal_note: string | null;
  public_note: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  timezone: string;
  status: string;
  priority: string;
  location_type: string | null;
  location_name: string | null;
  address: string | null;
  room: string | null;
  video_url: string | null;
  phone_number: string | null;
  related_client_id: string | null;
  related_employee_id: string | null;
  related_team_id: string | null;
  related_ward_id: string | null;
  related_case_id: string | null;
  related_document_id: string | null;
  visibility_scope: string;
  is_office_visible: boolean;
  is_module_visible: boolean;
  is_client_portal_visible: boolean;
  is_employee_portal_visible: boolean;
  is_public_holiday: boolean;
  color_key: string | null;
  icon_key: string | null;
  recurrence_rule_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
};

export const CALENDAR_EVENT_SELECT_COLUMNS = [
  'id',
  'tenant_id',
  'module_key',
  'source_type',
  'source_id',
  'event_type',
  'title',
  'description',
  'internal_note',
  'public_note',
  'start_at',
  'end_at',
  'all_day',
  'timezone',
  'status',
  'priority',
  'location_type',
  'location_name',
  'address',
  'room',
  'video_url',
  'phone_number',
  'related_client_id',
  'related_employee_id',
  'related_team_id',
  'related_ward_id',
  'related_case_id',
  'related_document_id',
  'visibility_scope',
  'is_office_visible',
  'is_module_visible',
  'is_client_portal_visible',
  'is_employee_portal_visible',
  'is_public_holiday',
  'color_key',
  'icon_key',
  'recurrence_rule_id',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'archived_at',
].join(', ');

function mapRecordTypeToUiType(eventType: CalendarEventRecordType): CalendarEventType {
  switch (eventType) {
    case 'krankheit':
      return 'krank';
    case 'schulung':
      return 'weiterbildung';
    case 'besprechung':
      return 'team_meeting';
    case 'urlaub_legacy':
      return 'urlaub';
    default:
      if (
        eventType === 'termin'
        || eventType === 'einsatz'
        || eventType === 'erinnerung'
        || eventType === 'urlaub'
        || eventType === 'krank'
        || eventType === 'abwesenheit'
        || eventType === 'team_meeting'
        || eventType === 'uebergabe'
        || eventType === 'weiterbildung'
      ) {
        return eventType;
      }
      if (eventType === 'frist' || eventType === 'wiedervorlage') return 'erinnerung';
      if (eventType === 'einsatz' || eventType === 'pflegevisite' || eventType === 'besuch') return 'einsatz';
      return 'termin';
  }
}

export function mapCalendarEventRow(row: CalendarEventRow): CalendarEventRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    moduleKey: row.module_key as CalendarEventRecord['moduleKey'],
    sourceType: row.source_type as CalendarSourceType,
    sourceId: row.source_id,
    eventType: row.event_type as CalendarEventRecordType,
    title: row.title,
    description: row.description,
    internalNote: row.internal_note,
    publicNote: row.public_note,
    startAt: row.start_at,
    endAt: row.end_at,
    allDay: row.all_day,
    timezone: row.timezone,
    status: row.status,
    priority: row.priority,
    locationType: row.location_type,
    locationName: row.location_name,
    address: row.address,
    room: row.room,
    videoUrl: row.video_url,
    phoneNumber: row.phone_number,
    relatedClientId: row.related_client_id,
    relatedEmployeeId: row.related_employee_id,
    relatedTeamId: row.related_team_id,
    relatedWardId: row.related_ward_id,
    relatedCaseId: row.related_case_id,
    relatedDocumentId: row.related_document_id,
    visibilityScope: row.visibility_scope,
    isOfficeVisible: row.is_office_visible,
    isModuleVisible: row.is_module_visible,
    isClientPortalVisible: row.is_client_portal_visible,
    isEmployeePortalVisible: row.is_employee_portal_visible,
    isPublicHoliday: row.is_public_holiday,
    colorKey: row.color_key,
    iconKey: row.icon_key,
    recurrenceRuleId: row.recurrence_rule_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    archivedAt: row.archived_at,
  };
}

export function mapCalendarEventRecordToUi(record: CalendarEventRecord): CalendarEvent {
  const uiType = mapRecordTypeToUiType(record.eventType);
  return {
    id: record.id,
    title: record.title,
    start: record.startAt,
    end: record.endAt,
    type: uiType,
    color: resolveCalendarEventColor(record.moduleKey, record.eventType, record.colorKey),
    allDay: record.allDay,
    sourceId: record.sourceId ?? undefined,
    sourceType: record.sourceType,
    moduleKey: record.moduleKey,
    status: record.status,
    href: resolveCalendarEventHref(record),
    record,
  };
}

export type CalendarEventUi = CalendarEvent & {
  sourceType?: CalendarSourceType;
  moduleKey?: CalendarEventRecord['moduleKey'];
  status?: string;
  record?: CalendarEventRecord;
};
