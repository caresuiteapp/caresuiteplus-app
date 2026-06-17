import { describe, expect, it } from 'vitest';
import { enforcePermission } from '@/lib/permissions/enforce';
import {
  isRemoteClientDeleted,
  REMOTE_CLIENT_DELETED_STATUS,
  remoteStatusToWorkflow,
} from '@/lib/services/clients/clientStatusBridge';
import {
  mapCatalogStatusToDbStatus,
  mapDbStatusToCatalogStatus,
} from '@/lib/office/employeeStatusMapping';

describe('office delete permissions', () => {
  it('allows business_admin to delete clients and employees', () => {
    expect(enforcePermission('business_admin', 'office.clients.delete')).toBeNull();
    expect(enforcePermission('business_admin', 'office.employees.delete')).toBeNull();
  });

  it('denies caregiver delete permissions', () => {
    expect(enforcePermission('caregiver', 'office.clients.delete')).toEqual({
      ok: false,
      error: expect.stringContaining('Löschen'),
    });
    expect(enforcePermission('caregiver', 'office.employees.delete')).toEqual({
      ok: false,
      error: expect.stringContaining('Löschen'),
    });
  });
});

describe('office soft delete mapping', () => {
  it('maps remote client deleted status and detects soft delete', () => {
    expect(REMOTE_CLIENT_DELETED_STATUS).toBe('deleted');
    expect(isRemoteClientDeleted('deleted')).toBe(true);
    expect(remoteStatusToWorkflow('deleted')).toBe('archiviert');
  });

  it('maps employee deleted status for live Supabase enum', () => {
    expect(mapCatalogStatusToDbStatus('geloescht')).toBe('deleted');
    expect(mapDbStatusToCatalogStatus('deleted')).toBe('geloescht');
  });
});
