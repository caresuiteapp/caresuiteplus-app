import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  buildDefaultRoleMatrix,
  hasConnectAdminAccess,
  hasHealthDataAccess,
} from '@/lib/permissions/roleMatrixDefaults';
import {
  portalAreaWithoutTenant,
  validateRoleMatrixChange,
} from '@/lib/permissions/roleMatrixProtection';
import {
  copyRolePermissions,
  fetchPermissionAuditHistory,
  fetchRoleMatrixOverview,
  previewRoleMatrixChange,
  restoreRoleDefaults,
  saveRoleMatrix,
} from '@/lib/permissions/roleMatrixService';
import { resetRoleMatrixStore, getTenantRoleMatrix } from '@/lib/permissions/roleMatrixStore';

const TENANT = DEMO_TENANT_ID;
const OTHER_TENANT = '00000000-0000-4000-8000-000000000099';

describe('Rollenmatrix (Prompt 68)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetRoleMatrixStore(TENANT);
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetRoleMatrixStore();
  });

  it('1. liefert 20 Systemrollen mit konservativen Defaults', async () => {
    const result = await fetchRoleMatrixOverview(TENANT, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(20);
    const caregiver = result.data.find((r) => r.roleKey === 'caregiver');
    expect(caregiver?.areaPermissions.billing.view).toBe(false);
  });

  it('2. verweigert Gesundheitsdaten ohne explizite Bestätigung', () => {
    const base = buildDefaultRoleMatrix('caregiver');
    const next = structuredClone(base);
    next.clients.edit = true;
    next.clients.approve = true;

    const validation = validateRoleMatrixChange(
      {
        tenantId: TENANT,
        roleKey: 'caregiver',
        areaPermissions: next,
      },
      { caregiver: base } as never,
      'admin',
    );
    expect(validation.ok).toBe(false);
    expect(validation.requiresHealthDataConfirm).toBe(true);
  });

  it('3. blockiert Abrechnungsrechte für Mitarbeitende ohne Bestätigung', () => {
    const base = buildDefaultRoleMatrix('employee');
    const next = structuredClone(base);
    next.billing.administer = true;

    const validation = validateRoleMatrixChange(
      {
        tenantId: TENANT,
        roleKey: 'employee',
        areaPermissions: next,
      },
      { employee: base } as never,
      'admin',
    );
    expect(validation.ok).toBe(false);
    expect(validation.requiresBillingConfirm).toBe(true);
  });

  it('4. verhindert Admin-Rechte für Klient:innenrollen', () => {
    const base = buildDefaultRoleMatrix('client');
    const next = structuredClone(base);
    next.administration.administer = true;

    const validation = validateRoleMatrixChange(
      {
        tenantId: TENANT,
        roleKey: 'client',
        areaPermissions: next,
      },
      { client: base } as never,
      'admin',
    );
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes('Verwaltungsrechte'))).toBe(true);
  });

  it('5. schützt Owner vor vollständigem Rechteverlust', () => {
    const base = buildDefaultRoleMatrix('owner');
    const next = structuredClone(base);
    next.administration.administer = false;
    next.administration.approve = false;

    const validation = validateRoleMatrixChange(
      {
        tenantId: TENANT,
        roleKey: 'owner',
        areaPermissions: next,
      },
      { owner: base, admin: buildDefaultRoleMatrix('admin') } as never,
      'admin',
    );
    expect(validation.ok).toBe(false);
  });

  it('6. erlaubt Connect-Admin nur Owner/Admin/Developer', () => {
    const base = buildDefaultRoleMatrix('office');
    const next = structuredClone(base);
    next.connect.administer = true;

    const validation = validateRoleMatrixChange(
      {
        tenantId: TENANT,
        roleKey: 'office',
        areaPermissions: next,
      },
      { office: base } as never,
      'admin',
    );
    expect(validation.ok).toBe(false);
    expect(hasConnectAdminAccess(next)).toBe(true);
  });

  it('7. normaler Admin darf developer_admin nicht ändern', () => {
    const base = buildDefaultRoleMatrix('developer_admin');
    const next = structuredClone(base);
    next.administration.administer = false;

    const validation = validateRoleMatrixChange(
      {
        tenantId: TENANT,
        roleKey: 'developer_admin',
        areaPermissions: next,
        actorRoleKey: 'admin',
      },
      { developer_admin: base } as never,
      'admin',
    );
    expect(validation.ok).toBe(false);
  });

  it('8. speichert Matrix-Änderungen mit Audit-Trail', async () => {
    const base = buildDefaultRoleMatrix('billing');
    const next = structuredClone(base);
    next.clients.edit = true;

    const saved = await saveRoleMatrix(
      {
        tenantId: TENANT,
        roleKey: 'billing',
        areaPermissions: next,
        actorUserId: 'admin-1',
        actorRoleKey: 'admin',
        confirmHealthData: true,
      },
      'business_admin',
    );
    expect(saved.ok).toBe(true);

    const audit = await fetchPermissionAuditHistory(TENANT, 'business_admin');
    expect(audit.ok).toBe(true);
    if (audit.ok) {
      expect(audit.data.length).toBeGreaterThan(0);
    }
  });

  it('9. stellt Standardrechte wieder her', async () => {
    const base = buildDefaultRoleMatrix('dispatch');
    const next = structuredClone(base);
    next.billing.administer = true;

    await saveRoleMatrix(
      {
        tenantId: TENANT,
        roleKey: 'dispatch',
        areaPermissions: next,
        actorUserId: 'admin-1',
        actorRoleKey: 'admin',
        confirmBillingOverride: true,
      },
      'business_admin',
    );

    const restored = await restoreRoleDefaults(TENANT, 'dispatch', 'admin-1', 'business_admin');
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.data.areaPermissions.billing.administer).toBe(false);
    }
  });

  it('10. kopiert Rechte zwischen Rollen', async () => {
    const copied = await copyRolePermissions(TENANT, 'owner', 'management', 'admin-1', 'business_admin');
    expect(copied.ok).toBe(true);
    if (copied.ok) {
      expect(hasHealthDataAccess(copied.data.areaPermissions)).toBe(
        hasHealthDataAccess(buildDefaultRoleMatrix('owner')),
      );
    }
  });

  it('11. verhindert Cross-Tenant-Zugriff über Portal-Kontext', () => {
    const matrix = buildDefaultRoleMatrix('employee');
    matrix.employee_portal.view = true;
    expect(portalAreaWithoutTenant(matrix, null)).toContain('Mandantenkontext');
    expect(portalAreaWithoutTenant(matrix, TENANT)).toBeNull();
  });

  it('12. zeigt Auswirkungsvorschau vor dem Speichern', () => {
    const current = buildDefaultRoleMatrix('caregiver');
    const next = structuredClone(current);
    next.clients.edit = true;
    next.clients.approve = true;
    const preview = previewRoleMatrixChange(TENANT, 'caregiver', next);
    expect(preview.grantedAreas).toContain('clients');
    expect(preview.requiresHealthDataConfirm).toBe(true);
  });
});

describe('Rollenmatrix Mandantenisolation', () => {
  beforeEach(() => {
    resetRoleMatrixStore(TENANT);
    resetRoleMatrixStore(OTHER_TENANT);
  });

  afterEach(() => {
    resetRoleMatrixStore();
  });

  it('isolates tenant stores', async () => {
    const next = buildDefaultRoleMatrix('office');
    next.qm_cockpit.administer = true;
    await saveRoleMatrix(
      {
        tenantId: TENANT,
        roleKey: 'office',
        areaPermissions: next,
        actorRoleKey: 'admin',
      },
      'business_admin',
    );

    const tenantOffice = getTenantRoleMatrix(TENANT, 'office');
    const otherOffice = getTenantRoleMatrix(OTHER_TENANT, 'office');
    expect(tenantOffice.qm_cockpit.administer).toBe(true);
    expect(otherOffice.qm_cockpit.administer).toBe(false);
  });
});
