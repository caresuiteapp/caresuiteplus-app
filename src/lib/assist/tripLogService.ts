import type { RoleKey, ServiceResult } from '@/types';
import type { TrackingDashboard, TripLogDetail, TripLogListItem } from '@/types/modules/assist';
import {
  endDemoTrip,
  getDemoTrackingDashboard,
  getDemoTripById,
  getDemoTripListItems,
  getTripGeofenceEvents,
} from '@/data/demo/tripLogs';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { tripSupabaseRepository } from '@/lib/services/repositories/tripRepository.supabase';
import { trackingSupabaseRepository } from '@/lib/services/repositories/trackingRepository.supabase';
import { isMissingTableServiceError } from '@/lib/supabase/errors';
import { emptyTrackingDashboard } from '@/lib/assist/trackingDashboardMapper';

function tenantDenied<T>(tenantId: string): ServiceResult<T> | null {
  const block = guardServiceTenant(tenantId);
  if (block) return block;
  return null;
}

const PURPOSE_LABELS = {
  einsatz: 'Einsatzfahrt',
  dienstfahrt: 'Dienstfahrt',
  material: 'Materialtransport',
  sonstiges: 'Sonstiges',
} as const;

export async function fetchTripLogList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TripLogListItem[]>> {
  const denied = enforcePermission<TripLogListItem[]>(actorRoleKey, 'assist.trips.view');
  if (denied) return denied;

  const deniedTenant = tenantDenied<TripLogListItem[]>(tenantId);
  if (deniedTenant) return deniedTenant;

  if (getServiceMode() === 'supabase') {
    const result = await tripSupabaseRepository.listMapped(tenantId);
    if (result.ok && result.tableMissing) {
      return { ok: true, data: [] };
    }
    if (!result.ok && isMissingTableServiceError(result.error)) {
      return { ok: true, data: [] };
    }
    return result;
  }

  await new Promise((r) => setTimeout(r, 300));
  return { ok: true, data: getDemoTripListItems() };
}

export async function fetchTripDetail(
  tripId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TripLogDetail>> {
  const denied = enforcePermission<TripLogDetail>(actorRoleKey, 'assist.trips.view');
  if (denied) return denied;

  const deniedTenant = tenantDenied<TripLogDetail>(tenantId);
  if (deniedTenant) return deniedTenant;

  if (getServiceMode() === 'supabase') {
    const result = await tripSupabaseRepository.getDetailMapped(tripId, tenantId);
    if (result.ok && result.tableMissing) {
      return { ok: false, error: 'Fahrt nicht gefunden.' };
    }
    if (!result.ok && isMissingTableServiceError(result.error)) {
      return { ok: false, error: 'Fahrt nicht gefunden.' };
    }
    return result;
  }

  await new Promise((r) => setTimeout(r, 260));
  const trip = getDemoTripById(tripId);
  if (!trip) return { ok: false, error: 'Fahrt nicht gefunden.' };

  const detail: TripLogDetail = {
    id: trip.id,
    tenantId: trip.tenantId,
    employeeId: trip.employeeId,
    assignmentId: trip.assignmentId,
    vehicleLabel: trip.vehicleLabel,
    purpose: trip.purpose,
    startedAt: trip.startedAt,
    endedAt: trip.endedAt,
    distanceKm: trip.distanceKm,
    status: trip.status,
    updatedAt: trip.updatedAt,
    employeeName: trip.employeeName,
    routeSummary: `${trip.startAddress}${trip.endAddress ? ` → ${trip.endAddress}` : ' (läuft)'}`,
    startAddress: trip.startAddress,
    endAddress: trip.endAddress,
    notes: trip.notes ?? null,
    geofenceEvents: getTripGeofenceEvents(tripId),
  };

  return { ok: true, data: detail };
}

export async function fetchTrackingDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TrackingDashboard>> {
  const denied = enforcePermission<TrackingDashboard>(actorRoleKey, 'assist.tracking.view');
  if (denied) return denied;

  const deniedTenant = tenantDenied<TrackingDashboard>(tenantId);
  if (deniedTenant) return deniedTenant;

  if (getServiceMode() === 'supabase') {
    const result = await trackingSupabaseRepository.getDashboardMapped(tenantId);
    if (result.ok && result.tableMissing) {
      return { ok: true, data: emptyTrackingDashboard() };
    }
    if (!result.ok && isMissingTableServiceError(result.error)) {
      return { ok: true, data: emptyTrackingDashboard() };
    }
    return result;
  }

  await new Promise((r) => setTimeout(r, 320));
  return { ok: true, data: getDemoTrackingDashboard() };
}

export async function completeTrip(
  tripId: string,
  tenantId: string,
  endAddress: string,
  distanceKm: number,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TripLogDetail>> {
  const denied = enforcePermission<TripLogDetail>(actorRoleKey, 'assist.trips.manage');
  if (denied) return denied;

  const deniedTenant = tenantDenied<TripLogDetail>(tenantId);
  if (deniedTenant) return deniedTenant;

  if (getServiceMode() === 'supabase') {
    return tripSupabaseRepository.completeTripMapped(
      tripId,
      tenantId,
      endAddress,
      distanceKm,
    );
  }

  await new Promise((r) => setTimeout(r, 350));
  const updated = endDemoTrip(tripId, endAddress, distanceKm);
  if (!updated) return { ok: false, error: 'Fahrt konnte nicht abgeschlossen werden.' };

  return fetchTripDetail(tripId, tenantId, actorRoleKey);
}

export { PURPOSE_LABELS };
