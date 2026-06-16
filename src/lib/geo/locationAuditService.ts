import type { RoleKey, ServiceResult } from '@/types';
import type {
  GeoProviderKey,
  LocationAuditEvent,
  LocationPurpose,
} from '@/types/geo';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { computeRetentionUntil, DEFAULT_LOCATION_RETENTION_DAYS } from '@/lib/geo/geoModuleConfig';

const auditBuffer: LocationAuditEvent[] = [];

export type LocationAuditInput = {
  tenantId: string;
  actorProfileId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  purpose: LocationPurpose;
  providerKey?: GeoProviderKey | null;
  blockedReason?: string | null;
  metadata?: Record<string, unknown>;
};

export function peekLocationAuditEvents(tenantId: string): LocationAuditEvent[] {
  return auditBuffer.filter((e) => e.tenantId === tenantId);
}

export function clearLocationAuditBuffer(): void {
  auditBuffer.length = 0;
}

/** Erstellt auditierbaren Eintrag — auch bei blockierten Aktionen. */
export function recordLocationAuditEvent(input: LocationAuditInput): ServiceResult<LocationAuditEvent> {
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const now = new Date().toISOString();
  const event: LocationAuditEvent = {
    id: `loc-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId: input.tenantId,
    createdAt: now,
    updatedAt: now,
    actorProfileId: input.actorProfileId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    purpose: input.purpose,
    providerKey: input.providerKey ?? null,
    blockedReason: input.blockedReason ?? null,
    metadata: input.metadata ?? {},
  };

  auditBuffer.push(event);
  return { ok: true, data: event };
}

export function auditBlockedGeoAction(
  input: LocationAuditInput & { blockedReason: string },
  actorRoleKey?: RoleKey | null,
): ServiceResult<LocationAuditEvent> {
  return recordLocationAuditEvent({
    ...input,
    metadata: {
      ...input.metadata,
      actorRoleKey: actorRoleKey ?? null,
    },
  });
}

export function buildRetentionUntil(days = DEFAULT_LOCATION_RETENTION_DAYS): string {
  return computeRetentionUntil(days);
}
