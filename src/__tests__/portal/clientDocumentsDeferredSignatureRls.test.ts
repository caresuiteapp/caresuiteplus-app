import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function readMigration(name: string): string {
  return readFileSync(
    path.join(__dirname, '..', '..', '..', 'supabase', 'migrations', name),
    'utf8',
  );
}

describe('client_documents employee deferred signature RLS migration', () => {
  it('0241 adds employee portal INSERT/UPDATE policies for deferred signature', () => {
    const sql = readMigration('0241_client_documents_employee_deferred_signature_rls.sql');
    expect(sql).toContain('client_documents_portal_employee_deferred_signature_insert');
    expect(sql).toContain('client_documents_portal_employee_deferred_signature_update');
    expect(sql).toContain('assist_visit_proofs_portal_employee_update');
    expect(sql).toContain('pending_client_signature');
    expect(sql).toContain('is_employee_portal_rls_context');
    expect(sql).toContain('portal_employee_assigned_visit_ids');
  });
});
