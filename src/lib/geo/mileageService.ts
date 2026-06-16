import type { RoleKey, ServiceResult } from '@/types';
import type { MileageLogEntry, PreparedMileageLogDraft, RouteCalculation } from '@/types/geo';
import { ROLE_PERMISSIONS } from '@/data/demo/permissions';
import { assertGeoRolePermission, assertLocationPurpose, runGeoGuardChain } from '@/lib/geo/geoGuard';
import { buildRetentionUntil, recordLocationAuditEvent } from '@/lib/geo/locationAuditService';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

const mileageBuffer: MileageLogEntry[] = [];

export function peekMileageLogEntries(tenantId: string): MileageLogEntry[] {
  return mileageBuffer.filter((e) => e.tenantId === tenantId);
}

export function clearMileageLogBuffer(): void {
  mileageBuffer.length = 0;
}

export type PrepareMileageInput = {
  tenantId: string;
  tripId?: string | null;
  assignmentId?: string | null;
  employeeProfileId?: string | null;
  startAddress?: string | null;
  endAddress?: string | null;
  distanceKm?: number | null;
  route?: RouteCalculation | null;
};

/**
 * Fahrtenbuch-Eintrag vorbereiten — speichert tenant_id, persistiert erst nach Live-Flip.
 * Erlaubt im preparedOnly-Modus als Entwurf ohne GPS-Dauererfassung.
 */
export function prepareMileageLogEntry(
  input: PrepareMileageInput,
  actorRoleKey?: RoleKey | null,
): ServiceResult<PreparedMileageLogDraft> {
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const rolePerms = ROLE_PERMISSIONS[actorRoleKey ?? 'caregiver'] ?? [];
  const guard = runGeoGuardChain([
    assertLocationPurpose('mileage_log'),
    assertGeoRolePermission(actorRoleKey, 'mileage_log', rolePerms),
  ]);

  if (!guard.allowed) {
    return { ok: false, error: guard.message };
  }

  const distanceKm = input.distanceKm ?? input.route?.distanceKm ?? null;
  const now = new Date().toISOString();
  const draft: PreparedMileageLogDraft = {
    draftId: `mileage-draft-${Date.now()}`,
    tenantId: input.tenantId,
    updatedAt: now,
    tripId: input.tripId ?? null,
    assignmentId: input.assignmentId ?? null,
    employeeProfileId: input.employeeProfileId ?? null,
    startAddress: input.startAddress ?? input.route?.originAddress ?? null,
    endAddress: input.endAddress ?? input.route?.destinationAddress ?? null,
    distanceKm,
    purpose: 'mileage_log',
    source: input.route ? 'route_calculation' : 'manual',
    status: 'prepared',
    recordedAt: new Date().toISOString(),
    retentionUntil: buildRetentionUntil(),
  };

  recordLocationAuditEvent({
    tenantId: input.tenantId,
    action: 'prepare_mileage_log_entry',
    entityType: 'mileage_log_entry',
    entityId: draft.draftId,
    purpose: 'mileage_log',
  });

  return { ok: true, data: draft };
}

/** Entwurf in internen Puffer übernehmen (Demo/Prep — kein Supabase-Write). */
export function stageMileageLogEntry(draft: PreparedMileageLogDraft): MileageLogEntry {
  const now = new Date().toISOString();
  const entry: MileageLogEntry = {
    id: draft.draftId,
    tenantId: draft.tenantId,
    createdAt: now,
    updatedAt: now,
    tripId: draft.tripId,
    assignmentId: draft.assignmentId,
    employeeProfileId: draft.employeeProfileId,
    startAddress: draft.startAddress,
    endAddress: draft.endAddress,
    distanceKm: draft.distanceKm,
    purpose: draft.purpose,
    source: draft.source,
    status: draft.status,
    recordedAt: draft.recordedAt,
    retentionUntil: draft.retentionUntil,
  };
  mileageBuffer.push(entry);
  return entry;
}
