import { callKimHost } from './kim-host-transport.mjs';
import { readKimHostStatus } from '../../src/lib/gkvExchange/kimHostContract.ts';
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
async function limited(response, max = 32768) {
  const reader = response.body?.getReader(); if (!reader) throw new Error();
  let size = 0; const chunks = [];
  try { while (true) { const r = await reader.read(); if (r.done) break; size += r.value.length; if (size > max) { await reader.cancel(); throw new Error(); } chunks.push(r.value); } }
  finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function createKimHostHandler({ env, fetch: http = fetch }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'KIM_HOST_METHOD' }); }
    const auth = req.headers.authorization;
    if (typeof auth !== 'string' || auth.length > 8192 || !/^Bearer [A-Za-z0-9._~-]+$/.test(auth)) return res.status(401).json({ error: 'KIM_HOST_AUTH' });
    try {
      if (typeof req.body === 'string' && Buffer.byteLength(req.body) > 2048) return res.status(413).json({ error: 'KIM_HOST_INPUT' });
      let input; try { input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { return res.status(400).json({ error: 'KIM_HOST_INPUT' }); }
      if (!input || typeof input !== 'object' || Array.isArray(input) || Buffer.byteLength(JSON.stringify(input)) > 2048
        || Object.keys(input).some(k => !['tenantId','action','requestId'].includes(k)) || !uuid(input.tenantId)
        || !['status','start'].includes(input.action) || (input.action === 'start' ? !uuid(input.requestId) : input.requestId !== undefined)) return res.status(400).json({ error: 'KIM_HOST_INPUT' });
      const url = new URL(env.EXPO_PUBLIC_SUPABASE_URL || ''), key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.hash || url.search || !key) throw new Error();
      const signal = AbortSignal.timeout(15000), headers = { Authorization: auth, apikey: key, 'Content-Type': 'application/json' };
      const user = await http(`${url.origin}/auth/v1/user`, { headers, redirect: 'error', signal });
      if (!user.ok || !uuid((await limited(user)).id)) return res.status(401).json({ error: 'KIM_HOST_AUTH' });
      const access = await http(`${url.origin}/rest/v1/rpc/gkv_exchange_export_allowed`, { method: 'POST', headers, redirect: 'error', signal, body: JSON.stringify({ p_tenant_id: input.tenantId }) });
      if (!access.ok || await limited(access, 128) !== true) return res.status(403).json({ error: 'KIM_HOST_FORBIDDEN' });
      if (!env.KIM_DIAGNOSTIC_HOST_URL) return res.status(200).json({ version: 1, tenantId: input.tenantId, configured: false,
        environment: null, state: 'unconfigured', canStart: false, requestId: null, startedAt: null, completedAt: null, report: null, errorCode: null });
      return res.status(200).json(readKimHostStatus(await callKimHost(env, input), input.tenantId));
    } catch { return res.status(503).json({ error: 'KIM_HOST_UNAVAILABLE' }); }
  };
}
