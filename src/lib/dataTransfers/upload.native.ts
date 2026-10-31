import { File as NativeFile } from 'expo-file-system';
import type { UploadOptions } from 'tus-js-client';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { TRANSFER_BUCKET, transferAction, type DataFile } from './service';
import { MAX_TRANSFER_FILE_SIZE, TRANSFER_SIZE_ERROR } from './limits';

// The custom fileReader consumes a native URI descriptor, not a browser Blob.
// Resume only the exact file object in this app session, never another account's/reselected file.
const resumeUploads = new WeakMap<NativeTransferFile, { recordId: string; url: string }>();

export function resumableEndpoint(url: string): string {
  const base = new URL(url);
  // Keep the configured project gateway. Its Storage service matches the project's
  // schema; the separate Storage host can run a different rollout version.
  base.pathname = '/storage/v1/upload/resumable'; base.search = ''; base.hash = '';
  return base.href;
}
export async function uploadTransferFile(file: NativeTransferFile, record: DataFile, signal: AbortSignal, progress: (percent: number) => void): Promise<void> {
  if (signal.aborted) throw Object.assign(new Error('Upload pausiert'), { name: 'AbortError' });
  if (file.size > MAX_TRANSFER_FILE_SIZE) throw new Error(TRANSFER_SIZE_ERROR);
  const client = getSupabaseClient();
  if (!client) throw new Error('Bitte erneut anmelden.');
  if (file.size !== Number(record.size) || file.name !== record.name) throw new Error('Bitte dieselbe Originaldatei auswählen.');
  // If a response was lost after upload, confirm the stored object before resending bytes.
  try {
    await transferAction('finish', record.tenant_id, { p_request_id: record.request_id, p_file_id: record.id });
    resumeUploads.delete(file); progress(100); return;
  } catch (cause) {
    if (!(cause instanceof Error) || !('code' in cause) || cause.code !== 'transfer_incomplete') throw cause;
  }
  const { Upload } = await import('tus-js-client');
  const { anonKey, url } = getSupabaseConfig();
  const previous = resumeUploads.get(file);
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return; settled = true; signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    const upload = new Upload(file as unknown as Blob, {
      fileReader: nativeTransferReader, endpoint: resumableEndpoint(url), chunkSize: 6 * 1024 * 1024,
      uploadUrl: previous?.recordId === record.id ? previous.url : undefined,
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true, removeFingerprintOnSuccess: true,
      // No filenames, tokens or resume URLs are persisted on a shared workstation.
      storeFingerprintForResuming: false,
      headers: { apikey: anonKey },
      metadata: { bucketName: TRANSFER_BUCKET, objectName: record.object_path, contentType: 'application/octet-stream', cacheControl: '0' },
      onBeforeRequest: async request => {
        if (signal.aborted) throw Object.assign(new Error('Upload pausiert'), { name: 'AbortError' });
        // Refresh credentials for long transfers; also stop after logout/account switch.
        const { data, error } = await client.auth.getSession();
        if (error || !data.session || data.session.user.id !== record.created_by) throw new Error('Bitte mit dem ursprünglichen Konto anmelden.');
        request.setHeader('Authorization', `Bearer ${data.session.access_token}`);
      },
      onProgress: (uploaded, total) => progress(total ? Math.floor(uploaded / total * 100) : 100),
      onError: error => {
        if (upload.url) resumeUploads.set(file, { recordId: record.id, url: upload.url });
        const status = 'originalResponse' in error ? error.originalResponse?.getStatus() : undefined;
        finish(new Error(status === 413 ? 'Die Datei überschreitet die konfigurierte Speichergrenze. Bitte CareSuite um Erhöhung dieser Grenze bitten.' : status === 401 || status === 403 ? 'Die Upload-Berechtigung ist abgelaufen. Bitte anmelden und die Anfrage erneut öffnen.' : 'Upload unterbrochen. Sie können den Upload in diesem Fenster fortsetzen.'));
      },
      onSuccess: () => { resumeUploads.delete(file); finish(); },
    });
    const abort = () => {
      if (upload.url) resumeUploads.set(file, { recordId: record.id, url: upload.url });
      void upload.abort().catch(() => {}).finally(() => finish(Object.assign(new Error('Upload pausiert'), { name: 'AbortError' })));
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort(); else upload.start();
  });
  if (signal.aborted) throw Object.assign(new Error('Upload pausiert'), { name: 'AbortError' });
  await transferAction('finish', record.tenant_id, { p_request_id: record.request_id, p_file_id: record.id });
}

export type NativeTransferFile = { uri: string; name: string; size: number };
/** Read bounded chunks directly from disk, including multi-GB transfers. */
export const nativeTransferReader: NonNullable<UploadOptions['fileReader']> = {
  async openFile(input: NativeTransferFile) {
    const file = new NativeFile(input.uri); if (file.size !== input.size) throw new Error('Die ausgewählte Datei hat sich geändert. Bitte erneut auswählen.');
    const handle = file.open(); let closed = false;
    return { size: input.size, async slice(start: number, end: number) { if (closed) throw new Error('Die Datei wurde geschlossen. Bitte erneut auswählen.'); handle.offset = start; const bytes = handle.readBytes(Math.min(end, input.size) - start); return { value: bytes, done: start + bytes.length >= input.size }; }, close() { if (!closed) { closed = true; handle.close(); } } };
  },
};
