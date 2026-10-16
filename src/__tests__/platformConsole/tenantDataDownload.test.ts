import { expect, it, vi } from 'vitest';
import { authorizeDownload, validDownloadInput } from '../../../supabase/functions/tenant-data-download/core';
const input = { tenantId: '00000000-0000-4000-8000-000000000001', requestId: '00000000-0000-4000-8000-000000000002', fileId: '00000000-0000-4000-8000-000000000003' };
const file = { id: input.fileId, tenant_id: input.tenantId, request_id: input.requestId, object_path: `${input.tenantId}/${input.requestId}/${input.fileId}`, name: 'Export.xlsx' };
it('validates input without allowing client-provided object paths', () => {
  expect(validDownloadInput(input)).toBe(true);
  expect(validDownloadInput({ ...input, tenantId: '../other' })).toBe(false);
  expect(validDownloadInput(null)).toBe(false);
});
it('signs only the authorized server path, for 60 seconds, as an attachment', async () => {
  const sign = vi.fn(async () => ({ data: { signedUrl: 'https://example.test/download' }, error: null }));
  const authorize = vi.fn(async () => ({ data: file, error: null }));
  await expect(authorizeDownload(input, authorize, sign)).resolves.toBe('https://example.test/download');
  expect(authorize).toHaveBeenCalledWith({ p_action: 'download', p_tenant_id: input.tenantId, p_request_id: input.requestId, p_file_id: input.fileId });
  expect(sign).toHaveBeenCalledWith(file.object_path, 60, 'Export.xlsx');
});
it('never signs denied, mismatched or absent files', async () => {
  const sign = vi.fn();
  for (const result of [{ data: null, error: { message: 'forbidden' } }, { data: { ...file, tenant_id: input.fileId }, error: null }, { data: { ...file, object_path: 'another/file' }, error: null }]) {
    await expect(authorizeDownload(input, async () => result, sign)).rejects.toThrow('forbidden');
  }
  expect(sign).not.toHaveBeenCalled();
});
