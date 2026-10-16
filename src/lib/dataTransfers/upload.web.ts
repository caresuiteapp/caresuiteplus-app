import { getSupabaseClient } from '@/lib/supabase/client';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { TRANSFER_BUCKET, transferAction, type DataFile } from './service';

// Resume only the exact File object in this tab, never another account's/reselected file.
const resumeUploads = new WeakMap<File, { recordId: string; url: string }>();

export function resumableEndpoint(url: string): string {
  const base = new URL(url);
  if (base.hostname.endsWith('.supabase.co') && !base.hostname.endsWith('.storage.supabase.co')) {
    base.hostname = base.hostname.replace('.supabase.co', '.storage.supabase.co');
  }
  base.pathname = '/storage/v1/upload/resumable'; base.search = ''; base.hash = '';
  return base.href;
}
export async function uploadTransferFile(file: File, record: DataFile, signal: AbortSignal, progress: (percent: number) => void): Promise<void> {
  if (signal.aborted) throw new DOMException('Upload pausiert', 'AbortError');
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
    const upload = new Upload(file, {
      endpoint: resumableEndpoint(url), chunkSize: 6 * 1024 * 1024,
      uploadUrl: previous?.recordId === record.id ? previous.url : undefined,
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true, removeFingerprintOnSuccess: true,
      // No filenames, tokens or resume URLs are persisted on a shared workstation.
      storeFingerprintForResuming: false,
      headers: { apikey: anonKey },
      metadata: { bucketName: TRANSFER_BUCKET, objectName: record.object_path, contentType: 'application/octet-stream', cacheControl: '0' },
      onBeforeRequest: async request => {
        if (signal.aborted) throw new DOMException('Upload pausiert', 'AbortError');
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
      void upload.abort().catch(() => {}).finally(() => finish(new DOMException('Upload pausiert', 'AbortError')));
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort(); else upload.start();
  });
  if (signal.aborted) throw new DOMException('Upload pausiert', 'AbortError');
  await transferAction('finish', record.tenant_id, { p_request_id: record.request_id, p_file_id: record.id });
}
