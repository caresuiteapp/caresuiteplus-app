import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ os: 'android', upload: vi.fn(), download: vi.fn(), signed: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { get OS() { return h.os; } } }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/office/messagethreadservice', () => ({ fetchOfficeMessageThreadById: vi.fn().mockResolvedValue({ ok: false }), OFFICE_MESSAGING_SCHEMA_ERROR: 'Schema fehlt' }));
vi.mock('@/lib/office/officemessageauditservice', () => ({ auditFromThread: vi.fn(), logOfficeMessageAuditEvent: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({
  storage: { from: () => ({ upload: h.upload, download: h.download, createSignedUrl: h.signed }) },
  from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: {
    id: 'attachment-a', tenant_id: 'tenant-a', message_id: 'message-a', file_name: 'Datei.pdf', file_path: 'tenant/tenant-a/threads/thread-a/file.pdf', file_size_bytes: 3, mime_type: 'application/pdf', created_at: '2026-10-11',
  }, error: null }) }) }) }),
}) }));
import { resolveMessageAttachmentUrl, uploadPortalMessageAttachment } from '@/lib/office/messageattachmentservice';
const input = { tenantId: 'tenant-a', threadId: 'thread-a', messageId: 'message-a', fileName: 'Datei.pdf', mimeType: 'application/pdf', fileSizeBytes: 3,
  actorRoleKey: 'employee_portal' as const, audience: 'employee' as const };
beforeEach(() => { vi.clearAllMocks(); h.os = 'android'; h.upload.mockResolvedValue({ error: null }); h.signed.mockResolvedValue({ data: { signedUrl: 'https://example.test/signed.pdf' }, error: null }); });
afterEach(() => vi.unstubAllGlobals());
describe('portal native attachment transport', () => {
  it('uploads exact native typed-array bytes without creating an unsupported React Native Blob', async () => {
    vi.stubGlobal('Blob', class { constructor() { throw new Error('Creating blobs from ArrayBuffer is not supported'); } });
    const bytes = new Uint8Array([9, 1, 2, 3, 8]).subarray(1, 4);
    expect((await uploadPortalMessageAttachment({ ...input, fileData: bytes })).ok).toBe(true);
    const payload = h.upload.mock.calls[0][1]; expect(payload).toBeInstanceOf(ArrayBuffer); expect([...new Uint8Array(payload)]).toEqual([1, 2, 3]);
  });
  it('preserves a native ArrayBuffer upload', async () => {
    const payload = new Uint8Array([1, 2, 3]).buffer;
    expect((await uploadPortalMessageAttachment({ ...input, fileData: payload })).ok).toBe(true);
    expect(h.upload.mock.calls[0][1]).toBe(payload);
  });
  it('keeps browser uploads as MIME-labelled Blobs', async () => {
    h.os = 'web'; expect((await uploadPortalMessageAttachment({ ...input, fileData: new Uint8Array([1, 2, 3]) })).ok).toBe(true);
    const payload = h.upload.mock.calls[0][1] as Blob; expect(payload).toBeInstanceOf(Blob); expect(payload.type).toBe('application/pdf'); expect(payload.size).toBe(3);
  });
  it('uses authorized HTTPS URLs for native media and external PDF apps without browser blob downloads', async () => {
    const result = await resolveMessageAttachmentUrl('tenant-a', { id: 'file-a', tenantId: 'tenant-a', messageId: 'message-a', fileName: 'Datei.pdf', filePath: 'tenant/tenant-a/threads/thread-a/file.pdf', fileUrl: null, fileSizeBytes: 3, mimeType: 'application/pdf', createdAt: '2026-10-11' });
    expect(result).toEqual({ ok: true, data: 'https://example.test/signed.pdf' }); expect(h.download).not.toHaveBeenCalled(); expect(h.signed).toHaveBeenCalledTimes(1);
  });
  it('rejects an attachment from a different tenant before signing or downloading', async () => {
    const result = await resolveMessageAttachmentUrl('tenant-a', { id: 'file-b', tenantId: 'tenant-b', messageId: 'message-b', fileName: 'Privat.pdf', filePath: 'tenant/tenant-b/private.pdf', fileUrl: null, fileSizeBytes: 3, mimeType: 'application/pdf', createdAt: '2026-10-11' });
    expect(result.ok).toBe(false); expect(h.signed).not.toHaveBeenCalled(); expect(h.download).not.toHaveBeenCalled();
  });
});
