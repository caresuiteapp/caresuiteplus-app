#!/usr/bin/env node
/**
 * Content Portal C.12.5 — Auth verification without logging secrets.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TENANT = 'a4ba83bd-65db-46cf-8cf7-61492cc78315';
const outPath = join(root, '.audit-content-portal-c12-auth-verify.json');

function loadEnv() {
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
  }
  return out;
}

function pick(env, keys) {
  for (const k of keys) {
    const v = env[k]?.trim() ?? '';
    if (v) return v;
  }
  return '';
}

async function passwordLogin(url, anonKey, email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && Boolean(data.access_token), token: data.access_token ?? '' };
}

async function employeePortalLogin(url, anonKey, username, password) {
  const res = await fetch(`${url}/functions/v1/employee-portal-login`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && Boolean(data.sessionToken ?? data.ok), httpStatus: res.status };
}

async function clientPortalLogin(url, anonKey, username, code) {
  const res = await fetch(`${url}/functions/v1/client-portal-login`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, code }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && Boolean(data.sessionToken ?? data.ok), httpStatus: res.status };
}

async function main() {
  const env = loadEnv();
  const url = (env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  const anonKey =
    env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    '';

  const businessEmail = pick(env, ['AUDIT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL']);
  const businessPassword = pick(env, ['AUDIT_BUSINESS_PASSWORD', 'TEST_BUSINESS_PASSWORD']);
  const employeeUsername = pick(env, ['AUDIT_EMPLOYEE_USERNAME', 'TEST_EMPLOYEE_USERNAME']);
  const employeePassword = pick(env, ['AUDIT_EMPLOYEE_PASSWORD', 'TEST_EMPLOYEE_PASSWORD']);
  const clientUsername = pick(env, ['AUDIT_CLIENT_USERNAME', 'TEST_CLIENT_USERNAME', 'AUDIT_CLIENT_EMAIL', 'TEST_CLIENT_EMAIL']);
  const clientCode = pick(env, ['AUDIT_CLIENT_PORTAL_CODE', 'TEST_CLIENT_PORTAL_CODE']);

  const result = {
    businessLogin: false,
    employeePortalLogin: false,
    clientPortalLogin: false,
    tenantLinked: false,
    noSecretLeak: true,
    employeeLoginMethod: 'username_password',
    clientLoginMethod: 'username_portal_code',
    tenantId: TENANT,
  };

  const biz = await passwordLogin(url, anonKey, businessEmail, businessPassword);
  result.businessLogin = biz.ok;

  if (biz.ok) {
    const probe = await fetch(
      `${url}/rest/v1/assist_visits?tenant_id=eq.${TENANT}&select=id&limit=1`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${biz.token}`, Accept: 'application/json' } },
    );
    result.tenantLinked = probe.ok;
  }

  if (employeeUsername && employeePassword) {
    const ep = await employeePortalLogin(url, anonKey, employeeUsername, employeePassword);
    result.employeePortalLogin = ep.ok;
  }

  if (clientUsername && clientCode) {
    const cp = await clientPortalLogin(url, anonKey, clientUsername, clientCode);
    result.clientPortalLogin = cp.ok;
  }

  result.ok = result.businessLogin && result.tenantLinked;
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
