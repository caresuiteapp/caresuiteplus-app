import type { RoleKey, ServiceResult } from '@/types';
import type { GeoProviderContext, RouteCalculation, RouteRequestInput } from '@/types/geo';
import { ROLE_PERMISSIONS } from '@/data/demo/permissions';
import {
  assertExternalProviderAllowed,
  assertGeoExecutionReady,
  assertGeoRolePermission,
  assertLocationPurpose,
  runGeoGuardChain,
} from '@/lib/geo/geoGuard';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { auditBlockedGeoAction, buildRetentionUntil, recordLocationAuditEvent } from '@/lib/geo/locationAuditService';

async function guardedRouteAction(
  input: RouteRequestInput,
  provider: GeoProviderContext,
  actorRoleKey: RoleKey | null | undefined,
  action: string,
): Promise<ServiceResult<RouteCalculation>> {
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const guard = runGeoGuardChain([
    assertLocationPurpose(input.purpose),
    assertGeoRolePermission(actorRoleKey, input.purpose, ROLE_PERMISSIONS[actorRoleKey ?? 'caregiver'] ?? []),
    assertExternalProviderAllowed(provider, input.purpose),
    assertGeoExecutionReady(),
  ]);

  if (!guard.allowed) {
    await auditBlockedGeoAction(
      {
        tenantId: input.tenantId,
        action: `${action}_blocked`,
        entityType: 'route_calculation',
        purpose: input.purpose,
        providerKey: provider.providerKey,
        blockedReason: guard.message,
        metadata: { assignmentId: input.assignmentId },
      },
      actorRoleKey,
    );
    return { ok: false, error: guard.message };
  }

  const now = new Date().toISOString();
  const calc: RouteCalculation = {
    id: `route-${Date.now()}`,
    tenantId: input.tenantId,
    createdAt: now,
    updatedAt: now,
    assignmentId: input.assignmentId,
    originAddress: input.originAddress,
    destinationAddress: input.destinationAddress,
    providerKey: provider.providerKey,
    distanceKm: null,
    durationMinutes: null,
    polyline: null,
    purpose: input.purpose,
    calculatedAt: new Date().toISOString(),
    retentionUntil: buildRetentionUntil(),
  };

  recordLocationAuditEvent({
    tenantId: input.tenantId,
    action,
    entityType: 'route_calculation',
    entityId: calc.id,
    purpose: input.purpose,
    providerKey: provider.providerKey,
  });

  return { ok: true, data: calc };
}

/** Einsatzroute anzeigen — preparedOnly, externe Provider blockiert ohne Config. */
export async function showAssignmentRoute(
  input: RouteRequestInput,
  provider: GeoProviderContext,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<RouteCalculation>> {
  return guardedRouteAction(
    { ...input, purpose: 'assignment_route' },
    provider,
    actorRoleKey,
    'show_assignment_route',
  );
}

/** Fahrzeit berechnen — preparedOnly. */
export async function calculateTravelTime(
  input: RouteRequestInput,
  provider: GeoProviderContext,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<RouteCalculation>> {
  return guardedRouteAction(
    { ...input, purpose: 'travel_time' },
    provider,
    actorRoleKey,
    'calculate_travel_time',
  );
}

/** Kilometer berechnen — preparedOnly. */
export async function calculateKilometers(
  input: RouteRequestInput,
  provider: GeoProviderContext,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<RouteCalculation>> {
  return guardedRouteAction(
    { ...input, purpose: 'distance_calculation' },
    provider,
    actorRoleKey,
    'calculate_kilometers',
  );
}

export type TravelMetrics = {
  distanceKm: number | null;
  durationMinutes: number | null;
};

export function extractTravelMetrics(route: RouteCalculation): TravelMetrics {
  return {
    distanceKm: route.distanceKm,
    durationMinutes: route.durationMinutes,
  };
}
