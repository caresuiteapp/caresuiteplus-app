import { readKimHostCommand, type KimHostCommand } from './kimReceiveContract';

/** The only browser transport for host commands. No retry of a start request;
 * an interrupted HTTP response says nothing about completion at the host. */
export async function postKimHostCommand(command: KimHostCommand, accessToken: string, signal?: AbortSignal, http: typeof fetch = fetch): Promise<unknown> {
  const input = readKimHostCommand(command);
  const response = await http('/api/gkv/kim-host', { method: 'POST', signal, cache: 'no-store', redirect: 'error',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error(response.status === 401 ? 'Bitte erneut anmelden.' : response.status === 403
    ? 'Für die Hostprüfung fehlen die Abrechnungsrechte.' : 'Der Host ist nicht erreichbar. Ein gestarteter Auftrag kann dort weiterlaufen. Bitte den Status erneut abfragen.');
  const reader = response.body?.getReader(); if (!reader) throw new Error('Der Host hat keinen Prüfstatus geliefert.');
  let bytes = 0; const chunks: Uint8Array[] = [];
  try { while (true) { const next = await reader.read(); if (next.done) break; bytes += next.value.length;
    if (bytes > 32768) { await reader.cancel(); throw new Error('Der Prüfstatus ist unlesbar.'); } chunks.push(next.value); } }
  finally { reader.releaseLock(); }
  const content = new Uint8Array(bytes); let offset = 0; for (const chunk of chunks) { content.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(content)); }
  catch { throw new Error('Der Prüfstatus ist unlesbar. Bitte erneut abfragen.'); }
}
