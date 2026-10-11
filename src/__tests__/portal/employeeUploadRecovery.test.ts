import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn(), insert: vi.fn(), recover: vi.fn(), list: vi.fn(), request: vi.fn(), employee: vi.fn(), saved: {} as Record<string, unknown> }));
vi.mock('@/lib/portal/resolvePortalEmployeeLink', () => ({ fetchPortalEmployeeIdForAuthUser: f.employee }));
vi.mock('expo-crypto', () => ({ randomUUID: () => '9ab08243-9b71-4f37-a9d7-240c719be4dd' }));
vi.mock('@/lib/services/serviceRunner', () => ({ runService: async (callback: () => unknown) => callback() }));
vi.mock('@/lib/portal/assist/portalRequestService', () => ({ createPortalRequest: f.request }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ storage: { from: () => ({ upload: f.upload, remove: f.remove }) } }) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => {
  const q = { insert: (row: Record<string, unknown>) => { f.saved = row; return q; }, select: () => q, eq: () => q, order: () => q,
    single: f.insert, maybeSingle: f.recover, abortSignal: () => q,
    then: (resolve: (value: unknown) => unknown) => f.list().then(resolve) }; return q;
} }));
import * as native from '@/lib/portal/employeePortalUploadService';
import * as web from '@/lib/portal/employeePortalUploadService.web';
const input = { tenantId: 'tenant', employeeId: 'employee', uploadContext: 'mitarbeiter' as const, fileName: 'Scan.pdf', mimeType: 'application/pdf', bytes: new Uint8Array([37, 80, 68, 70]), sizeBytes: 900 };
beforeEach(() => {
  vi.clearAllMocks(); f.saved = {}; f.upload.mockResolvedValue({ error: null });
  f.employee.mockResolvedValue('employee');
  f.insert.mockImplementation(async () => ({ data: f.saved, error: null }));
  f.recover.mockResolvedValue({ data: null, error: null });
  f.list.mockResolvedValue({ data: [], error: null }); f.request.mockResolvedValue({ ok: true, data: { id: 'request' } });
});
describe.each([['native', native], ['web', web]] as const)('%s employee upload', (_platform, service) => {
  it('uses a native-capable UUID and binary ArrayBuffer with the actual byte count', async () => {
    const prior = globalThis.crypto; vi.stubGlobal('crypto', undefined);
    try {
      expect((await service.uploadEmployeePortalDocument(input)).ok).toBe(true);
      expect(f.saved.id).toBe('9ab08243-9b71-4f37-a9d7-240c719be4dd');
      expect(f.saved.size_bytes).toBe(4);
      expect(f.upload.mock.calls[0][1]).toBeInstanceOf(ArrayBuffer);
      expect([...new Uint8Array(f.upload.mock.calls[0][1])]).toEqual([37, 80, 68, 70]);
    } finally { vi.stubGlobal('crypto', prior); }
  });
  it('recovers a committed metadata row after its write response was lost without deleting its file', async () => {
    f.insert.mockRejectedValue(new Error('lost response'));
    f.recover.mockImplementation(async () => ({ data: f.saved, error: null }));
    expect((await service.uploadEmployeePortalDocument(input)).ok).toBe(true);
    expect(f.remove).not.toHaveBeenCalled(); expect(f.recover).toHaveBeenCalledOnce();
  });
  it('keeps the uploaded file and reports an unconfirmed insert instead of claiming success', async () => {
    f.insert.mockResolvedValue({ data: null, error: { message: 'offline' } });
    const result = await service.uploadEmployeePortalDocument(input);
    expect(result.ok).toBe(false); if (!result.ok) expect(result.error).toContain('Upload-Liste aktualisieren');
    expect(f.remove).not.toHaveBeenCalled();
  });
  it('does not hide an unavailable upload table behind an empty list', async () => {
    f.list.mockResolvedValue({ data: null, error: { code: '42P01', message: 'relation does not exist' } });
    expect((await service.listEmployeePortalUploads('tenant', 'employee')).ok).toBe(false);
  });
  it('rejects a forged employee scope before reading or uploading personal files', async () => {
    f.employee.mockResolvedValue('other-employee');
    expect((await service.uploadEmployeePortalDocument(input)).ok).toBe(false);
    expect((await service.listEmployeePortalUploads('tenant', 'employee')).ok).toBe(false);
    expect(f.upload).not.toHaveBeenCalled(); expect(f.insert).not.toHaveBeenCalled(); expect(f.list).not.toHaveBeenCalled();
  });
});
