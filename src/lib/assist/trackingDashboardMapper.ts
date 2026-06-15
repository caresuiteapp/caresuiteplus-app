import type { ServiceResult } from '@/types';
import type { GeofenceEvent, TrackingDashboard, VehiclePosition } from '@/types/modules/assist';

/** Spalten aus Migration 0030. */
export const TRACKING_DASHBOARD_SELECT_COLUMNS =
  'tenant_id, active_trips, employees_on_route, geofence_alerts_today, positions, recent_events, updated_at';

export const TRACKING_DASHBOARD_REQUIRED_FIELDS = [
  'active_trips',
  'employees_on_route',
  'geofence_alerts_today',
  'positions',
  'recent_events',
] as const;

export type TrackingDashboardLiveRow = {
  tenant_id: string;
  active_trips?: number | null;
  employees_on_route?: number | null;
  geofence_alerts_today?: number | null;
  positions?: unknown;
  recent_events?: unknown;
  updated_at?: string;
};

const VALID_GEOFENCE_TYPES = new Set(['enter', 'exit']);

function schemaMissingFields(row: TrackingDashboardLiveRow): string[] {
  const missing: string[] = [];
  for (const field of TRACKING_DASHBOARD_REQUIRED_FIELDS) {
    if (row[field] === undefined) {
      missing.push(field);
    }
  }
  return missing;
}

function parsePositions(value: unknown): VehiclePosition[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is VehiclePosition => {
    if (typeof item !== 'object' || item === null) return false;
    const pos = item as VehiclePosition;
    return (
      typeof pos.employeeId === 'string' &&
      typeof pos.employeeName === 'string' &&
      typeof pos.latitude === 'number' &&
      typeof pos.longitude === 'number' &&
      typeof pos.speedKmh === 'number' &&
      typeof pos.heading === 'string' &&
      typeof pos.updatedAt === 'string' &&
      typeof pos.insideGeofence === 'boolean' &&
      (pos.assignmentTitle === null || typeof pos.assignmentTitle === 'string')
    );
  });
}

function parseRecentEvents(value: unknown): GeofenceEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is GeofenceEvent => {
    if (typeof item !== 'object' || item === null) return false;
    const event = item as GeofenceEvent;
    return (
      typeof event.id === 'string' &&
      typeof event.label === 'string' &&
      typeof event.timestamp === 'string' &&
      typeof event.employeeName === 'string' &&
      VALID_GEOFENCE_TYPES.has(event.type)
    );
  });
}

export function mapTrackingDashboardRow(
  row: TrackingDashboardLiveRow,
): ServiceResult<TrackingDashboard> {
  const schemaMissing = schemaMissingFields(row);
  if (schemaMissing.length > 0) {
    const fields = schemaMissing.join(', ');
    return {
      ok: false,
      error: `Live-Tracking: Supabase-Schema unvollständig (${fields} fehlen). Migration 0030 anwenden.`,
    };
  }

  return {
    ok: true,
    data: {
      activeTrips: Number(row.active_trips ?? 0),
      employeesOnRoute: Number(row.employees_on_route ?? 0),
      geofenceAlertsToday: Number(row.geofence_alerts_today ?? 0),
      positions: parsePositions(row.positions),
      recentEvents: parseRecentEvents(row.recent_events),
    },
  };
}

export function emptyTrackingDashboard(): TrackingDashboard {
  return {
    activeTrips: 0,
    employeesOnRoute: 0,
    geofenceAlertsToday: 0,
    positions: [],
    recentEvents: [],
  };
}
