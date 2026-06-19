import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isPortalUsernameLabel } from '@/lib/portal/clientPortalDisplayName';

const MIGRATION = path.join(
  process.cwd(),
  'supabase/migrations/0101_portal_rls_tenant_context.sql',
);

describe('Migration 0101 portal RLS tenant context', () => {
  const sql = readFileSync(MIGRATION, 'utf8');

  it('falls back to JWT app_metadata tenant_id', () => {
    expect(sql).toContain("auth.jwt()->'app_metadata'->>'tenant_id'");
  });

  it('backfills portal profiles from client_portal_access', () => {
    expect(sql).toContain('client_portal_access cpa');
    expect(sql).toContain('first_name = c.first_name');
    expect(sql).toContain('tenant_id = cpa.tenant_id');
  });
});

describe('portal profile name guard', () => {
  it('flags duplicated portal username full_name values', () => {
    expect(isPortalUsernameLabel('ellen.zacharias ellen.zacharias')).toBe(true);
    expect(isPortalUsernameLabel('Ellen Zacharias')).toBe(false);
  });
});
