/**
 * Idempotent employee portal account repair for E2E/P0 test tenants only.
 */
import { hashSecret } from './portalAccountCrypto.mjs';
import { pick, PLACEHOLDER_RE } from './auditSupabaseClient.mjs';

export const E2E_TENANT_ID = 'a4ba83bd-65db-46cf-8cf7-61492cc78315';
export const E2E_EMPLOYEE_ID = '911a9b50-0325-45ce-a1ce-87cc9376c816';
export const P0_EMPLOYEE_B_ID = 'c0e5e001-e001-4000-8000-000000000001';
export const P0_MHI_EMPLOYEE_ID = 'c0e5e002-e002-4000-8000-000000000002';
export const LIVE_TENANT_BLOCKLIST = ['56180c22-b894-4fab-b55e-a563c94dd6e7'];

export function normalizePortalUsername(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function employeeEnvCreds(env, keys = ['AUDIT_EMPLOYEE_USERNAME', 'TEST_EMPLOYEE_USERNAME']) {
  const username = pick(env, keys);
  const password = pick(env, ['AUDIT_EMPLOYEE_PASSWORD', 'TEST_EMPLOYEE_PASSWORD']);
  return { username: username ? normalizePortalUsername(username) : '', password };
}

export function validateEmployeeEnv(env, usernameKeys) {
  const { username, password } = employeeEnvCreds(env, usernameKeys);
  if (!username || !password) {
    return { ok: false, failureClass: 'env_missing' };
  }
  if (PLACEHOLDER_RE.test(username) || PLACEHOLDER_RE.test(password)) {
    return { ok: false, failureClass: 'env_placeholder' };
  }
  return { ok: true, username, password };
}

function assertSafeTenant(tenantId) {
  if (LIVE_TENANT_BLOCKLIST.includes(tenantId)) {
    return { ok: false, failureClass: 'live_tenant_blocked' };
  }
  return { ok: true };
}

export async function repairEmployeePortalAccount(adminClient, env, options = {}) {
  const tenantId = options.tenantId ?? E2E_TENANT_ID;
  const employeeId = options.employeeId ?? E2E_EMPLOYEE_ID;
  const usernameKeys = options.usernameEnvKeys ?? ['AUDIT_EMPLOYEE_USERNAME', 'TEST_EMPLOYEE_USERNAME'];
  const repairMode = options.repairMode ?? 'p0_audit_ready';

  const tenantGuard = assertSafeTenant(tenantId);
  if (!tenantGuard.ok) {
    return { ok: false, diag: { failureClass: tenantGuard.failureClass, failureStep: 'tenant_guard' } };
  }

  const diag = {
    accountFound: false,
    accountRepaired: false,
    employeeFound: false,
    employeeActive: false,
    tenantLinked: false,
    usernameAligned: false,
    duplicateAccounts: 0,
    failureClass: null,
    failureStep: null,
    repairMode,
  };

  const creds = validateEmployeeEnv(env, usernameKeys);
  if (!creds.ok) {
    diag.failureClass = creds.failureClass;
    diag.failureStep = 'env';
    return { ok: false, diag };
  }

  const { username, password } = creds;

  const dupRes = await adminClient.restSelect(
    'employee_portal_accounts',
    `username=ilike.${encodeURIComponent(username)}&select=id,tenant_id,employee_id,status`,
  );
  if (dupRes.ok && Array.isArray(dupRes.data)) {
    diag.duplicateAccounts = dupRes.data.filter((row) => row.status !== 'archived').length;
  }

  const empRow = await adminClient.restSelect(
    'employees',
    `id=eq.${employeeId}&tenant_id=eq.${tenantId}&select=id,status,deleted_at,first_name,last_name`,
  );
  if (!empRow.ok || !Array.isArray(empRow.data) || !empRow.data.length) {
    diag.failureClass = 'employee_not_linked';
    diag.failureStep = 'employee_lookup';
    return { ok: false, diag };
  }
  diag.employeeFound = true;
  const emp = empRow.data[0];
  diag.employeeActive = !emp.deleted_at && String(emp.status ?? '').toLowerCase() !== 'inactive';

  const accRes = await adminClient.restSelect(
    'employee_portal_accounts',
    `tenant_id=eq.${tenantId}&employee_id=eq.${employeeId}&select=id,username,status,first_login_completed`,
  );
  if (!accRes.ok) {
    diag.failureClass = 'supabase_error';
    diag.failureStep = 'account_lookup';
    return { ok: false, diag };
  }

  const account = Array.isArray(accRes.data) && accRes.data.length ? accRes.data[0] : null;
  diag.accountFound = Boolean(account);
  diag.tenantLinked = true;

  const now = new Date().toISOString();
  const tempHash = await hashSecret(password, `cs-${Date.now().toString(36)}`);

  const patchBody =
    repairMode === 'first_login_otp'
      ? {
          username,
          status: 'pending_first_login',
          must_change_password: true,
          first_login_completed: false,
          temporary_password_hash: tempHash,
          temporary_password_created_at: now,
          temporary_password_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          blocked_at: null,
          blocked_by: null,
          blocked_reason: null,
        }
      : {
          username,
          status: 'active',
          must_change_password: false,
          first_login_completed: true,
          temporary_password_hash: tempHash,
          temporary_password_created_at: now,
          temporary_password_expires_at: null,
          blocked_at: null,
          blocked_by: null,
          blocked_reason: null,
        };

  let repairOk;
  if (account) {
    diag.usernameAligned = normalizePortalUsername(account.username) === username;
    repairOk = await adminClient.restPatch(
      'employee_portal_accounts',
      `id=eq.${account.id}`,
      patchBody,
    );
  } else {
    repairOk = await adminClient.restUpsert(
      'employee_portal_accounts',
      {
        tenant_id: tenantId,
        employee_id: employeeId,
        ...patchBody,
      },
      'tenant_id,employee_id',
    );
    diag.usernameAligned = true;
  }

  if (!repairOk.ok) {
    diag.failureClass = repairOk.error?.errorClass ?? 'supabase_error';
    diag.failureStep = 'account_upsert';
    return { ok: false, diag };
  }

  diag.accountRepaired = true;
  diag.usernameAligned = true;
  return { ok: true, diag, username, employeeId, tenantId };
}

export async function tryEmployeePortalLogin(publicClient, username, password) {
  const { url, key } = publicClient;
  const res = await fetch(`${url}/functions/v1/employee-portal-login`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username: normalizePortalUsername(username), password }),
  });
  const data = await res.json().catch(() => ({}));
  const ok = res.ok && Boolean(data.sessionToken ?? data.ok);
  return {
    ok,
    httpStatus: res.status,
    failureClass: data.errorClass ?? (res.status === 401 ? 'invalid_password' : 'login_failed'),
    error: data.error ?? null,
    hasSession: Boolean(data.sessionToken),
    mustChangePassword: Boolean(data.mustChangePassword),
  };
}

export async function diagnoseLivePortalLogin(publicClient, username, password) {
  return tryEmployeePortalLogin(publicClient, username, password);
}
