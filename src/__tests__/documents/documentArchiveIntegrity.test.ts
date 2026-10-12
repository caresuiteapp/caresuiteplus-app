import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeneratedDocumentRecord } from '@/types/documents/documentEngine';
const f = vi.hoisted(() => ({ rows: new Map<string, Record<string, unknown>>(), inserts: [] as Record<string, unknown>[],
  actor: vi.fn(), readError: null as unknown, insertError: null as { code?: string; message: string } | null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/auth/resolveAuthenticatedProfile', () => ({ resolveAuthenticatedProfileId: f.actor }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => {
  let id = ''; let payload: Record<string, unknown> | null = null;
  const query = { select: () => query, eq: (key: string, value: string) => { if (key === 'id') id = value; return query; },
    maybeSingle: async () => ({ data: f.rows.get(id) ?? null, error: f.readError }),
    insert: (value: Record<string, unknown>) => { payload = value; return query; },
    single: async () => { if (f.insertError) return { data: null, error: f.insertError };
      f.inserts.push(payload!); f.rows.set(String(payload!.id), payload!); return { data: payload, error: null }; } };
  return query;
} }));
import { archiveGeneratedDocumentToClientRecord, archiveGeneratedDocumentToEmployeeRecord } from '@/lib/documents/documentArchiveService';
const tenant = 'tenant'; const id = 'document-id';
const document = { id, tenantId: tenant, clientId: 'client', title: 'Vertrag', fileName: 'Vertrag.pdf', pdfPath: 'tenant/tenant/generated/document/original.pdf' } as GeneratedDocumentRecord;
const input = () => ({ tenantId: tenant, clientId: 'client', document, storageArea: 'vertraege' });
beforeEach(() => { vi.clearAllMocks(); f.rows.clear(); f.inserts = []; f.readError = null; f.insertError = null;
  f.actor.mockResolvedValue({ ok: true, data: 'verified-profile' }); });
describe('generated document archive', () => {
  it('uses actual schema fields and the verified actor, keeping the document private until release', async () => {
    expect(await archiveGeneratedDocumentToClientRecord(input())).toMatchObject({ ok: true, clientDocumentId: id });
    expect(f.inserts[0]).toMatchObject({ id, file_name: 'Vertrag.pdf', category: 'vertrag', storage_path: document.pdfPath, portal_visible: false, uploaded_by: 'verified-profile' });
    expect(f.inserts[0]).not.toHaveProperty('metadata_json');
  });
  it('repeats the same archival request without creating another file record', async () => {
    await archiveGeneratedDocumentToClientRecord(input()); await archiveGeneratedDocumentToClientRecord(input()); expect(f.inserts).toHaveLength(1);
  });
  it('rejects an existing record for another client or original file', async () => {
    await archiveGeneratedDocumentToClientRecord(input());
    f.rows.set(id, { ...f.rows.get(id), storage_path: 'tenant/different.pdf' });
    expect((await archiveGeneratedDocumentToClientRecord(input())).ok).toBe(false); expect(f.inserts).toHaveLength(1);
  });
  it('does not fabricate a storage path or silently accept an archive error', async () => {
    expect((await archiveGeneratedDocumentToClientRecord({ ...input(), document: { ...document, pdfPath: null } })).ok).toBe(false);
    f.insertError = { message: 'denied' }; expect((await archiveGeneratedDocumentToClientRecord(input())).ok).toBe(false);
    expect(f.inserts).toEqual([]);
  });
  it('files an employee PDF once using the actual personnel schema without automatic release', async () => {
    const employeeInput = { tenantId: tenant, employeeId: 'employee', document: { ...document, clientId: null, employeeId: 'employee' }, storageArea: 'vertraege' };
    expect(await archiveGeneratedDocumentToEmployeeRecord(employeeInput)).toMatchObject({ ok: true, employeeDocumentId: id });
    expect(await archiveGeneratedDocumentToEmployeeRecord(employeeInput)).toMatchObject({ ok: true, employeeDocumentId: id });
    expect(f.inserts).toHaveLength(1);
    expect(f.inserts[0]).toMatchObject({ employee_id: 'employee', category: 'contract', sensitive: true, released_to_portal: false });
    expect(f.inserts[0]).not.toHaveProperty('mime_type'); expect(f.inserts[0]).not.toHaveProperty('uploaded_by');
  });
  it('rejects a foreign personnel destination and a path outside the existing storage format', async () => {
    const employeeInput = { tenantId: tenant, employeeId: 'foreign', document: { ...document, employeeId: 'employee' }, storageArea: 'personal' };
    expect((await archiveGeneratedDocumentToEmployeeRecord(employeeInput)).ok).toBe(false);
    expect((await archiveGeneratedDocumentToClientRecord({ ...input(), document: { ...document, pdfPath: `${tenant}/generated/file.pdf` } })).ok).toBe(false);
    expect(f.inserts).toEqual([]);
  });
});
