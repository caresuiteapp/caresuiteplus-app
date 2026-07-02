#!/usr/bin/env node
/**
 * P0 portal auth bootstrap — Test Pflege GmbH only.
 * Creates/repairs dedicated P0 test employees + portal accounts + fresh assignment.
 * Never modifies Helferhasen+ live accounts (e.g. helfe.mhia.jlelat).
 */
import { randomUUID } from 'node:crypto';
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
  LIVE_TENANT_BLOCKLIST,
  P0_EMPLOYEE_B_ID,
  P0_MHI_EMPLOYEE_ID,
  diagnoseLivePortalLogin,
  normalizePortalUsername,
  repairEmployeePortalAccount,
} from './lib/repairEmployeePortalAccount.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outPath = join(root, '.audit-p0-portal-auth-bootstrap-results.json');
const CLIENT_A = 'ec4f159f-e794-4326-8b0e-15c0166df1ea';
const P0_BUDGET_ACCOUNT_ID = 'c0e5a001-b001-4000-8000-000000000101';
const P0_BUDGET_RESERVE_CENTS = 5000;
const P0_MHI_USERNAME_DEFAULT = 'p0.mhi.test@caresuiteplus.test';

async function ensureEmployee(admin, tenantId, employee) {
  const existing = await admin.restSelect(
    'employees',
    `id=eq.${employee.id}&tenant_id=eq.${tenantId}&select=id,status,deleted_at`,
  );
  if (existing.ok && Array.isArray(existing.data) && existing.data.length) {
    const patch = await admin.restPatch('employees', `id=eq.${employee.id}`, {
      first_name: employee.firstName,
      last_name: employee.lastName,
      status: 'active',
      deleted_at: null,
      internal_notes: 'P0-E2E dedizierter Testmitarbeiter',
    });
    return { ok: patch.ok, created: false, patch: patch.ok };
  }
  const upsert = await admin.restUpsert(
    'employees',
    {
      id: employee.id,
      tenant_id: tenantId,
      first_name: employee.firstName,
      last_name: employee.lastName,
      status: 'active',
      internal_notes: 'P0-E2E dedizierter Testmitarbeiter',
    },
    'id',
  );
  return { ok: upsert.ok, created: true, error: upsert.error ?? null };
}

async function main() {
  const env = loadAuditEnv();
  const tenantId = pick(env, ['AUDIT_P0_TENANT_ID']) || E2E_TENANT_ID;
  const result = { ok: false, tenantId, steps: [], credentials: {} };

  if (LIVE_TENANT_BLOCKLIST.includes(tenantId)) {
    result.reason = 'live_tenant_blocked';
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    process.exit(3);
  }

  const admin = createAuditAdminClient(env);
  const publicClient = createAuditPublicClient(env);

  const p0MhiUsername = normalizePortalUsername(
    pick(env, ['AUDIT_EMPLOYEE_USERNAME_MHI', 'AUDIT_P0_MHI_USERNAME']) || P0_MHI_USERNAME_DEFAULT,
  );
  const p0PrimaryUsername = normalizePortalUsername(
    pick(env, ['AUDIT_EMPLOYEE_USERNAME', 'TEST_EMPLOYEE_USERNAME']),
  );
  const p0ForeignUsername = normalizePortalUsername(
    pick(env, ['AUDIT_EMPLOYEE_USERNAME_RLS', 'AUDIT_EMPLOYEE_USERNAME_B']) ||
      'audit-employee-b@caresuiteplus.test',
  );
  const password = pick(env, ['AUDIT_EMPLOYEE_PASSWORD', 'TEST_EMPLOYEE_PASSWORD']);

  result.credentials = {
    primaryUsername: p0PrimaryUsername,
    mhiPersonaUsername: p0MhiUsername,
    foreignUsername: p0ForeignUsername,
    passwordDocumentedInEnv: Boolean(password),
  };

  // Diagnose live helfe.mhia.jlelat without modifying it
  const liveMhiDiag = await diagnoseLivePortalLogin(publicClient, 'helfe.mhia.jlelat', password);
  result.steps.push({
    step: 'diagnose_live_mhi',
    ok: false,
    expected: 'invalid_password',
    detail: {
      note: 'Helferhasen+ Produktivaccount — nicht für P0 destruktiv repariert',
      failureClass: liveMhiDiag.failureClass,
      httpStatus: liveMhiDiag.httpStatus,
    },
  });

  await admin.restUpsert(
    'tenant_environment_settings',
    { tenant_id: tenantId, mode: 'internal_test', notes: 'P0 portal auth bootstrap' },
    'tenant_id',
  );

  const employees = [
    { id: E2E_EMPLOYEE_ID, firstName: 'P0', lastName: 'Test Admin' },
    { id: P0_MHI_EMPLOYEE_ID, firstName: 'P0 Test', lastName: 'Mhi Persona' },
    { id: P0_EMPLOYEE_B_ID, firstName: 'P0', lastName: 'Test Foreign' },
  ];
  for (const emp of employees) {
    const ensured = await ensureEmployee(admin, tenantId, emp);
    result.steps.push({ step: `employee_${emp.id.slice(0, 8)}`, ok: ensured.ok, detail: ensured });
  }

  const consentNow = new Date().toISOString();
  const bundleVersion = '2026-06-employee-portal-v1';
  for (const employeeId of [E2E_EMPLOYEE_ID, P0_MHI_EMPLOYEE_ID, P0_EMPLOYEE_B_ID]) {
    const locOk = await admin.restUpsert(
      'employee_location_consents',
      {
        tenant_id: tenantId,
        employee_id: employeeId,
        consent_granted_at: consentNow,
        consent_explained_at: consentNow,
        revoked_at: null,
      },
      'tenant_id,employee_id',
    );
    const bundleOk = await admin.restUpsert(
      'employee_consent_bundle',
      {
        tenant_id: tenantId,
        employee_id: employeeId,
        bundle_version: bundleVersion,
        completed_at: consentNow,
        explained_permissions: ['location', 'notifications', 'camera', 'microphone', 'signature'],
        location_internal_at: consentNow,
      },
      'tenant_id,employee_id,bundle_version',
    );
    result.steps.push({
      step: `permission_onboarding_${employeeId.slice(0, 8)}`,
      ok: locOk.ok && bundleOk.ok,
      detail: { locationConsent: locOk.ok, consentBundle: bundleOk.ok },
    });
  }

  const primaryRepair = await repairEmployeePortalAccount(admin, env, {
    tenantId,
    employeeId: E2E_EMPLOYEE_ID,
    usernameEnvKeys: ['AUDIT_EMPLOYEE_USERNAME', 'TEST_EMPLOYEE_USERNAME'],
    repairMode: 'p0_audit_ready',
  });
  result.steps.push({ step: 'portal_primary', ok: primaryRepair.ok, detail: primaryRepair.diag ?? null });

  const mhiHash = await (await import('./lib/portalAccountCrypto.mjs')).hashSecret(
    password,
    `cs-p0mhi-${Date.now().toString(36)}`,
  );
  const mhiPatch = await admin.restUpsert(
    'employee_portal_accounts',
    {
      tenant_id: tenantId,
      employee_id: P0_MHI_EMPLOYEE_ID,
      username: p0MhiUsername,
      status: 'active',
      must_change_password: false,
      first_login_completed: true,
      temporary_password_hash: mhiHash,
      temporary_password_created_at: new Date().toISOString(),
      temporary_password_expires_at: null,
    },
    'tenant_id,username',
  );
  result.steps.push({
    step: 'portal_mhi_persona',
    ok: mhiPatch.ok,
    detail: { username: p0MhiUsername, employeeId: P0_MHI_EMPLOYEE_ID, error: mhiPatch.error ?? null },
  });

  const foreignRepair = await repairEmployeePortalAccount(admin, env, {
    tenantId,
    employeeId: P0_EMPLOYEE_B_ID,
    usernameEnvKeys: ['AUDIT_EMPLOYEE_USERNAME_RLS', 'AUDIT_EMPLOYEE_USERNAME_B'],
    repairMode: 'p0_audit_ready',
  }).catch(() => ({ ok: false }));

  const foreignHash = await (await import('./lib/portalAccountCrypto.mjs')).hashSecret(
    password,
    `cs-p0b-${Date.now().toString(36)}`,
  );
  const foreignPatch = await admin.restUpsert(
    'employee_portal_accounts',
    {
      tenant_id: tenantId,
      employee_id: P0_EMPLOYEE_B_ID,
      username: p0ForeignUsername,
      status: 'active',
      must_change_password: false,
      first_login_completed: true,
      temporary_password_hash: foreignHash,
      temporary_password_created_at: new Date().toISOString(),
      temporary_password_expires_at: null,
      blocked_at: null,
      blocked_by: null,
      blocked_reason: null,
    },
    'tenant_id,username',
  );
  result.steps.push({
    step: 'portal_foreign',
    ok: foreignPatch.ok,
    detail: {
      username: p0ForeignUsername,
      employeeId: P0_EMPLOYEE_B_ID,
      error: foreignPatch.error ?? null,
      repairAttempted: foreignRepair.ok,
    },
  });

  const loginChecks = [
    { key: 'primary', username: p0PrimaryUsername },
    { key: 'mhi_persona', username: p0MhiUsername },
    { key: 'foreign', username: p0ForeignUsername },
  ];
  for (const check of loginChecks) {
    const login = await diagnoseLivePortalLogin(publicClient, check.username, password);
    result.steps.push({
      step: `login_verify_${check.key}`,
      ok: login.ok,
      detail: { username: check.username, failureClass: login.failureClass, mustChangePassword: login.mustChangePassword },
    });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const budgetYear = Number(todayStr.slice(0, 4));
  const monthStart = `${todayStr.slice(0, 7)}-01`;
  const monthEndDay = new Date(Date.UTC(budgetYear, Number(todayStr.slice(5, 7)), 0)).getUTCDate();
  const monthEnd = `${todayStr.slice(0, 7)}-${String(monthEndDay).padStart(2, '0')}`;
  const assignmentId = randomUUID();
  const plannedStart = `${todayStr}T11:00:00+00`;
  const plannedEnd = `${todayStr}T12:00:00+00`;
  const assignment = {
    id: assignmentId,
    tenant_id: tenantId,
    client_id: CLIENT_A,
    employee_id: P0_MHI_EMPLOYEE_ID,
    product_key: 'assist',
    title: 'P0-E2E Testeinsatz',
    client_visible_notes: 'P0-E2E dedizierter Testeinsatz',
    internal_notes: 'P0 portal auth bootstrap',
    assignment_date: todayStr,
    planned_start_at: plannedStart,
    planned_end_at: plannedEnd,
    status: 'confirmed',
  };
  const assignOk = await admin.restUpsert('assignments', assignment, 'id');
  const visitOk = await admin.restUpsert(
    'assist_visits',
    {
      id: assignmentId,
      tenant_id: tenantId,
      client_id: CLIENT_A,
      employee_id: P0_MHI_EMPLOYEE_ID,
      legacy_assignment_id: assignmentId,
      service_key: 'alltagsbegleitung',
      service_name: 'Alltagsbegleitung',
      duration_minutes: 60,
      title: 'P0-E2E Testeinsatz',
      assignment_date: todayStr,
      planned_start_at: plannedStart,
      planned_end_at: plannedEnd,
      planning_status: 'confirmed',
      canonical_status: 'confirmed',
      execution_status: 'pending',
      documentation_status: 'none',
      proof_status: 'none',
      billing_status: 'preview',
      budget_amount_cents: P0_BUDGET_RESERVE_CENTS,
    },
    'id',
  );

  const budgetAccountOk = await admin.restUpsert(
    'client_budget_accounts',
    {
      id: P0_BUDGET_ACCOUNT_ID,
      tenant_id: tenantId,
      client_id: CLIENT_A,
      catalog_key: 'paragraph_45b',
      catalog_year: budgetYear,
      period: 'monthly',
      period_start: monthStart,
      period_end: monthEnd,
      allocated_cents: 13100,
      used_cents: 0,
      reserved_cents: P0_BUDGET_RESERVE_CENTS,
      billing_priority: 1,
      status: 'active',
      catalog_snapshot: {},
      metadata: { source: 'p0_portal_auth_bootstrap' },
    },
    'id',
  );
  const budgetReservationOk = await admin.restUpsert(
    'client_budget_transactions',
    {
      id: randomUUID(),
      tenant_id: tenantId,
      client_id: CLIENT_A,
      budget_account_id: P0_BUDGET_ACCOUNT_ID,
      transaction_type: 'reservation',
      amount_cents: P0_BUDGET_RESERVE_CENTS,
      balance_after_cents: 13100 - P0_BUDGET_RESERVE_CENTS,
      reference_type: 'assist_visit',
      reference_id: assignmentId,
      lifecycle_status: 'geplant',
      note: 'P0-E2E bootstrap budget reservation',
    },
    'id',
  );
  result.steps.push({
    step: 'budget_reservation',
    ok: budgetAccountOk.ok && budgetReservationOk.ok,
    detail: {
      budgetAccountId: P0_BUDGET_ACCOUNT_ID,
      amountCents: P0_BUDGET_RESERVE_CENTS,
      accountError: budgetAccountOk.error ?? null,
      reservationError: budgetReservationOk.error ?? null,
    },
  });
  result.steps.push({ step: 'assignment', ok: assignOk.ok && visitOk.ok, detail: { assignmentId } });

  result.assignmentId = assignmentId;
  result.p0MhiUsername = p0MhiUsername;
  result.p0PrimaryUsername = p0PrimaryUsername;
  result.p0ForeignUsername = p0ForeignUsername;
  result.ok = result.steps.every(
    (s) => s.ok || s.step === 'diagnose_live_mhi' || s.step.startsWith('permission_onboarding_'),
  );

  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 2);
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(1);
});
