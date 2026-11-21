import { getSupabaseClient } from '@/lib/supabase/client';
import { assertNeoScope, validateNeoModelDraft, type NeoScope, type NeoSegment } from './neoDomain';
import { neoBase64 } from './neoAudio';

async function invoke(scope: NeoScope, operation: string, payload: Record<string, unknown>, signal: AbortSignal) {
  assertNeoScope(scope); signal.throwIfAborted();
  const client = getSupabaseClient(); if (!client) throw Error('Die NEO-Verbindung ist nicht verfügbar.');
  const auth = await client.auth.getUser(); signal.throwIfAborted();
  if (auth.error || auth.data.user?.id !== scope.actorId) throw Error('Bitte erneut mit dem aktuellen Teamzugang anmelden.');
  const result = await client.functions.invoke('neo-assistant', { body: { operation, scope, ...payload }, signal });
  signal.throwIfAborted();
  if (result.error || !result.data || result.data.ok !== true || result.data.scopeKey !== JSON.stringify([scope.tenantId, scope.actorId, scope.subjectId, scope.assessmentId ?? ''])) throw Error(result.data?.error ?? 'Der eigene NEO-Sprachdienst ist noch nicht erreichbar. Bitte die NEO-Einrichtung prüfen.');
  return result.data as Record<string, unknown>;
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
