import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildEmployeePersonnelFileFromLiveRows } from '@/lib/office/employeePersonnelFileMapper';

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Mitarbeitenden-Portal Zugangsdatenvertrag', () => {
  it('prüft das Passwort exakt und verändert keine Zeichen vor dem Hashvergleich', () => {
    const login = readSource('supabase/functions/employee-portal-login/index.ts');
    expect(login).toContain("const password = typeof body.password === 'string' ? body.password : '';");
    expect(login).not.toContain('normalizePortalPassword');
    expect(login).not.toMatch(/body\.password[^\n]*\.trim\(/);
  });

  it('zeigt den echten Kontostatus statt eines veralteten Portal-Flags', () => {
    const panel = readSource('src/components/office/EmployeePortalAccessPanel.tsx');
    expect(panel).toContain("account.status === 'password_reset_required'");
    expect(panel).toContain("account.status === 'pending_first_login' || !account.firstLoginCompleted");
    expect(panel).toContain("account.status === 'active' && account.firstLoginCompleted");
  });

  it.each([
    ['active', false, true],
    ['pending_first_login', false, true],
    ['password_reset_required', false, true],
    ['blocked', true, false],
    ['archived', true, false],
  ])('uses the %s account status ahead of the legacy portal_enabled=%s flag', (status, legacy, expected) => {
    const file = buildEmployeePersonnelFileFromLiveRows({
      employee: {
        id: 'employee', tenant_id: 'tenant', first_name: 'Test', last_name: 'Person',
        status: 'active', portal_enabled: legacy, created_at: '2026-01-01', updated_at: '2026-01-01',
      },
      portalAccount: { status },
    });
    expect(file.portalAccess.portalActive).toBe(expected);
  });

  it.each([true, false])('uses the legacy portal flag %s only when no account exists', (legacy) => {
    const file = buildEmployeePersonnelFileFromLiveRows({
      employee: {
        id: 'employee', tenant_id: 'tenant', first_name: 'Test', last_name: 'Person',
        status: 'active', portal_enabled: legacy, created_at: '2026-01-01', updated_at: '2026-01-01',
      },
    });
    expect(file.portalAccess.portalActive).toBe(legacy);
  });
});
