#!/usr/bin/env node
/**
 * ASSIST LIVE E2E A.4.2.1 — Auth repair verify (read-only, no secrets in stdout).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)));
const outPath = join(root, '.audit-assist-live-e2e-a421-auth-verify-results.json');

const TEST_PFLEGE_TENANT_ID = 'a4ba83bd-65db-46cf-8cf7-61492cc78315';
const DEMO_CLIENT_ID = 'ec4f159f-e794-4326-8b0e-15c0166df1ea';
const DEMO_EMPLOYEE_ID = '911a9b50-0325-45ce-a1ce-87cc9376c816';

const PLACEHOLDER = /DEIN_|CHANGE_ME|placeholder|example\.com|changeme|^password$/i;

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

function envPresent(env, keys) {
  return Boolean(pick(env, keys));
}

function envPlaceholder(env, keys) {
  const v = pick(env, keys);
  return v ? PLACEHOLDER.test(v) : false;
}

function extractProjectRef(url) {
  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return m?.[1] ?? null;
}

async function tryPasswordLogin(url, anonKey, email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  const errMsg = String(data.error_description ?? data.msg ?? data.message ?? data.error ?? '');
  let errorClass = 'unknown';
  if (/invalid login|invalid_credentials/i.test(errMsg) || data.error_code === 'invalid_credentials') {
    errorClass = 'invalid_credentials';
  } else if (/email not confirmed/i.test(errMsg)) errorClass = 'email_not_confirmed';
  else if (/user not found/i.test(errMsg)) errorClass = 'user_not_found';
  else if (/disabled|banned/i.test(errMsg)) errorClass = 'disabled';
  else if (!res.ok) errorClass = 'auth_failed';
  return {
    ok: res.ok && Boolean(data.access_token),
    httpStatus: res.status,
    errorClass,
    accessToken: data.access_token ?? null,
  };
}

async function restSelect(url, key, table, query, bearer) {
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${bearer ?? key}`,
      Accept: 'application/json',
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: JSON.stringify(data), data: null };
  return { ok: true, data };
}

async function tryEmployeePortalLogin(url, anonKey, username, password) {
  const res = await fetch(`${url}/functions/v1/employee-portal-login`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && Boolean(data.sessionToken ?? data.ok), httpStatus: res.status };
}

async function tryClientPortalLogin(url, anonKey, username, code) {
  const res = await fetch(`${url}/functions/v1/client-portal-login`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, code }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && Boolean(data.sessionToken ?? data.ok), httpStatus: res.status };
}

function readNetlifyRef() {
  const path = join(root, 'netlify.toml');
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8');
  const m = text.match(/EXPO_PUBLIC_SUPABASE_URL\s*=\s*"https:\/\/([^.]+)\.supabase\.co"/);
  return m?.[1] ?? null;
}

async function main() {
  const env = loadEnv();
  const result = {
    ok: false,
    phase: 'a421_auth_verify',
    env: {
      supabaseUrlPresent: Boolean(env.EXPO_PUBLIC_SUPABASE_URL?.trim()),
      supabaseUrlEmpty: !env.EXPO_PUBLIC_SUPABASE_URL?.trim(),
      anonKeyPresent: Boolean(
        (env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY)?.trim(),
      ),
      businessEmailPresent: envPresent(env, ['AUDIT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL', 'UAT_BUSINESS_EMAIL']),
      businessPasswordPresent: envPresent(env, [
        'AUDIT_BUSINESS_PASSWORD',
        'TEST_BUSINESS_PASSWORD',
        'UAT_BUSINESS_PASSWORD',
      ]),
      businessEmailPlaceholder: envPlaceholder(env, ['AUDIT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL', 'UAT_BUSINESS_EMAIL']),
      businessPasswordPlaceholder: envPlaceholder(env, [
        'AUDIT_BUSINESS_PASSWORD',
        'TEST_BUSINESS_PASSWORD',
        'UAT_BUSINESS_PASSWORD',
      ]),
      serviceRolePresent: Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
      employeeUsernamePresent: envPresent(env, ['AUDIT_EMPLOYEE_USERNAME', 'TEST_EMPLOYEE_USERNAME', 'UAT_EMPLOYEE_USERNAME']),
      employeePasswordPresent: envPresent(env, ['AUDIT_EMPLOYEE_PASSWORD', 'TEST_EMPLOYEE_PASSWORD', 'UAT_EMPLOYEE_PASSWORD']),
      employeeUsernamePlaceholder: envPlaceholder(env, ['AUDIT_EMPLOYEE_USERNAME', 'TEST_EMPLOYEE_USERNAME']),
      employeePasswordPlaceholder: envPlaceholder(env, ['AUDIT_EMPLOYEE_PASSWORD', 'TEST_EMPLOYEE_PASSWORD']),
      clientUsernamePresent: envPresent(env, [
        'AUDIT_CLIENT_USERNAME',
        'TEST_CLIENT_USERNAME',
        'UAT_CLIENT_USERNAME',
        'AUDIT_CLIENT_EMAIL',
        'TEST_CLIENT_EMAIL',
      ]),
      clientCodePresent: envPresent(env, ['AUDIT_CLIENT_PORTAL_CODE', 'TEST_CLIENT_PORTAL_CODE', 'UAT_CLIENT_PORTAL_CODE']),
      clientUsernamePlaceholder: envPlaceholder(env, ['AUDIT_CLIENT_USERNAME', 'TEST_CLIENT_USERNAME']),
      clientCodePlaceholder: envPlaceholder(env, ['AUDIT_CLIENT_PORTAL_CODE', 'TEST_CLIENT_PORTAL_CODE']),
      placeholderDetected: false,
      envGatePassed: false,
    },
    project: { refFromEnv: null, refFromNetlify: null, mismatch: false },
    auth: { loginSuccess: false, errorClass: null, userId: null },
    tenant: {
      testPflegeUnique: false,
      testPflegeCount: 0,
      tenantId: null,
      assistModuleEnabled: false,
    },
    profile: { present: false, membershipPresent: false, assistAccess: false },
    portals: {
      employeeEnvPresent: false,
      employeeLoginSuccess: false,
      employeeAccessPrepared: false,
      clientEnvPresent: false,
      clientLoginSuccess: false,
      clientAccessPrepared: false,
    },
    demo: { clientPresent: false, employeePresent: false, visitPresent: false },
    validation: {
      assistReachable: false,
      a43FullReleased: false,
      a43PartialReleased: false,
    },
  };

  result.env.placeholderDetected =
    result.env.businessEmailPlaceholder ||
    result.env.businessPasswordPlaceholder ||
    result.env.employeeUsernamePlaceholder ||
    result.env.employeePasswordPlaceholder ||
    result.env.clientUsernamePlaceholder ||
    result.env.clientCodePlaceholder;

  result.env.envGatePassed =
    result.env.supabaseUrlPresent &&
    result.env.anonKeyPresent &&
    result.env.businessEmailPresent &&
    result.env.businessPasswordPresent &&
    !result.env.placeholderDetected;

  result.portals.employeeEnvPresent =
    result.env.employeeUsernamePresent && result.env.employeePasswordPresent && !result.env.employeePasswordPlaceholder;
  result.portals.clientEnvPresent =
    result.env.clientUsernamePresent && result.env.clientCodePresent && !result.env.clientCodePlaceholder;

  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const anonKey =
    env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    '';
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  const businessEmail = pick(env, ['AUDIT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL', 'UAT_BUSINESS_EMAIL']);
  const businessPassword = pick(env, ['AUDIT_BUSINESS_PASSWORD', 'TEST_BUSINESS_PASSWORD', 'UAT_BUSINESS_PASSWORD']);

  result.project.refFromEnv = extractProjectRef(url);
  result.project.refFromNetlify = readNetlifyRef();
  result.project.mismatch =
    Boolean(result.project.refFromEnv && result.project.refFromNetlify) &&
    result.project.refFromEnv !== result.project.refFromNetlify;

  if (!result.env.envGatePassed || result.project.mismatch) {
    result.reason = result.project.mismatch ? 'project_mismatch' : 'env_gate_failed';
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ok: false, reason: result.reason, envGate: result.env.envGatePassed }));
    process.exit(2);
  }

  const dbKey = serviceKey || anonKey;
  const login = await tryPasswordLogin(url, anonKey, businessEmail, businessPassword);
  result.auth.loginSuccess = login.ok;
  result.auth.errorClass = login.ok ? null : login.errorClass;

  if (!login.ok) {
    result.reason = 'business_login_failed';
    result.validation.a43FullReleased = false;
    result.validation.a43PartialReleased = false;
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(
      JSON.stringify({
        ok: false,
        reason: result.reason,
        businessLogin: false,
        errorClass: result.auth.errorClass,
        a43Full: false,
        a43Partial: false,
      }),
    );
    process.exit(2);
  }

  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${login.accessToken}` },
  });
  const userData = await userRes.json().catch(() => ({}));
  result.auth.userId = userData.id ?? null;

  const tenantsRes = await restSelect(url, dbKey, 'tenants', `name=ilike.Test%20Pflege%20GmbH&select=id,name,status`);
  if (tenantsRes.ok && Array.isArray(tenantsRes.data)) {
    result.tenant.testPflegeCount = tenantsRes.data.length;
    result.tenant.testPflegeUnique = tenantsRes.data.length === 1;
    if (result.tenant.testPflegeUnique) result.tenant.tenantId = tenantsRes.data[0].id;
  }

  const tenantId = result.tenant.tenantId ?? TEST_PFLEGE_TENANT_ID;

  const productsRes = await restSelect(
    url,
    dbKey,
    'tenant_products',
    `tenant_id=eq.${tenantId}&product_key=eq.assist&select=product_key,status`,
  );
  if (productsRes.ok && Array.isArray(productsRes.data)) {
    result.tenant.assistModuleEnabled = productsRes.data.some(
      (p) => p.status === 'active' || p.status === 'trial',
    );
  }

  if (result.auth.userId) {
    const profileRes = await restSelect(
      url,
      dbKey,
      'profiles',
      `auth_user_id=eq.${result.auth.userId}&select=id,tenant_id,role_id,status`,
      serviceKey || login.accessToken,
    );
    const profile = profileRes.ok && Array.isArray(profileRes.data) ? profileRes.data[0] : null;
    result.profile.present = Boolean(profile);
    result.profile.membershipPresent = Boolean(profile && profile.tenant_id === tenantId);

    const membershipRes = await restSelect(
      url,
      dbKey,
      'tenant_users',
      `tenant_id=eq.${tenantId}&auth_user_id=eq.${result.auth.userId}&select=id,status`,
      serviceKey || login.accessToken,
    );
    if (membershipRes.ok && Array.isArray(membershipRes.data) && membershipRes.data.length > 0) {
      result.profile.membershipPresent = true;
    }
  }

  result.profile.assistAccess =
    result.tenant.assistModuleEnabled && result.profile.membershipPresent && result.auth.loginSuccess;

  const assistProbe = await restSelect(
    url,
    anonKey,
    'assist_visits',
    `tenant_id=eq.${tenantId}&select=id&limit=1`,
    login.accessToken,
  );
  result.validation.assistReachable = assistProbe.ok;

  const empDb = await restSelect(
    url,
    dbKey,
    'employee_portal_accounts',
    `tenant_id=eq.${tenantId}&select=id&limit=1`,
  );
  result.portals.employeeAccessPrepared = empDb.ok && Array.isArray(empDb.data) && empDb.data.length > 0;

  const clientDb = await restSelect(
    url,
    dbKey,
    'client_portal_access',
    `tenant_id=eq.${tenantId}&portal_enabled=eq.true&select=id&limit=1`,
  );
  result.portals.clientAccessPrepared = clientDb.ok && Array.isArray(clientDb.data) && clientDb.data.length > 0;

  if (result.portals.employeeEnvPresent) {
    const employeeUsername = pick(env, ['AUDIT_EMPLOYEE_USERNAME', 'TEST_EMPLOYEE_USERNAME', 'UAT_EMPLOYEE_USERNAME']);
    const employeePassword = pick(env, ['AUDIT_EMPLOYEE_PASSWORD', 'TEST_EMPLOYEE_PASSWORD', 'UAT_EMPLOYEE_PASSWORD']);
    const epLogin = await tryEmployeePortalLogin(url, anonKey, employeeUsername, employeePassword);
    result.portals.employeeLoginSuccess = epLogin.ok;
  }

  if (result.portals.clientEnvPresent) {
    const clientUsername = pick(env, [
      'AUDIT_CLIENT_USERNAME',
      'TEST_CLIENT_USERNAME',
      'UAT_CLIENT_USERNAME',
      'AUDIT_CLIENT_EMAIL',
      'TEST_CLIENT_EMAIL',
    ]);
    const clientCode = pick(env, ['AUDIT_CLIENT_PORTAL_CODE', 'TEST_CLIENT_PORTAL_CODE', 'UAT_CLIENT_PORTAL_CODE']);
    const cpLogin = await tryClientPortalLogin(url, anonKey, clientUsername, clientCode);
    result.portals.clientLoginSuccess = cpLogin.ok;
  }

  const clientRes = await restSelect(
    url,
    dbKey,
    'clients',
    `tenant_id=eq.${tenantId}&id=eq.${DEMO_CLIENT_ID}&select=id&limit=1`,
  );
  result.demo.clientPresent = clientRes.ok && Array.isArray(clientRes.data) && clientRes.data.length > 0;

  const employeeRes = await restSelect(
    url,
    dbKey,
    'employees',
    `tenant_id=eq.${tenantId}&id=eq.${DEMO_EMPLOYEE_ID}&select=id&limit=1`,
  );
  result.demo.employeePresent = employeeRes.ok && Array.isArray(employeeRes.data) && employeeRes.data.length > 0;

  const visitRes = await restSelect(
    url,
    dbKey,
    'assist_visits',
    `tenant_id=eq.${tenantId}&select=id&limit=1`,
  );
  result.demo.visitPresent = visitRes.ok && Array.isArray(visitRes.data) && visitRes.data.length > 0;

  const demoReady = result.demo.clientPresent && result.demo.employeePresent && result.demo.visitPresent;

  result.validation.a43FullReleased =
    result.auth.loginSuccess &&
    result.validation.assistReachable &&
    result.profile.assistAccess &&
    result.portals.employeeLoginSuccess &&
    result.portals.clientLoginSuccess &&
    demoReady;

  result.validation.a43PartialReleased =
    result.auth.loginSuccess && result.validation.assistReachable && result.profile.assistAccess;

  result.ok = result.validation.a43PartialReleased;
  result.reason = result.ok ? 'a421_verify_ok' : 'a421_verify_partial';

  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({
      ok: result.ok,
      reason: result.reason,
      businessLogin: result.auth.loginSuccess,
      assistReachable: result.validation.assistReachable,
      assistAccess: result.profile.assistAccess,
      employeeEnv: result.portals.employeeEnvPresent,
      employeeLogin: result.portals.employeeLoginSuccess,
      clientEnv: result.portals.clientEnvPresent,
      clientLogin: result.portals.clientLoginSuccess,
      demoReady,
      a43Full: result.validation.a43FullReleased,
      a43Partial: result.validation.a43PartialReleased,
    }),
  );
  process.exit(result.auth.loginSuccess ? 0 : 2);
}

main().catch((err) => {
  const safe = { ok: false, reason: 'script_error', message: err instanceof Error ? err.message : 'error' };
  writeFileSync(outPath, JSON.stringify(safe, null, 2));
  console.log(JSON.stringify(safe));
  process.exit(2);
});
