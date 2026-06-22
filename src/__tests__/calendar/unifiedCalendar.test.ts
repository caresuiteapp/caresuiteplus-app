import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildModuleCalendarConfig,
  buildOfficeCalendarConfig,
  detectCalendarConflicts,
} from '@/lib/calendar/calendarEventService';
import { filterCalendarRecords } from '@/lib/calendar/calendarFilters';
import { resolveCalendarEventHref, CALENDAR_MODULE_ROUTES, CALENDAR_ROUTE_ALIASES } from '@/lib/calendar/calendarRouteRegistry';
import {
  buildCalendarEventFromStationaerEntity,
} from '@/lib/calendar/calendarSyncService';
import { listTemplates } from '@/lib/calendar/calendarTemplateService';
import { getSystemTemplatesForModule } from '@/data/calendar/defaultTemplates';
import {
  isStationaerCalendarSourceType,
  resolveEventTypeForSource,
  resolveStationaerEventHref,
} from '@/lib/calendar/calendarSourceRegistry';
import { APP_ROUTES } from '@/lib/navigation/routes';
import type { CalendarEventRecord } from '@/types/calendar';
import type { StationaerCalendarEntity } from '@/types/modules/stationaerCalendar';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}



const baseRecord = (overrides: Partial<CalendarEventRecord>): CalendarEventRecord => ({

  id: 'evt-1',

  tenantId: 'tenant-1',

  moduleKey: 'assist',

  sourceType: 'assist_visit',

  sourceId: 'visit-1',

  eventType: 'einsatz',

  title: 'Test',

  description: null,

  internalNote: null,

  publicNote: null,

  startAt: '2026-06-20T08:00:00.000Z',

  endAt: '2026-06-20T09:00:00.000Z',

  allDay: false,

  timezone: 'Europe/Berlin',

  status: 'aktiv',

  priority: 'normal',

  locationType: null,

  locationName: null,

  address: null,

  room: null,

  videoUrl: null,

  phoneNumber: null,

  relatedClientId: null,

  relatedEmployeeId: null,

  relatedTeamId: null,

  relatedWardId: null,

  relatedCaseId: null,

  relatedDocumentId: null,

  visibilityScope: 'tenant',

  isOfficeVisible: true,

  isModuleVisible: true,

  isClientPortalVisible: false,

  isEmployeePortalVisible: true,

  isPublicHoliday: false,

  colorKey: 'assist',

  iconKey: null,

  recurrenceRuleId: null,

  createdAt: '2026-06-20T07:00:00.000Z',

  updatedAt: '2026-06-20T07:00:00.000Z',

  createdBy: null,

  updatedBy: null,

  archivedAt: null,

  ...overrides,

});



describe('Unified calendar system', () => {

  it('Office-Hauptkalender zeigt alle sichtbaren Module', () => {

    const config = buildOfficeCalendarConfig();

    const records = [

      baseRecord({ id: 'a', moduleKey: 'office', eventType: 'termin' }),

      baseRecord({ id: 'b', moduleKey: 'assist', eventType: 'einsatz' }),

      baseRecord({ id: 'c', moduleKey: 'pflege', eventType: 'pflegevisite', isOfficeVisible: false }),

    ];

    const filtered = filterCalendarRecords(records, config);

    expect(filtered.map((r) => r.id)).toEqual(['a', 'b']);

  });



  it('Modulkalender filtert auf module_key', () => {

    const config = buildModuleCalendarConfig('assist');

    const records = [

      baseRecord({ id: 'a', moduleKey: 'assist' }),

      baseRecord({ id: 'b', moduleKey: 'office', eventType: 'termin' }),

    ];

    const filtered = filterCalendarRecords(records, config);

    expect(filtered.map((r) => r.id)).toEqual(['a']);

  });



  it('Beratungsmodul zeigt nur beratung module_key', () => {

    const config = buildModuleCalendarConfig('beratung');

    const records = [

      baseRecord({ id: 'a', moduleKey: 'beratung', eventType: 'wiedervorlage' }),

      baseRecord({ id: 'b', moduleKey: 'assist', eventType: 'einsatz' }),

    ];

    const filtered = filterCalendarRecords(records, config);

    expect(filtered.map((r) => r.id)).toEqual(['a']);

  });



  it('Portal-Client-Sichtbarkeit filtert related_client_id', () => {

    const config = buildOfficeCalendarConfig();

    const records = [

      baseRecord({ id: 'a', relatedClientId: 'client-1', isClientPortalVisible: true }),

      baseRecord({ id: 'b', relatedClientId: 'client-2', isClientPortalVisible: true }),

      baseRecord({ id: 'c', relatedClientId: 'client-1', isClientPortalVisible: false }),

    ];

    const portalVisible = records.filter(

      (r) => r.relatedClientId === 'client-1' && r.isClientPortalVisible && !r.archivedAt,

    );

    const filtered = filterCalendarRecords(records, config);

    expect(filtered.length).toBe(3);

    expect(portalVisible.map((r) => r.id)).toEqual(['a']);

  });



  it('Portal-Employee-Sichtbarkeit filtert related_employee_id', () => {

    const records = [

      baseRecord({ id: 'a', relatedEmployeeId: 'emp-1', isEmployeePortalVisible: true }),

      baseRecord({ id: 'b', relatedEmployeeId: 'emp-2', isEmployeePortalVisible: true }),

    ];

    const portalVisible = records.filter(

      (r) => r.relatedEmployeeId === 'emp-1' && r.isEmployeePortalVisible,

    );

    expect(portalVisible.map((r) => r.id)).toEqual(['a']);

  });



  it('Dedupe-Schlüssel tenant_id+source_type+source_id ist eindeutig', () => {

    const records = [

      baseRecord({ id: 'evt-a', sourceType: 'assist_visit', sourceId: 'visit-1' }),

      baseRecord({ id: 'evt-b', sourceType: 'assist_visit', sourceId: 'visit-1' }),

      baseRecord({ id: 'evt-c', sourceType: 'appointment', sourceId: 'visit-1' }),

    ];

    const keys = records.map((r) => `${r.tenantId}:${r.sourceType}:${r.sourceId}`);

    const uniqueKeys = new Set(keys);

    expect(uniqueKeys.size).toBe(2);

  });



  it('cancelled Status wird standardmäßig ausgeblendet', () => {

    const config = buildOfficeCalendarConfig();

    const records = [

      baseRecord({ id: 'a', status: 'aktiv' }),

      baseRecord({ id: 'b', status: 'cancelled' }),

    ];

    const filtered = filterCalendarRecords(records, config);

    expect(filtered.map((r) => r.id)).toEqual(['a']);

  });



  it('archivierte Events werden standardmäßig ausgeblendet', () => {

    const config = buildOfficeCalendarConfig();

    const records = [

      baseRecord({ id: 'a' }),

      baseRecord({ id: 'b', archivedAt: '2026-06-20T10:00:00.000Z' }),

    ];

    const filtered = filterCalendarRecords(records, config);

    expect(filtered.map((r) => r.id)).toEqual(['a']);

  });



  it('Legacy-Fallback liefert nicht parallel zum zentralen Store', () => {

    const centralRecords = [baseRecord({ id: 'central-1', sourceId: 'visit-1' })];

    const legacyRecords = [baseRecord({ id: 'legacy-1', sourceId: 'visit-1' })];

    const display = centralRecords.length > 0 ? centralRecords : legacyRecords;

    expect(display.map((r) => r.id)).toEqual(['central-1']);

    expect(display.length).toBe(1);

  });



  it('resolveCalendarEventHref verlinkt Assist-Einsätze', () => {

    const href = resolveCalendarEventHref(baseRecord({ sourceId: 'abc-123' }));

    expect(href).toBe('/assist/assignments/abc-123');

  });

  it('Stationär-Modulkalender filtert auf module_key stationaer', () => {
    const config = buildModuleCalendarConfig('stationaer');
    const records = [
      baseRecord({ id: 'a', moduleKey: 'stationaer', eventType: 'aktivitaet', sourceType: 'stationary_activity' }),
      baseRecord({ id: 'b', moduleKey: 'assist', eventType: 'einsatz' }),
      baseRecord({ id: 'c', moduleKey: 'stationaer', eventType: 'termin', sourceType: 'resident_appointment' }),
    ];
    const filtered = filterCalendarRecords(records, config);
    expect(filtered.map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('Office-Hauptkalender enthält sichtbare Stationär-Events', () => {
    const config = buildOfficeCalendarConfig();
    const records = [
      baseRecord({ id: 'a', moduleKey: 'office', eventType: 'termin' }),
      baseRecord({ id: 'b', moduleKey: 'stationaer', eventType: 'besuch', isOfficeVisible: true }),
      baseRecord({ id: 'c', moduleKey: 'stationaer', eventType: 'aktivitaet', isOfficeVisible: false }),
    ];
    const filtered = filterCalendarRecords(records, config);
    expect(filtered.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('Stationär source_type mappt auf korrekte event_types', () => {
    expect(resolveEventTypeForSource('stationary_activity')).toBe('aktivitaet');
    expect(resolveEventTypeForSource('resident_visit')).toBe('besuch');
    expect(resolveEventTypeForSource('family_meeting')).toBe('besprechung');
    expect(resolveEventTypeForSource('resident_document_deadline')).toBe('frist');
    expect(isStationaerCalendarSourceType('stationary_appointment')).toBe(true);
    expect(isStationaerCalendarSourceType('appointment')).toBe(false);
  });

  it('Stationär-Sync-Builder setzt module_key stationaer und Ward-Felder', () => {
    const entity: StationaerCalendarEntity = {
      id: 'evt-stat-1',
      tenantId: 'tenant-1',
      sourceType: 'stationary_activity',
      title: 'Sitzgymnastik',
      description: null,
      startAt: '2026-06-20T10:00:00.000Z',
      endAt: '2026-06-20T11:30:00.000Z',
      allDay: false,
      status: 'aktiv',
      relatedResidentId: null,
      relatedWardId: 'ward-a',
      relatedEmployeeId: null,
      room: 'Aula',
      locationType: 'common_area',
      locationName: 'Aula',
      isClientPortalVisible: true,
      isEmployeePortalVisible: true,
      isRelativePortalVisible: true,
      updatedAt: '2026-06-20T09:00:00.000Z',
    };
    const payload = buildCalendarEventFromStationaerEntity(entity);
    expect(payload.moduleKey).toBe('stationaer');
    expect(payload.sourceType).toBe('stationary_activity');
    expect(payload.eventType).toBe('aktivitaet');
    expect(payload.relatedWardId).toBe('ward-a');
    expect(payload.room).toBe('Aula');
    expect(payload.locationType).toBe('common_area');
    expect(payload.isClientPortalVisible).toBe(true);
  });

  it('Stationär-Dedupe-Schlüssel tenant_id+source_type+source_id', () => {
    const records = [
      baseRecord({ id: 'evt-a', moduleKey: 'stationaer', sourceType: 'stationary_activity', sourceId: 'act-1' }),
      baseRecord({ id: 'evt-b', moduleKey: 'stationaer', sourceType: 'stationary_activity', sourceId: 'act-1' }),
      baseRecord({ id: 'evt-c', moduleKey: 'stationaer', sourceType: 'resident_visit', sourceId: 'act-1' }),
    ];
    const keys = records.map((r) => `${r.tenantId}:${r.sourceType}:${r.sourceId}`);
    expect(new Set(keys).size).toBe(2);
  });

  it('Portal-Resident-Sichtbarkeit filtert stationaer client portal events', () => {
    const records = [
      baseRecord({
        id: 'a',
        moduleKey: 'stationaer',
        sourceType: 'resident_appointment',
        relatedClientId: 'resident-1',
        isClientPortalVisible: true,
      }),
      baseRecord({
        id: 'b',
        moduleKey: 'stationaer',
        sourceType: 'ward_meeting',
        relatedClientId: 'resident-1',
        isClientPortalVisible: false,
      }),
      baseRecord({
        id: 'c',
        moduleKey: 'assist',
        relatedClientId: 'resident-1',
        isClientPortalVisible: true,
      }),
    ];
    const portalVisible = records.filter(
      (r) =>
        r.moduleKey === 'stationaer'
        && r.relatedClientId === 'resident-1'
        && r.isClientPortalVisible
        && !r.archivedAt,
    );
    expect(portalVisible.map((r) => r.id)).toEqual(['a']);
  });

  it('resolveCalendarEventHref verlinkt Stationär-Aktivitäten', () => {
    const href = resolveCalendarEventHref(
      baseRecord({
        moduleKey: 'stationaer',
        sourceType: 'stationary_activity',
        sourceId: 'act-42',
      }),
    );
    expect(href).toBe('/stationaer/aktivitaeten/act-42');
    expect(resolveStationaerEventHref('resident_visit', 'visit-9')).toBe('/stationaer/besuche/visit-9');
  });

  it('detectCalendarConflicts liefert Stationär-Stubs', () => {
    const conflicts = detectCalendarConflicts({
      tenantId: 'tenant-1',
      moduleKey: 'stationaer',
      sourceType: 'physician_visit',
      wardId: 'ward-a',
      startAt: '2026-06-20T10:00:00.000Z',
      endAt: '2026-06-20T11:00:00.000Z',
    });
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts.some((c) => c.message.includes('Wohnbereich'))).toBe(true);
    expect(conflicts.some((c) => c.message.includes('Medizinischer Termin'))).toBe(true);
  });

  it('buildModuleCalendarConfig liefert Modul-Metadaten', () => {
    const pflege = buildModuleCalendarConfig('pflege');
    expect(pflege.subtitle).toContain('Pflege');
    expect(pflege.emptyStateMessage).toBeTruthy();
    expect(pflege.moduleColor).toBeTruthy();
    expect(pflege.breadcrumbs?.length).toBeGreaterThan(0);
    expect(pflege.allowedEventTypes).toContain('pflegevisite');
  });

  it('alle Modul-Routen sind registriert', () => {
    for (const route of Object.values(CALENDAR_MODULE_ROUTES)) {
      expect(route).toMatch(/^\/(office|assist|pflege|stationaer|beratung|akademie)\/calendar$/);
    }
  });

  it('Kalender-Aliase leiten auf /calendar um', () => {
    expect(CALENDAR_ROUTE_ALIASES['/pflege/kalender']).toBe('/pflege/calendar');
    expect(CALENDAR_ROUTE_ALIASES['/beratung/kalender']).toBe('/beratung/calendar');
    expect(CALENDAR_ROUTE_ALIASES['/akademie/kalender']).toBe('/akademie/calendar');
    expect(CALENDAR_ROUTE_ALIASES['/stationaer/kalender']).toBe('/stationaer/calendar');
  });

  it('APP_ROUTES enthält alle Modul-Kalender', () => {
    const paths = [
      '/office/calendar',
      '/assist/calendar',
      '/pflege/calendar',
      '/stationaer/calendar',
      '/beratung/calendar',
      '/akademie/calendar',
    ];
    for (const p of paths) {
      expect(APP_ROUTES.some((r) => r.path === p)).toBe(true);
    }
  });

  it('Modul-Routen nutzen CalendarShell über ModuleCalendarScreen', () => {
    for (const mod of ['pflege', 'beratung', 'akademie', 'stationaer'] as const) {
      const route = readSrc(`app/${mod}/calendar/index.tsx`);
      expect(route).toContain('ModuleCalendarScreen');
      expect(route).not.toContain('Placeholder');
    }
    const assist = readSrc('app/assist/(tabs)/calendar.tsx');
    expect(assist).toContain('AssistCalendarScreen');
    expect(assist).not.toContain('Placeholder');
  });

  it('CalendarPageShell ist kanonische Shell-Komponente', () => {
    const shell = readSrc('src/components/calendar/CalendarPageShell.tsx');
    expect(shell).toContain('CalendarToolbar');
    expect(shell).toContain('CalendarFilterBar');
    expect(shell).toContain('CalendarEventGrid');
    expect(shell).toContain('CalendarCreateModal');
    expect(shell).toContain('sourceContext="calendar"');
    const mobile = readSrc('src/components/calendar/CalendarMobileView.tsx');
    expect(mobile).toContain('CalendarPageShell');
  });

  it('Template-Filterung pro Modul', async () => {
    const assist = getSystemTemplatesForModule('assist');
    expect(assist.every((t) => t.moduleKey === 'assist')).toBe(true);
    expect(assist.some((t) => t.templateKey === 'assist_einsatz')).toBe(true);

    const pflege = getSystemTemplatesForModule('pflege');
    expect(pflege.every((t) => t.moduleKey === 'pflege')).toBe(true);

    const listed = await listTemplates('beratung', null, 'counselor');
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data.every((t) => t.moduleKey === 'beratung')).toBe(true);
    }
  });

  it('Drawer und Create-Komponenten sind zentral exportiert', () => {
    const index = readSrc('src/components/calendar/index.ts');
    expect(index).toContain('CalendarEventDrawer');
    expect(index).toContain('CalendarEventCreateModal');
    expect(index).toContain('CalendarEventForm');
    expect(index).toContain('CalendarEventTemplatePicker');
    expect(index).toContain('CalendarPageShell');
  });

  it('Calendar und Terminverwaltung nutzen dieselbe Create-Modal-Komponente', () => {
    const shell = readSrc('src/components/calendar/CalendarPageShell.tsx');
    const appointments = readSrc('src/screens/office/AppointmentsListScreen.tsx');
    expect(shell).toContain('CalendarCreateModal');
    expect(shell).toContain('sourceContext="calendar"');
    expect(appointments).toContain('CalendarEventCreateModal');
    expect(appointments).toContain('sourceContext="appointment_management"');
  });

  it('defaultTemplates Fallback liefert Systemvorlagen pro Modul', () => {
    const office = getSystemTemplatesForModule('office');
    const stationaer = getSystemTemplatesForModule('stationaer');
    expect(office.length).toBeGreaterThan(0);
    expect(stationaer.some((t) => t.templateKey === 'stationaer_aktivitaet')).toBe(true);
    expect(getSystemTemplatesForModule('assist').some((t) => t.templateKey === 'assist_einsatz')).toBe(true);
  });

  it('Template-Picker hat Empty-State und Seed-Aktion', () => {
    const picker = readSrc('src/components/calendar/CalendarEventTemplatePicker.tsx');
    expect(picker).toContain('Standardvorlagen erstellen');
    expect(picker).toContain('Ohne Vorlage fortfahren');
    expect(picker).toContain('seedSystemCalendarTemplates');
  });

  it('calendarEventSaveService ist zentraler Speicherpfad', () => {
    const save = readSrc('src/lib/calendar/calendarEventSaveService.ts');
    expect(save).toContain('createCalendarEventFromForm');
    expect(save).toContain('syncCalendarEvent');
    expect(save).toContain('appointmentSupabaseRepository.create');
  });

  it('Legacy-Termin-Formular leitet auf Modal-Flow um', () => {
    const createRoute = readSrc('app/office/appointments/create.tsx');
    const createScreen = readSrc('src/screens/office/AppointmentCreateScreen.tsx');
    expect(createRoute).toContain('Redirect');
    expect(createRoute).toContain('create=1');
    expect(createScreen).toContain('Redirect');
    expect(createScreen).not.toContain('DomainCreateScreen');
  });

  it('Assist-Einsatz wird im Type-Step separat verlinkt', () => {
    const form = readSrc('src/components/calendar/CalendarEventForm.tsx');
    const modal = readSrc('src/components/calendar/CalendarEventCreateModal.tsx');
    expect(form).toContain('Assist-Einsatz');
    expect(form).toContain('Einsatz-Wizard');
    expect(modal).toContain('/assist/einsaetze/new');
  });

});

