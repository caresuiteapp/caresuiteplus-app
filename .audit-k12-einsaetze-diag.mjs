#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)));
for (const file of ['.env.local', '.env']) {
  const p = join(root, file);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  '';
const username = process.env.AUDIT_CLIENT_USERNAME ?? '';
const code = process.env.AUDIT_CLIENT_PORTAL_CODE ?? '';

const loginRes = await fetch(`${url}/functions/v1/client-portal-login`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    apikey: key,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ username, code }),
});
const login = await loginRes.json();
if (!login.sessionToken) {
  console.log(JSON.stringify({ ok: false, step: 'login', login }, null, 2));
  process.exit(1);
}

const token = login.supabaseAccessToken;
const clientId = login.clientId;
const tenantId = login.tenantId;

const visitsRes = await fetch(
  `${url}/rest/v1/assist_visits?tenant_id=eq.${tenantId}&client_id=eq.${clientId}&planning_status=neq.draft&select=id,title,planned_start_at&limit=3`,
  {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  },
);
const visits = await visitsRes.json();

const countRes = await fetch(
  `${url}/rest/v1/assist_visits?tenant_id=eq.${tenantId}&client_id=eq.${clientId}&planning_status=neq.draft&select=id`,
  {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      Prefer: 'count=exact',
    },
  },
);

const embedSelect =
  'id,title,planned_start_at,clients(first_name,last_name),employees(first_name,last_name)';
const embedRes = await fetch(
  `${url}/rest/v1/assist_visits?tenant_id=eq.${tenantId}&client_id=eq.${clientId}&planning_status=neq.draft&select=${encodeURIComponent(embedSelect)}&limit=3`,
  {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      Prefer: 'count=exact',
    },
  },
);
const embedBody = await embedRes.json();

const anonRes = await fetch(
  `${url}/rest/v1/assist_visits?tenant_id=eq.${tenantId}&client_id=eq.${clientId}&planning_status=neq.draft&select=id&limit=1`,
  { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json', Prefer: 'count=exact' } },
);

console.log(
  JSON.stringify(
    {
      ok: true,
      clientId,
      tenantId,
      visitsStatus: visitsRes.status,
      visitsSample: visits,
      contentRange: countRes.headers.get('content-range'),
      embedStatus: embedRes.status,
      embedContentRange: embedRes.headers.get('content-range'),
      embedBody,
      anonStatus: anonRes.status,
      anonContentRange: anonRes.headers.get('content-range'),
      anonBody: await anonRes.json().catch(() => null),
    },
    null,
    2,
  ),
);
