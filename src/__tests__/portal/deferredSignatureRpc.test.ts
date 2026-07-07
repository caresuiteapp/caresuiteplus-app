import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function readMigration(name: string): string {
  return readFileSync(
    path.join(__dirname, '..', '..', '..', 'supabase', 'migrations', name),
    'utf8',
  );
}

describe('employee portal deferred signature RPC migration', () => {
  it('0242 defines SECURITY DEFINER upsert RPC', () => {
    const sql = readMigration('0242_employee_portal_deferred_signature_rpc.sql');
    expect(sql).toContain('employee_portal_upsert_deferred_signature_client_document');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('pending_client_signature');
    expect(sql).toContain('GRANT EXECUTE');
  });
});

describe('deferred signature service uses RPC', () => {
  it('calls employee_portal_upsert_deferred_signature_client_document', () => {
    const service = readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        '..',
        'src/lib/portal/deferredVisitClientSignatureService.ts',
      ),
      'utf8',
    );
    expect(service).toContain('employee_portal_upsert_deferred_signature_client_document');
    expect(service).not.toContain("fromUnknownTable(supabase, 'client_documents').insert");
  });
});
