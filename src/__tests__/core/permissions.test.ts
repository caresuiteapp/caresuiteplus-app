import { describe, expect, it } from 'vitest';
import { hasPermission, checkPermission } from '@/lib/permissions';
import { getPermissionsForRole } from '@/lib/permissions/staticRolePermissions';

describe('Permissions', () => {
  it('business_admin hat Reporting-Rechte', () => {
    expect(hasPermission('business_admin', 'business.reporting.view')).toBe(true);
    expect(hasPermission('business_admin', 'business.reporting.create')).toBe(true);
  });

  it('client_portal hat kein Office-Zugriff', () => {
    expect(hasPermission('client_portal', 'office.clients.create')).toBe(false);
    const decision = checkPermission('client_portal', 'office.clients.create');
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBeTruthy();
  });

  it('jede Rolle hat definierte Berechtigungen', () => {
    const roles = ['business_admin', 'nurse', 'client_portal', 'employee_portal'] as const;
    for (const role of roles) {
      expect(getPermissionsForRole(role).length).toBeGreaterThan(0);
    }
  });
});
