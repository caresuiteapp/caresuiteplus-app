#!/usr/bin/env node
/**
 * Production data check — Assist Durchführung sync for deferred-signature visits.
 * Validates DB truth vs expected office UI fields for a given assignment/visit id.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const supabaseUrl = process.env.SUPABASE_URL ?? 'https://euagyyztvmemuaiumvxm.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1YWd5eXp0dm1lbXVhaXVtdnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MjU5MDMsImV4cCI6MjA5NjUwMTkwM30.WlzLh30maRgWePjQFEj32mfW7DGqN8sFaroREbYsss0';

const ASSIGNMENT_ID = process.env.ASSIST_EXEC_CHECK_ID ?? 'da96df00-a106-4b1c-9185-123790dea5d6';
const TENANT_ID = process.env.ASSIST_EXEC_CHECK_TENANT ?? '56180c22-b894-4fab-b55e-a563c94dd6e7';

const reportPath = join(root, '.audit-assist-execution-sync-results.json');
const results = {
  timestamp: new Date().toISOString(),
  assignmentId: ASSIGNMENT_ID,
  tenantId: TENANT_ID,
  checks: {},
};

function report(key, pass, detail = '') {
  results.checks[key] = { pass, detail };
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${key}${detail ? ` — ${detail}` : ''}`);
}

async function sbGet(table, query) {
  const url = `${supabaseUrl}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
      apikey: supabaseKey,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${table}: ${res.status} ${text}`);
  }
  return res.json();
}

function deriveExpectedExecutionStatus(assignmentStatus, hasDoc, hasSignature, serviceEnded) {
  if (serviceEnded || hasDoc || assignmentStatus === 'completed' || assignmentStatus === 'abgeschlossen') {
    return 'completed';
  }
  return 'pending';
}

async function main() {
  console.log(`\nAssist execution sync production check — ${ASSIGNMENT_ID}\n`);

  const assignments = await sbGet(
    'assignments',
    `select=id,status,on_the_way_at,arrived_at,actual_start_at,actual_end_at,finished_at,documentation_notes&tenant_id=eq.${TENANT_ID}&id=eq.${ASSIGNMENT_ID}`,
  );
  const assignment = assignments[0] ?? null;
  report('assignment_row_exists', Boolean(assignment), assignment ? `status=${assignment.status}` : 'missing');

  const visitsById = await sbGet(
    'assist_visits',
    `select=id,legacy_assignment_id,canonical_status,execution_status,documentation_status,proof_status,on_the_way_at,arrived_at,actual_start_at,actual_end_at,finished_at&tenant_id=eq.${TENANT_ID}&id=eq.${ASSIGNMENT_ID}`,
  );
  const visitsByLegacy = await sbGet(
    'assist_visits',
    `select=id,legacy_assignment_id,canonical_status,execution_status,documentation_status,proof_status,on_the_way_at,arrived_at,actual_start_at,actual_end_at,finished_at&tenant_id=eq.${TENANT_ID}&legacy_assignment_id=eq.${ASSIGNMENT_ID}`,
  );
  const visit =
    visitsById[0] ??
    visitsByLegacy.find((row) => row.id !== ASSIGNMENT_ID) ??
    visitsByLegacy[0] ??
    null;

  report('assist_visit_row_exists', Boolean(visit), visit ? `visitId=${visit.id}` : 'missing');

  const visitId = visit?.id ?? ASSIGNMENT_ID;
  const resolvedAssignmentId = visit?.legacy_assignment_id?.trim() || assignment?.id || ASSIGNMENT_ID;
  const idSplit = visit && resolvedAssignmentId !== visit.id;

  report(
    'id_resolution',
    Boolean(assignment) || Boolean(visit),
    `visitId=${visitId}, assignmentId=${resolvedAssignmentId}${idSplit ? ' (split ids)' : ' (same id)'}`,
  );

  const executionStates = await sbGet(
    'assist_visit_execution_state',
    `select=visit_id,assignment_status,documentation_complete,signature_complete,proof_generated,travel_started_at,travel_ended_at,service_started_at,service_ended_at,finalized_at&tenant_id=eq.${TENANT_ID}&visit_id=eq.${visitId}`,
  );
  const executionState = executionStates[0] ?? null;
  report(
    'execution_state_exists',
    Boolean(executionState),
    executionState ? `assignment_status=${executionState.assignment_status}` : 'missing',
  );

  const proofs = await sbGet(
    'assist_visit_proofs',
    `select=id,status,created_at&tenant_id=eq.${TENANT_ID}&visit_id=eq.${visitId}&order=created_at.desc&limit=1`,
  );
  const proof = proofs[0] ?? null;

  const hasDoc = Boolean(assignment?.documentation_notes?.trim()) || executionState?.documentation_complete;
  const hasSignature = Boolean(executionState?.signature_complete);
  const serviceEnded = Boolean(
    assignment?.actual_end_at || executionState?.service_ended_at || visit?.actual_end_at,
  );

  const expectedExecution = deriveExpectedExecutionStatus(
    assignment?.status ?? visit?.canonical_status,
    hasDoc,
    hasSignature,
    serviceEnded,
  );

  report(
    'expected_ui_execution_status',
    expectedExecution === 'completed',
    `expected=${expectedExecution}, visit.execution_status=${visit?.execution_status ?? 'n/a'}`,
  );

  report(
    'visit_execution_status_completed',
    visit?.execution_status === 'completed',
    `actual=${visit?.execution_status ?? 'null'}`,
  );

  report(
    'assignment_on_the_way_at',
    Boolean(assignment?.on_the_way_at ?? visit?.on_the_way_at ?? executionState?.travel_started_at),
    assignment?.on_the_way_at ?? visit?.on_the_way_at ?? executionState?.travel_started_at ?? 'missing',
  );

  report(
    'assignment_service_started_at',
    Boolean(assignment?.actual_start_at ?? visit?.actual_start_at ?? executionState?.service_started_at),
    assignment?.actual_start_at ?? visit?.actual_start_at ?? executionState?.service_started_at ?? 'missing',
  );

  report(
    'assignment_service_ended_at',
    Boolean(assignment?.actual_end_at ?? visit?.actual_end_at ?? executionState?.service_ended_at),
    assignment?.actual_end_at ?? visit?.actual_end_at ?? executionState?.service_ended_at ?? 'missing',
  );

  report(
    'deferred_signature_pending',
    proof?.status === 'pending_client_signature' || (hasDoc && !hasSignature),
    proof ? `proof.status=${proof.status}` : 'no proof row (doc+no sig)',
  );

  const oldEnrichmentWouldFindAssignment =
    Boolean(assignment) && resolvedAssignmentId === ASSIGNMENT_ID;
  report(
    'legacy_enrichment_lookup_by_route_id',
    oldEnrichmentWouldFindAssignment,
    oldEnrichmentWouldFindAssignment
      ? 'route id matches assignment row'
      : `route id ${ASSIGNMENT_ID} would miss assignment ${resolvedAssignmentId}`,
  );

  results.data = {
    assignment,
    visit,
    executionState,
    proof,
    resolvedAssignmentId,
    visitId,
    expectedExecution,
  };

  const failed = Object.values(results.checks).some((c) => !c.pass);
  results.overall = failed ? 'FAIL' : 'PASS';
  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nReport: ${reportPath}`);
  console.log(`Overall: ${results.overall}\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
