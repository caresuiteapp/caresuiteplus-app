#!/usr/bin/env node
/**
 * Content Portal C.5 — idempotent E2E seed for Test Pflege GmbH only.
 * Never touches LIVE whitelist tenants. No secrets in stdout.
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
  repairEmployeePortalAccount,
} from './lib/repairEmployeePortalAccount.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TENANT = 'a4ba83bd-65db-46cf-8cf7-61492cc78315';
const CLIENT_A = 'ec4f159f-e794-4326-8b0e-15c0166df1ea';
const EMPLOYEE = E2E_EMPLOYEE_ID;
const VISIT_TODAY = 'c0e50001-0001-4000-8000-000000000001';
const VISIT_TOMORROW = 'c0e50002-0002-4000-8000-000000000002';
const PROOF_PENDING = 'c0e50003-0003-4000-8000-000000000003';
const ASSIGN_TODAY = 'c0e5a001-a001-4000-8000-000000000001';
const ASSIGN_TOMORROW = 'c0e5a002-a002-4000-8000-000000000002';
const THREAD_EMPLOYEE = 'c0e5c001-c001-4000-8000-000000000001';
const THREAD_CLIENT = 'c0e5c002-c002-4000-8000-000000000002';
const MSG_EMP_1 = 'c0e5d001-d001-4000-8000-000000000001';
const MSG_CLIENT_1 = 'c0e5d002-d002-4000-8000-000000000002';
const outPath = join(root, '.audit-content-portal-e2e-seed-results.json');

const LIVE_WHITELIST = ['56180c22-b894-4fab-b55e-a563c94dd6e7'];

function credentials(env) {
  return {
    email: pick(env, ['AUDIT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL']),
    password: pick(env, ['AUDIT_BUSINESS_PASSWORD', 'TEST_BUSINESS_PASSWORD']),
  };
}

async function main() {
  const env = loadAuditEnv();
  const dryRun = process.argv.includes('--dry-run');
  const publicClient = createAuditPublicClient(env);
  const adminClient = createAuditAdminClient(env);
  const { email, password } = credentials(env);
  const result = { ok: false, dryRun, tenantId: TENANT, steps: [] };

  if (LIVE_WHITELIST.includes(TENANT)) {
    result.reason = 'tenant_is_live_whitelist';
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    process.exit(3);
  }

  if (!publicClient.url || !publicClient.key || !email || !password) {
    result.reason = 'missing_env_credentials';
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    process.exit(2);
  }

  if (!adminClient.url || !adminClient.key) {
    result.reason = 'missing_service_role';
    result.clientError = {
      clientType: 'admin',
      envKeyName: adminClient.keyEnvKeyName,
      errorClass: 'missing_env',
    };
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    process.exit(2);
  }

  if (dryRun) {
    result.ok = true;
    result.steps.push({ step: 'dry_run', ok: true, detail: 'Would seed E2E tenant only' });
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    return;
  }

  const auth = await publicClient.passwordLogin(email, password);
  result.steps.push({
    step: 'business_login',
    ok: auth.ok,
    detail: auth.ok ? 'ok' : auth.error,
  });
  if (!auth.ok) {
    result.reason = 'auth_failed';
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    process.exit(2);
  }

  const envRow = await adminClient.restUpsert('tenant_environment_settings', {
    tenant_id: TENANT,
    mode: 'internal_test',
    notes: 'Content Portal E2E seed',
  }, 'tenant_id');
  result.steps.push({
    step: 'env_mode',
    ok: envRow.ok,
    detail: envRow.ok ? 'ok' : envRow.error,
  });

  const employeeRepair = await repairEmployeePortalAccount(adminClient, env);
  result.steps.push({
    step: 'employee_portal_account',
    ok: employeeRepair.ok,
    detail: employeeRepair.ok ? 'ok' : employeeRepair.diag,
  });

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const visitBase = {
    tenant_id: TENANT,
    client_id: CLIENT_A,
    employee_id: EMPLOYEE,
    service_key: 'alltagsbegleitung',
    service_name: 'Alltagsbegleitung',
    duration_minutes: 60,
    planning_status: 'confirmed',
    documentation_status: 'in_progress',
    proof_status: 'pending',
    billing_status: 'none',
    canonical_status: 'scheduled',
  };

  const visits = [
    {
      ...visitBase,
      id: VISIT_TODAY,
      title: 'E2E Einsatz heute',
      assignment_date: todayStr,
      planned_start_at: `${todayStr}T08:00:00+00`,
      planned_end_at: `${todayStr}T09:00:00+00`,
      execution_status: 'in_progress',
    },
    {
      ...visitBase,
      id: VISIT_TOMORROW,
      title: 'E2E Einsatz morgen',
      assignment_date: tomorrowStr,
      planned_start_at: `${tomorrowStr}T10:00:00+00`,
      planned_end_at: `${tomorrowStr}T11:00:00+00`,
      execution_status: 'scheduled',
    },
  ];

  for (const row of visits) {
    const upsert = await adminClient.restUpsert('assist_visits', row, 'id');
    result.steps.push({
      step: `visit_${row.id.slice(0, 8)}`,
      ok: upsert.ok,
      detail: upsert.ok ? 'ok' : upsert.error,
    });
  }

  // --- Assignments (employee portal reads from assignments table) ---
  const assignmentBase = {
    tenant_id: TENANT,
    client_id: CLIENT_A,
    employee_id: EMPLOYEE,
    product_key: 'assist',
    title: 'E2E Einsatz',
    client_visible_notes: 'E2E Testeinsatz — automatisch erstellt',
  };
  const assignments = [
    {
      ...assignmentBase,
      id: ASSIGN_TODAY,
      title: 'E2E Einsatz heute',
      assignment_date: todayStr,
      planned_start_at: `${todayStr}T08:00:00+00`,
      planned_end_at: `${todayStr}T09:00:00+00`,
      status: 'confirmed',
    },
    {
      ...assignmentBase,
      id: ASSIGN_TOMORROW,
      title: 'E2E Einsatz morgen',
      assignment_date: tomorrowStr,
      planned_start_at: `${tomorrowStr}T10:00:00+00`,
      planned_end_at: `${tomorrowStr}T11:00:00+00`,
      status: 'planned',
    },
  ];
  for (const row of assignments) {
    const upsert = await adminClient.restUpsert('assignments', row, 'id');
    result.steps.push({
      step: `assignment_${row.id.slice(0, 8)}`,
      ok: upsert.ok,
      detail: upsert.ok ? 'ok' : upsert.error,
    });
  }

  // --- Message threads + messages (employee + client) ---
  const nowIso = new Date().toISOString();
  const threads = [
    {
      id: THREAD_EMPLOYEE,
      tenant_id: TENANT,
      thread_type: 'employee',
      status: 'open',
      priority: 'normal',
      subject: 'E2E Mitarbeiter-Nachricht',
      employee_id: EMPLOYEE,
      last_message_at: nowIso,
      last_message_preview: 'E2E Test-Nachricht an Mitarbeiter',
    },
    {
      id: THREAD_CLIENT,
      tenant_id: TENANT,
      thread_type: 'client',
      status: 'open',
      priority: 'normal',
      subject: 'E2E Klienten-Nachricht',
      client_id: CLIENT_A,
      last_message_at: nowIso,
      last_message_preview: 'E2E Test-Nachricht an Klient',
    },
  ];
  for (const t of threads) {
    const upsert = await adminClient.restUpsert('message_threads', t, 'id');
    result.steps.push({
      step: `thread_${t.thread_type}`,
      ok: upsert.ok,
      detail: upsert.ok ? 'ok' : upsert.error,
    });
  }
  const messages = [
    {
      id: MSG_EMP_1,
      tenant_id: TENANT,
      thread_id: THREAD_EMPLOYEE,
      body: 'E2E Test-Nachricht an Mitarbeiter',
      is_internal_note: false,
      is_system_message: false,
      sent_at: nowIso,
      status: 'sent',
    },
    {
      id: MSG_CLIENT_1,
      tenant_id: TENANT,
      thread_id: THREAD_CLIENT,
      body: 'E2E Test-Nachricht an Klient',
      is_internal_note: false,
      is_system_message: false,
      sent_at: nowIso,
      status: 'sent',
    },
  ];
  for (const m of messages) {
    const upsert = await adminClient.restUpsert('messages', m, 'id');
    result.steps.push({
      step: `msg_${m.thread_id.slice(-4)}`,
      ok: upsert.ok,
      detail: upsert.ok ? 'ok' : upsert.error,
    });
  }

  const proof = await adminClient.restUpsert('assist_visit_proofs', {
    id: PROOF_PENDING,
    tenant_id: TENANT,
    visit_id: VISIT_TODAY,
    status: 'pending_review',
    storage_path: 'audit/content-portal/pending-proof.json',
    payload_snapshot: { note: 'E2E pending proof' },
    portal_visible: false,
    portal_release_status: 'none',
    billing_released: false,
  }, 'id');
  result.steps.push({
    step: 'proof_pending',
    ok: proof.ok,
    detail: proof.ok ? 'ok' : proof.error,
  });

  const portal = await adminClient.restUpsert('client_portal_settings', {
    tenant_id: TENANT,
    client_id: CLIENT_A,
    portal_enabled: true,
    inherit_tenant_defaults: true,
  }, 'tenant_id,client_id');
  result.steps.push({
    step: 'portal_settings',
    ok: portal.ok,
    detail: portal.ok ? 'ok' : portal.error,
  });

  result.ok = result.steps.every((s) => s.ok);
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
