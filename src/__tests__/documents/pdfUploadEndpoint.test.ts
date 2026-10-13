import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { createPdfUploadHandler } from '../../../supabase/functions/_shared/pdfUploadHandler';
import { parsePdfUpload, pdfSha256, pdfUploadPath } from '../../../supabase/functions/_shared/pdfUpload';

const tenant = '10000000-0000-4000-8000-000000000001';
const documentId = '20000000-0000-4000-8000-000000000002';
const employeeId = '30000000-0000-4000-8000-000000000003';
const pdf = new jsPDF(); pdf.text('CareSuite test document', 20, 20);
const original = new Uint8Array(pdf.output('arraybuffer'));
const base64 = Buffer.from(original).toString('base64');
const body = () => ({ tenantId: tenant, documentId, pdfBase64: base64 });
let actor: Record<string, unknown>;
let role: Record<string, unknown>;
let document: Record<string, unknown>;
let authOk: boolean;
let permission: boolean;
let securityReady: boolean;
let securityError: unknown;
let uploadError: { statusCode: string } | null;
let jobError: unknown;
let storedBytes: Uint8Array;
const upload = vi.fn(); const download = vi.fn(); const upsert = vi.fn();

function client() {
  return {
    auth: { getUser: async () => ({ data: { user: authOk ? { id: 'verified-user' } : null }, error: null }) },
    rpc: async (name: string) => name === 'care_security_pdf_upload_ready'
      ? { data: securityReady, error: securityError } : { data: permission, error: null },
    from: (table: string) => {
      const result = () => ({ data: table === 'profiles' ? actor : table === 'roles' ? role : table === 'employees' ? { id: employeeId } : document, error: null });
      const query = { eq: (_key: string, _value: unknown) => query, or: (_filter: string) => query,
        maybeSingle: async () => result(), single: async () => result() };
      return { select: () => query, upsert };
    },
    storage: { from: () => ({ upload, download }) },
  };
}
const handler = createPdfUploadHandler({ userClient: client, serviceClient: client,
  respond: (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }), corsHeaders: {} });
const post = (value: unknown = body(), authorization = 'Bearer verified-token') => handler(new Request('https://example.test/render', {
  method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify(value),
}));
beforeEach(() => {
  vi.clearAllMocks(); authOk = true; permission = true; uploadError = null; jobError = null; storedBytes = original;
  securityReady = true; securityError = null;
  actor = { id: 'profile-id', tenant_id: tenant, role_id: 'role-id', is_active: true, status: 'active' };
  role = { key: 'office_admin', tenant_id: tenant }; document = { id: documentId, status: 'draft', locked_at: null };
  upload.mockImplementation(async () => ({ error: uploadError }));
  download.mockImplementation(async () => ({ data: new Blob([new Uint8Array(storedBytes)]), error: null }));
  upsert.mockImplementation(async () => ({ error: jobError }));
});

describe('PDF upload endpoint', () => {
  it('stores genuine renderer bytes at an immutable path and acknowledges a completed storage job', async () => {
    const response = await post(); expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.pdfPath).toBe(pdfUploadPath({ tenantId: tenant, documentId }, await pdfSha256(original)));
    expect(result.pdfPath).toMatch(new RegExp(`^tenant/${tenant}/generated/`));
    expect(upload.mock.calls[0][1]).toEqual(original); expect(upload.mock.calls[0][2].upsert).toBe(false);
    expect(upsert.mock.calls[0][0]).toMatchObject({ created_by: 'profile-id', related_entity_id: documentId });
  });
  it.each([{}, { tenantId: tenant, documentId, htmlOutput: '<p>HTML</p>' },
    { ...body(), documentId: '../foreign' }, { ...body(), pdfBase64: 'invalid' },
    { ...body(), pdfBase64: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n').toString('base64') },
  ])('rejects an incomplete or invalid PDF before storage writes %#', async value => {
    expect((await post(value)).status).toBe(400); expect(upload).not.toHaveBeenCalled(); expect(upsert).not.toHaveBeenCalled();
  });
  it('verifies the session before processing document bytes', async () => {
    authOk = false; expect((await post()).status).toBe(401); expect(upload).not.toHaveBeenCalled();
    expect((await post(body(), '')).status).toBe(401);
  });
  it.each(['absent migration', 'unavailable readiness check'])('fails closed before storage when %s', async kind => {
    if (kind === 'absent migration') securityReady = false;
    else securityError = { code: 'PGRST202' };
    expect((await post()).status).toBe(503); expect(upload).not.toHaveBeenCalled(); expect(upsert).not.toHaveBeenCalled();
  });
  it.each(['foreign tenant', 'inactive profile', 'portal role', 'foreign role', 'missing permission', 'locked original'])('rejects %s without a storage write', async kind => {
    if (kind === 'foreign tenant') actor.tenant_id = 'foreign';
    if (kind === 'inactive profile') actor.is_active = false;
    if (kind === 'portal role') role.key = 'employee_portal';
    if (kind === 'foreign role') role.tenant_id = 'foreign';
    if (kind === 'missing permission') permission = false;
    if (kind === 'locked original') document.locked_at = '2026-10-12T09:00:00Z';
    expect((await post()).status).toBe(kind === 'locked original' ? 409 : 403); expect(upload).not.toHaveBeenCalled();
  });
  it('requires a scoped employee for a payroll PDF', async () => {
    expect((await post({ ...body(), documentId: `payroll-${documentId}` })).status).toBe(400);
    expect((await post({ ...body(), documentId: `payroll-${documentId}`, employeeId })).status).toBe(200);
  });
  it.each(['employee', 'client', 'family', 'relative', 'caregiver', 'nurse', 'EMPLOYEE_PORTAL', 'Client_Portal', 'Family_Portal', 'Employee', 'NURSE'])('denies the legacy or differently cased portal role %s before storage', async key => {
    role.key = key;
    expect((await post()).status).toBe(403); expect(upload).not.toHaveBeenCalled(); expect(upsert).not.toHaveBeenCalled();
  });
  it('replays identical uploaded bytes without replacing the file', async () => {
    uploadError = { statusCode: '409' };
    expect((await post()).status).toBe(200); expect(download).toHaveBeenCalledOnce();
    storedBytes = new TextEncoder().encode('different bytes');
    expect((await post()).status).toBe(409);
  });
  it('does not announce success for storage or database failure', async () => {
    uploadError = { statusCode: '500' }; expect((await post()).status).toBe(503); expect(upsert).not.toHaveBeenCalled();
    uploadError = null; jobError = new Error('database unavailable'); expect((await post()).status).toBe(503);
  });
  it('returns the same job identity for a retry', async () => {
    await post(); await post(); expect(upsert.mock.calls[0][0].id).toBe(upsert.mock.calls[1][0].id);
  });
  it('does not accept noncanonical base64 padding', () => {
    expect(() => parsePdfUpload({ ...body(), pdfBase64: base64.replace(/=$/, 'A') + '=' })).toThrow();
  });
});
