/** Zentrale Kalender-Domänentypen — CareSuite+ Unified Calendar System */

export type CalendarModuleKey =
  | 'office'
  | 'assist'
  | 'pflege'
  | 'stationaer'
  | 'beratung'
  | 'akademie'
  | 'portal'
  | 'global'
  | 'all';

export type CalendarScope = 'office' | 'module' | 'portal';

export type CalendarSourceType =
  | 'appointment'
  | 'assist_visit'
  | 'care_visit'
  | 'stationary_appointment'
  | 'resident_appointment'
  | 'stationary_activity'
  | 'resident_visit'
  | 'physician_visit'
  | 'therapy_appointment'
  | 'family_meeting'
  | 'ward_meeting'
  | 'admission_appointment'
  | 'resident_document_deadline'
  | 'stationary_task_deadline'
  | 'consultation_appointment'
  | 'academy_training'
  | 'absence'
  | 'vacation'
  | 'sick_leave'
  | 'training'
  | 'meeting'
  | 'task_deadline'
  | 'document_deadline'
  | 'invoice_deadline'
  | 'custom_event';

/** Stationär-Kalenderquellen — module_key immer stationaer */
export type StationaerCalendarSourceType =
  | 'stationary_appointment'
  | 'resident_appointment'
  | 'stationary_activity'
  | 'resident_visit'
  | 'physician_visit'
  | 'therapy_appointment'
  | 'family_meeting'
  | 'ward_meeting'
  | 'admission_appointment'
  | 'resident_document_deadline'
  | 'stationary_task_deadline';

export type CalendarEventRecordType =
  | 'termin'
  | 'einsatz'
  | 'abwesenheit'
  | 'urlaub'
  | 'krankheit'
  | 'schulung'
  | 'besprechung'
  | 'frist'
  | 'wiedervorlage'
  | 'beratung'
  | 'besuch'
  | 'aktivitaet'
  | 'pflegevisite'
  | 'rueckruf'
  | 'dokument'
  | 'abrechnung'
  | 'sonstiges'
  | 'erinnerung'
  | 'team_meeting'
  | 'uebergabe'
  | 'weiterbildung'
  | 'krank'
  | 'urlaub_legacy';

export type CalendarEventStatus =
  | 'entwurf'
  | 'aktiv'
  | 'in_bearbeitung'
  | 'abgeschlossen'
  | 'cancelled'
  | 'archiviert'
  | 'gesperrt'
  | 'fehlerhaft'
  | string;

export type CalendarEventRecord = {
  id: string;
  tenantId: string;
  moduleKey: CalendarModuleKey;
  sourceType: CalendarSourceType;
  sourceId: string | null;
  eventType: CalendarEventRecordType;
  title: string;
  description: string | null;
  internalNote: string | null;
  publicNote: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  timezone: string;
  status: CalendarEventStatus;
  priority: string;
  locationType: string | null;
  locationName: string | null;
  address: string | null;
  room: string | null;
  videoUrl: string | null;
  phoneNumber: string | null;
  relatedClientId: string | null;
  relatedEmployeeId: string | null;
  relatedTeamId: string | null;
  relatedWardId: string | null;
  relatedCaseId: string | null;
  relatedDocumentId: string | null;
  visibilityScope: string;
  isOfficeVisible: boolean;
  isModuleVisible: boolean;
  isClientPortalVisible: boolean;
  isEmployeePortalVisible: boolean;
  isPublicHoliday: boolean;
  colorKey: string | null;
  iconKey: string | null;
  recurrenceRuleId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  archivedAt: string | null;
};

export type CalendarBreadcrumb = {
  label: string;
  href?: string;
};

export type CalendarViewConfig = {
  calendarScope: CalendarScope;
  moduleKey: CalendarModuleKey;
  showAllModules?: boolean;
  defaultView?: import('@/types/modules/calendarEvent').CalendarViewMode;
  allowedEventTypes?: CalendarEventRecordType[];
  subtitle?: string;
  emptyStateMessage?: string;
  moduleColor?: string;
  breadcrumbs?: CalendarBreadcrumb[];
  entityContext?: {
    clientId?: string | null;
    employeeId?: string | null;
    wardId?: string | null;
    caseId?: string | null;
  };
};

export type CalendarEventTemplate = {
  id: string;
  tenantId: string | null;
  moduleKey: CalendarModuleKey;
  templateKey: string;
  label: string;
  description: string | null;
  sourceType: CalendarSourceType;
  eventType: CalendarEventRecordType;
  defaultDurationMinutes: number;
  allDay: boolean;
  isSystem: boolean;
  isActive: boolean;
  roleKeys: string[];
  fieldSchema: CalendarTemplateField[];
  createdAt: string;
  updatedAt: string;
};

export type CalendarTemplateField = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'datetime' | 'select' | 'boolean';
  required?: boolean;
  options?: string[];
};

export type GetCalendarEventsParams = {
  tenantId: string;
  actorRoleKey?: import('@/types').RoleKey | null;
  rangeStart?: string;
  rangeEnd?: string;
  config: CalendarViewConfig;
  includeArchived?: boolean;
  clientId?: string | null;
  employeeId?: string | null;
};

export type PortalCalendarContext = {
  portalType: 'client' | 'employee' | 'relative' | 'resident';
  clientId?: string | null;
  employeeId?: string | null;
};
