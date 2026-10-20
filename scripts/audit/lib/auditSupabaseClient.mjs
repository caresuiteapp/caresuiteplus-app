/**
 * Central Supabase client factory for Content Portal audit scripts.
 * Never logs secret values.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const PLACEHOLDER_RE =
  /DEIN_|CHANGE_ME|placeholder|example\.com|changeme|^password$|^echter-|^echtes-|^\.\.\.$|^test@test$|DEIN_SUPABASE|PLACEHOLDER/i;

export function loadAuditEnv() {
  const path = join(root, '.env');
  const out = { ...process.env };
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
    if (!process.env[key]) process.env[key] = val;
  }
  return out;
}

export function pick(env, keys) {
  for (const k of keys) {
    const v = env[k]?.trim() ?? '';
    if (v) return v;
  }
  return '';
}

export function pickWithKey(env, keys) {
  for (const k of keys) {
    const v = env[k]?.trim() ?? '';
    if (v) return { value: v, envKeyName: k };
  }
  return { value: '', envKeyName: null };
}

export function getSupabaseUrl(env = process.env) {
  const picked = pickWithKey(env, ['EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_URL']);
  return {
    value: picked.value.replace(/\/$/, ''),
    envKeyName: picked.envKeyName,
  };
}

export function getPublishableKey(env = process.env) {
  return pickWithKey(env, [
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
  ]);
}

export function getServiceRoleKey(env = process.env) {
  return pickWithKey(env, ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'SUPABASE_SERVICE_ROLE']);
}

export function redactSecret(value) {
  const v = String(value ?? '');
  if (!v) return '(empty)';
  if (v.length <= 8) return '***';
  return `${v.slice(0, 4)}…${v.slice(-4)} (${v.length} chars)`;
}

export function assertNoPlaceholderSecrets(env, keys) {
  const blockers = [];
  for (const key of keys) {
    const value = env[key]?.trim() ?? '';
    if (value && PLACEHOLDER_RE.test(value)) {
      blockers.push({ envKeyName: key, reason: 'placeholder' });
    }
  }
  if (blockers.length > 0) {
    const err = new Error('placeholder_secrets_detected');
    err.blockers = blockers;
    throw err;
  }
}

export function classifySupabaseError(text) {
  const msg = String(text ?? '');
  if (/invalid api key/i.test(msg)) return 'invalid_api_key';
  if (/permission denied/i.test(msg)) return 'permission_denied';
  if (/invalid login|invalid_credentials/i.test(msg)) return 'invalid_credentials';
  if (/jwt expired/i.test(msg)) return 'jwt_expired';
  return 'supabase_error';
}

export function formatClientError(clientType, envKeyName, errorText) {
  return {
    clientType,
    envKeyName,
    errorClass: classifySupabaseError(errorText),
    message: String(errorText ?? '').slice(0, 500),
  };
}

async function restRequest(url, apiKey, bearerKey, path, options = {}) {
  const res = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${bearerKey}`,
      Accept: 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data, text };
}

export function createAuditPublicClient(env = loadAuditEnv()) {
  const { value: url, envKeyName: urlKey } = getSupabaseUrl(env);
  const { value: key, envKeyName: keyName } = getPublishableKey(env);
  const clientType = 'public';

  return {
    clientType,
    url,
    key,
    urlEnvKeyName: urlKey,
    keyEnvKeyName: keyName,
    async passwordLogin(email, password) {
      const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.access_token) {
        const detail = data.error_description ?? data.msg ?? data.message ?? data.error ?? res.status;
        return {
          ok: false,
          error: formatClientError(clientType, keyName, detail),
        };
      }
      return { ok: true, token: data.access_token };
    },
    async restSelect(table, query) {
      const result = await restRequest(url, key, key, `/rest/v1/${table}?${query}`);
      if (!result.ok) {
        return {
          ok: false,
          error: formatClientError(clientType, keyName, result.text),
          data: null,
        };
      }
      return { ok: true, data: result.data };
    },
    async restSelectAsUser(table, query, userToken) {
      const result = await restRequest(url, key, userToken, `/rest/v1/${table}?${query}`);
      if (!result.ok) {
        return {
          ok: false,
          error: formatClientError(clientType, keyName, result.text),
          data: null,
        };
      }
      return { ok: true, data: result.data };
    },
  };
}

export function createAuditAdminClient(env = loadAuditEnv()) {
  const { value: url, envKeyName: urlKey } = getSupabaseUrl(env);
  const { value: key, envKeyName: keyName } = getServiceRoleKey(env);
  const clientType = 'admin';

  return {
    clientType,
    url,
    key,
    urlEnvKeyName: urlKey,
    keyEnvKeyName: keyName,
    async restSelect(table, query) {
      const result = await restRequest(url, key, key, `/rest/v1/${table}?${query}`);
      if (!result.ok) {
        return {
          ok: false,
          error: formatClientError(clientType, keyName, result.text),
          data: null,
        };
      }
      return { ok: true, data: result.data };
    },
    async restUpsert(table, row, onConflict) {
      const result = await restRequest(url, key, key, `/rest/v1/${table}?on_conflict=${onConflict}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(row),
      });
      if (!result.ok) {
        return {
          ok: false,
          error: formatClientError(clientType, keyName, result.text),
        };
      }
      return { ok: true };
    },
    async restUpsertMany(table, rows, onConflict) {
      const result = await restRequest(url, key, key, `/rest/v1/${table}?on_conflict=${onConflict}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(rows),
      });
      if (!result.ok) {
        return {
          ok: false,
          error: formatClientError(clientType, keyName, result.text),
        };
      }
      return { ok: true };
    },
    async restPatch(table, filterQuery, patch) {
      const result = await restRequest(url, key, key, `/rest/v1/${table}?${filterQuery}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(patch),
      });
      if (!result.ok) {
        return {
          ok: false,
          error: formatClientError(clientType, keyName, result.text),
        };
      }
      return { ok: true };
    },
  };
}
