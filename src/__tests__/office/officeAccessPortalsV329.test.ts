import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createEmployeePortalAccount, createInternalUser } from '@/lib/auth/accessManagementService';
import { setupClientPortalAccess } from '@/lib/clients/clientPortalAccessService';
import { setupRelativePortalAccess } from '@/lib/access/relativePortalAccessService';

const read = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('Office Zugänge und Portale V32.9', () => {
  it('blockiert schreibende Zugriffsaktionen ohne Office-Berechtigung', async () => {
    const deniedRole = 'employee_portal' as const;
    const results = await Promise.all([
      createInternalUser({
        tenantId: 'tenant-test',
        companyName: 'Test',
        firstName: 'A',
        lastName: 'B',
        email: 'a@example.test',
        roleKey: 'readonly',
        actorRoleKey: deniedRole,
      }),
      createEmployeePortalAccount({
        tenantId: 'tenant-test',
        companyName: 'Test',
        employeeId: 'employee-test',
        firstName: 'A',
        lastName: 'B',
        actorRoleKey: deniedRole,
      }),
      setupClientPortalAccess({
        tenantId: 'tenant-test',
        clientId: 'client-test',
        firstName: 'A',
        lastName: 'B',
        actorRoleKey: deniedRole,
      }),
      setupRelativePortalAccess({
        tenantId: 'tenant-test',
        clientId: 'client-test',
        relativeContactId: 'contact-test',
        actorRoleKey: deniedRole,
      }),
    ]);

    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/Berechtigung|Zugriff/i);
    }
  });

  it('zeigt Mitarbeitende lesbar statt als rohe UUID', () => {
    const repository = read('src/lib/access/accessManagementLiveRepository.ts');
    const list = read('src/screens/office/access/EmployeePortalAccountsScreen.tsx');
    const detail = read('src/screens/office/access/EmployeePortalAccountDetailScreen.tsx');

    expect(repository).toContain(".select('id, first_name, last_name, employee_number')");
    expect(list).toContain('item.employeeName ?? item.username');
    expect(detail).toContain("account.employeeName ?? 'Nicht aufgelöst'");
    expect(detail).not.toContain('Mitarbeiter-ID:');
  });

  it('behandelt Sperren, Entsperren und Passwort-Reset sichtbar', () => {
    const detail = read('src/screens/office/access/EmployeePortalAccountDetailScreen.tsx');
    expect(detail).toContain('setActionError(result.error)');
    expect(detail).toContain('await query.refresh()');
    expect(detail).toContain('loading={actionLoading}');
    expect(detail).toContain('ACCESS_STATUS_LABELS[account.status]');
  });

  it('verwendet typsichere Einzelauswahl in Portalfiltern', () => {
    const clientPortal = read('src/screens/office/access/ClientPortalCodesScreen.tsx');
    const relativePortal = read('src/screens/office/access/RelativePortalCodesScreen.tsx');
    expect(clientPortal).toContain("Array.isArray(key) ? key[0] ?? '' : key");
    expect(relativePortal.match(/Array\.isArray\(key\) \? key\[0\] \?\? '' : key/g)).toHaveLength(2);
  });

  it('entfernt die funktionslose Demo-Vorschau für Modulrechte', () => {
    const modulePermissions = read('src/screens/office/access/UserModulePermissionsScreen.tsx');
    const permissions = read('src/screens/business/office/OfficePermissionsScreen.tsx');
    expect(modulePermissions).toContain('OfficePermissionsScreen');
    expect(modulePermissions).not.toContain('Demo-Vorschau');
    expect(permissions).toContain("fetchModuleAssignmentList(tenantId, 'permissions'");
    expect(permissions).not.toContain('title="Modulrechte pro Benutzer"');
  });
});
