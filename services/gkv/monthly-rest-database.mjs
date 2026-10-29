import { createHmac, randomUUID } from 'node:crypto';
import { isUuid } from './storage.mjs';
import { monthlySupabaseConfig, monthlyJson } from './monthly-auth.mjs';

/** Fixed Supabase endpoint, personal bearer and separate worker authentication.
 * No service-role key, caller URL, client-selected identity or arbitrary SQL. */
export function monthlyRestDatabase({config, tenantId, principal, authorization, workerKeyId, workerKey, http = fetch}) {
  const {url,key} = monthlySupabaseConfig(config);
  if (!isUuid(tenantId) || !isUuid(principal.actorId) || !isUuid(principal.sessionId) || !isUuid(workerKeyId)
    || !(workerKey instanceof Uint8Array) || workerKey.length !== 32) throw Error('MONTHLY_CONFIGURATION');
  const secret = Buffer.from(workerKey);
  async function call(operation, args) {
    const envelope = JSON.stringify({version: 1, tenantId, ...principal, keyId: workerKeyId, issuedAt: Date.now(), nonce: randomUUID(), operation, args});
    const mac = createHmac('sha256', secret).update('gkv-monthly-worker-v1\n').update(envelope).digest('hex');
    const response = await http(`${url}/rest/v1/rpc/gkv_monthly_worker_command`, {method: 'POST', redirect: 'error', cache: 'no-store',
      headers: {Authorization: authorization, apikey: key, 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Encoding': 'identity'},
      signal: AbortSignal.timeout(15000), body: JSON.stringify({p_envelope: envelope, p_mac: mac})});
    const result = await monthlyJson(response);
    if (!response.ok) throw Error(result?.code === '42501' ? 'MONTHLY_FORBIDDEN' : result?.code === '40001' ? 'MONTHLY_STALE'
      : result?.code === '23505' ? 'MONTHLY_SIGNATURE_REUSED' : 'MONTHLY_UNAVAILABLE');
    return result;
  }
  const context = async (operation, input) => {
    const result = await call(operation, input);
    if (result?.actorId !== principal.actorId || result?.sessionId !== principal.sessionId) throw Error('MONTHLY_AUTH');
    return result;
  };
  return {context: input => context('context', input), readContext: input => context('archive', input),
    issue: receipt => call('issue', receipt), receiptStatus: receipt => call('receipt-status', receipt),
    close: () => secret.fill(0)};
}
