import { getSupabaseClient } from '@/lib/supabase/client';
import type { DataFile } from './service';
export async function downloadTransferFile(file: DataFile): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Bitte erneut anmelden.');
  const { data, error } = await client.functions.invoke('tenant-data-download', {
    body: { tenantId: file.tenant_id, requestId: file.request_id, fileId: file.id },
  });
  if (error || !data?.url) throw new Error('Der Download konnte nicht freigegeben werden. Bitte Anmeldung und Serververbindung prüfen.');
  const url = new URL(data.url);
  if (url.protocol !== 'https:') throw new Error('Ungültiger Download-Link.');
  // The browser downloads directly to disk, never buffering multi-GB files in JS.
  const link = document.createElement('a');
  link.href = url.href; link.download = file.name; link.rel = 'noreferrer';
  document.body.appendChild(link); link.click(); link.remove();
}
