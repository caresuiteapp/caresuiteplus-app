import type {
  CalendarEventRecordType,
  CalendarModuleKey,
  CalendarScope,
  CalendarSourceType,
} from '@/types/calendar';

export type CalendarEventCreateContext = 'calendar' | 'appointment_management' | 'portal';

export type CalendarFormStep =
  | 'type'
  | 'template'
  | 'basics'
  | 'relations'
  | 'datetime'
  | 'location'
  | 'participants'
  | 'visibility'
  | 'reminders'
  | 'followup'
  | 'preview';

export const CALENDAR_FORM_STEPS: CalendarFormStep[] = [
  'type',
  'template',
  'basics',
  'relations',
  'datetime',
  'location',
  'participants',
  'visibility',
  'reminders',
  'followup',
  'preview',
];

export const CALENDAR_FORM_STEP_LABELS: Record<CalendarFormStep, string> = {
  type: 'Art',
  template: 'Vorlage',
  basics: 'Grunddaten',
  relations: 'Bezüge',
  datetime: 'Zeitplan',
  location: 'Ort',
  participants: 'Teilnehmer',
  visibility: 'Sichtbarkeit',
  reminders: 'Erinnerungen',
  followup: 'Nachverfolgung',
  preview: 'Vorschau',
};

export type CalendarEventFormState = {
  title: string;
  description: string;
  internalNote: string;
  publicNote: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  locationName: string;
  room: string;
  address: string;
  relatedClientId: string;
  relatedEmployeeId: string;
  relatedWardId: string;
  relatedCaseId: string;
  participantNote: string;
  isOfficeVisible: boolean;
  isModuleVisible: boolean;
  isClientPortalVisible: boolean;
  isEmployeePortalVisible: boolean;
  reminderMinutes: number | null;
  followUpNote: string;
  sourceType: CalendarSourceType;
  eventType: CalendarEventRecordType;
  templateKey: string | null;
};

export type CalendarEventFormInput = {
  tenantId: string;
  moduleKey: CalendarModuleKey;
  calendarScope: CalendarScope;
  sourceContext: CalendarEventCreateContext;
  sourceType: CalendarSourceType;
  eventType: CalendarEventRecordType;
  templateKey?: string | null;
  title: string;
  description?: string | null;
  internalNote?: string | null;
  publicNote?: string | null;
  startAt: string;
  endAt: string;
  allDay?: boolean;
  locationName?: string | null;
  room?: string | null;
  address?: string | null;
  relatedClientId?: string | null;
  relatedEmployeeId?: string | null;
  relatedWardId?: string | null;
  relatedCaseId?: string | null;
  isOfficeVisible?: boolean;
  isModuleVisible?: boolean;
  isClientPortalVisible?: boolean;
  isEmployeePortalVisible?: boolean;
  colorKey?: string | null;
  existingSourceId?: string | null;
  existingEventId?: string | null;
};

export type CalendarEventSaveResult = {
  sourceId: string;
  calendarEventId?: string;
};

export function createDefaultFormState(
  moduleKey: CalendarModuleKey,
  durationMinutes = 60,
): CalendarEventFormState {
  const now = new Date();
  const end = new Date(now.getTime() + durationMinutes * 60_000);
  const resolved = moduleKey === 'all' ? 'office' : moduleKey;
  return {
    title: '',
    description: '',
    internalNote: '',
    publicNote: '',
    startAt: now.toISOString(),
    endAt: end.toISOString(),
    allDay: false,
    locationName: '',
    room: '',
    address: '',
    relatedClientId: '',
    relatedEmployeeId: '',
    relatedWardId: '',
    relatedCaseId: '',
    participantNote: '',
    isOfficeVisible: resolved === 'office' || moduleKey === 'all',
    isModuleVisible: true,
    isClientPortalVisible: false,
    isEmployeePortalVisible: false,
    reminderMinutes: 30,
    followUpNote: '',
    sourceType: resolved === 'office' ? 'appointment' : 'custom_event',
    eventType: 'termin',
    templateKey: null,
  };
}
