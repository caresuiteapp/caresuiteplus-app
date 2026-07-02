#!/usr/bin/env node
/**
 * P0 E2E bootstrap — Test Pflege GmbH only (never Helferhasen+ live tenant).
 * Repairs portal credentials, seeds fresh confirmed assignment for today.
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
  repairEmployeePortalAccount,
  tryEmployeePortalLogin,
} from './lib/repairEmployeePortalAccount.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outPath = join(root, '.audit-p0-e2e-bootstrap-results.json');
const LIVE_WHITELIST = ['56180c22-b894-4fab-b55e-a563c94dd6e7'];
const CLIENT_A = 'ec4f159f-e794-4326-8b0e-15c0166df1ea';

async function main() {
  const env = loadAuditEnv();
  const tenantId = pick(env, ['AUDIT_P0_TENANT_ID']) || E2E_TENANT_ID;

  if (LIVE_WHITELIST.includes(tenantId)) {
    const result = { ok: false, reason: 'refuse_live_tenant', tenantId };
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    process.exit(3);
  }

  const admin = createAuditAdminClient(env);
  const publicClient = createAuditPublicClient(env);
  const result = { ok: false, tenantId, steps: [] };

  const repair = await repairEmployeePortalAccount(admin, env, {
    tenantId,
    employeeId: E2E_EMPLOYEE_ID,
  });
  result.steps.push({ step: 'portal_repair', ok: repair.ok, detail: repair.diag ?? 'ok' });
  if (!repair.ok) {
    result.reason = 'portal_repair_failed';
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    process.exit(2);
  }

  const username = repair.username ?? pick(env, ['AUDIT_EMPLOYEE_USERNAME']);
  const password = pick(env, ['AUDIT_EMPLOYEE_PASSWORD', 'TEST_EMPLOYEE_PASSWORD']);
  const login = await tryEmployeePortalLogin(publicClient, username, password);
  result.steps.push({ step: 'portal_login_verify', ok: login.ok, detail: login.failureClass });

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const assignmentId = randomUUID();
  const startHour = 10 + (today.getHours() % 8);
  const plannedStart = `${todayStr}T${String(startHour).padStart(2, '0')}:30:00+00`;
  const plannedEnd = `${todayStr}T${String(startHour + 1).padStart(2, '0')}:30:00+00`;

  const assignment = {
    id: assignmentId,
    tenant_id: tenantId,
    client_id: CLIENT_A,
    employee_id: E2E_EMPLOYEE_ID,
    product_key: 'assist',
    title: 'P0-E2E Testeinsatz',
    client_visible_notes: 'P0-E2E — dedizierter Testeinsatz, kein Live-Klient',
    internal_notes: 'P0-E2E bootstrap',
    assignment_date: todayStr,
    planned_start_at: plannedStart,
    planned_end_at: plannedEnd,
    status: 'confirmed',
  };

  const assignUpsert = await admin.restUpsert('assignments', assignment, 'id');
  result.steps.push({ step: 'assignment', ok: assignUpsert.ok, detail: assignUpsert.ok ? assignmentId : assignUpsert.error });

  const visit = {
    id: assignmentId,
    tenant_id: tenantId,
    client_id: CLIENT_A,
    employee_id: E2E_EMPLOYEE_ID,
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
    billing_status: 'none',
  };

  const visitUpsert = await admin.restUpsert('assist_visits', visit, 'id');
  result.steps.push({ step: 'assist_visit', ok: visitUpsert.ok, detail: visitUpsert.ok ? assignmentId : visitUpsert.error });

  result.ok = login.ok && assignUpsert.ok && visitUpsert.ok;
  result.assignmentId = assignmentId;
  result.employeeUsername = username;
  result.clientId = CLIENT_A;
  result.employeeId = E2E_EMPLOYEE_ID;

  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 2);
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(1);
});
