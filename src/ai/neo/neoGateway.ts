import { getSupabaseClient } from '@/lib/supabase/client';
import { assertNeoScope, validateNeoModelDraft, type NeoScope, type NeoSegment } from './neoDomain';
import { neoBase64 } from './neoAudio';

async function invoke(scope: NeoScope, operation: string, payload: Record<string, unknown>, signal: AbortSignal) {
  assertNeoScope(scope); signal.throwIfAborted();
  const client = getSupabaseClient(); if (!client) throw Error('Die NEO-Verbindung ist nicht verfügbar.');
  const auth = await client.auth.getUser(); signal.throwIfAborted();
  if (auth.error || auth.data.user?.id !== scope.actorId) throw Error('Bitte erneut mit dem aktuellen Teamzugang anmelden.');
  if (!['status', 'transcribe'].includes(operation)) throw Error('Ein eigenes zusätzliches Sprachmodell ist noch nicht freigegeben. Die belegte NEO-Zuordnung ist ohne dieses Modell nutzbar.');
  const session = await client.auth.getSession(); signal.throwIfAborted();
  const token = session.data.session?.access_token;
  if (session.error || !token) throw Error('Bitte erneut mit dem aktuellen Teamzugang anmelden.');
  const base = typeof window !== 'undefined' && window.location?.protocol === 'https:' ? '' : 'https://www.caresuiteplus.app';
  const response = await fetch(`${base}/api/neo/${operation}`, { method: 'POST', signal: AbortSignal.any([signal, AbortSignal.timeout(95000)]),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ scope, ...payload }) });
  const raw = await response.text(); signal.throwIfAborted();
  if (raw.length > 250000) throw Error('Die NEO-Antwort ist zu umfangreich.');
  let data: Record<string, unknown>; try { data = JSON.parse(raw); } catch { throw Error('Die eigene NEO-Verbindung hat keine gültige Antwort geliefert.'); }
  const current = await client.auth.getUser(); signal.throwIfAborted();
  if (current.error || current.data.user?.id !== scope.actorId) throw Error('Der Teamzugang wurde während der Verarbeitung gewechselt.');
  if (!response.ok || !data || data.ok !== true || data.scopeKey !== JSON.stringify([scope.tenantId, scope.actorId, scope.subjectId, scope.assessmentId ?? ''])) throw Error(typeof data?.error === 'string' ? data.error : 'Der eigene NEO-Sprachdienst ist noch nicht bereit.');
  return data;
}
export async function transcribeNeoAudio(scope: NeoScope, audio: Uint8Array, signal: AbortSignal): Promise<string> {
  if (audio.length > 500000 || audio.length < 100) throw Error('Der Audioabschnitt ist leer oder zu lang.');
  const data = await invoke(scope, 'transcribe', { audio: neoBase64(audio) }, signal);
  if (typeof data.text !== 'string' || data.text.length > 6000) throw Error('Das Transkript ist unvollständig. Bitte den Abschnitt erneut einsprechen.');
  return data.text.trim();
}
export async function requestNeoModelDraft(scope: NeoScope, segments: NeoSegment[], signal: AbortSignal) {
  const data = await invoke(scope, 'analyze', { segments }, signal);
  return validateNeoModelDraft(data.draft, segments);
}
export async function checkNeoService(scope: NeoScope, signal: AbortSignal): Promise<boolean> {
  const data = await invoke(scope, 'status', {}, signal); return data.transcriptionReady === true;
}
