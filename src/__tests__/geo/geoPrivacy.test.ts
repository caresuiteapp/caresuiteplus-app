import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { ROLE_PERMISSIONS } from '@/lib/permissions/staticRolePermissions';
import {
  assertExternalProviderAllowed,
  assertGeoRolePermission,
  assertGpsConsent,
  assertLiveTrackingWindow,
  assertGeofenceNotProof,
  assertClientPortalVisibility,
  validateAddress,
  prepareMileageLogEntry,
  stageMileageLogEntry,
  peekMileageLogEntries,
  markUnterwegsWithLocation,
  peekLocationAuditEvents,
  clearLocationAuditBuffer,
  clearMileageLogBuffer,
  canClientPortalViewLocationEvent,
  computeClientPortalVisibilityWindow,
  isWithinLiveTrackingWindow,
  listGeoProviderKeys,
  GEO_PROVIDER_REGISTRY,
} from '@/lib/geo';

const root = path.join(__dirname, '..', '..', '..');
const migrationPath = path.join(root, 'supabase/migrations/0046_geo_routes_prepared.sql');

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8');
}

const assignmentStart = '2026-06-16T10:00:00.000Z';

describe('0046_geo_routes_prepared migration', () => {
  const sql = readMigration();

  it('legt alle sieben Geo-Tabellen an', () => {
    for (const table of [
      'geo_provider_configs',
      'geocoded_addresses',
      'route_calculations',
      'assignment_location_events',
      'geofence_events',
      'mileage_log_entries',
      'location_audit_events',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }
  });

  it('aktiviert RLS und mandantenspezifische Policies', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('current_tenant_id()');
    expect(sql).toMatch(/geo_provider_configs[\s\S]*tenant_id/);
  });

  it('markiert Geofence ohne Validierung als keinen Beweis', () => {
    expect(sql).toContain('proof_eligible');
    expect(sql).toContain('validated');
  });

  it('enthält keine destruktiven Befehle', () => {
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });
});

describe('geo privacy guards', () => {
  beforeEach(() => {
    clearLocationAuditBuffer();
    clearMileageLogBuffer();
  });

  it('blockiert GPS ohne Einwilligung/Rolle', async () => {
    const noRole = assertGeoRolePermission(null, 'unterwegs_status', ROLE_PERMISSIONS.caregiver);
    expect(noRole.allowed).toBe(false);

    const noConsent = assertGpsConsent('unterwegs_status', { employeeConsentGranted: false });
    expect(noConsent.allowed).toBe(false);

    const result = await markUnterwegsWithLocation(
      {
        tenantId: DEMO_TENANT_ID,
        assignmentId: 'asg-001',
        assignmentStartAt: assignmentStart,
        consent: { employeeConsentGranted: false },
      },
      null,
    );
    expect(result.ok).toBe(false);
  });

  it('blockiert Live-Tracking außerhalb des Zeitfensters', () => {
    const inside = isWithinLiveTrackingWindow(
      assignmentStart,
      new Date('2026-06-16T09:45:00.000Z'),
    );
    expect(inside).toBe(true);

    const outside = isWithinLiveTrackingWindow(
      assignmentStart,
      new Date('2026-06-16T08:00:00.000Z'),
    );
    expect(outside).toBe(false);

    const guard = assertLiveTrackingWindow(
      { assignmentId: 'asg-001', assignmentStartAt: assignmentStart },
      new Date('2026-06-16T08:00:00.000Z'),
    );
    expect(guard.allowed).toBe(false);
  });

  it('blockiert Provider ohne Konfiguration/Freigabe', () => {
    const unconfigured = assertExternalProviderAllowed(
      {
        providerKey: 'google_maps',
        configured: false,
        externalDataAllowed: false,
        credentialReference: null,
      },
      'address_validation',
    );
    expect(unconfigured.allowed).toBe(false);
    if (!unconfigured.allowed) {
      expect(unconfigured.code).toBe('provider_not_configured');
    }

    const noApproval = assertExternalProviderAllowed(
      {
        providerKey: 'google_maps',
        configured: true,
        externalDataAllowed: false,
        credentialReference: 'vault:maps',
      },
      'address_validation',
    );
    expect(noApproval.allowed).toBe(false);
    if (!noApproval.allowed) {
      expect(noApproval.code).toBe('external_provider_blocked');
    }
  });

  it('speichert tenant_id im Fahrtenbuch-Entwurf', () => {
    const draft = prepareMileageLogEntry(
      {
        tenantId: DEMO_TENANT_ID,
        startAddress: 'Start',
        endAddress: 'Ziel',
        distanceKm: 12.4,
      },
      'caregiver',
    );
    expect(draft.ok).toBe(true);
    if (draft.ok) {
      expect(draft.data.tenantId).toBe(DEMO_TENANT_ID);
      const entry = stageMileageLogEntry(draft.data);
      expect(entry.tenantId).toBe(DEMO_TENANT_ID);
      expect(peekMileageLogEntries(DEMO_TENANT_ID)).toHaveLength(1);
    }
  });

  it('erzeugt Audit bei blockierter Adressvalidierung', async () => {
    await validateAddress(
      {
        tenantId: DEMO_TENANT_ID,
        rawAddress: 'Musterstraße 1',
        purpose: 'address_validation',
      },
      {
        providerKey: 'google_maps',
        configured: false,
        externalDataAllowed: false,
        credentialReference: null,
      },
      'caregiver',
    );
    const audits = peekLocationAuditEvents(DEMO_TENANT_ID);
    expect(audits.some((a) => a.action === 'validate_address_blocked')).toBe(true);
  });

  it('Klientenportal sieht nur freigegebenes Zeitfenster', () => {
    const window = computeClientPortalVisibilityWindow(
      assignmentStart,
      '2026-06-16T11:00:00.000Z',
    );
    const during = assertClientPortalVisibility(window, new Date('2026-06-16T10:30:00.000Z'));
    expect(during.allowed).toBe(true);

    const before = assertClientPortalVisibility(window, new Date('2026-06-16T08:00:00.000Z'));
    expect(before.allowed).toBe(false);

    const event = {
      clientPortalVisibleFrom: window.visibleFrom,
      clientPortalVisibleUntil: window.visibleUntil,
    } as Parameters<typeof canClientPortalViewLocationEvent>[0];
    expect(canClientPortalViewLocationEvent(event, new Date('2026-06-16T10:30:00.000Z'))).toBe(true);
    expect(canClientPortalViewLocationEvent(event, new Date('2026-06-16T06:00:00.000Z'))).toBe(false);
  });

  it('externe Provider erhalten keine Daten ohne Freigabe', async () => {
    const result = await validateAddress(
      {
        tenantId: DEMO_TENANT_ID,
        rawAddress: 'Test 1',
        purpose: 'address_validation',
      },
      {
        providerKey: 'here_maps',
        configured: true,
        externalDataAllowed: false,
        credentialReference: 'vault:here',
      },
      'caregiver',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Freigabe');
    }
  });

  it('Geofencing nicht als Nachweis ohne Validierung', () => {
    const blocked = assertGeofenceNotProof({ validated: false, proofEligible: true });
    expect(blocked.allowed).toBe(false);
    const ok = assertGeofenceNotProof({ validated: true, proofEligible: true });
    expect(ok.allowed).toBe(true);
  });
});

describe('geo provider registry', () => {
  it('listet alle geforderten Provider', () => {
    const keys = listGeoProviderKeys();
    expect(keys).toEqual(
      expect.arrayContaining([
        'google_maps',
        'here_maps',
        'mapbox',
        'osm_nominatim',
        'tomtom',
        'generic_geocoder',
      ]),
    );
    expect(GEO_PROVIDER_REGISTRY.length).toBe(6);
  });
});
