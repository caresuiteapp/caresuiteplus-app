#!/usr/bin/env node
/**
 * P0 local DB verification — reads .env internally, no secret logging.
 */
import { createAuditAdminClient, loadAuditEnv } from './lib/auditSupabaseClient.mjs';

const TENANT = '56180c22-b894-4fab-b55e-a563c94dd6e7';

async function queryDb(admin, table, query) {
  const res = await admin.restSelect(table, query);
  if (!res.ok) return { ok: false, error: res.error?.message ?? 'query_failed' };
  return { ok: true, count: Array.isArray(res.data) ? res.data.length : 0, data: res.data };
}

async function main() {
  const env = loadAuditEnv();
  const admin = createAuditAdminClient(env);
  const visitId = process.env.P0_VISIT_ID ?? '2ca87309-d40e-4ba7-a42c-d003b9c1aa68';

  const out = {
    visitId,
    tenantId: TENANT,
    assignment: await queryDb(
      admin,
      'assignments',
      `id=eq.${visitId}&tenant_id=eq.${TENANT}&select=id,status,documentation_notes,employee_id,client_id,title,internal_notes,planned_start_at`,
    ),
    visit: await queryDb(
      admin,
      'assist_visits',
      `id=eq.${visitId}&tenant_id=eq.${TENANT}&select=id,canonical_status,execution_status,documentation_status,proof_status`,
    ),
    proofs: await queryDb(
      admin,
      'assist_visit_proofs',
      `visit_id=eq.${visitId}&tenant_id=eq.${TENANT}&select=id,status,pdf_storage_path,portal_visible,payload_hash`,
    ),
    docs: await queryDb(
      admin,
      'assist_visit_documentation',
      `visit_id=eq.${visitId}&tenant_id=eq.${TENANT}&select=id,short_description,submitted_at,updated_at`,
    ),
    sigs: await queryDb(
      admin,
      'assist_visit_signatures',
      `visit_id=eq.${visitId}&tenant_id=eq.${TENANT}&select=id,signed_at`,
    ),
    wfm: await queryDb(
      admin,
      'workforce_time_events',
      `reference_id=eq.${visitId}&tenant_id=eq.${TENANT}&select=id,event_type,occurred_at`,
    ),
    budgetTx: await queryDb(
      admin,
      'client_budget_transactions',
      `reference_id=eq.${visitId}&tenant_id=eq.${TENANT}&select=id,transaction_type,amount_cents,lifecycle_status`,
    ),
  };

  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(String(err.message ?? err));
  process.exit(1);
});
