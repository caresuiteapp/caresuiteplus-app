#!/usr/bin/env node
/**
 * Content Portal C.6 — Auth bootstrap for portal E2E (business, employee, client).
 * Delegates to audited bootstrap logic; never logs secrets.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const legacyBootstrap = join(root, '.audit-assist-live-e2e-a42-auth-bootstrap.mjs');
const outPath = join(root, '.audit-content-portal-auth-bootstrap-results.json');

function loadEnvSummary() {
  const path = join(root, '.env');
  const summary = {
    supabaseUrl: Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL),
    anonKey: Boolean(
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    ),
    businessEmail: Boolean(
      process.env.AUDIT_BUSINESS_EMAIL ?? process.env.TEST_BUSINESS_EMAIL,
    ),
    businessPassword: Boolean(
      process.env.AUDIT_BUSINESS_PASSWORD ?? process.env.TEST_BUSINESS_PASSWORD,
    ),
    serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    employeeCreds: Boolean(
      process.env.AUDIT_EMPLOYEE_USERNAME ?? process.env.TEST_EMPLOYEE_USERNAME,
    ),
    clientCreds: Boolean(
      process.env.AUDIT_CLIENT_USERNAME ?? process.env.TEST_CLIENT_USERNAME,
    ),
  };
  if (!existsSync(path)) return summary;
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
    if (!process.env[key]) process.env[key] = val;
  }
  return {
    supabaseUrl: Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL),
    anonKey: Boolean(
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    ),
    businessEmail: Boolean(
      process.env.AUDIT_BUSINESS_EMAIL ?? process.env.TEST_BUSINESS_EMAIL,
    ),
    businessPassword: Boolean(
      process.env.AUDIT_BUSINESS_PASSWORD ?? process.env.TEST_BUSINESS_PASSWORD,
    ),
    serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    employeeCreds: Boolean(
      process.env.AUDIT_EMPLOYEE_USERNAME ?? process.env.TEST_EMPLOYEE_USERNAME,
    ),
    clientCreds: Boolean(
      process.env.AUDIT_CLIENT_USERNAME ?? process.env.TEST_CLIENT_USERNAME,
    ),
  };
}

function main() {
  const envSummary = loadEnvSummary();
  const result = {
    ok: false,
    phase: 'content_portal_auth_bootstrap',
    envSummary,
    legacyBootstrapExists: existsSync(legacyBootstrap),
    exitCode: null,
    blocker: null,
  };

  if (!envSummary.supabaseUrl || !envSummary.anonKey) {
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
