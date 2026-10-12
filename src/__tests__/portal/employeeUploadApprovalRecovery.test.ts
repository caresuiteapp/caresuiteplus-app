import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ upload: {} as Record<string, unknown>, documents: [] as Record<string, unknown>[], insertCount: 0, failStatus: false, loseInsertResponse: false, changeStatus: false }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'unused' }));
vi.mock('@/lib/clients/clientDocumentsService', () => ({ buildClientDocumentStoragePath: vi.fn() }));
vi.mock('@/lib/clients/clientBackend', () => ({ getClientExtendedRepository: vi.fn() }));
vi.mock('@/lib/portal/assist/portalActivityService', () => ({ logPortalActivity: vi.fn() }));
vi.mock('@/lib/portal/assist/portalRequestService', () => ({ createPortalRequest: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const filters: ((row: Record<string, unknown>) => boolean)[] = [];
  let changes: Record<string, unknown> | null = null;
  const rows = () => (table === 'portal_uploads' ? [h.upload] : h.documents).filter(row => filters.every(f => f(row)));
  const result = () => {
    if (changes && h.changeStatus) h.upload.status = 'abgelehnt';
    if (changes && h.failStatus) return { data: null, error: { message: 'status unavailable' } };
    const matching = rows();
    if (changes) matching.forEach(row => Object.assign(row, changes));
    return { data: matching[0] ?? null, error: matching.length ? null : { message: 'no matching row' } };
  };
  const q = {
    select: () => q, eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return q; },
    in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return q; },
    update: (row: Record<string, unknown>) => { changes = row; return q; },
    single: async () => result(), maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
    insert: async (row: Record<string, unknown>) => { h.insertCount++; h.documents.push({ ...row }); return { error: h.loseInsertResponse ? { message: 'response lost' } : null }; },
  }; return q;
} }));
import { approvePortalUpload } from '@/lib/portal/assist/portalDocumentUploadService';

const input = { tenantId: 'tenant', uploadId: 'upload-uuid', reviewedBy: 'office-profile' };
beforeEach(() => {
  h.documents = []; h.insertCount = 0; h.failStatus = false; h.loseInsertResponse = false; h.changeStatus = false;
  h.upload = { id: input.uploadId, tenant_id: input.tenantId, employee_id: 'employee', client_id: null, upload_context: 'mitarbeiter', status: 'hochgeladen', file_name: 'certificate.pdf', storage_path: 'tenant/tenant/employees/employee/portal-uploads/upload-uuid/certificate.pdf' };
});
describe('office approval of a personal employee upload', () => {
  it('retries an unconfirmed status write with one stable personal document', async () => {
    h.failStatus = true;
    expect((await approvePortalUpload(input)).ok).toBe(false);
    expect(h.documents).toHaveLength(1); expect(h.upload.status).toBe('hochgeladen');
    h.failStatus = false;
    const approved = await approvePortalUpload(input);
    expect(approved.ok).toBe(true); expect(h.insertCount).toBe(1);
    expect(h.documents[0]).toMatchObject({ id: input.uploadId, employee_id: 'employee', released_to_portal: true });
    expect(h.upload.status).toBe('freigegeben');
  });
  it('confirms an inserted archive after the insert response was lost', async () => {
    h.loseInsertResponse = true;
    expect((await approvePortalUpload(input)).ok).toBe(true);
    expect(h.documents).toHaveLength(1); expect(h.upload.status).toBe('freigegeben');
  });
  it('never binds an upload to an existing document of a different owner or path', async () => {
    h.documents = [{ id: input.uploadId, tenant_id: input.tenantId, employee_id: 'other-employee', storage_path: h.upload.storage_path }];
    expect((await approvePortalUpload(input)).ok).toBe(false);
    expect(h.insertCount).toBe(0); expect(h.upload.status).toBe('hochgeladen');
  });
  it('does not overwrite a concurrent rejection or report approval when no pending row was updated', async () => {
    h.changeStatus = true;
    expect((await approvePortalUpload(input)).ok).toBe(false);
    expect(h.upload.status).toBe('abgelehnt');
  });
});
