import type { RoleKey, ServiceResult } from '@/types';
import type {
  GeocodedAddress,
  GeoProviderContext,
  ValidateAddressInput,
} from '@/types/geo';
import { ROLE_PERMISSIONS } from '@/data/demo/permissions';
import {
  assertExternalProviderAllowed,
  assertGeoExecutionReady,
  assertGeoRolePermission,
  assertLocationPurpose,
  runGeoGuardChain,
} from '@/lib/geo/geoGuard';
import { resolveDefaultProviderForPurpose } from '@/lib/geo/geoProviderRegistry';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { auditBlockedGeoAction, buildRetentionUntil, recordLocationAuditEvent } from '@/lib/geo/locationAuditService';

function hashAddressInput(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Adressvalidierung — blockiert ohne Provider-Konfiguration und Live-Flip. */
export async function validateAddress(
  input: ValidateAddressInput,
  provider: GeoProviderContext,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<GeocodedAddress>> {
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
        action: 'validate_address_blocked',
        entityType: 'geocoded_address',
        purpose: input.purpose,
        providerKey: provider.providerKey,
        blockedReason: guard.message,
        metadata: { rawAddress: input.rawAddress },
      },
      actorRoleKey,
    );
    return { ok: false, error: guard.message };
  }

  const now = new Date().toISOString();
  const result: GeocodedAddress = {
    id: `geo-addr-${Date.now()}`,
    tenantId: input.tenantId,
    createdAt: now,
    updatedAt: now,
    inputHash: hashAddressInput(input.rawAddress),
    rawInput: input.rawAddress,
    formattedAddress: input.rawAddress.trim(),
    latitude: null,
    longitude: null,
    providerKey: provider.providerKey,
    confidence: 'unknown',
    validated: false,
    purpose: input.purpose,
    retentionUntil: buildRetentionUntil(),
  };

  recordLocationAuditEvent({
    tenantId: input.tenantId,
    action: 'validate_address',
    entityType: 'geocoded_address',
    entityId: result.id,
    purpose: input.purpose,
    providerKey: provider.providerKey,
  });

  return { ok: true, data: result };
}

export function resolveProviderForValidation(
  purpose: ValidateAddressInput['purpose'],
  configuredProviders: GeoProviderContext[],
): GeoProviderContext | null {
  const defaultKey = resolveDefaultProviderForPurpose(purpose);
  if (!defaultKey) return null;
  return configuredProviders.find((p) => p.providerKey === defaultKey) ?? null;
}
