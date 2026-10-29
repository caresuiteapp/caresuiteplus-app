// Shared with the stateless gateway; do not pull the host's SQLite archive into
// a serverless runtime merely to validate an identifier.
const isUuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);

export function monthlySupabaseConfig(config) {
  const url = new URL(config.url);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !config.key) throw Error('MONTHLY_CONFIGURATION');
  return { url: url.origin, key: config.key };
}
export async function monthlyJson(response, max = 2_850_000) {
  // Fetch decodes HTTP compression. Bound the decoded stream as well; the
  // native mTLS transport separately rejects compressed host replies.
  if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(response.headers.get('content-type') || '')) throw Error('MONTHLY_UNAVAILABLE');
  const reader = response.body?.getReader(); if (!reader) throw Error('MONTHLY_UNAVAILABLE');
  const parts = []; let size = 0;
  try { while (true) { const {done,value} = await reader.read(); if (done) break; size += value.length;
    if (size > max) { await reader.cancel(); throw Error('MONTHLY_UNAVAILABLE'); } parts.push(value); } }
  finally { reader.releaseLock(); }
  return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(parts)));
}
/** The decoded claims are usable only after the fixed Auth server accepts this
 * exact bearer token. A live session row is checked again inside every SQL call. */
export async function authenticateMonthly(config, authorization, http = fetch) {
  if (typeof authorization !== 'string' || authorization.length > 8192 || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization)) throw Error('MONTHLY_AUTH');
  const {url,key} = monthlySupabaseConfig(config);
  const response = await http(`${url}/auth/v1/user`, {headers: {Authorization: authorization, apikey: key, Accept: 'application/json', 'Accept-Encoding': 'identity'},
    redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000)});
  if (!response.ok) throw Error(response.status === 401 || response.status === 403 ? 'MONTHLY_AUTH' : 'MONTHLY_UNAVAILABLE');
  const user = await monthlyJson(response, 65536);
  let claims; try { claims = JSON.parse(Buffer.from(authorization.split('.')[1], 'base64url').toString('utf8')); } catch { throw Error('MONTHLY_AUTH'); }
  if (!isUuid(user.id) || user.is_anonymous === true || claims.sub !== user.id || !isUuid(claims.session_id)
    || claims.role !== 'authenticated' || claims.iss !== `${url}/auth/v1` || claims.is_anonymous === true
    || !(claims.aud === 'authenticated' || Array.isArray(claims.aud) && claims.aud.includes('authenticated'))
    || !Number.isSafeInteger(claims.exp) || claims.exp <= Date.now() / 1000) throw Error('MONTHLY_AUTH');
  return Object.freeze({actorId: user.id, sessionId: claims.session_id});
}
