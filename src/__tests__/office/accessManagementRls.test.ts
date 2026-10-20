import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const srcRoot = path.join(__dirname, '..', '..');

describe('access management RLS (migration 0100)', () => {
  it('ermöglicht SELECT auf Portal-Basistabellen für security_invoker mgmt-Views', () => {
    const migration = readFileSync(
      path.join(srcRoot, '..', 'supabase', 'migrations', '0100_access_management_rls_live.sql'),
      'utf8',
    );

    expect(migration).toContain('employee_portal_accounts_select');
    expect(migration).toContain("has_permission('office.access')");
    expect(migration).toContain('GRANT SELECT (');
    expect(migration).toContain('employee_portal_accounts TO authenticated');
    expect(migration).toContain('relative_portal_codes_select');
    expect(migration).toContain('client_portal_codes_select');
    expect(migration).not.toMatch(
      /GRANT SELECT \([\s\S]*?\) ON public\.employee_portal_accounts[\s\S]*temporary_password_hash/,
    );
  });

  it('seedet office.access für Live-Rollen owner/admin', () => {
    const migration = readFileSync(
      path.join(srcRoot, '..', 'supabase', 'migrations', '0100_access_management_rls_live.sql'),
      'utf8',
    );

    expect(migration).toContain("'office.access'");
    expect(migration).toContain("'owner'");
    expect(migration).toContain("'admin'");
    expect(migration).toContain('tenant_users_select');
    expect(migration).toContain('login_audit_events_select');
  });

  it('accessManagementLiveRepository nutzt mgmt-Views und tenant_users', () => {
    const repo = readFileSync(
      path.join(srcRoot, 'lib', 'access', 'accessManagementLiveRepository.ts'),
      'utf8',
    );

    expect(repo).toContain('employee_portal_accounts_mgmt');
    expect(repo).toContain('relative_portal_codes_mgmt');
    expect(repo).toContain('tenant_users');
    expect(repo).toContain('login_audit_events');
  });
});
