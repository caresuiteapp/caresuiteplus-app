import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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

  it('leitet die Einsatzfähigkeit aus dem vorhandenen Portalkonto ab', () => {
    const mapper = readSource('src/lib/office/employeePersonnelFileMapper.ts');
    expect(mapper).toContain('portalActive: portalAccount');
    expect(mapper).toContain("portalAccount.status !== 'blocked' && portalAccount.status !== 'archived'");
  });
});
