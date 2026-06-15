import type { GeofenceEvent, TripLog, TripLogListItem, TrackingDashboard, VehiclePosition } from '@/types/modules/assist';
import { demoEmployees } from './employees';
import { DEMO_TENANT_ID } from './tenant';

function employeeName(id: string): string {
  const e = demoEmployees.find((x) => x.id === id);
  return e ? `${e.firstName} ${e.lastName}` : 'Unbekannt';
}

type TripSeed = TripLog & { notes?: string | null };

const TRIP_SEEDS: TripSeed[] = [
  {
    id: 'trip-001',
    tenantId: DEMO_TENANT_ID,
    employeeId: 'employee-001',
    assignmentId: 'assign-001',
    vehicleLabel: 'VW Caddy · B-CS 1001',
    purpose: 'einsatz',
    startedAt: '2026-06-01T08:15:00.000Z',
    endedAt: '2026-06-01T09:05:00.000Z',
    startAddress: 'Büro Mitte, Berlin',
    endAddress: 'Musterstraße 12, Berlin',
    distanceKm: 8.4,
    status: 'abgeschlossen',
    createdAt: '2026-06-01T08:15:00.000Z',
    updatedAt: '2026-06-01T09:05:00.000Z',
    notes: 'Anfahrt zum Einsatz Alltagsbegleitung',
  },
  {
    id: 'trip-002',
    tenantId: DEMO_TENANT_ID,
    employeeId: 'employee-002',
    assignmentId: 'assign-002',
    vehicleLabel: 'E-Bike · Flotte 3',
    purpose: 'einsatz',
    startedAt: '2026-06-01T10:00:00.000Z',
    endedAt: null,
    startAddress: 'Depot Friedrichshain',
    endAddress: null,
    distanceKm: null,
    status: 'in_bearbeitung',
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    notes: 'Unterwegs zur Pflegevisit',
  },
  {
    id: 'trip-003',
    tenantId: DEMO_TENANT_ID,
    employeeId: 'employee-003',
    assignmentId: null,
    vehicleLabel: 'VW Caddy · B-CS 1003',
    purpose: 'material',
    startedAt: '2026-06-01T07:30:00.000Z',
    endedAt: '2026-06-01T08:00:00.000Z',
    startAddress: 'Lager Süd',
    endAddress: 'Büro Mitte, Berlin',
    distanceKm: 12.1,
    status: 'abgeschlossen',
    createdAt: '2026-06-01T07:30:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'trip-004',
    tenantId: DEMO_TENANT_ID,
    employeeId: 'employee-001',
    assignmentId: 'assign-003',
    vehicleLabel: 'VW Caddy · B-CS 1001',
    purpose: 'einsatz',
    startedAt: '2026-06-01T09:30:00.000Z',
    endedAt: '2026-06-01T10:45:00.000Z',
    startAddress: 'Musterstraße 12, Berlin',
    endAddress: 'Prenzlauer Berg, Berlin',
    distanceKm: 5.2,
    status: 'abgeschlossen',
    createdAt: '2026-06-01T09:30:00.000Z',
    updatedAt: '2026-06-01T10:45:00.000Z',
  },
];

let tripStore: TripSeed[] = TRIP_SEEDS.map((t) => ({ ...t }));

const GEOFENCE_EVENTS: GeofenceEvent[] = [
  {
    id: 'geo-001',
    type: 'enter',
    label: 'Einsatzgebiet Musterstraße',
    timestamp: '2026-06-01T08:52:00.000Z',
    employeeName: 'Thomas Keller',
  },
  {
    id: 'geo-002',
    type: 'exit',
    label: 'Einsatzgebiet Musterstraße',
    timestamp: '2026-06-01T09:48:00.000Z',
    employeeName: 'Thomas Keller',
  },
  {
    id: 'geo-003',
    type: 'enter',
    label: 'Einsatzgebiet Friedrichshain',
    timestamp: '2026-06-01T10:18:00.000Z',
    employeeName: 'Anna Krüger',
  },
];

const POSITIONS: VehiclePosition[] = [
  {
    employeeId: 'employee-002',
    employeeName: 'Anna Krüger',
    latitude: 52.5158,
    longitude: 13.4542,
    speedKmh: 18,
    heading: 'SO',
    updatedAt: new Date().toISOString(),
    assignmentTitle: 'Pflegevisit',
    insideGeofence: true,
  },
  {
    employeeId: 'employee-004',
    employeeName: 'Maria Schmidt',
    latitude: 52.4892,
    longitude: 13.4211,
    speedKmh: 42,
    heading: 'N',
    updatedAt: new Date().toISOString(),
    assignmentTitle: 'Begleitung Arzt',
    insideGeofence: false,
  },
];

export function getDemoTripListItems(): TripLogListItem[] {
  return tripStore.map((t) => ({
    id: t.id,
    tenantId: t.tenantId,
    employeeId: t.employeeId,
    assignmentId: t.assignmentId,
    vehicleLabel: t.vehicleLabel,
    purpose: t.purpose,
    startedAt: t.startedAt,
    endedAt: t.endedAt,
    distanceKm: t.distanceKm,
    status: t.status,
    updatedAt: t.updatedAt,
    employeeName: employeeName(t.employeeId),
    routeSummary: `${t.startAddress}${t.endAddress ? ` → ${t.endAddress}` : ' (läuft)'}`,
  }));
}

export function getDemoTripById(id: string): (TripSeed & { employeeName: string }) | null {
  const trip = tripStore.find((t) => t.id === id);
  if (!trip) return null;
  return { ...trip, employeeName: employeeName(trip.employeeId) };
}

export function getDemoTrackingDashboard(): TrackingDashboard {
  const active = tripStore.filter((t) => t.status === 'in_bearbeitung');
  return {
    activeTrips: active.length,
    employeesOnRoute: POSITIONS.length,
    geofenceAlertsToday: GEOFENCE_EVENTS.length,
    positions: POSITIONS,
    recentEvents: GEOFENCE_EVENTS,
  };
}

export function getTripGeofenceEvents(tripId: string): GeofenceEvent[] {
  const trip = tripStore.find((t) => t.id === tripId);
  if (!trip) return [];
  return GEOFENCE_EVENTS.filter((e) => e.employeeName === employeeName(trip.employeeId));
}

export function endDemoTrip(tripId: string, endAddress: string, distanceKm: number): TripSeed | null {
  const index = tripStore.findIndex((t) => t.id === tripId);
  if (index < 0 || tripStore[index].endedAt) return null;

  tripStore[index] = {
    ...tripStore[index],
    endedAt: new Date().toISOString(),
    endAddress,
    distanceKm,
    status: 'abgeschlossen',
    updatedAt: new Date().toISOString(),
  };
  return { ...tripStore[index] };
}
