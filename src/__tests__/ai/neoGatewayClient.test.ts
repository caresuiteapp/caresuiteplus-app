import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkNeoService, transcribeNeoAudio } from '@/ai/neo/neoGateway';
import { neoScopeKey } from '@/ai/neo/neoDomain';
const api = vi.hoisted(() => ({ user: vi.fn(), session: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ auth: { getUser: api.user, getSession: api.session } }) }));
const scope = { tenantId: '11111111-1111-4111-8111-111111111111', actorId: '22222222-2222-4222-8222-222222222222', subjectId: '33333333-3333-4333-8333-333333333333' };
beforeEach(() => { vi.resetAllMocks(); api.user.mockResolvedValue({ data: { user: { id: scope.actorId } }, error: null }); api.session.mockResolvedValue({ data: { session: { access_token: 'fixture-user-token' } }, error: null }); });
afterEach(() => vi.unstubAllGlobals());
describe('NEO direct Vercel transport', () => {
  it('uses only the configured CareSuite endpoint and user bearer, with honest readiness', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, scopeKey: neoScopeKey(scope), transcriptionReady: false }))); vi.stubGlobal('fetch', fetcher);
    expect(await checkNeoService(scope, new AbortController().signal)).toBe(false);
    expect(fetcher.mock.calls[0][0]).toBe('https://www.caresuiteplus.app/api/neo/status');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer fixture-user-token'); expect(api.user).toHaveBeenCalledTimes(2);
  });
  it('does not deliver text after an account changes while a request is running', async () => {
    api.user.mockResolvedValueOnce({ data: { user: { id: scope.actorId } }, error: null }).mockResolvedValueOnce({ data: { user: { id: scope.subjectId } }, error: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, scopeKey: neoScopeKey(scope), text: 'Vertraulicher Wortlaut' }))));
    await expect(transcribeNeoAudio(scope, new Uint8Array(120), new AbortController().signal)).rejects.toThrow('gewechselt');
  });
  it('rejects cross-case replies and never retries against another provider', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, scopeKey: 'another-case', transcriptionReady: true }))); vi.stubGlobal('fetch', fetcher);
    await expect(checkNeoService(scope, new AbortController().signal)).rejects.toThrow('nicht bereit'); expect(fetcher).toHaveBeenCalledOnce();
  });
});
