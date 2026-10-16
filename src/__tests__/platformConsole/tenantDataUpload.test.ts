// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ action: vi.fn(), session: vi.fn(), instances: [] as any[], run: null as ((upload: any) => void) | null }));
vi.mock('@/lib/dataTransfers/service', () => ({ TRANSFER_BUCKET: 'tenant-data-transfers', transferAction: mocks.action }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ auth: { getSession: mocks.session } }) }));
vi.mock('@/lib/supabase/config', () => ({ getSupabaseConfig: () => ({ url: 'https://test.supabase.co', anonKey: 'public-key' }) }));
vi.mock('tus-js-client', () => ({ Upload: class {
  url = 'https://test.storage.supabase.co/storage/v1/upload/resumable/one';
  constructor(public file: File, public options: any) { mocks.instances.push(this); }
  start() { mocks.run?.(this); }
  abort = vi.fn(async () => {});
} }));
import { uploadTransferFile } from '@/lib/dataTransfers/upload.web';
import type { DataFile } from '@/lib/dataTransfers/service';
const record: DataFile = { id: 'file', tenant_id: 'tenant', request_id: 'request', created_by: 'owner', name: 'Export.any', size: 4, object_path: 'tenant/request/file', state: 'pending' };
const incomplete = Object.assign(new Error('Bitte alle Dateien vollständig hochladen oder unvollständige Dateien entfernen.'), { code: 'transfer_incomplete' });
beforeEach(() => {
  vi.clearAllMocks(); mocks.instances.length = 0; mocks.run = upload => upload.options.onSuccess();
  mocks.session.mockResolvedValue({ data: { session: { user: { id: 'owner' }, access_token: 'current-token' } }, error: null });
  mocks.action.mockReset(); mocks.action.mockRejectedValueOnce(incomplete).mockResolvedValue({ ok: true });
});
it('recovers a lost completion response without uploading the bytes again', async () => {
  mocks.action.mockReset(); mocks.action.mockResolvedValue({ ok: true });
  await uploadTransferFile(new File(['data'], record.name), record, new AbortController().signal, vi.fn());
  expect(mocks.instances).toHaveLength(0);
});
it('rechecks the current identity on each chunk and never sends another account token', async () => {
  const file = new File(['data'], record.name);
  await uploadTransferFile(file, record, new AbortController().signal, vi.fn());
  const options = mocks.instances[0].options; const headers = { setHeader: vi.fn() };
  await options.onBeforeRequest(headers);
  expect(headers.setHeader).toHaveBeenCalledWith('Authorization', 'Bearer current-token');
  headers.setHeader.mockClear(); mocks.session.mockResolvedValue({ data: { session: { user: { id: 'other' }, access_token: 'other-token' } } });
  await expect(options.onBeforeRequest(headers)).rejects.toThrow('ursprünglichen Konto');
  expect(headers.setHeader).not.toHaveBeenCalled();
});
it('pauses and resumes the same file in memory, while a reselected file starts cleanly', async () => {
  mocks.run = null; const file = new File(['data'], record.name); const control = new AbortController();
  const running = uploadTransferFile(file, record, control.signal, vi.fn());
  const rejected = expect(running).rejects.toThrow('Upload pausiert');
  await vi.waitFor(() => expect(mocks.instances).toHaveLength(1));
  control.abort(); await rejected;
  expect(mocks.instances[0].abort).toHaveBeenCalledOnce();
  mocks.action.mockReset(); mocks.action.mockRejectedValueOnce(incomplete).mockResolvedValue({ ok: true });
  mocks.run = upload => upload.options.onSuccess();
  await uploadTransferFile(file, record, new AbortController().signal, vi.fn());
  expect(mocks.instances[1].options.uploadUrl).toContain('/resumable/one');
  mocks.action.mockReset(); mocks.action.mockRejectedValueOnce(incomplete).mockResolvedValue({ ok: true });
  await uploadTransferFile(new File(['data'], record.name), record, new AbortController().signal, vi.fn());
  expect(mocks.instances[2].options.uploadUrl).toBeUndefined();
});
it('never finalizes a failed transport or hides a storage size limit', async () => {
  mocks.run = upload => upload.options.onError({ originalResponse: { getStatus: () => 413 } });
  await expect(uploadTransferFile(new File(['data'], record.name), record, new AbortController().signal, vi.fn())).rejects.toThrow('Speichergrenze');
  expect(mocks.action).toHaveBeenCalledTimes(1);
});
