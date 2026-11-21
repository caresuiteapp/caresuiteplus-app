import { assertNeoScope, assertNeoSegments, neoScopeKey, type NeoScope } from '../../../src/ai/neo/neoDomain.ts';
type Dependencies = {
  authorize: (request: Request, scope: NeoScope) => Promise<boolean>;
  serviceUrl: string; serviceToken: string; fetcher?: typeof fetch;
};
export function createNeoGatewayHandler(deps: Dependencies) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { ok: false, error: 'Diese Methode ist nicht verfügbar.' });
    try {
      if (!request.headers.get('Authorization')?.startsWith('Bearer ')) return reply(401, { ok: false, error: 'Bitte mit dem Teamzugang anmelden.' });
      const reader = request.body?.getReader(); if (!reader) return reply(400, { ok: false, error: 'Die Anfrage ist leer.' });
      const chunks: Uint8Array[] = []; let length = 0;
      while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 900000) { await reader.cancel(); return reply(413, { ok: false, error: 'Der Sprachabschnitt ist zu lang.' }); } chunks.push(value); }
      const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const input = JSON.parse(new TextDecoder().decode(bytes));
      if (!input || typeof input !== 'object' || Array.isArray(input) || !['status', 'transcribe', 'analyze'].includes(input.operation)) return reply(400, { ok: false, error: 'Unbekannte NEO-Anfrage.' });
      const scope = input.scope as NeoScope; assertNeoScope(scope);
      if (!await deps.authorize(request, scope)) return reply(403, { ok: false, error: 'Für diese Person oder diesen Bereich fehlt die aktuelle Berechtigung.' });
      if (!deps.serviceUrl || deps.serviceToken.length < 32) return reply(503, { ok: false, error: 'Der eigene NEO-Sprachdienst ist noch nicht eingerichtet.' });
      const base = new URL(deps.serviceUrl);
      if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) return reply(503, { ok: false, error: 'Die NEO-Dienstadresse muss als sichere eigene Serververbindung eingerichtet werden.' });
      if (input.operation === 'transcribe' && (typeof input.audio !== 'string' || input.audio.length > 700000)) return reply(400, { ok: false, error: 'Ungültiger Audioabschnitt.' });
      if (input.operation === 'analyze') assertNeoSegments(input.segments);
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(input.operation === 'status' ? 8000 : 95000)]);
      const response = await (deps.fetcher ?? fetch)(new URL(`v1/${input.operation}`, base.href.endsWith('/') ? base : new URL(base.href + '/')), { method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deps.serviceToken}` },
        body: JSON.stringify(input.operation === 'transcribe' ? { audio: input.audio } : input.operation === 'analyze' ? { segments: input.segments } : {}) });
      const raw = await response.text(); if (raw.length > 250000) throw Error('invalid-service-response');
      const result = JSON.parse(raw);
      if (!response.ok || result.ok !== true) return reply(response.status === 429 ? 429 : 503, { ok: false, error: result.error === 'reasoning-not-configured' ? 'Ein eigenes Sprachmodell ist noch nicht eingerichtet. Die belegte NEO-Zuordnung ist bereits ohne Sprachmodell nutzbar.' : result.error === 'busy' ? 'Der eigene Sprachdienst ist ausgelastet. Bitte den Abschnitt erneut erfassen.' : 'Der eigene NEO-Dienst konnte diesen Abschnitt nicht verarbeiten.' });
      // Authorization may be revoked while inference is running; never deliver a stale case response.
      if (!await deps.authorize(request, scope)) return reply(403, { ok: false, error: 'Die Berechtigung wurde während der Verarbeitung geändert.' });
      return reply(200, { ...result, ok: true, scopeKey: neoScopeKey(scope) });
    } catch { return reply(400, { ok: false, error: 'Die NEO-Anfrage konnte nicht abgeschlossen werden. Bitte Person, Verbindung und Abschnitt prüfen.' }); }
  };
}
