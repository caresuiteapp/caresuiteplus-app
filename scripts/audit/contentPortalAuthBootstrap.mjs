#!/usr/bin/env node
/**
 * Content Portal C.6 — Auth bootstrap for portal E2E (business, employee, client).
 * Delegates to audited bootstrap logic; never logs secrets.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getPublishableKey,
  getServiceRoleKey,
  getSupabaseUrl,
  loadAuditEnv,
  pick,
} from './lib/auditSupabaseClient.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const legacyBootstrap = join(root, '.audit-assist-live-e2e-a42-auth-bootstrap.mjs');
const outPath = join(root, '.audit-content-portal-auth-bootstrap-results.json');

function envSummary(env) {
  return {
    supabaseUrl: Boolean(getSupabaseUrl(env).value),
    anonKey: Boolean(getPublishableKey(env).value),
    businessEmail: Boolean(pick(env, ['AUDIT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL'])),
    businessPassword: Boolean(pick(env, ['AUDIT_BUSINESS_PASSWORD', 'TEST_BUSINESS_PASSWORD'])),
    serviceRole: Boolean(getServiceRoleKey(env).value),
    employeeCreds: Boolean(pick(env, ['AUDIT_EMPLOYEE_USERNAME', 'TEST_EMPLOYEE_USERNAME'])),
    clientCreds: Boolean(pick(env, ['AUDIT_CLIENT_USERNAME', 'TEST_CLIENT_USERNAME'])),
  };
}

function main() {
  const env = loadAuditEnv();
  const summary = envSummary(env);
  const result = {
    ok: false,
    phase: 'content_portal_auth_bootstrap',
    envSummary: summary,
    legacyBootstrapExists: existsSync(legacyBootstrap),
    exitCode: null,
    blocker: null,
  };

  if (!summary.supabaseUrl || !summary.anonKey) {
    result.blocker = 'missing_supabase_env';
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    process.exit(2);
  }

  if (!existsSync(legacyBootstrap)) {
    result.blocker = 'legacy_bootstrap_missing';
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    process.exit(2);
  }

  const run = spawnSync(process.execPath, [legacyBootstrap], {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
  });
  result.exitCode = run.status;
  result.ok = run.status === 0;

  const legacyResultsPath = join(root, '.audit-assist-live-e2e-a42-auth-bootstrap-results.json');
  if (existsSync(legacyResultsPath)) {
    try {
      result.legacy = JSON.parse(readFileSync(legacyResultsPath, 'utf8'));
    } catch {
      result.legacy = { parseError: true };
    }
  }

  if (!result.ok) {
    result.blocker = result.legacy?.auth?.errorClass ?? 'bootstrap_failed';
  }

  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ok: result.ok, exitCode: result.exitCode, blocker: result.blocker }));
  process.exit(result.ok ? 0 : 1);
}

main();
