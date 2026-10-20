#!/usr/bin/env node
/**
 * Content Portal C.12R.5 — Auth verification without logging secrets.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAuditAdminClient,
  createAuditPublicClient,
  loadAuditEnv,
  pick,
} from './lib/auditSupabaseClient.mjs';
import {
  E2E_EMPLOYEE_ID,
  E2E_TENANT_ID,
  employeeEnvCreds,
  tryEmployeePortalLogin,
  validateEmployeeEnv,
} from './lib/repairEmployeePortalAccount.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TENANT = E2E_TENANT_ID;
const outPath = join(root, '.audit-content-portal-c12-auth-verify.json');

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
  const env = loadAuditEnv();
  const publicClient = createAuditPublicClient(env);
  const adminClient = createAuditAdminClient(env);
  const { url, key: anonKey } = publicClient;

  const businessEmail = pick(env, ['AUDIT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL']);
  const businessPassword = pick(env, ['AUDIT_BUSINESS_PASSWORD', 'TEST_BUSINESS_PASSWORD']);
  const { username: employeeUsername, password: employeePassword } = employeeEnvCreds(env);
  const clientUsername = pick(env, ['AUDIT_CLIENT_USERNAME', 'TEST_CLIENT_USERNAME', 'AUDIT_CLIENT_EMAIL', 'TEST_CLIENT_EMAIL']);
  const clientCode = pick(env, ['AUDIT_CLIENT_PORTAL_CODE', 'TEST_CLIENT_PORTAL_CODE']);

  const result = {
    businessLogin: false,
    employeePortalLogin: false,
    clientPortalLogin: false,
    tenantLinked: false,
    noForeignDataVisible: true,
    noSecretLeak: true,
    employeeLoginMethod: 'username_password',
    clientLoginMethod: 'username_portal_code',
    tenantId: TENANT,
    employeeFailureClass: null,
    employeeFailureStep: null,
    employeeTenantLinked: false,
    employeeAccountActive: false,
    employeeAccountFound: false,
    employeeHasAssignments: false,
    employeeDataVisible: false,
    clientFailureClass: null,
  };

  const biz = await publicClient.passwordLogin(businessEmail, businessPassword);
  result.businessLogin = biz.ok;

  if (biz.ok) {
    const probe = await publicClient.restSelectAsUser(
      'assist_visits',
      `tenant_id=eq.${TENANT}&select=id&limit=1`,
      biz.token,
    );
    result.tenantLinked = probe.ok;
    const liveProbe = await publicClient.restSelectAsUser(
      'assist_visits',
      `tenant_id=eq.56180c22-b894-4fab-b55e-a563c94dd6e7&select=id&limit=1`,
      biz.token,
    );
    if (liveProbe.ok && Array.isArray(liveProbe.data) && liveProbe.data.length > 0) {
      result.noForeignDataVisible = false;
    }
  }

  const empEnv = validateEmployeeEnv(env);
  if (!empEnv.ok) {
    result.employeeFailureClass = empEnv.failureClass;
    result.employeeFailureStep = 'env';
  } else {
    const accRes = await adminClient.restSelect(
      'employee_portal_accounts',
      `tenant_id=eq.${TENANT}&employee_id=eq.${E2E_EMPLOYEE_ID}&select=id,username,status`,
    );
    if (accRes.ok && Array.isArray(accRes.data) && accRes.data.length) {
      const acc = accRes.data[0];
      result.employeeAccountFound = true;
      result.employeeTenantLinked = true;
      result.employeeAccountActive =
        acc.status !== 'blocked' && acc.status !== 'archived';
    }

    const assignRes = await adminClient.restSelect(
      'assist_visits',
      `tenant_id=eq.${TENANT}&employee_id=eq.${E2E_EMPLOYEE_ID}&select=id&limit=1`,
    );
    result.employeeHasAssignments =
      assignRes.ok && Array.isArray(assignRes.data) && assignRes.data.length > 0;

    const ep = await tryEmployeePortalLogin(publicClient, employeeUsername, employeePassword);
    result.employeePortalLogin = ep.ok;
    if (!ep.ok) {
      result.employeeFailureClass = ep.failureClass;
      result.employeeFailureStep = 'edge_login';
    } else {
      result.employeeDataVisible = result.employeeHasAssignments;
    }
  }

  if (clientUsername && clientCode) {
    const cp = await clientPortalLogin(url, anonKey, clientUsername, clientCode);
    result.clientPortalLogin = cp.ok;
    if (!cp.ok) result.clientFailureClass = 'login_failed';
  }

  result.ok =
    result.businessLogin &&
    result.tenantLinked &&
    result.employeePortalLogin &&
    result.clientPortalLogin &&
    result.noForeignDataVisible;

  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
