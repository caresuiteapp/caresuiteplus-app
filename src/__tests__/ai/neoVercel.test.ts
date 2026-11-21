import { describe, expect, it, vi } from 'vitest';
import { createNeoVercelHandler, type NeoVercelResponse } from '../../../api/_lib/neo-vercel-handler';
import { createNeoVercelEngine, validateNeoVercelWav } from '../../../api/_lib/neo-vercel-engine.mjs';
import { encodeNeoWav } from '@/ai/neo/neoAudio';
const scope = { tenantId: '11111111-1111-4111-8111-111111111111', actorId: '22222222-2222-4222-8222-222222222222', subjectId: '33333333-3333-4333-8333-333333333333' };
function fixture(operation: 'status' | 'transcribe' = 'transcribe') {
  const calls: { url: string; options?: RequestInit }[] = []; let authorizations = 0;
  const model = { denied: false, revoke: false, actor: scope.actorId, ready: true, failure: '', malicious: false };
  const engine = { status: vi.fn(async () => ({ transcriptionReady: model.ready })), transcribe: vi.fn(async () => { if (model.failure) throw Error(model.failure); return { text: 'Ich habe keine Schmerzen.', engine: model.malicious ? 'external-cloud' : 'whisper.cpp-vercel' }; }) };
  const fetcher = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: model.actor }));
    if (String(url).endsWith('/rest/v1/rpc/neo_voice_authorize')) { authorizations++; return new Response(JSON.stringify(!model.denied && !(model.revoke && authorizations > 1))); }
    throw Error('Unexpected request destination');
  });
  let status = 0, body: any; const headers: Record<string, string> = {};
  const response: NeoVercelResponse = { status(code) { status = code; return this; }, setHeader(key, value) { headers[key] = value; }, json(value) { body = value; return value; } };
  const env = { EXPO_PUBLIC_SUPABASE_URL: 'https://confirmed.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-key' };
  const request = { method: 'POST', headers: { authorization: 'Bearer user.jwt.token' }, body: { scope: { ...scope }, ...(operation === 'transcribe' ? { audio: Buffer.from(encodeNeoWav(new Float32Array(1600).fill(.02), 16000)).toString('base64') } : {}) } };
  const run = async () => { await createNeoVercelHandler(operation, { fetch: fetcher as typeof fetch, engine, env })(request, response); return { status, body, headers }; };
  return { model, engine, calls, request, env, run };
}
describe('NEO Vercel own-inference route', () => {
  it('checks current user and person authorization before and after inference and returns the pinned scope', async () => {
    const f = fixture(), result = await f.run(); expect(result.status).toBe(200); expect(result.body.text).toBe('Ich habe keine Schmerzen.');
    expect(result.body.scopeKey).toBe(JSON.stringify([scope.tenantId, scope.actorId, scope.subjectId, ''])); expect(f.calls).toHaveLength(4);
    expect(f.calls.every(call => call.url.startsWith('https://confirmed.supabase.co/'))).toBe(true);
    expect(f.calls.every(call => (call.options?.headers as any).Authorization === 'Bearer user.jwt.token' && (call.options?.headers as any).apikey === 'public-key')).toBe(true);
    expect(result.headers['Cache-Control']).toContain('no-store');
  });
  it('does not release transcripts after permission revocation during inference', async () => {
    const f = fixture(); f.model.revoke = true; const result = await f.run(); expect(result.status).toBe(403); expect(result.body).not.toHaveProperty('text'); expect(f.engine.transcribe).toHaveBeenCalledOnce();
  });
  it.each(['denied', 'actor'] as const)('does not enter inference after %s mismatch', async kind => {
    const f = fixture(); if (kind === 'denied') f.model.denied = true; else f.model.actor = scope.subjectId;
    expect((await f.run()).status).toBe(403); expect(f.engine.transcribe).not.toHaveBeenCalled();
  });
  it('reports unavailable deployment honestly without a fallback provider', async () => {
    const f = fixture(); f.model.ready = false; expect((await f.run()).status).toBe(503); expect(f.engine.transcribe).not.toHaveBeenCalled();
    const status = fixture('status'); status.model.ready = false; const result = await status.run(); expect(result.status).toBe(200); expect(result.body).toMatchObject({ transcriptionReady: false, modelReady: false, capabilities: { acousticWakeWord: false, diarization: false, semanticRoles: false } });
  });
  it('rejects malformed or extra submitted fields before access to the backend', async () => {
    const f = fixture(); (f.request.body as any).serviceUrl = 'https://external.example'; expect((await f.run()).status).toBe(400); expect(f.calls).toHaveLength(0);
    const g = fixture(); g.request.body.scope.actorId = 'invalid'; expect((await g.run()).status).toBe(400); expect(g.calls).toHaveLength(0);
  });
  it('rejects absent credentials and methods without inference', async () => {
    const f = fixture(); f.request.headers.authorization = ''; expect((await f.run()).status).toBe(401);
    const g = fixture(); g.request.method = 'GET'; expect((await g.run()).status).toBe(405); expect(g.calls).toHaveLength(0);
  });
  it('requires the configured HTTPS backend without URL credentials', async () => {
    const f = fixture(); f.env.EXPO_PUBLIC_SUPABASE_URL = 'https://name:password@confirmed.supabase.co'; expect((await f.run()).status).toBe(503); expect(f.calls).toHaveLength(0);
  });
  it('keeps engine exceptions and provider responses out of client errors', async () => {
    const f = fixture(); f.model.failure = 'Sensitive conversation content'; const result = await f.run(); expect(result.status).toBe(503); expect(JSON.stringify(result.body)).not.toContain(f.model.failure);
    const g = fixture(); g.model.malicious = true; expect((await g.run()).status).toBe(502);
  });
  it('returns bounded backpressure for a busy CPU worker', async () => {
    const f = fixture(); f.model.failure = 'busy'; expect((await f.run()).status).toBe(429);
  });
  it('validates actual WAV structure and fails closed without verified Linux artifacts', async () => {
    const wav = Buffer.from(encodeNeoWav(new Float32Array(1600).fill(.02), 16000)); expect(validateNeoVercelWav(wav).seconds).toBe(.1);
    const broken = Buffer.from(wav); broken.writeUInt32LE(1, 4); expect(() => validateNeoVercelWav(broken)).toThrow('invalid-audio');
    const engine = createNeoVercelEngine({ assetDirectory: '/nonexistent/neo-verified-artifacts' }); expect(await engine.status()).toEqual({ transcriptionReady: false });
    await expect(engine.transcribe(wav.toString('base64'), new AbortController().signal)).rejects.toThrow('transcription-not-configured');
  });
  it('does not activate an experimental engine merely because artifacts were supplied', async () => {
    const execute = vi.fn(); const engine = createNeoVercelEngine({ enabled: false, assetDirectory: '/any/local/artifact-directory', execute });
    expect(await engine.status()).toEqual({ transcriptionReady: false }); expect(execute).not.toHaveBeenCalled();
  });
});
