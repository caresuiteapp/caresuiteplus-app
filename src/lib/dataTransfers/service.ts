import { platformRpc } from '@/lib/platformConsole/platformSupabaseClient';
import { getSupabaseClient } from '@/lib/supabase/client';

export type DataRequest = {
  id: string; tenant_id: string; message: string;
  state: 'open' | 'submitted' | 'processed' | 'cancelled';
  created_at: string; expires_at: string; submitted_at: string | null; file_count?: number;
};
export type DataFile = {
  id: string; tenant_id: string; request_id: string; created_by: string;
  name: string; size: number; object_path: string; state: 'pending' | 'ready' | 'discarded';
};
export type TransferPage<T> = { items: T[]; total: number };
export const TRANSFER_BUCKET = 'tenant-data-transfers';

export class DataTransferError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'DataTransferError'; }
}

const messages: Record<string, string> = {
  transfer_forbidden: 'Ihr Konto ist für diese Datenübernahme nicht berechtigt. Bitte mit dem Verwaltungskonto anmelden.',
  transfer_not_found: 'Diese Datenübernahme gehört nicht zum geöffneten Unternehmen oder ist nicht mehr verfügbar.',
  transfer_closed: 'Diese Upload-Anfrage wurde beendet oder ist abgelaufen. Bitte eine neue Anfrage anfordern.',
  transfer_tenant_inactive: 'Das Unternehmen benötigt einen aktiven Zugang für die Datenübernahme.',
  transfer_incomplete: 'Bitte alle Dateien vollständig hochladen oder unvollständige Dateien entfernen.',
  transfer_not_submitted: 'Das Unternehmen hat diese Dateien noch nicht übermittelt.',
  transfer_invalid: 'Die Datei oder die Anfrage ist ungültig. Bitte Namen und Auswahl prüfen.',
};
export async function transferAction<T>(action: string, tenantId: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await platformRpc<T>('tenant_data_transfer', { ...args, p_action: action, p_tenant_id: tenantId });
  if (error || data == null) throw new DataTransferError(error?.message ?? 'transfer_unavailable', messages[error?.message ?? ''] ?? error?.message ?? 'Die Datenübernahme ist nicht erreichbar. Bitte erneut versuchen.');
  return data;
}
export const getOpenTransfer = (tenantId: string) => transferAction<{ request: DataRequest | null }>('open', tenantId);
export const listTransfers = (tenantId: string, offset = 0) => transferAction<TransferPage<DataRequest>>('list', tenantId, { p_offset: offset });
export const listTransferFiles = (tenantId: string, requestId: string, offset = 0) => transferAction<TransferPage<DataFile>>('files', tenantId, { p_request_id: requestId, p_offset: offset });
export function formatTransferSize(size: number): string {
  if (!size) return '0 B';
  const index = Math.min(5, Math.floor(Math.log(size) / Math.log(1024)));
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: index ? 1 : 0 }).format(size / 1024 ** index)} ${['B','KiB','MiB','GiB','TiB','PiB'][index]}`;
}
export async function discardTransferFile(file: DataFile): Promise<void> {
  // Revoke before deleting so a concurrent submit cannot include a removed object.
  await transferAction('discard', file.tenant_id, { p_request_id: file.request_id, p_file_id: file.id });
  const client = getSupabaseClient();
  if (!client) throw new Error('Die Serververbindung fehlt.');
  const { error } = await client.storage.from(TRANSFER_BUCKET).remove([file.object_path]);
  if (error) throw new Error('Die Datei ist aus der Übermittlung entfernt. Die Löschung im Speicher konnte noch nicht bestätigt werden.');
}
export { downloadTransferFile } from './transferDownload';
