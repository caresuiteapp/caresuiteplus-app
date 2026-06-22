import type { WorkflowStatus } from '@/types';
import type { StationaerCalendarSourceType } from '@/types/calendar';
import type { StationaerCalendarEntity } from '@/types/modules/stationaerCalendar';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { getDemoResidentListItems } from '@/data/demo/residents';
import { getDemoActivityPlans } from '@/data/demo/stationaerPlanning';

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3600000).toISOString();
}

function buildSeedEntities(): StationaerCalendarEntity[] {
  const residents = getDemoResidentListItems().slice(0, 4);
  const activities = getDemoActivityPlans().slice(0, 3);
  const now = Date.now();

  const entities: StationaerCalendarEntity[] = [
    {
      id: 'stat-appt-001',
      tenantId: DEMO_TENANT_ID,
      sourceType: 'stationary_appointment',
      title: 'Einrichtungsrunde',
      description: null,
      startAt: hoursFromNow(2),
      endAt: hoursFromNow(3),
      allDay: false,
      status: 'aktiv',
      relatedResidentId: null,
      relatedWardId: 'ward-a',
      relatedEmployeeId: null,
      room: null,
      locationType: 'ward',
      locationName: 'Haus A',
      isClientPortalVisible: false,
      isEmployeePortalVisible: true,
      isRelativePortalVisible: false,
      updatedAt: new Date(now).toISOString(),
    },
    {
      id: 'stat-appt-002',
      tenantId: DEMO_TENANT_ID,
      sourceType: 'resident_appointment',
      title: `Arzttermin · ${residents[0]?.firstName ?? 'Bewohner'}`,
      description: null,
      startAt: hoursFromNow(26),
      endAt: hoursFromNow(27),
      allDay: false,
      status: 'aktiv',
      relatedResidentId: residents[0]?.id ?? null,
      relatedWardId: 'ward-a',
      relatedEmployeeId: null,
      room: residents[0]?.roomName ?? null,
      locationType: 'room',
      locationName: 'Behandlungszimmer',
      isClientPortalVisible: true,
      isEmployeePortalVisible: true,
      isRelativePortalVisible: true,
      updatedAt: new Date(now).toISOString(),
    },
    ...activities.map((activity, index) => ({
      id: activity.id,
      tenantId: DEMO_TENANT_ID,
      sourceType: 'stationary_activity' as StationaerCalendarSourceType,
      title: activity.title,
      description: `Leitung: ${activity.facilitator}`,
      startAt: activity.scheduledAt,
      endAt: new Date(new Date(activity.scheduledAt).getTime() + 90 * 60000).toISOString(),
      allDay: false,
      status: activity.status,
      relatedResidentId: null,
      relatedWardId: 'ward-b',
      relatedEmployeeId: null,
      room: null,
      locationType: 'common_area',
      locationName: activity.location,
      isClientPortalVisible: true,
      isEmployeePortalVisible: true,
      isRelativePortalVisible: true,
      updatedAt: new Date(now + index).toISOString(),
    })),
    {
      id: 'stat-visit-001',
      tenantId: DEMO_TENANT_ID,
      sourceType: 'resident_visit',
      title: `Besuch · ${residents[1]?.firstName ?? 'Bewohner'}`,
      description: 'Angehörigenbesuch',
      startAt: hoursFromNow(48),
      endAt: hoursFromNow(50),
      allDay: false,
      status: 'aktiv',
      relatedResidentId: residents[1]?.id ?? null,
      relatedWardId: 'ward-a',
      relatedEmployeeId: null,
      room: residents[1]?.roomName ?? null,
      locationType: 'room',
      locationName: 'Besucherraum',
      isClientPortalVisible: true,
      isEmployeePortalVisible: false,
      isRelativePortalVisible: true,
      updatedAt: new Date(now).toISOString(),
    },
    {
      id: 'stat-phys-001',
      tenantId: DEMO_TENANT_ID,
      sourceType: 'physician_visit',
      title: 'Hausarztvisite',
      description: null,
      startAt: hoursFromNow(72),
      endAt: hoursFromNow(74),
      allDay: false,
      status: 'aktiv',
      relatedResidentId: residents[2]?.id ?? null,
      relatedWardId: 'ward-b',
      relatedEmployeeId: null,
      room: null,
      locationType: 'ward',
      locationName: 'Haus B',
      isClientPortalVisible: true,
      isEmployeePortalVisible: true,
      isRelativePortalVisible: false,
      updatedAt: new Date(now).toISOString(),
    },
    {
      id: 'stat-therapy-001',
      tenantId: DEMO_TENANT_ID,
      sourceType: 'therapy_appointment',
      title: 'Ergotherapie',
      description: null,
      startAt: hoursFromNow(96),
      endAt: hoursFromNow(97),
      allDay: false,
      status: 'aktiv',
      relatedResidentId: residents[0]?.id ?? null,
      relatedWardId: 'ward-a',
      relatedEmployeeId: null,
      room: null,
      locationType: 'therapy_room',
      locationName: 'Therapieraum 1',
      isClientPortalVisible: true,
      isEmployeePortalVisible: true,
      isRelativePortalVisible: true,
      updatedAt: new Date(now).toISOString(),
    },
    {
      id: 'stat-family-001',
      tenantId: DEMO_TENANT_ID,
      sourceType: 'family_meeting',
      title: 'Angehörigengespräch',
      description: null,
      startAt: hoursFromNow(120),
      endAt: hoursFromNow(121),
      allDay: false,
      status: 'aktiv',
      relatedResidentId: residents[2]?.id ?? null,
      relatedWardId: 'ward-b',
      relatedEmployeeId: null,
      room: null,
      locationType: 'office',
      locationName: 'Beratungszimmer',
      isClientPortalVisible: false,
      isEmployeePortalVisible: true,
      isRelativePortalVisible: true,
      updatedAt: new Date(now).toISOString(),
    },
    {
      id: 'stat-ward-001',
      tenantId: DEMO_TENANT_ID,
      sourceType: 'ward_meeting',
      title: 'Wohnbereichsbesprechung Haus A',
      description: null,
      startAt: hoursFromNow(144),
      endAt: hoursFromNow(145),
      allDay: false,
      status: 'aktiv',
      relatedResidentId: null,
      relatedWardId: 'ward-a',
      relatedEmployeeId: null,
      room: null,
      locationType: 'ward',
      locationName: 'Haus A',
      isClientPortalVisible: false,
      isEmployeePortalVisible: true,
      isRelativePortalVisible: false,
      updatedAt: new Date(now).toISOString(),
    },
    {
      id: 'stat-adm-001',
      tenantId: DEMO_TENANT_ID,
      sourceType: 'admission_appointment',
      title: 'Aufnahmetermin Neubewohner:in',
      description: null,
      startAt: hoursFromNow(168),
      endAt: hoursFromNow(169),
      allDay: false,
      status: 'entwurf',
      relatedResidentId: null,
      relatedWardId: 'ward-c',
      relatedEmployeeId: null,
      room: null,
      locationType: 'office',
      locationName: 'Verwaltung',
      isClientPortalVisible: false,
      isEmployeePortalVisible: true,
      isRelativePortalVisible: false,
      updatedAt: new Date(now).toISOString(),
    },
    {
      id: 'stat-doc-001',
      tenantId: DEMO_TENANT_ID,
      sourceType: 'resident_document_deadline',
      title: 'Pflegeplan-Review fällig',
      description: null,
      startAt: hoursFromNow(192),
      endAt: hoursFromNow(193),
      allDay: false,
      status: 'aktiv',
      relatedResidentId: residents[3]?.id ?? null,
      relatedWardId: 'ward-a',
      relatedEmployeeId: null,
      room: null,
      locationType: null,
      locationName: null,
      isClientPortalVisible: false,
      isEmployeePortalVisible: true,
      isRelativePortalVisible: false,
      updatedAt: new Date(now).toISOString(),
    },
    {
      id: 'stat-task-001',
      tenantId: DEMO_TENANT_ID,
      sourceType: 'stationary_task_deadline',
      title: 'Medikamentenliste aktualisieren',
      description: null,
      startAt: hoursFromNow(216),
      endAt: hoursFromNow(217),
      allDay: false,
      status: 'aktiv',
      relatedResidentId: null,
      relatedWardId: 'ward-b',
      relatedEmployeeId: null,
      room: null,
      locationType: null,
      locationName: null,
      isClientPortalVisible: false,
      isEmployeePortalVisible: true,
      isRelativePortalVisible: false,
      updatedAt: new Date(now).toISOString(),
    },
  ];

  return entities;
}

let demoStore = buildSeedEntities();

export function getDemoStationaerCalendarEntities(): StationaerCalendarEntity[] {
  return demoStore.map((entry) => ({ ...entry }));
}

export function getDemoStationaerCalendarEntityById(
  id: string,
): StationaerCalendarEntity | undefined {
  return demoStore.find((entry) => entry.id === id);
}

export function createDemoStationaerCalendarEntity(
  tenantId: string,
  input: Omit<StationaerCalendarEntity, 'id' | 'tenantId' | 'updatedAt'>,
): StationaerCalendarEntity {
  const entity: StationaerCalendarEntity = {
    ...input,
    id: `stat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tenantId,
    updatedAt: new Date().toISOString(),
  };
  demoStore = [entity, ...demoStore];
  return entity;
}

export function updateDemoStationaerCalendarEntity(
  id: string,
  patch: Partial<StationaerCalendarEntity>,
): StationaerCalendarEntity | undefined {
  const index = demoStore.findIndex((entry) => entry.id === id);
  if (index < 0) return undefined;
  const updated: StationaerCalendarEntity = {
    ...demoStore[index]!,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  demoStore[index] = updated;
  return updated;
}

export function archiveDemoStationaerCalendarEntity(id: string): boolean {
  const before = demoStore.length;
  demoStore = demoStore.filter((entry) => entry.id !== id);
  return demoStore.length < before;
}

export function cancelDemoStationaerCalendarEntity(
  id: string,
): StationaerCalendarEntity | undefined {
  return updateDemoStationaerCalendarEntity(id, { status: 'cancelled' as WorkflowStatus });
}
