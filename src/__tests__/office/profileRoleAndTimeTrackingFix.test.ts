import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { mapRoleKeyToDbRoleKey } from '@/lib/supabase/profileRoleBridge';
import { mapLegacyRoleKeyToRoleKey } from '@/lib/permissions/workspaceRoles';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('profileRoleBridge', () => {
  it('maps CS+ role keys to live roles.key values', () => {
    expect(mapRoleKeyToDbRoleKey('business_admin')).toBe('admin');
    expect(mapRoleKeyToDbRoleKey('dispatch')).toBe('planning');
    expect(mapRoleKeyToDbRoleKey('employee_portal')).toBe('employee');
    expect(mapLegacyRoleKeyToRoleKey('planning')).toBe('dispatch');
  });

  it('loads profile roles via role_id join instead of legacy role_key column', () => {
    const loader = readSrc('src/lib/office/employeePersonnelFileLiveLoader.ts');
    const updater = readSrc('src/lib/office/employeePersonnelUpdateService.ts');
    const bridge = readSrc('src/lib/supabase/profileRoleBridge.ts');

    expect(loader).not.toContain("select('role_key')");
    expect(loader).toContain('fetchProfileRoleKey');
    expect(updater).not.toContain('role_key: patch.roleKey');
    expect(updater).toContain('updateProfileRoleKey');
    expect(bridge).toContain("select('role_id, roles(key)')");
    expect(bridge).toContain("update({ role_id:");
    expect(bridge).toContain('.eq(\'tenant_id\', tenantId)');
  });
});

describe('TimeTrackingEmployeeScreen admin without employee profile', () => {
  it('shows Team-Übersicht guidance instead of hard error for admins', () => {
    const source = readSrc('src/components/timeTracking/TimeTrackingEmployeeScreen.tsx');
    expect(source).toContain('canUseTeamOverview');
    expect(source).toContain('isAdminWithoutEmployee');
    expect(source).toContain('time.tracking.team.view');
    expect(source).toContain('Team-Übersicht nutzen');
    expect(source).toContain('/business/office/time-tracking/zeitkonten');
    expect(source).toContain('Kein Mitarbeiterprofil');
  });
});

describe('EmployeeRolesPermissionsHub RBAC load', () => {
  it('surfaces RBAC load errors and hydrates from resolveEffectivePermissions', () => {
    const hub = readSrc('src/components/office/EmployeeRolesPermissionsHub.tsx');
    const rbac = readSrc('src/lib/permissions/rbacService.ts');

    expect(hub).toContain('rbacLoadError');
    expect(hub).toContain('resolveEffectivePermissions');
    expect(hub).toContain('if (!tenantId || !employeeId)');
    expect(rbac).toContain('persistEmployeeRbacState(tenantId, employeeId, { overrides');
    expect(rbac).toContain('persistEmployeeRbacState(tenantId, employeeId, { scopes');
    expect(rbac).toContain('shouldUseSyncRbacFallback');
    expect(rbac).toContain('isSupabaseSchemaMismatchError');
    expect(rbac).toContain('isValidRbacContext');
  });
});
