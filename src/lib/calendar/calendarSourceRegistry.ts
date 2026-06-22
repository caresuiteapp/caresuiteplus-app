import type {
  CalendarEventRecordType,
  CalendarSourceType,
  StationaerCalendarSourceType,
} from '@/types/calendar';

export type CalendarSourceDefinition = {
  sourceType: CalendarSourceType;
  moduleKey: 'stationaer';
  eventType: CalendarEventRecordType;
  hrefSegment: string;
  label: string;
};

const STATIONAER_SOURCE_DEFINITIONS: Record<StationaerCalendarSourceType, CalendarSourceDefinition> = {
  stationary_appointment: {
    sourceType: 'stationary_appointment',
    moduleKey: 'stationaer',
    eventType: 'termin',
    hrefSegment: 'termine',
    label: 'Einrichtungstermin',
  },
  resident_appointment: {
    sourceType: 'resident_appointment',
    moduleKey: 'stationaer',
    eventType: 'termin',
    hrefSegment: 'bewohnertermine',
    label: 'Bewohnertermin',
  },
  stationary_activity: {
    sourceType: 'stationary_activity',
    moduleKey: 'stationaer',
    eventType: 'aktivitaet',
    hrefSegment: 'aktivitaeten',
    label: 'Aktivität',
  },
  resident_visit: {
    sourceType: 'resident_visit',
    moduleKey: 'stationaer',
    eventType: 'besuch',
    hrefSegment: 'besuche',
    label: 'Besuch',
  },
  physician_visit: {
    sourceType: 'physician_visit',
    moduleKey: 'stationaer',
    eventType: 'termin',
    hrefSegment: 'arztbesuche',
    label: 'Arztbesuch',
  },
  therapy_appointment: {
    sourceType: 'therapy_appointment',
    moduleKey: 'stationaer',
    eventType: 'termin',
    hrefSegment: 'therapie',
    label: 'Therapietermin',
  },
  family_meeting: {
    sourceType: 'family_meeting',
    moduleKey: 'stationaer',
    eventType: 'besprechung',
    hrefSegment: 'angehoerigentermine',
    label: 'Angehörigentermin',
  },
  ward_meeting: {
    sourceType: 'ward_meeting',
    moduleKey: 'stationaer',
    eventType: 'besprechung',
    hrefSegment: 'wohnbereichsbesprechungen',
    label: 'Wohnbereichsbesprechung',
  },
  admission_appointment: {
    sourceType: 'admission_appointment',
    moduleKey: 'stationaer',
    eventType: 'termin',
    hrefSegment: 'aufnahmen',
    label: 'Aufnahmetermin',
  },
  resident_document_deadline: {
    sourceType: 'resident_document_deadline',
    moduleKey: 'stationaer',
    eventType: 'frist',
    hrefSegment: 'dokumentfristen',
    label: 'Dokumentfrist',
  },
  stationary_task_deadline: {
    sourceType: 'stationary_task_deadline',
    moduleKey: 'stationaer',
    eventType: 'frist',
    hrefSegment: 'aufgabenfristen',
    label: 'Aufgabenfrist',
  },
};

export const STATIONAER_CALENDAR_SOURCE_TYPES = Object.keys(
  STATIONAER_SOURCE_DEFINITIONS,
) as StationaerCalendarSourceType[];

export function isStationaerCalendarSourceType(
  sourceType: CalendarSourceType,
): sourceType is StationaerCalendarSourceType {
  return sourceType in STATIONAER_SOURCE_DEFINITIONS;
}

export function resolveStationaerSourceDefinition(
  sourceType: StationaerCalendarSourceType,
): CalendarSourceDefinition {
  return STATIONAER_SOURCE_DEFINITIONS[sourceType];
}

export function resolveEventTypeForSource(sourceType: CalendarSourceType): CalendarEventRecordType | null {
  if (isStationaerCalendarSourceType(sourceType)) {
    return STATIONAER_SOURCE_DEFINITIONS[sourceType].eventType;
  }
  return null;
}

export function resolveStationaerEventHref(
  sourceType: StationaerCalendarSourceType,
  sourceId: string,
): string {
  const def = STATIONAER_SOURCE_DEFINITIONS[sourceType];
  return `/stationaer/${def.hrefSegment}/${sourceId}`;
}

/** care_records record_type → calendar source_type */
export const CARE_RECORD_TO_CALENDAR_SOURCE: Record<string, StationaerCalendarSourceType> = {
  stationary_appointment: 'stationary_appointment',
  resident_appointment: 'resident_appointment',
  stationary_activity: 'stationary_activity',
  resident_visit: 'resident_visit',
  physician_visit: 'physician_visit',
  therapy_appointment: 'therapy_appointment',
  family_meeting: 'family_meeting',
  ward_meeting: 'ward_meeting',
  admission_appointment: 'admission_appointment',
  resident_document_deadline: 'resident_document_deadline',
  stationary_task_deadline: 'stationary_task_deadline',
};

export function resolveSourceTypeFromCareRecord(
  recordType: string,
): StationaerCalendarSourceType | null {
  return CARE_RECORD_TO_CALENDAR_SOURCE[recordType] ?? null;
}
