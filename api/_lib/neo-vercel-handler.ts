export type NeoVercelScope = { tenantId: string; actorId: string; subjectId: string; assessmentId?: string };
export type NeoVercelRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown; aborted?: boolean; once?: (event: string, callback: () => void) => unknown; off?: (event: string, callback: () => void) => unknown };
export type NeoVercelResponse = { status(code: number): NeoVercelResponse; setHeader(name: string, value: string): void; json(body: unknown): unknown };
export type NeoVercelEngine = { status(): Promise<{ transcriptionReady: boolean }>; transcribe(audio: string, signal: AbortSignal): Promise<{ text: string; engine: string }> };
type Dependencies = { fetch: typeof fetch; engine: NeoVercelEngine; env: { EXPO_PUBLIC_SUPABASE_URL?: string; EXPO_PUBLIC_SUPABASE_ANON_KEY?: string; EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY = 700_000;
class Failure extends Error { constructor(readonly status: number, message: string) { super(message); } }
const row = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const scopeKey = (scope: NeoVercelScope) => JSON.stringify([scope.tenantId, scope.actorId, scope.subjectId, scope.assessmentId ?? '']);
function parse(body: unknown, operation: 'status' | 'transcribe'): { scope: NeoVercelScope; audio?: string } {
  let input: Record<string, unknown>;
  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    const text = body.toString(); if (Buffer.byteLength(text) > MAX_BODY) throw new Failure(413, 'Der Sprachabschnitt ist zu groß.');
    try { input = row(JSON.parse(text)); } catch (error) { if (error instanceof Failure) throw error; throw new Failure(400, 'Die NEO-Anfrage ist ungültig.'); }
  } else input = row(body);
  if (Object.keys(input).some(key => !['scope', ...(operation === 'transcribe' ? ['audio'] : [])].includes(key))) throw new Failure(400, 'Unbekannte NEO-Anfragefelder.');
  const scope = row(input.scope);
  if (Object.keys(scope).some(key => !['tenantId', 'actorId', 'subjectId', 'assessmentId'].includes(key)) || !['tenantId', 'actorId', 'subjectId'].every(key => typeof scope[key] === 'string' && UUID.test(scope[key] as string)) || scope.assessmentId !== undefined && (typeof scope.assessmentId !== 'string' || !UUID.test(scope.assessmentId))) throw new Failure(400, 'Der Personen- oder Unternehmensbezug fehlt.');
  if (operation === 'transcribe' && (typeof input.audio !== 'string' || input.audio.length > 666_668 || input.audio.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.audio))) throw new Failure(400, 'Der Audioabschnitt ist ungültig.');
  return { scope: scope as NeoVercelScope, ...(operation === 'transcribe' ? { audio: input.audio as string } : {}) };
}
async function boundedJson(response: Response, max = 65_536): Promise<unknown> {
  if (!response.body) throw new Failure(503, 'Die Zugangsprüfung ist nicht erreichbar.');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; length += part.value.length; if (length > max) { await reader.cancel(); throw new Failure(503, 'Die Zugangsprüfung ist nicht verfügbar.'); } chunks.push(part.value); }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(length); let offset = 0; for (const part of chunks) { buffer.set(part, offset); offset += part.length; }
  return JSON.parse(new TextDecoder().decode(buffer));
}

/** Only user-scoped authorization and local CPU inference. No inference-provider fallback. */
export function createNeoVercelHandler(operation: 'status' | 'transcribe', dependencies: Dependencies) {
  return async (request: NeoVercelRequest, response: NeoVercelResponse): Promise<unknown> => {
    response.setHeader('Cache-Control', 'private, no-store, max-age=0'); response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Vary', 'Authorization');
    if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return response.status(405).json({ ok: false, error: 'NEO erwartet POST.' }); }
    const abort = new AbortController(); const onAbort = () => abort.abort(); request.once?.('aborted', onAbort);
    const timeout = setTimeout(onAbort, 95_000);
    try {
      if (request.aborted) throw new Failure(499, 'Die Anfrage wurde abgebrochen.');
      const authorization = request.headers.authorization;
      if (typeof authorization !== 'string' || authorization.length > 8192 || !/^Bearer [A-Za-z0-9._~-]+$/.test(authorization)) throw new Failure(401, 'Bitte erneut mit dem Teamzugang anmelden.');
      const input = parse(request.body, operation);
      const key = dependencies.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || dependencies.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      let base: URL; try { base = new URL(dependencies.env.EXPO_PUBLIC_SUPABASE_URL || ''); } catch { throw new Failure(503, 'Die NEO-Zugangsprüfung ist noch nicht eingerichtet.'); }
      if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/' || !key) throw new Failure(503, 'Die NEO-Zugangsprüfung ist noch nicht eingerichtet.');
      const headers = { Authorization: authorization, apikey: key, 'Content-Type': 'application/json' };
      const authorize = async () => {
        abort.signal.throwIfAborted();
        const auth = await dependencies.fetch(`${base.origin}/auth/v1/user`, { headers, redirect: 'error', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10_000)]) });
        if (!auth.ok) throw new Failure(401, 'Bitte erneut mit dem Teamzugang anmelden.');
        const user = row(await boundedJson(auth)); if (user.id !== input.scope.actorId) throw new Failure(403, 'Der Teamzugang hat sich geändert.');
        const access = await dependencies.fetch(`${base.origin}/rest/v1/rpc/neo_voice_authorize`, { method: 'POST', headers, redirect: 'error', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10_000)]), body: JSON.stringify({ p_tenant_id: input.scope.tenantId, p_subject_id: input.scope.subjectId, p_assessment_id: input.scope.assessmentId ?? null }) });
        if (!access.ok || await boundedJson(access, 1024) !== true) throw new Failure(403, 'Die aktuelle Freigabe für diese Person fehlt.');
      };
      await authorize();
      const status = await dependencies.engine.status();
      if (operation === 'status') {
        await authorize();
        return response.status(200).json({ ok: true, scopeKey: scopeKey(input.scope), transcriptionReady: status.transcriptionReady, modelReady: false, engine: 'whisper.cpp-vercel', capabilities: { acousticWakeWord: false, diarization: false, semanticRoles: false } });
      }
      if (!status.transcriptionReady) throw new Failure(503, 'Die geprüfte Linux-Sprachengine ist auf Vercel noch nicht bereitgestellt.');
      const result = await dependencies.engine.transcribe(input.audio!, abort.signal);
      if (typeof result.text !== 'string' || result.text.length > 6000 || result.engine !== 'whisper.cpp-vercel') throw new Failure(502, 'Die Sprachverarbeitung hat keine gültige Antwort geliefert.');
      await authorize(); abort.signal.throwIfAborted();
      return response.status(200).json({ ok: true, scopeKey: scopeKey(input.scope), text: result.text, engine: result.engine });
    } catch (error) {
      const status = error instanceof Failure ? error.status : error instanceof Error && error.message === 'busy' ? 429 : error instanceof Error && error.message === 'invalid-audio' ? 400 : abort.signal.aborted ? 499 : 503;
      const message = error instanceof Failure ? error.message : status === 429 ? 'Die Sprachverarbeitung ist ausgelastet. Bitte den Abschnitt erneut erfassen.' : status === 400 ? 'Der Audioabschnitt ist ungültig.' : status === 499 ? 'Die Anfrage wurde abgebrochen.' : 'Die eigene NEO-Sprachverarbeitung ist derzeit nicht verfügbar.';
      return response.status(status).json({ ok: false, error: message });
    } finally { clearTimeout(timeout); request.off?.('aborted', onAbort); }
  };
}
