import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const MIGRATION = path.join(
  process.cwd(),
  'supabase/migrations/0098_portal_client_name_rls.sql',
);

describe('Migration 0098 portal client name RLS', () => {
  const sql = readFileSync(MIGRATION, 'utf8');

  it('allows portal actors to read their own client row', () => {
    expect(sql).toContain('clients_select_portal_self');
    expect(sql).toContain('id = public.current_client_id()');
  });
});
