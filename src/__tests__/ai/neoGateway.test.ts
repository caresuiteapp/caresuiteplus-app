import { describe, expect, it, vi } from 'vitest';
import { createNeoGatewayHandler } from '../../../supabase/functions/neo-assistant/handler';
import { neoScopeKey } from '@/ai/neo/neoDomain';
const scope = { tenantId: '11111111-1111-4111-8111-111111111111', actorId: '22222222-2222-4222-8222-222222222222', subjectId: '33333333-3333-4333-8333-333333333333' };
const request = (payload: unknown, token = true) => new Request('https://example.test/neo', { method: 'POST', headers: { ...(token ? { Authorization: 'Bearer signed-user-token' } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const reply = (value: object) => new Response(JSON.stringify(value));
describe('NEO authenticated inference gateway', () => {
  it('does not accept anonymous or unauthorized requests', async () => {
    const authorize = vi.fn().mockResolvedValue(false), fetcher = vi.fn(); const handler = createNeoGatewayHandler({ authorize, fetcher, serviceUrl: 'https://own.example/', serviceToken: 's'.repeat(48) });
    expect((await handler(request({ operation: 'status', scope }, false))).status).toBe(401);
    expect((await handler(request({ operation: 'status', scope }))).status).toBe(403); expect(fetcher).not.toHaveBeenCalled();
  });
  it('forwards only audio, never the account/case identity or user token, and pins the result to scope', async () => {
    const authorize = vi.fn().mockResolvedValue(true), fetcher = vi.fn().mockResolvedValue(reply({ ok: true, text: 'Erfasster Wortlaut' }));
    const result = await createNeoGatewayHandler({ authorize, fetcher, serviceUrl: 'https://own.example/', serviceToken: 's'.repeat(48) })(request({ operation: 'transcribe', scope, audio: 'YWJj' }));
    expect(await result.json()).toEqual({ ok: true, text: 'Erfasster Wortlaut', scopeKey: neoScopeKey(scope) });
    const [url, options] = fetcher.mock.calls[0]; expect(url.href).toBe('https://own.example/v1/transcribe');
    expect(JSON.parse(options.body)).toEqual({ audio: 'YWJj' }); expect(options.headers.Authorization).toBe('Bearer ' + 's'.repeat(48)); expect(authorize).toHaveBeenCalledTimes(2);
  });
  it('suppresses a result when access is revoked during inference', async () => {
    const authorize = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const result = await createNeoGatewayHandler({ authorize, fetcher: vi.fn().mockResolvedValue(reply({ ok: true, text: 'Sensitive text' })), serviceUrl: 'https://own.example/', serviceToken: 's'.repeat(48) })(request({ operation: 'transcribe', scope, audio: 'YWJj' }));
    expect(result.status).toBe(403); expect(await result.text()).not.toContain('Sensitive text');
  });
  it.each(['http://own.example/', 'https://user:secret@own.example/', 'https://own.example/?secret=1'])('rejects unsafe service address %s', async serviceUrl => {
    const fetcher = vi.fn(); const result = await createNeoGatewayHandler({ authorize: async () => true, fetcher, serviceUrl, serviceToken: 's'.repeat(48) })(request({ operation: 'status', scope }));
    expect(result.status).toBe(503); expect(fetcher).not.toHaveBeenCalled();
  });
  it('bounds payloads and rejects unrecognized operations and identities', async () => {
    const fetcher = vi.fn(), handler = createNeoGatewayHandler({ authorize: async () => true, fetcher, serviceUrl: 'https://own.example/', serviceToken: 's'.repeat(48) });
    expect((await handler(request({ operation: 'execute-sql', scope }))).status).toBe(400);
    expect((await handler(request({ operation: 'status', scope: { ...scope, actorId: 'anyone' } }))).status).toBe(400);
    expect((await handler(request({ operation: 'transcribe', scope, audio: 'x'.repeat(900001) }))).status).toBe(413); expect(fetcher).not.toHaveBeenCalled();
  });
});
