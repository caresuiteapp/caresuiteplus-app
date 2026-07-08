#!/usr/bin/env node
/**
 * CareSuite+ — Staging Service-E2E smoke for WFM P2.2 reviewed time export.
 *
 * Target: shwpweerzsfkqaivmaoc ONLY.
 *
 * Usage:
 *   node scripts/staging/smoke-wfm-p22-export-staging.mjs
 *   node scripts/staging/smoke-wfm-p22-export-staging.mjs --with-seed
 *
 * Env:
 *   STAGING_SUPABASE_URL
 *   STAGING_SUPABASE_ANON_KEY
 *   STAGING_SEED_PASSWORD (optional)
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STAGING_REF = 'shwpweerzsfkqaivmaoc';
const PRODUCTION_REF = 'euagyyztvmemuaiumvxm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const IDS = {
  tenant: 'b2222222-2222-4222-8222-222222222201',
  officeAuth: 'b2222222-2222-4222-8222-222222222211',
  reviewExportApproved: 'b2222222-2222-4222-8222-222222222281',
};

const EMAILS = {
  office: 'office.staging@example.test',
  employee: 'employee.staging@example.test',
};

const PERIOD = { startDate: '2026-07-07', endDate: '2026-07-07' };

function parseFlag(name) {
  return process.argv.includes(`--${name}`);
}

function assertStagingTarget() {
  const refPath = path.join(root, 'supabase', '.temp', 'project-ref');
  const linked = readFileSync(refPath, 'utf8').trim();
  if (linked === PRODUCTION_REF) throw new Error('ABBRUCH: Production Ref');
  if (linked !== STAGING_REF) throw new Error(`ABBRUCH: Ref ${linked}`);
  console.log(`✓ Staging-Ziel: ${STAGING_REF}`);
}

function resolveStagingCredentials() {
  const envPath = path.join(root, 'supabase', '.temp', 'staging-env.json');
  let file = null;
  if (existsSync(envPath)) {
    file = JSON.parse(readFileSync(envPath, 'utf8'));
  }
  const url = process.env.STAGING_SUPABASE_URL ?? file?.url ?? `https://${STAGING_REF}.supabase.co`;
  const anon = process.env.STAGING_SUPABASE_ANON_KEY ?? file?.anonKey ?? '';
  if (url.includes(PRODUCTION_REF)) throw new Error('ABBRUCH: Production URL');
  if (!anon) throw new Error('STAGING_SUPABASE_ANON_KEY fehlt');
  return { url, anon };
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function payloadHash(payload) {
  const content = stableStringify(payload);
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

async function signIn(url, anonKey, email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Login ${email}: ${body.error_description ?? res.status}`);
  return body.access_token;
}

async function rest(url, anon, token, method, pathName, { query = '', body = null, prefer = '' } = {}) {
  const headers = {
    apikey: anon,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  if (body) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${url}/rest/v1/${pathName}${query}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

function buildPayload(review) {
  const minutes = Number(review.metadata?.minutes_total ?? 0);
  return {
    schemaVersion: 1,
    employeeId: review.employee_id,
    referenceKey: review.reference_key,
    referenceId: review.reference_id,
    entryKind: review.entry_kind,
    periodDate: review.work_date,
    minutesTotal: Math.max(0, Math.round(minutes)),
    reviewStatus: 'approved',
    reviewId: review.id,
  };
}

function buildCsv(items) {
  const header = 'reference_key;employee_id;entry_kind;period_date;minutes_total;review_status;payload_hash';
  const rows = items.map((item) => {
    const p = item.exported_payload;
    return [p.referenceKey, p.employeeId, p.entryKind, p.periodDate, String(p.minutesTotal), p.reviewStatus, item.payload_hash].join(';');
  });
  return rows.length ? `${header}\n${rows.join('\n')}` : header;
}

async function runSmoke() {
  const password = process.env.STAGING_SEED_PASSWORD ?? 'StagingWfmP21-Example-Only';
  const { url, anon } = resolveStagingCredentials();
  const results = [];

  const officeToken = await signIn(url, anon, EMAILS.office, password);
  const employeeToken = await signIn(url, anon, EMAILS.employee, password);

  const reviewsRes = await rest(
    url,
    anon,
    officeToken,
    'GET',
    'workforce_time_entry_reviews',
    {
      query: `?tenant_id=eq.${IDS.tenant}&work_date=gte.${PERIOD.startDate}&work_date=lte.${PERIOD.endDate}&select=id,review_status,export_blocking,export_status,reference_key,employee_id,entry_kind,work_date,reference_id,metadata`,
    },
  );
  const reviews = Array.isArray(reviewsRes.body) ? reviewsRes.body : [];
  const exportable = reviews.filter(
    (r) => r.review_status === 'approved' && r.export_blocking === false && r.export_status !== 'exported',
  );
  results.push({
    check: 'listExportableReviews',
    ok: reviewsRes.ok && exportable.length === 1,
    detail: `total=${reviews.length}, exportable=${exportable.length}`,
  });

  const [year, month] = PERIOD.startDate.split('-').map(Number);
  const draftRes = await rest(url, anon, officeToken, 'POST', 'workforce_export_jobs', {
    prefer: 'return=representation',
    body: {
      tenant_id: IDS.tenant,
      requested_by: IDS.officeAuth,
      export_format: 'csv',
      export_type: 'reviewed_time',
      period_year: year,
      period_month: month,
      period_start: PERIOD.startDate,
      period_end: PERIOD.endDate,
      status: 'draft',
      row_count: 0,
      metadata: { source: 'wfm_p22_smoke' },
    },
  });
  const draftJob = Array.isArray(draftRes.body) ? draftRes.body[0] : draftRes.body;
  const jobId = draftJob?.id;
  results.push({
    check: 'createExportDraft',
    ok: draftRes.ok && draftJob?.status === 'draft' && draftJob?.export_type === 'reviewed_time',
    detail: draftJob?.status ?? draftRes.status,
  });

  const itemsBefore = await rest(
    url,
    anon,
    officeToken,
    'GET',
    'workforce_time_export_items',
    { query: `?export_job_id=eq.${jobId}&select=id` },
  );
  results.push({
    check: 'draftWithoutItems',
    ok: itemsBefore.ok && (itemsBefore.body?.length ?? 0) === 0,
    detail: `items=${itemsBefore.body?.length ?? 0}`,
  });

  const blocked = reviews.filter(
    (r) =>
      ['approved', 'export_ready'].includes(r.export_status) &&
      !(r.review_status === 'approved' && r.export_blocking === false),
  );
  const validationOk = exportable.length >= 1;
  results.push({
    check: 'validateExportBatch',
    ok: validationOk,
    detail: `exportable=${exportable.length}, blockedApproved=${blocked.length}`,
  });

  if (!validationOk || !jobId) {
    for (const row of results) console.log(`  ${row.ok ? '✓' : '✗'} ${row.check}: ${row.detail}`);
    throw new Error('Validation failed — Finalize übersprungen');
  }

  const review = exportable[0];
  const payload = buildPayload(review);
  const hash = payloadHash(payload);
  const itemId = crypto.randomUUID();
  const now = new Date().toISOString();

  const itemInsert = await rest(url, anon, officeToken, 'POST', 'workforce_time_export_items', {
    prefer: 'return=representation',
    body: {
      id: itemId,
      tenant_id: IDS.tenant,
      export_job_id: jobId,
      review_id: review.id,
      employee_id: review.employee_id,
      reference_id: review.reference_id,
      reference_key: review.reference_key,
      entry_kind: review.entry_kind,
      period_date: review.work_date,
      minutes_total: payload.minutesTotal,
      review_status_at_export: 'approved',
      exported_payload: payload,
      payload_hash: hash,
      changed_after_export: false,
    },
  });
  results.push({
    check: 'finalizeExportItems',
    ok: itemInsert.ok,
    detail: itemInsert.ok ? 'item inserted' : `${itemInsert.status}`,
  });

  const reviewPatch = await rest(url, anon, officeToken, 'PATCH', 'workforce_time_entry_reviews', {
    query: `?id=eq.${review.id}`,
    prefer: 'return=representation',
    body: {
      export_status: 'exported',
      last_export_job_id: jobId,
      last_exported_at: now,
      changed_after_export: false,
    },
  });
  const patchedReview = Array.isArray(reviewPatch.body) ? reviewPatch.body[0] : null;
  results.push({
    check: 'reviewExportStatus',
    ok: reviewPatch.ok && patchedReview?.export_status === 'exported',
    detail: patchedReview?.export_status ?? reviewPatch.status,
  });

  const actionInsert = await rest(url, anon, officeToken, 'POST', 'workforce_time_review_actions', {
    body: {
      tenant_id: IDS.tenant,
      entry_review_id: review.id,
      action: 'export_finalized',
      prev_status: 'approved',
      new_status: 'approved',
      actor_id: IDS.officeAuth,
      comment: `P2.2 smoke batch ${jobId}`,
      metadata: { source: 'wfm_p22_smoke' },
    },
  });
  results.push({
    check: 'exportFinalizedAction',
    ok: actionInsert.ok || actionInsert.status === 409,
    detail: actionInsert.ok ? 'ok' : String(actionInsert.status),
  });

  const jobPatch = await rest(url, anon, officeToken, 'PATCH', 'workforce_export_jobs', {
    query: `?id=eq.${jobId}`,
    prefer: 'return=representation',
    body: {
      status: 'finalized',
      row_count: 1,
      content_hash: hash,
      finalized_at: now,
      finalized_by: IDS.officeAuth,
      completed_at: now,
    },
  });
  const finalizedJob = Array.isArray(jobPatch.body) ? jobPatch.body[0] : null;
  results.push({
    check: 'finalizeExportBatch',
    ok: jobPatch.ok && finalizedJob?.status === 'finalized',
    detail: finalizedJob?.status ?? jobPatch.status,
  });

  const dupInsert = await rest(url, anon, officeToken, 'POST', 'workforce_time_export_items', {
    body: {
      tenant_id: IDS.tenant,
      export_job_id: jobId,
      review_id: review.id,
      employee_id: review.employee_id,
      reference_key: review.reference_key,
      entry_kind: review.entry_kind,
      period_date: review.work_date,
      minutes_total: 1,
      review_status_at_export: 'approved',
      exported_payload: payload,
      payload_hash: hash,
    },
  });
  results.push({
    check: 'duplicateReferenceKeyBlocked',
    ok: !dupInsert.ok,
    detail: String(dupInsert.status),
  });

  const itemsAfter = await rest(
    url,
    anon,
    officeToken,
    'GET',
    'workforce_time_export_items',
    { query: `?export_job_id=eq.${jobId}&select=exported_payload,payload_hash` },
  );
  const csv = buildCsv(Array.isArray(itemsAfter.body) ? itemsAfter.body : []);
  results.push({
    check: 'buildInternalCsv',
    ok: csv.includes('reference_key') && csv.includes(review.reference_key),
    detail: `rows=${itemsAfter.body?.length ?? 0}`,
  });

  const employeeJobs = await rest(
    url,
    anon,
    employeeToken,
    'GET',
    'workforce_export_jobs',
    { query: `?tenant_id=eq.${IDS.tenant}&export_type=eq.reviewed_time&select=id` },
  );
  results.push({
    check: 'employeeExportJobsDenied',
    ok: employeeJobs.ok && (employeeJobs.body?.length ?? 0) === 0,
    detail: `rows=${employeeJobs.body?.length ?? 0}`,
  });

  const employeeItems = await rest(
    url,
    anon,
    employeeToken,
    'GET',
    'workforce_time_export_items',
    { query: `?tenant_id=eq.${IDS.tenant}&select=id` },
  );
  results.push({
    check: 'employeeExportItemsDenied',
    ok: employeeItems.ok && (employeeItems.body?.length ?? 0) === 0,
    detail: `rows=${employeeItems.body?.length ?? 0}`,
  });

  let failed = false;
  console.log('\nP2.2 Export Service-E2E Smoke:');
  for (const row of results) {
    console.log(`  ${row.ok ? '✓' : '✗'} ${row.check}: ${row.detail}`);
    if (!row.ok) failed = true;
  }
  if (failed) process.exitCode = 1;
}

async function main() {
  assertStagingTarget();
  if (parseFlag('with-seed')) {
    execSync('node scripts/staging/seed-wfm-p22-export-staging.mjs', {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });
  }
  await runSmoke();
}

main().catch((err) => {
  console.error(`\n✗ ${err.message ?? err}`);
  process.exitCode = 1;
});
