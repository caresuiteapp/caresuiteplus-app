import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'supabase',
  'migrations',
  '0096_broadcast_rls_live_roles.sql',
);

describe('broadcast RLS (migration 0096)', () => {
  const migration = readFileSync(migrationPath, 'utf8');

  it('behebt has_permission Profil-Lookup für Legacy- und Portal-Profile', () => {
    expect(migration).toContain('pr.id = auth.uid() OR pr.auth_user_id = auth.uid()');
    expect(migration).toContain('p.id = auth.uid() OR p.auth_user_id = auth.uid()');
  });

  it('erlaubt Tenant-Admins Broadcasts über has_permission-Fallback', () => {
    expect(migration).toContain("p_permission_key = 'messages.broadcast.create'");
    expect(migration).toContain('public.is_tenant_admin()');
  });

  it('seedet messages.broadcast.create für Live- und Canonical-Rollen', () => {
    expect(migration).toContain("'messages.broadcast.create'");
    for (const roleKey of [
      'owner',
      'admin',
      'management',
      'office',
      'planning',
      'business_admin',
      'business_manager',
      'dispatch',
    ]) {
      expect(migration).toContain(`'${roleKey}'`);
    }
  });

  it('backfillt fehlende profiles.auth_user_id für Legacy-Accounts', () => {
    expect(migration).toContain('SET auth_user_id = id');
    expect(migration).toContain('WHERE auth_user_id IS NULL');
  });
});
