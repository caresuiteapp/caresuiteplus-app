import { describe, expect, it } from 'vitest';
import { hasPermission } from '@/lib/permissions';
import {
  canAccessKIM,
  canManageConsent,
  canManageProviders,
  canViewAudit,
  hasTIPermission,
} from '@/lib/ti/tiPermissionService';

describe('TI Permissions', () => {
  it('business_admin hat ti.view', () => {
    expect(hasPermission('business_admin', 'ti.view')).toBe(true);
  });

  it('business_admin hat ti.kim.view', () => {
    expect(hasPermission('business_admin', 'ti.kim.view')).toBe(true);
  });

  it('caregiver hat kein ti.admin', () => {
    expect(hasPermission('caregiver', 'ti.admin')).toBe(false);
  });

  it('hasTIPermission mappt korrekt', () => {
    expect(hasTIPermission('business_admin', 'ti.kim.manage')).toBe(true);
    expect(hasTIPermission('caregiver', 'ti.kim.manage')).toBe(false);
  });

  it('canAccessKIM für business_manager', () => {
    expect(canAccessKIM('business_manager')).toBe(true);
  });

  it('canManageProviders für nurse verweigert', () => {
    expect(canManageProviders('nurse')).toBe(false);
  });

  it('canViewAudit für business_admin', () => {
    expect(canViewAudit('business_admin')).toBe(true);
  });

  it('canManageConsent für billing verweigert', () => {
    expect(canManageConsent('billing')).toBe(false);
  });
});
