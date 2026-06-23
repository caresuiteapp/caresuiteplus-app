#!/usr/bin/env node
/** A.4.1 env gate — never logs secret values */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)));

function loadEnv() {
  const path = join(root, '.env');
  if (!existsSync(path)) return {};
  const out = {};
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

const env = loadEnv();
const email = pick(env, ['AUDIT_BUSINESS_EMAIL', 'UAT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL', 'BUSINESS_TEST_EMAIL']);
const password = pick(env, ['AUDIT_BUSINESS_PASSWORD', 'UAT_BUSINESS_PASSWORD', 'TEST_BUSINESS_PASSWORD', 'BUSINESS_TEST_PASSWORD']);

const PLACEHOLDER = /DEIN_|CHANGE_ME|placeholder|example\.com|changeme|^password$/i;

async function tryLogin() {
  const url = env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key || !email || !password) return { ok: false, reason: 'missing_env' };
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  const errCode = data.error_code ?? data.error ?? '';
  const errMsg = data.error_description ?? data.msg ?? data.message ?? 'auth_failed';
  return {
    ok: res.ok && Boolean(data.access_token),
    reason: res.ok ? 'ok' : errCode || 'auth_failed',
    httpStatus: res.status,
    errorCategory: /invalid login/i.test(String(errMsg)) ? 'invalid_credentials' : 'other',
  };
}

const placeholder = PLACEHOLDER.test(email) || PLACEHOLDER.test(password);
const result = {
  AUDIT_BUSINESS_EMAIL_present: Boolean(env.AUDIT_BUSINESS_EMAIL?.trim()),
  AUDIT_BUSINESS_EMAIL_empty: !env.AUDIT_BUSINESS_EMAIL?.trim(),
  AUDIT_BUSINESS_PASSWORD_present: Boolean(env.AUDIT_BUSINESS_PASSWORD?.trim()),
  AUDIT_BUSINESS_PASSWORD_empty: !env.AUDIT_BUSINESS_PASSWORD?.trim(),
  credential_email_present: Boolean(email),
  credential_email_empty: !email,
  credential_password_present: Boolean(password),
  credential_password_empty: !password,
  placeholder,
  supabaseUrl: Boolean(env.EXPO_PUBLIC_SUPABASE_URL?.trim()),
  supabaseKey: Boolean((env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY)?.trim()),
  portalEmployeeEmail: Boolean(
    (env.AUDIT_EMPLOYEE_EMAIL ?? env.TEST_EMPLOYEE_EMAIL ?? env.UAT_EMPLOYEE_EMAIL)?.trim(),
  ),
  portalClientEmail: Boolean(
    (env.AUDIT_CLIENT_EMAIL ?? env.TEST_CLIENT_EMAIL ?? env.UAT_CLIENT_EMAIL)?.trim(),
  ),
};

if (!placeholder && email && password) {
  const login = await tryLogin();
  result.supabaseLoginSuccess = login.ok;
  result.supabaseLoginReason = login.ok ? 'ok' : login.reason;
  result.supabaseLoginHttpStatus = login.httpStatus;
  result.supabaseLoginErrorCategory = login.errorCategory;
} else {
  result.supabaseLoginSuccess = false;
  result.supabaseLoginReason = placeholder ? 'placeholder_blocked' : 'missing_credentials';
}

console.log(JSON.stringify(result));
