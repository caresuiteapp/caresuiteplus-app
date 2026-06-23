/**
 * Idempotent employee portal account repair for E2E test tenant only.
 */
import { hashSecret } from './portalAccountCrypto.mjs';
import { pick, PLACEHOLDER_RE } from './auditSupabaseClient.mjs';

export const E2E_TENANT_ID = 'a4ba83bd-65db-46cf-8cf7-61492cc78315';
export const E2E_EMPLOYEE_ID = '911a9b50-0325-45ce-a1ce-87cc9376c816';

export function employeeEnvCreds(env) {
  const username = pick(env, ['AUDIT_EMPLOYEE_USERNAME', 'TEST_EMPLOYEE_USERNAME']);
  const password = pick(env, ['AUDIT_EMPLOYEE_PASSWORD', 'TEST_EMPLOYEE_PASSWORD']);
  return { username, password };
}

export function validateEmployeeEnv(env) {
  const { username, password } = employeeEnvCreds(env);
  if (!username || !password) {
    return { ok: false, failureClass: 'env_missing' };
  }
  if (PLACEHOLDER_RE.test(username) || PLACEHOLDER_RE.test(password)) {
    return { ok: false, failureClass: 'env_placeholder' };
  }
  return { ok: true, username, password };
}

export async function repairEmployeePortalAccount(adminClient, env, options = {}) {
  const tenantId = options.tenantId ?? E2E_TENANT_ID;
  const employeeId = options.employeeId ?? E2E_EMPLOYEE_ID;
  const diag = {
    accountFound: false,
    accountRepaired: false,
    employeeFound: false,
    employeeActive: false,
    tenantLinked: false,
    usernameAligned: false,
    failureClass: null,
    failureStep: null,
  };

  const creds = validateEmployeeEnv(env);
  if (!creds.ok) {
    diag.failureClass = creds.failureClass;
    diag.failureStep = 'env';
    return { ok: false, diag };
  }

  const { username, password } = creds;

  const empRow = await adminClient.restSelect(
    'employees',
    `id=eq.${employeeId}&tenant_id=eq.${tenantId}&select=id,status,deleted_at`,
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
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const tempHash = await hashSecret(password, `cs-${Date.now().toString(36)}`);

  const patchBody = {
    username,
    status: 'pending_first_login',
    must_change_password: true,
    first_login_completed: false,
    temporary_password_hash: tempHash,
    temporary_password_created_at: now,
    temporary_password_expires_at: expires,
    blocked_at: null,
    blocked_by: null,
    blocked_reason: null,
  };

  let repairOk;
  if (account) {
    diag.usernameAligned = account.username?.toLowerCase() === username.toLowerCase();
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
      'tenant_id,username',
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
  return { ok: true, diag, username };
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
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  const ok = res.ok && Boolean(data.sessionToken ?? data.ok);
  let failureClass = 'unknown';
  if (!ok) {
    if (res.status === 401) failureClass = 'invalid_password';
    else if (res.status === 400) failureClass = 'invalid_request';
    else if (res.status >= 500) failureClass = 'edge_function_failed';
    else failureClass = 'login_failed';
  }
  return { ok, httpStatus: res.status, failureClass, hasSession: Boolean(data.sessionToken) };
}
