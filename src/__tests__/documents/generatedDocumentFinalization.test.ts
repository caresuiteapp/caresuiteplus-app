import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
const f = vi.hoisted(() => ({ mode: 'supabase', row: {} as Record<string, unknown>, writes: [] as Record<string, unknown>[],
  upload: vi.fn(), render: vi.fn(), archive: vi.fn(), employeeArchive: vi.fn(), download: vi.fn(), conflict: false }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => f.mode }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ storage: { from: () => ({ download: f.download }) } }) }));
vi.mock('@/lib/supabase/edgeFunctions', () => ({ invokeEdgeFunction: f.upload }));
vi.mock('@/lib/documents/documentPdfService', () => ({ renderHtmlToPdfBytes: f.render }));
vi.mock('@/lib/documents/documentArchiveService', () => ({ archiveGeneratedDocumentToClientRecord: f.archive, archiveGeneratedDocumentToEmployeeRecord: f.employeeArchive }));
vi.mock('@/lib/documents/repository/documentAuditRepository.supabase', () => ({ writeDocumentAuditLog: vi.fn(), listDocumentAuditLog: vi.fn() }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => {
  let mutation: Record<string, unknown> | null = null;
  const query = { select: () => query, eq: () => query, update: (value: Record<string, unknown>) => { mutation = value; return query; },
    maybeSingle: async () => ({ data: f.row, error: null }),
    single: async () => { if (f.conflict) return { data: null, error: { message: 'version conflict' } };
      if (mutation) { f.writes.push(mutation); f.row = { ...f.row, ...mutation }; }
      return { data: f.row, error: null }; } };
  return query;
} }));
import { finalizeGeneratedDocument } from '@/lib/documents/documentEngineService';
const tenantId = '10000000-0000-4000-8000-000000000001';
const documentId = '20000000-0000-4000-8000-000000000002';
const clientId = '30000000-0000-4000-8000-000000000003';
const path = `tenant/${tenantId}/generated/${documentId}/original.pdf`;
const pdf = new jsPDF(); pdf.text('Original document', 20, 20);
const bytes = new Uint8Array(pdf.output('arraybuffer'));
const input = () => ({ tenantId, documentId, archivedInArea: 'vertraege', clientId });
beforeEach(() => {
  vi.clearAllMocks(); f.mode = 'supabase'; f.writes = []; f.conflict = false;
  f.row = { id: documentId, tenant_id: tenantId, client_id: clientId, title: 'Vertrag', status: 'draft',
    generated_content_json: { html: '<p>Original contract</p>' }, pdf_path: null, updated_at: '2026-10-12T09:00:00Z' };
  f.render.mockResolvedValue(bytes); f.upload.mockResolvedValue({ ok: true, data: { pdfPath: path } });
  f.download.mockResolvedValue({ data: new Blob([bytes]), error: null });
  f.archive.mockResolvedValue({ ok: true, clientDocumentId: documentId });
  f.employeeArchive.mockResolvedValue({ ok: true, employeeDocumentId: documentId });
});
describe('generated document completion', () => {
  it('renders the stored live HTML, verifies the uploaded file and archives it before finalizing', async () => {
    expect((await finalizeGeneratedDocument(input())).ok).toBe(true);
    expect(f.render).toHaveBeenCalledWith('<p>Original contract</p>');
    expect(f.download).toHaveBeenCalledWith(path); expect(f.archive).toHaveBeenCalledOnce();
    expect(f.writes).toHaveLength(1); expect(f.writes[0]).toMatchObject({ status: 'finalized', pdf_path: path });
  });
  it.each(['renderer', 'upload', 'missing path', 'storage', 'invalid bytes', 'archive'])('keeps the record unfinalized on %s failure', async kind => {
    if (kind === 'renderer') f.render.mockRejectedValue(new Error('renderer failed'));
    if (kind === 'upload') f.upload.mockResolvedValue({ ok: false, error: 'upload failed' });
    if (kind === 'missing path') f.upload.mockResolvedValue({ ok: true, data: {} });
    if (kind === 'storage') f.download.mockResolvedValue({ data: null, error: { message: 'missing' } });
    if (kind === 'invalid bytes') f.download.mockResolvedValue({ data: new Blob(['%PDF fake']), error: null });
    if (kind === 'archive') f.archive.mockResolvedValue({ ok: false, error: 'archive failed' });
    expect((await finalizeGeneratedDocument(input())).ok).toBe(false); expect(f.writes).toEqual([]);
  });
  it('rejects a foreign archive destination or caller-supplied file path before writes', async () => {
    expect((await finalizeGeneratedDocument({ ...input(), clientId: 'foreign' })).ok).toBe(false);
    expect((await finalizeGeneratedDocument({ ...input(), pdfPath: 'unconfirmed/file.pdf' })).ok).toBe(false);
    expect(f.upload).not.toHaveBeenCalled(); expect(f.archive).not.toHaveBeenCalled(); expect(f.writes).toEqual([]);
  });
  it('does not render or rewrite an already finalized original when completion is retried', async () => {
    f.row = { ...f.row, status: 'finalized', pdf_path: path, archived_in_area: 'vertraege' };
    expect((await finalizeGeneratedDocument(input())).ok).toBe(true);
    expect(f.render).not.toHaveBeenCalled(); expect(f.upload).not.toHaveBeenCalled(); expect(f.writes).toEqual([]);
  });
  it('reports a concurrent revision conflict instead of successful finalization', async () => {
    f.conflict = true; expect((await finalizeGeneratedDocument(input())).ok).toBe(false); expect(f.writes).toEqual([]);
  });
  it('uses the stored client association even when the caller omits it', async () => {
    expect((await finalizeGeneratedDocument({ ...input(), clientId: null })).ok).toBe(true);
    expect(f.archive).toHaveBeenCalledWith(expect.objectContaining({ clientId }));
  });
  it('requires successful personnel filing for a stored employee document', async () => {
    f.row = { ...f.row, client_id: null, employee_id: 'employee' };
    f.employeeArchive.mockResolvedValue({ ok: false, error: 'personnel archive failed' });
    expect((await finalizeGeneratedDocument({ ...input(), clientId: null, employeeId: 'employee' })).ok).toBe(false);
    expect(f.employeeArchive).toHaveBeenCalledOnce(); expect(f.archive).not.toHaveBeenCalled(); expect(f.writes).toEqual([]);
  });
});
