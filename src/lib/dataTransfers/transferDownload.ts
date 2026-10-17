import { Directory, File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { DataFile } from './service';
export async function downloadTransferFile(file: DataFile): Promise<void> {
  const client = getSupabaseClient(); if (!client) throw new Error('Bitte erneut anmelden.');
  const { data, error } = await client.functions.invoke('tenant-data-download', { body: { tenantId: file.tenant_id, requestId: file.request_id, fileId: file.id } });
  if (error || !data?.url || new URL(data.url).protocol !== 'https:') throw new Error('Der Download konnte nicht freigegeben werden.');
  if (!(await isAvailableAsync())) throw new Error('Dateifreigabe ist auf diesem Gerät nicht verfügbar.');
  const folder = new Directory(Paths.cache, 'caresuite-transfers'); folder.create({ intermediates: true, idempotent: true });
  const destination = new File(folder, `${file.id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
  const saved = await File.downloadFileAsync(data.url, destination, { idempotent: true });
  await shareAsync(saved.uri, { dialogTitle: file.name });
}
