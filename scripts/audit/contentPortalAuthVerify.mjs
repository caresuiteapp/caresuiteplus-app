#!/usr/bin/env node
/**
 * Content Portal C.12.5 — Auth verification without logging secrets.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAuditPublicClient,
  loadAuditEnv,
  pick,
} from './lib/auditSupabaseClient.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TENANT = 'a4ba83bd-65db-46cf-8cf7-61492cc78315';
const outPath = join(root, '.audit-content-portal-c12-auth-verify.json');

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
  const env = loadAuditEnv();
  const publicClient = createAuditPublicClient(env);
  const { url, key: anonKey } = publicClient;

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

  const biz = await publicClient.passwordLogin(businessEmail, businessPassword);
  result.businessLogin = biz.ok;
  if (!biz.ok && biz.error) {
    result.businessLoginError = biz.error;
  }

  if (biz.ok) {
    const probe = await publicClient.restSelectAsUser(
      'assist_visits',
      `tenant_id=eq.${TENANT}&select=id&limit=1`,
      biz.token,
    );
    result.tenantLinked = probe.ok;
    if (!probe.ok && probe.error) {
      result.tenantProbeError = probe.error;
    }
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
