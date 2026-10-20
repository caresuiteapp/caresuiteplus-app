#!/usr/bin/env node
/**
 * Content Portal C.12 — Env gate (presence only, no secret values).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getPublishableKey,
  getServiceRoleKey,
  getSupabaseUrl,
  loadAuditEnv,
  pick,
  PLACEHOLDER_RE,
} from './lib/auditSupabaseClient.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outPath = join(root, '.audit-content-portal-c12-env-gate.json');

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function fieldStatus(value) {
  const v = value?.trim() ?? '';
  return {
    present: Boolean(v),
    empty: !v,
    placeholder: v ? PLACEHOLDER_RE.test(v) : false,
  };
}

async function tryBusinessLogin(url, anonKey, email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && Boolean(data.access_token), httpStatus: res.status };
}

async function main() {
  const env = loadAuditEnv();
  const { value: url } = getSupabaseUrl(env);
  const { value: anonKey } = getPublishableKey(env);
  const { value: serviceRoleKey } = getServiceRoleKey(env);

  const businessEmail = pick(env, ['AUDIT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL', 'UAT_BUSINESS_EMAIL']);
  const businessPassword = pick(env, ['AUDIT_BUSINESS_PASSWORD', 'TEST_BUSINESS_PASSWORD', 'UAT_BUSINESS_PASSWORD']);
  const employeeUsername = pick(env, ['AUDIT_EMPLOYEE_USERNAME', 'TEST_EMPLOYEE_USERNAME', 'AUDIT_EMPLOYEE_EMAIL', 'TEST_EMPLOYEE_EMAIL']);
  const employeePassword = pick(env, ['AUDIT_EMPLOYEE_PASSWORD', 'TEST_EMPLOYEE_PASSWORD']);
  const clientUsername = pick(env, ['AUDIT_CLIENT_USERNAME', 'TEST_CLIENT_USERNAME', 'AUDIT_CLIENT_EMAIL', 'TEST_CLIENT_EMAIL']);
  const clientCode = pick(env, ['AUDIT_CLIENT_PORTAL_CODE', 'TEST_CLIENT_PORTAL_CODE']);
  const clientPassword = pick(env, ['AUDIT_CLIENT_PASSWORD', 'TEST_CLIENT_PASSWORD']);

  const result = {
    ok: false,
    supabaseUrl: fieldStatus(url),
    anonKey: fieldStatus(anonKey),
    serviceRoleKey: fieldStatus(serviceRoleKey),
    businessEmail: fieldStatus(businessEmail),
    businessPassword: fieldStatus(businessPassword),
    employeeUsername: fieldStatus(employeeUsername),
    employeePassword: fieldStatus(employeePassword),
    clientUsername: fieldStatus(clientUsername),
    clientPortalCode: fieldStatus(clientCode),
    clientPassword: fieldStatus(clientPassword),
    businessLoginTest: { attempted: false, ok: false },
    gatePassed: false,
    blockers: [],
  };

  if (!result.supabaseUrl.present || !result.anonKey.present) {
    result.blockers.push('missing_supabase_env');
  }
  if (!result.businessEmail.present || !result.businessPassword.present) {
    result.blockers.push('missing_business_credentials');
  }
  if (result.businessEmail.placeholder || result.businessPassword.placeholder) {
    result.blockers.push('business_credentials_placeholder');
  }
  if (businessEmail && !isValidEmail(businessEmail)) {
    result.blockers.push('business_email_not_valid_format');
  }
  if (employeeUsername === '...' || employeePassword === '...') {
    result.blockers.push('employee_credentials_placeholder_literal');
  }
  if (clientUsername === '...' || clientCode === '...') {
    result.blockers.push('client_credentials_placeholder_literal');
  }
  if (!result.serviceRoleKey.present) {
    result.blockers.push('missing_service_role');
  } else if (result.serviceRoleKey.placeholder) {
    result.blockers.push('service_role_placeholder');
  }

  const portalCredsOk =
    (result.employeeUsername.present && result.employeePassword.present) ||
    result.serviceRoleKey.present;
  const clientCredsOk =
    (result.clientUsername.present && (result.clientPortalCode.present || result.clientPassword.present)) ||
    result.serviceRoleKey.present;

  if (!portalCredsOk) result.blockers.push('employee_portal_creds_or_service_role');
  if (!clientCredsOk) result.blockers.push('client_portal_creds_or_service_role');

  if (url && anonKey && businessEmail && businessPassword && !result.businessPassword.placeholder) {
    result.businessLoginTest.attempted = true;
    const login = await tryBusinessLogin(url, anonKey, businessEmail, businessPassword);
    result.businessLoginTest.ok = login.ok;
    result.businessLoginTest.httpStatus = login.httpStatus;
    if (!login.ok) result.blockers.push('business_login_failed');
  }

  result.gatePassed =
    result.blockers.length === 0 ||
    (result.blockers.every((b) => b === 'missing_service_role') && result.businessLoginTest.ok);

  result.ok =
    result.supabaseUrl.present &&
    result.anonKey.present &&
    result.businessEmail.present &&
    result.businessPassword.present &&
    !result.businessPassword.placeholder &&
    result.businessLoginTest.ok;

  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({
      ok: result.ok,
      gatePassed: result.gatePassed,
      businessLogin: result.businessLoginTest.ok,
      serviceRolePresent: result.serviceRoleKey.present,
      businessEmailValidFormat: businessEmail ? isValidEmail(businessEmail) : false,
      blockers: result.blockers,
    }),
  );
  process.exit(result.ok ? 0 : 2);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
