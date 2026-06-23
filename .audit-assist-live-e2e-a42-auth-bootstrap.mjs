#!/usr/bin/env node
/**
 * ASSIST LIVE E2E A.4.2 — Auth testuser bootstrap (fetch-only, no secrets in stdout).
 */
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)));
const outPath = join(root, '.audit-assist-live-e2e-a42-auth-bootstrap-results.json');

const TEST_PFLEGE_TENANT_ID = 'a4ba83bd-65db-46cf-8cf7-61492cc78315';
const DEMO_CLIENT_ID = 'ec4f159f-e794-4326-8b0e-15c0166df1ea';
const DEMO_EMPLOYEE_ID = '911a9b50-0325-45ce-a1ce-87cc9376c816';
const DEMO_VISIT_ID = 'a0420001-0001-4000-8000-000000000001';

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

function extractProjectRef(url) {
  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return m?.[1] ?? null;
}

async function hashSecret(value, salt) {
  const payload = `${salt}:${value}`;
  const digest = createHash('sha256').update(payload, 'utf8').digest('hex');
  return `sha256:${salt}:${digest}`;
}

async function hashPortalCode(code) {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return hashSecret(normalized, 'portal-code');
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

async function adminListUsers(url, serviceKey, email) {
  const normalized = email.trim().toLowerCase();
  let page = 1;
  while (page <= 10) {
    const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const data = await res.json().catch(() => ({}));
    const users = data.users ?? [];
    const match = users.find((u) => u.email?.toLowerCase() === normalized);
    if (match) {
      return {
        ok: true,
        user: {
          id: match.id,
          emailConfirmed: Boolean(match.email_confirmed_at),
          banned: Boolean(match.banned_until),
        },
      };
    }
    if (users.length < 200) break;
    page += 1;
  }
  return { ok: true, user: null };
}

async function adminCreateUser(url, serviceKey, email, password) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      app_metadata: { role_key: 'business_admin' },
      user_metadata: { display_name: 'Audit Test Admin' },
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, error: data.msg ?? data.message ?? data.error_description ?? null };
}

async function adminUpdateUser(url, serviceKey, userId, password) {
  const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password, email_confirm: true }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, error: data.msg ?? data.message ?? data.error_description ?? null };
}

async function restSelect(url, key, table, query) {
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: JSON.stringify(data), data: null };
  return { ok: true, data };
}

async function restInsert(url, key, table, row, onConflict) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: onConflict ? `resolution=merge-duplicates,return=minimal` : 'return=minimal',
  };
  const res = await fetch(`${url}/rest/v1/${table}${onConflict ? `?on_conflict=${onConflict}` : ''}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: text };
  }
  return { ok: true };
}

async function restPatch(url, key, table, filter, patch) {
  const res = await fetch(`${url}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: text };
  }
  return { ok: true };
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
    phase: 'precheck',
    env: {
      supabaseUrlPresent: Boolean(env.EXPO_PUBLIC_SUPABASE_URL?.trim()),
      anonKeyPresent: Boolean(
        (env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY)?.trim(),
      ),
      businessEmailPresent: Boolean(pick(env, ['AUDIT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL', 'UAT_BUSINESS_EMAIL'])),
      businessPasswordPresent: Boolean(
        pick(env, ['AUDIT_BUSINESS_PASSWORD', 'TEST_BUSINESS_PASSWORD', 'UAT_BUSINESS_PASSWORD']),
      ),
      serviceRolePresent: Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
      employeeUsernamePresent: Boolean(
        pick(env, ['AUDIT_EMPLOYEE_USERNAME', 'TEST_EMPLOYEE_USERNAME', 'UAT_EMPLOYEE_USERNAME']),
      ),
      employeePasswordPresent: Boolean(
        pick(env, ['AUDIT_EMPLOYEE_PASSWORD', 'TEST_EMPLOYEE_PASSWORD', 'UAT_EMPLOYEE_PASSWORD']),
      ),
      clientUsernamePresent: Boolean(
        pick(env, [
          'AUDIT_CLIENT_USERNAME',
          'TEST_CLIENT_USERNAME',
          'UAT_CLIENT_USERNAME',
          'AUDIT_CLIENT_EMAIL',
          'TEST_CLIENT_EMAIL',
        ]),
      ),
      clientCodePresent: Boolean(
        pick(env, ['AUDIT_CLIENT_PORTAL_CODE', 'TEST_CLIENT_PORTAL_CODE', 'UAT_CLIENT_PORTAL_CODE']),
      ),
      placeholderDetected: false,
    },
    project: { refFromEnv: null, refFromNetlify: null, mismatch: false },
    auth: {
      userExists: false,
      userConfirmed: false,
      loginSuccess: false,
      errorClass: null,
      repairAttempted: false,
      repairOk: false,
    },
    tenant: {
      testPflegeUnique: false,
      testPflegeCount: 0,
      tenantId: null,
      assistModuleEnabled: false,
    },
    profile: { present: false, membershipPresent: false, assistAccess: false },
    portals: {
      employeeLoginMethod: 'username_password',
      employeeLoginSuccess: false,
      employeeAccessPrepared: false,
      clientLoginMethod: 'username_portal_code',
      clientLoginSuccess: false,
      clientAccessPrepared: false,
      envNamesForRunner: {
        employee: [
          'AUDIT_EMPLOYEE_USERNAME',
          'AUDIT_EMPLOYEE_PASSWORD',
          'TEST_EMPLOYEE_USERNAME',
          'TEST_EMPLOYEE_PASSWORD',
        ],
        client: [
          'AUDIT_CLIENT_USERNAME',
          'AUDIT_CLIENT_PORTAL_CODE',
          'TEST_CLIENT_USERNAME',
          'TEST_CLIENT_PORTAL_CODE',
        ],
      },
    },
    demo: { visitPrepared: false },
    validation: { assistReachable: false, a43Released: false },
    steps: [],
  };

  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const anonKey =
    env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    '';
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  const businessEmail = pick(env, ['AUDIT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL', 'UAT_BUSINESS_EMAIL']);
  const businessPassword = pick(env, ['AUDIT_BUSINESS_PASSWORD', 'TEST_BUSINESS_PASSWORD', 'UAT_BUSINESS_PASSWORD']);

  result.env.placeholderDetected =
    PLACEHOLDER.test(businessEmail) ||
    PLACEHOLDER.test(businessPassword) ||
    PLACEHOLDER.test(pick(env, ['AUDIT_EMPLOYEE_PASSWORD', 'TEST_EMPLOYEE_PASSWORD'])) ||
    PLACEHOLDER.test(pick(env, ['AUDIT_CLIENT_PORTAL_CODE', 'TEST_CLIENT_PORTAL_CODE']));

  result.project.refFromEnv = extractProjectRef(url);
  result.project.refFromNetlify = readNetlifyRef();
  result.project.mismatch =
    Boolean(result.project.refFromEnv && result.project.refFromNetlify) &&
    result.project.refFromEnv !== result.project.refFromNetlify;

  if (!url || !anonKey || !businessEmail || !businessPassword || result.env.placeholderDetected) {
    result.reason = 'env_gate_failed';
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ok: false, reason: result.reason }));
    process.exit(2);
  }

  if (result.project.mismatch) {
    result.reason = 'project_mismatch';
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ok: false, reason: result.reason }));
    process.exit(2);
  }

  const dbKey = serviceKey || anonKey;

  let login = await tryPasswordLogin(url, anonKey, businessEmail, businessPassword);
  result.auth.loginSuccess = login.ok;
  result.auth.errorClass = login.ok ? null : login.errorClass;

  if (!login.ok && serviceKey && businessEmail) {
    result.auth.repairAttempted = true;
    const found = await adminListUsers(url, serviceKey, businessEmail);
    if (!found.user) {
      const created = await adminCreateUser(url, serviceKey, businessEmail, businessPassword);
      result.auth.userExists = false;
      result.auth.repairOk = created.ok;
      result.steps.push({ step: 'create_user', ok: created.ok, detail: created.error ?? 'ok' });
    } else {
      result.auth.userExists = true;
      result.auth.userConfirmed = found.user.emailConfirmed;
      const updated = await adminUpdateUser(url, serviceKey, found.user.id, businessPassword);
      result.auth.repairOk = updated.ok;
      result.steps.push({ step: 'update_user', ok: updated.ok, detail: updated.error ?? 'ok' });
    }
    login = await tryPasswordLogin(url, anonKey, businessEmail, businessPassword);
    result.auth.loginSuccess = login.ok;
    result.auth.errorClass = login.ok ? null : login.errorClass;
  } else if (serviceKey && businessEmail) {
    const found = await adminListUsers(url, serviceKey, businessEmail);
    if (found.user) {
      result.auth.userExists = true;
      result.auth.userConfirmed = found.user.emailConfirmed;
    }
  }

  if (!login.ok) {
    result.reason = serviceKey ? 'login_failed_after_repair' : 'login_failed_no_service_role';
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ok: false, reason: result.reason, login: false }));
    process.exit(2);
  }

  const tenantsRes = await restSelect(
    url,
    dbKey,
    'tenants',
    `name=ilike.Test%20Pflege%20GmbH&select=id,name,status`,
  );
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

  if (serviceKey && login.accessToken) {
    const userRes = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${login.accessToken}` },
    });
    const userData = await userRes.json().catch(() => ({}));
    const authUserId = userData.id;

    if (authUserId) {
      const profileRes = await restSelect(
        url,
        serviceKey,
        'profiles',
        `auth_user_id=eq.${authUserId}&select=id,tenant_id,role_id`,
      );
      const profile = profileRes.ok && Array.isArray(profileRes.data) ? profileRes.data[0] : null;
      result.profile.present = Boolean(profile);

      const ownerRoleRes = await restSelect(
        url,
        serviceKey,
        'roles',
        `tenant_id=eq.${tenantId}&key=eq.owner&select=id`,
      );
      const ownerRoleId =
        ownerRoleRes.ok && Array.isArray(ownerRoleRes.data) ? ownerRoleRes.data[0]?.id : null;

      if (!profile) {
        const ins = await restInsert(url, serviceKey, 'profiles', {
          auth_user_id: authUserId,
          tenant_id: tenantId,
          role_id: ownerRoleId,
          first_name: 'Audit',
          last_name: 'Test',
          email: businessEmail,
          status: 'active',
        });
        result.profile.present = ins.ok;
        result.steps.push({ step: 'profile_insert', ok: ins.ok });
      } else if (profile.tenant_id !== tenantId) {
        const upd = await restPatch(
          url,
          serviceKey,
          'profiles',
          `auth_user_id=eq.${authUserId}`,
          { tenant_id: tenantId, role_id: ownerRoleId ?? profile.role_id, status: 'active' },
        );
        result.steps.push({ step: 'profile_update', ok: upd.ok });
      }

      const membershipRes = await restSelect(
        url,
        serviceKey,
        'tenant_users',
        `tenant_id=eq.${tenantId}&auth_user_id=eq.${authUserId}&select=id`,
      );
      result.profile.membershipPresent =
        membershipRes.ok && Array.isArray(membershipRes.data) && membershipRes.data.length > 0;

      if (!result.profile.membershipPresent) {
        const tu = await restInsert(url, serviceKey, 'tenant_users', {
          tenant_id: tenantId,
          auth_user_id: authUserId,
          display_name: 'Audit Test Admin',
          first_name: 'Audit',
          last_name: 'Test',
          email: businessEmail,
          username: `audit.test.${randomBytes(3).toString('hex')}`,
          role_key: 'owner',
          status: 'active',
          must_change_password: false,
          first_login_completed: true,
        });
        result.profile.membershipPresent = tu.ok;
        result.steps.push({ step: 'tenant_user_insert', ok: tu.ok });
      }

      if (!result.tenant.assistModuleEnabled) {
        const assistProdRes = await restSelect(url, serviceKey, 'products', `product_key=eq.assist&select=id`);
        const assistProductId =
          assistProdRes.ok && Array.isArray(assistProdRes.data) ? assistProdRes.data[0]?.id : null;
        if (assistProductId) {
          const tp = await restInsert(
            url,
            serviceKey,
            'tenant_products',
            {
              tenant_id: tenantId,
              product_id: assistProductId,
              product_key: 'assist',
              status: 'trial',
              is_default: false,
            },
            'tenant_id,product_id',
          );
          result.tenant.assistModuleEnabled = tp.ok;
          result.steps.push({ step: 'assist_product', ok: tp.ok });
        }
      }
    }
  }

  result.profile.assistAccess = result.tenant.assistModuleEnabled && result.profile.membershipPresent;

  let employeeUsername = pick(env, ['AUDIT_EMPLOYEE_USERNAME', 'TEST_EMPLOYEE_USERNAME', 'UAT_EMPLOYEE_USERNAME']);
  let employeePassword = pick(env, ['AUDIT_EMPLOYEE_PASSWORD', 'TEST_EMPLOYEE_PASSWORD', 'UAT_EMPLOYEE_PASSWORD']);
  if (!employeeUsername) employeeUsername = 'audit.emp.testpflege';

  const clientUsername = pick(env, [
    'AUDIT_CLIENT_USERNAME',
    'TEST_CLIENT_USERNAME',
    'UAT_CLIENT_USERNAME',
    'AUDIT_CLIENT_EMAIL',
    'TEST_CLIENT_EMAIL',
  ]);
  let clientCode = pick(env, ['AUDIT_CLIENT_PORTAL_CODE', 'TEST_CLIENT_PORTAL_CODE', 'UAT_CLIENT_PORTAL_CODE']);

  if (serviceKey) {
    const empRes = await restSelect(
      url,
      serviceKey,
      'employee_portal_accounts',
      `tenant_id=eq.${tenantId}&employee_id=eq.${DEMO_EMPLOYEE_ID}&select=id,username,status`,
    );
    const empAccount =
      empRes.ok && Array.isArray(empRes.data) && empRes.data.length ? empRes.data[0] : null;

    if (empAccount) result.portals.employeeAccessPrepared = true;

    if (!employeePassword) employeePassword = `AuditEmp${randomBytes(4).toString('hex')}!0`;

    const tempHash = await hashSecret(employeePassword, `cs-${Date.now().toString(36)}`);
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    if (!empAccount) {
      const ep = await restInsert(url, serviceKey, 'employee_portal_accounts', {
        tenant_id: tenantId,
        employee_id: DEMO_EMPLOYEE_ID,
        username: employeeUsername,
        status: 'pending_first_login',
        must_change_password: true,
        first_login_completed: false,
        temporary_password_hash: tempHash,
        temporary_password_created_at: now,
        temporary_password_expires_at: expires,
      });
      result.portals.employeeAccessPrepared = ep.ok;
      result.steps.push({ step: 'employee_portal_account', ok: ep.ok });
    } else {
      const epUpd = await restPatch(
        url,
        serviceKey,
        'employee_portal_accounts',
        `id=eq.${empAccount.id}`,
        {
          temporary_password_hash: tempHash,
          temporary_password_created_at: now,
          temporary_password_expires_at: expires,
          status: 'pending_first_login',
          first_login_completed: false,
        },
      );
      result.portals.employeeAccessPrepared = epUpd.ok;
      result.steps.push({ step: 'employee_portal_password_reset', ok: epUpd.ok });
      if (!pick(env, ['AUDIT_EMPLOYEE_USERNAME', 'TEST_EMPLOYEE_USERNAME'])) {
        employeeUsername = empAccount.username;
      }
    }

    const clientRes = await restSelect(
      url,
      serviceKey,
      'client_portal_access',
      `tenant_id=eq.${tenantId}&client_id=eq.${DEMO_CLIENT_ID}&select=id,portal_username,portal_enabled,status`,
    );
    const clientAccess =
      clientRes.ok && Array.isArray(clientRes.data) && clientRes.data.length ? clientRes.data[0] : null;

    if (clientAccess?.portal_enabled) result.portals.clientAccessPrepared = true;

    if (!clientCode) {
      clientCode = `A${randomBytes(2).toString('hex').toUpperCase().slice(0, 2)}${String(
        Math.floor(1000 + Math.random() * 9000),
      )}`;
    }

    const effectiveClientUsername = (clientUsername || clientAccess?.portal_username || 'erika.mustermann').toLowerCase();
    const codeHash = await hashPortalCode(clientCode);

    if (!clientAccess) {
      const cp = await restInsert(url, serviceKey, 'client_portal_access', {
        tenant_id: tenantId,
        client_id: DEMO_CLIENT_ID,
        portal_username: effectiveClientUsername,
        portal_access_code_hash: codeHash,
        portal_enabled: true,
        status: 'aktiv',
        code_created_at: now,
      });
      result.portals.clientAccessPrepared = cp.ok;
      result.steps.push({ step: 'client_portal_access', ok: cp.ok });
    } else {
      const cpUpd = await restPatch(url, serviceKey, 'client_portal_access', `id=eq.${clientAccess.id}`, {
        portal_username: effectiveClientUsername,
        portal_access_code_hash: codeHash,
        portal_enabled: true,
        status: 'aktiv',
        code_rotated_at: now,
      });
      result.portals.clientAccessPrepared = cpUpd.ok;
      result.steps.push({ step: 'client_portal_access_update', ok: cpUpd.ok });
    }

    await restInsert(
      url,
      serviceKey,
      'client_portal_settings',
      {
        tenant_id: tenantId,
        client_id: DEMO_CLIENT_ID,
        show_budget: true,
        show_visit_tracking: false,
        show_documents: true,
        show_messages: true,
      },
      'tenant_id,client_id',
    );

    const today = new Date().toISOString().slice(0, 10);
    const visit = await restInsert(
      url,
      serviceKey,
      'assist_visits',
      {
        id: DEMO_VISIT_ID,
        tenant_id: tenantId,
        client_id: DEMO_CLIENT_ID,
        employee_id: DEMO_EMPLOYEE_ID,
        service_key: 'alltagsbegleitung',
        service_name: 'Alltagsbegleitung',
        title: 'A.4.2 Demo Einsatz Erika',
        assignment_date: today,
        planned_start_at: `${today}T08:00:00+00`,
        planned_end_at: `${today}T09:30:00+00`,
        duration_minutes: 90,
        planning_status: 'confirmed',
        execution_status: 'planned',
        documentation_status: 'pending',
        proof_status: 'none',
        billing_status: 'none',
        canonical_status: 'planned',
      },
      'id',
    );
    result.demo.visitPrepared = visit.ok;
    result.steps.push({ step: 'assist_visit', ok: visit.ok });

    const epLogin = await tryEmployeePortalLogin(url, anonKey, employeeUsername, employeePassword);
    result.portals.employeeLoginSuccess = epLogin.ok;

    const cpLogin = await tryClientPortalLogin(url, anonKey, effectiveClientUsername, clientCode);
    result.portals.clientLoginSuccess = cpLogin.ok;
  }

  const assistProbe = await fetch(
    `${url}/rest/v1/assist_visits?tenant_id=eq.${tenantId}&select=id&limit=1`,
    {
      headers: { apikey: anonKey, Authorization: `Bearer ${login.accessToken}`, Accept: 'application/json' },
    },
  );
  result.validation.assistReachable = assistProbe.ok;

  result.validation.a43Released =
    result.auth.loginSuccess &&
    result.validation.assistReachable &&
    result.portals.employeeLoginSuccess &&
    result.portals.clientLoginSuccess &&
    result.demo.visitPrepared;

  result.ok =
    result.auth.loginSuccess &&
    result.tenant.testPflegeUnique &&
    result.profile.assistAccess;

  result.reason = result.ok ? 'bootstrap_ok' : 'bootstrap_partial';

  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({
      ok: result.ok,
      reason: result.reason,
      businessLogin: result.auth.loginSuccess,
      employeeLogin: result.portals.employeeLoginSuccess,
      clientLogin: result.portals.clientLoginSuccess,
      a43Released: result.validation.a43Released,
    }),
  );
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  const safe = { ok: false, reason: 'script_error', message: err instanceof Error ? err.message : 'error' };
  writeFileSync(outPath, JSON.stringify(safe, null, 2));
  console.log(JSON.stringify(safe));
  process.exit(2);
});
