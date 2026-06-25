import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  EMPLOYEE_TIME_TRACKING_MODE_OPTIONS,
  resolveEmployeeTimeTrackingModeWithOverride,
} from '@/lib/office/employeeHomeOfficeService';
import { enforceWithActorSync } from '@/lib/permissions/actorPermissions';
import { buildPermissionCatalogEntries } from '@/lib/permissions/permissionCatalogSeedData';
import { validateCriticalChangeReason } from '@/lib/permissions/permissionChangeHelpers';
import { buildPermissionMatrix } from '@/lib/permissions/permissionMatrixBuilder';
import {
  hasEffectivePermission,
  mergeEffectivePermissions,
  resetRbacDemoStore,
  resolveEffectivePermissionsSync,
  saveEmployeePermissionOverrides,
  setEmployeeRoleAssignments,
} from '@/lib/permissions/rbacService';
import { getPermissionsForRole } from '@/lib/permissions/staticRolePermissions';
import type { Profile } from '@/types';

const TENANT = DEMO_TENANT_ID;
const EMPLOYEE = 'emp-rbac-test-001';

describe('RBAC effective permissions (Rollen & Rechte)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetRbacDemoStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetRbacDemoStore();
  });

  it('1. caregiver erhält Assist-Einsatzrechte', () => {
    const effective = resolveEffectivePermissionsSync(TENANT, EMPLOYEE, 'caregiver');
    expect(hasEffectivePermission(effective, 'assist.execution.manage')).toBe(true);
    expect(hasEffectivePermission(effective, 'business.tenant.manage')).toBe(false);
  });

  it('2. business_admin hat Tenant-Verwaltung', () => {
    const effective = resolveEffectivePermissionsSync(TENANT, EMPLOYEE, 'business_admin');
    expect(hasEffectivePermission(effective, 'business.tenant.manage')).toBe(true);
  });

  it('3. Mehrfachrollen — Union von caregiver + dispatch', async () => {
    await setEmployeeRoleAssignments(TENANT, EMPLOYEE, ['caregiver', 'dispatch'], 'caregiver');
    const effective = resolveEffectivePermissionsSync(TENANT, EMPLOYEE, 'caregiver', ['dispatch']);
    expect(hasEffectivePermission(effective, 'assist.assignments.manage')).toBe(true);
    expect(hasEffectivePermission(effective, 'assist.execution.manage')).toBe(true);
  });

  it('4. Override grant ergänzt fehlendes Recht', () => {
    const overrides = [
      {
        id: 'o1',
        tenantId: TENANT,
        employeeId: EMPLOYEE,
        permissionKey: 'office.invoices.create' as const,
        allowed: true,
        reason: 'Vertretung Abrechnung',
        validFrom: null,
        validUntil: null,
        createdBy: null,
      },
    ];
    const effective = mergeEffectivePermissions(
      ['caregiver'],
      [],
      overrides,
      [],
      EMPLOYEE,
      TENANT,
      'caregiver',
    );
    expect(hasEffectivePermission(effective, 'office.invoices.create')).toBe(true);
    expect(effective.sources['office.invoices.create']).toBe('override_grant');
  });

  it('5. Override deny entzieht Rollenrecht', () => {
    const overrides = [
      {
        id: 'o2',
        tenantId: TENANT,
        employeeId: EMPLOYEE,
        permissionKey: 'assist.execution.manage' as const,
        allowed: false,
        reason: 'Sperre',
        validFrom: null,
        validUntil: null,
        createdBy: null,
      },
    ];
    const effective = mergeEffectivePermissions(
      ['caregiver'],
      [],
      overrides,
      [],
      EMPLOYEE,
      TENANT,
      'caregiver',
    );
    expect(hasEffectivePermission(effective, 'assist.execution.manage')).toBe(false);
    expect(effective.sources['assist.execution.manage']).toBe('override_deny');
  });

  it('6. Katalog enthält alle staticRolePermissions Keys', () => {
    const catalog = buildPermissionCatalogEntries();
    const staticKeys = getPermissionsForRole('business_admin');
    for (const key of staticKeys) {
      expect(catalog.some((e) => e.key === key)).toBe(true);
    }
  });

  it('7. Katalog — keine Roh-Keys als Label', () => {
    const catalog = buildPermissionCatalogEntries();
    const officeView = catalog.find((e) => e.key === 'office.clients.view');
    expect(officeView?.label).not.toBe('office.clients.view');
    expect(officeView?.label.length).toBeGreaterThan(3);
  });

  it('8. Preview-Matrix markiert Lesen für view-Rechte', () => {
    const perms = getPermissionsForRole('dispatch');
    const matrix = buildPermissionMatrix(perms, buildPermissionCatalogEntries());
    const clientsRow = matrix.find((r) => r.area === 'office.clients');
    expect(clientsRow?.read).toBe(true);
  });

  it('9. billing ohne Admin-Rechte auf Mandant', () => {
    const effective = resolveEffectivePermissionsSync(TENANT, EMPLOYEE, 'billing');
    expect(hasEffectivePermission(effective, 'office.invoices.create')).toBe(true);
    expect(hasEffectivePermission(effective, 'business.tenant.manage')).toBe(false);
  });

  it('10. Zeiterfassungsmodi — office Override', () => {
    const mode = resolveEmployeeTimeTrackingModeWithOverride('employee_portal', null, 'office');
    expect(mode).toBe('office');
    expect(EMPLOYEE_TIME_TRACKING_MODE_OPTIONS.some((o) => o.key === 'office')).toBe(true);
  });

  it('11. nurse hat Pflege-Zugriff aber kein Abrechnungs-Admin', () => {
    const effective = resolveEffectivePermissionsSync(TENANT, EMPLOYEE, 'nurse');
    expect(hasEffectivePermission(effective, 'pflege.plans.view')).toBe(true);
    expect(hasEffectivePermission(effective, 'business.modules.manage')).toBe(false);
  });

  it('12. employee_portal — Portal-Rechte ohne Office-Vollzugriff', () => {
    const effective = resolveEffectivePermissionsSync(TENANT, EMPLOYEE, 'employee_portal');
    expect(hasEffectivePermission(effective, 'portal.employee.profile.view')).toBe(true);
    expect(hasEffectivePermission(effective, 'office.clients.create')).toBe(false);
  });

  it('13. enforceWithActor blockiert ohne effektives Recht trotz Rolle', async () => {
    const profile: Profile = {
      id: 'profile-rbac-1',
      tenantId: TENANT,
      roleId: null,
      roleKey: 'caregiver',
      firstName: 'Test',
      lastName: 'User',
      displayName: 'Test User',
      email: 'test@example.com',
      phone: null,
      avatarUrl: null,
      employeeId: EMPLOYEE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveEmployeePermissionOverrides({
      tenantId: TENANT,
      employeeId: EMPLOYEE,
      overrides: [
        {
          id: 'deny-manage',
          tenantId: TENANT,
          employeeId: EMPLOYEE,
          permissionKey: 'assist.assignments.manage',
          allowed: false,
          reason: 'Test-Sperre',
          validFrom: null,
          validUntil: null,
          createdBy: null,
        },
      ],
    });

    const denied = enforceWithActorSync(
      'caregiver',
      TENANT,
      profile,
      'assist.assignments.manage',
    );
    expect(denied).not.toBeNull();
    expect(denied?.ok).toBe(false);
  });

  it('14. Kritische Änderung erfordert Begründung', () => {
    const catalog = buildPermissionCatalogEntries();
    const before = getPermissionsForRole('caregiver');
    const after = [...before, 'business.tenant.manage'];
    const missingReason = validateCriticalChangeReason(catalog, before, after, null);
    expect(missingReason).toBeTruthy();
    expect(missingReason).toContain('Begründung');
    expect(validateCriticalChangeReason(catalog, before, after, 'Vertretung')).toBeNull();
  });

  it('15. Override grant via saveEmployeePermissionOverrides', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    const result = await saveEmployeePermissionOverrides({
      tenantId: TENANT,
      employeeId: EMPLOYEE,
      overrides: [
        {
          id: 'grant-invoice',
          tenantId: TENANT,
          employeeId: EMPLOYEE,
          permissionKey: 'office.invoices.create',
          allowed: true,
          reason: 'Vertretung',
          validFrom: null,
          validUntil: null,
          createdBy: null,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const effective = resolveEffectivePermissionsSync(TENANT, EMPLOYEE, 'caregiver');
    expect(hasEffectivePermission(effective, 'office.invoices.create')).toBe(true);
  });
});
