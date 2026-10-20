#!/usr/bin/env node
/**
 * WFM P2.1 Final Gate — Staging-only functional smoke (REST/JWT equivalent to Office app flows).
 *
 * Target: shwpweerzsfkqaivmaoc ONLY.
 * Requires: STAGING_SUPABASE_URL, STAGING_SUPABASE_ANON_KEY
 *
 * Usage:
 *   node scripts/staging/final-gate-wfm-p21-staging.mjs
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
  employeeAuth: 'b2222222-2222-4222-8222-222222222212',
  reviewPending: 'b2222222-2222-4222-8222-222222222251',
  reviewSecond: 'b2222222-2222-4222-8222-222222222252',
  reviewGateReject: 'b2222222-2222-4222-8222-222222222298',
  reviewGateCorrect: 'b2222222-2222-4222-8222-222222222297',
  actionGateReject: 'b2222222-2222-4222-8222-222222222296',
  actionGateCorrect: 'b2222222-2222-4222-8222-222222222295',
  workSession: 'b2222222-2222-4222-8222-222222222241',
  employee1: 'b2222222-2222-4222-8222-222222222231',
  employee2: 'b2222222-2222-4222-8222-222222222232',
};

const EMAILS = { office: 'office.staging@example.test' };
const WORK_DATE = '2026-07-07';
const PASSWORD = process.env.STAGING_SEED_PASSWORD ?? 'StagingWfmP21-Example-Only';

function loadStagingEnvFile() {
  const envPath = path.join(root, 'supabase', '.temp', 'staging-env.json');
  if (!existsSync(envPath)) return null;
  const parsed = JSON.parse(readFileSync(envPath, 'utf8'));
  if (parsed.projectRef === PRODUCTION_REF) throw new Error('ABBRUCH: staging-env.json ist Production');
  if (parsed.projectRef && parsed.projectRef !== STAGING_REF) {
    throw new Error('ABBRUCH: staging-env.json passt nicht zu Staging-Ref');
  }
  return parsed;
}

function resolveStagingCredentials() {
  const file = loadStagingEnvFile();
  const url = process.env.STAGING_SUPABASE_URL ?? file?.url ?? `https://${STAGING_REF}.supabase.co`;
  const anon = process.env.STAGING_SUPABASE_ANON_KEY ?? file?.anonKey ?? '';
  if (url.includes(PRODUCTION_REF)) throw new Error('ABBRUCH: Staging-URL ist Production');
  if (!url.includes(STAGING_REF)) throw new Error('ABBRUCH: Staging-URL passt nicht zu Staging-Ref');
  if (!anon) throw new Error('ABBRUCH: Staging-Anon-Key fehlt (Env oder supabase/.temp/staging-env.json)');
  return { url, anon };
}

function assertStagingEnv() {
  const refPath = path.join(root, 'supabase', '.temp', 'project-ref');
  const linked = existsSync(refPath) ? readFileSync(refPath, 'utf8').trim() : '';
  if (linked === PRODUCTION_REF) throw new Error('ABBRUCH: gelinktes Projekt ist Production');
  if (linked !== STAGING_REF) throw new Error(`ABBRUCH: erwartet ${STAGING_REF}, ist ${linked || '?'}`);
  resolveStagingCredentials();
  console.log(`✓ Staging-Ziel: ${STAGING_REF}`);
}

async function signIn(url, anon, email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Login ${email} failed: ${body.error_description ?? res.status}`);
  return body.access_token;
}

async function restGetReviews(url, anon, token, query) {
  const res = await fetch(`${url}/rest/v1/workforce_time_entry_reviews?${query}`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const body = await res.json();
  return { ok: res.ok, status: res.status, body: Array.isArray(body) ? body : [] };
}

async function restPatchReview(url, anon, token, reviewId, patch) {
  const res = await fetch(`${url}/rest/v1/workforce_time_entry_reviews?id=eq.${reviewId}`, {
    method: 'PATCH',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(patch),
  });
  const text = await res.text();
  let body = [];
  try { body = text ? JSON.parse(text) : []; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

async function restInsertAction(url, anon, token, row) {
  const res = await fetch(`${url}/rest/v1/workforce_time_review_actions`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });
  return { ok: res.ok, status: res.status };
}

async function countOpenReviews(url, anon, token) {
  const res = await restGetReviews(
    url,
    anon,
    token,
    `tenant_id=eq.${IDS.tenant}&review_status=in.(pending_review,needs_clarification)&select=id,review_status`,
  );
  return res.ok ? res.body.length : -1;
}

async function runPersistenceSmoke() {
  const { url, anon } = resolveStagingCredentials();
  const token = await signIn(url, anon, EMAILS.office, PASSWORD);
  const results = [];

  // Reset gate reviews to known baseline via PATCH
  await restPatchReview(url, anon, token, IDS.reviewPending, {
    review_status: 'pending_review',
    review_note: 'Final gate baseline pending',
  });
  await restPatchReview(url, anon, token, IDS.reviewSecond, {
    review_status: 'pending_review',
    review_note: 'Final gate baseline second',
  });

  const openBefore = await countOpenReviews(url, anon, token);

  // A) Rückfrage stellen
  const clarify = await restPatchReview(url, anon, token, IDS.reviewPending, {
    review_status: 'needs_clarification',
    review_note: 'Final gate clarification',
  });
  await restInsertAction(url, anon, token, {
    id: 'b2222222-2222-4222-8222-222222222290',
    tenant_id: IDS.tenant,
    entry_review_id: IDS.reviewPending,
    action: 'clarification_requested',
    prev_status: 'pending_review',
    new_status: 'needs_clarification',
    actor_id: IDS.officeAuth,
    comment: 'Final gate clarify',
  });
  const reloadClarify = await restGetReviews(
    url,
    anon,
    token,
    `id=eq.${IDS.reviewPending}&select=review_status`,
  );
  const openAfterClarify = await countOpenReviews(url, anon, token);
  results.push({
    check: 'action_clarify_persists',
    ok: clarify.ok
      && reloadClarify.body[0]?.review_status === 'needs_clarification'
      && openAfterClarify >= openBefore,
    detail: `status=${reloadClarify.body[0]?.review_status}, open=${openAfterClarify}`,
  });

  // B) Genehmigen
  const approve = await restPatchReview(url, anon, token, IDS.reviewSecond, {
    review_status: 'approved',
    review_note: 'Final gate approved',
  });
  await restInsertAction(url, anon, token, {
    id: 'b2222222-2222-4222-8222-222222222291',
    tenant_id: IDS.tenant,
    entry_review_id: IDS.reviewSecond,
    action: 'review_approved',
    prev_status: 'pending_review',
    new_status: 'approved',
    actor_id: IDS.officeAuth,
    comment: 'Final gate approve',
  });
  const reloadApprove = await restGetReviews(
    url,
    anon,
    token,
    `id=eq.${IDS.reviewSecond}&select=review_status`,
  );
  const openAfterApprove = await countOpenReviews(url, anon, token);
  results.push({
    check: 'action_approve_persists',
    ok: approve.ok
      && reloadApprove.body[0]?.review_status === 'approved'
      && openAfterApprove < openAfterClarify,
    detail: `status=${reloadApprove.body[0]?.review_status}, open=${openAfterApprove}`,
  });

  // C) Ablehnen — upsert dedicated row first
  const rejectInsert = await fetch(`${url}/rest/v1/workforce_time_entry_reviews`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      id: IDS.reviewGateReject,
      tenant_id: IDS.tenant,
      employee_id: IDS.employee1,
      work_date: WORK_DATE,
      entry_kind: 'session',
      reference_id: IDS.workSession,
      reference_key: `${IDS.tenant}:${IDS.employee1}:${WORK_DATE}:session:final-gate-reject`,
      review_status: 'pending_review',
    }),
  });
  const rejectPatch = await restPatchReview(url, anon, token, IDS.reviewGateReject, {
    review_status: 'rejected',
    review_note: 'Final gate rejected',
  });
  await restInsertAction(url, anon, token, {
    id: IDS.actionGateReject,
    tenant_id: IDS.tenant,
    entry_review_id: IDS.reviewGateReject,
    action: 'review_rejected',
    prev_status: 'pending_review',
    new_status: 'rejected',
    actor_id: IDS.officeAuth,
    comment: 'Final gate reject',
  });
  const reloadReject = await restGetReviews(
    url,
    anon,
    token,
    `id=eq.${IDS.reviewGateReject}&select=review_status`,
  );
  results.push({
    check: 'action_reject_persists',
    ok: (rejectInsert.ok || rejectInsert.status === 409)
      && rejectPatch.ok
      && reloadReject.body[0]?.review_status === 'rejected',
    detail: `status=${reloadReject.body[0]?.review_status}`,
  });

  // D) Corrected
  const corrInsert = await fetch(`${url}/rest/v1/workforce_time_entry_reviews`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      id: IDS.reviewGateCorrect,
      tenant_id: IDS.tenant,
      employee_id: IDS.employee2,
      work_date: WORK_DATE,
      entry_kind: 'session',
      reference_id: IDS.workSession,
      reference_key: `${IDS.tenant}:${IDS.employee2}:${WORK_DATE}:session:final-gate-correct`,
      review_status: 'pending_review',
    }),
  });
  const correct = await restPatchReview(url, anon, token, IDS.reviewGateCorrect, {
    review_status: 'corrected',
    review_note: 'Final gate corrected',
  });
  await restInsertAction(url, anon, token, {
    id: IDS.actionGateCorrect,
    tenant_id: IDS.tenant,
    entry_review_id: IDS.reviewGateCorrect,
    action: 'review_corrected',
    prev_status: 'pending_review',
    new_status: 'corrected',
    actor_id: IDS.officeAuth,
    comment: 'Final gate correct',
  });
  const reloadCorrect = await restGetReviews(
    url,
    anon,
    token,
    `id=eq.${IDS.reviewGateCorrect}&select=review_status`,
  );
  const openFinal = await countOpenReviews(url, anon, token);
  results.push({
    check: 'action_corrected_persists',
    ok: (corrInsert.ok || corrInsert.status === 409)
      && correct.ok
      && reloadCorrect.body[0]?.review_status === 'corrected',
    detail: `status=${reloadCorrect.body[0]?.review_status}, open=${openFinal}`,
  });

  // Lazy materialization idempotency — duplicate POST same reference_key
  const refKey = `${IDS.tenant}:${IDS.employee1}:${WORK_DATE}:session:final-gate-lazy`;
  const lazy1 = await fetch(`${url}/rest/v1/workforce_time_entry_reviews`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      tenant_id: IDS.tenant,
      employee_id: IDS.employee1,
      work_date: WORK_DATE,
      entry_kind: 'session',
      reference_id: IDS.workSession,
      reference_key: refKey,
      review_status: 'pending_review',
    }),
  });
  const lazy2 = await fetch(`${url}/rest/v1/workforce_time_entry_reviews`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      tenant_id: IDS.tenant,
      employee_id: IDS.employee1,
      work_date: WORK_DATE,
      entry_kind: 'session',
      reference_id: IDS.workSession,
      reference_key: refKey,
      review_status: 'pending_review',
    }),
  });
  const lazyRows = await restGetReviews(
    url,
    anon,
    token,
    `reference_key=eq.${encodeURIComponent(refKey)}&select=id`,
  );
  results.push({
    check: 'lazy_materialization_idempotent',
    ok: lazy1.ok && lazy2.status === 409 && lazyRows.body.length === 1,
    detail: `first=${lazy1.status}, dup=${lazy2.status}, rows=${lazyRows.body.length}`,
  });

  // Mini-historie — last action readable
  const actions = await fetch(
    `${url}/rest/v1/workforce_time_review_actions?entry_review_id=eq.${IDS.reviewPending}&order=created_at.desc&limit=1&select=action,comment,new_status`,
    { headers: { apikey: anon, Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  );
  const actionBody = await actions.json();
  results.push({
    check: 'mini_history_last_action',
    ok: actions.ok && Array.isArray(actionBody) && actionBody.length >= 1,
    detail: actionBody[0]?.action ?? 'none',
  });

  console.log('\nPersistenz-Smoke (Office-REST-Äquivalent):');
  let failed = false;
  for (const row of results) {
    console.log(`  ${row.ok ? '✓' : '✗'} ${row.check}: ${row.detail}`);
    if (!row.ok) failed = true;
  }
  if (failed) process.exitCode = 1;
}

function run(cmd, label) {
  console.log(`\n> ${label}`);
  execSync(cmd, { cwd: root, stdio: 'inherit', env: { ...process.env, SUPABASE_PROJECT_REF: STAGING_REF } });
}

async function main() {
  const headStart = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
  console.log(`Final Gate Start HEAD: ${headStart}`);
  assertStagingEnv();

  run('node scripts/staging/seed-wfm-p21-staging.mjs --verify-rls', 'JWT-RLS-Smoke');
  await runPersistenceSmoke();
  run('npx vitest run src/__tests__/wfm', 'WFM Unit Tests');
  run('npx vitest run src/__tests__/timeTracking/timeTracking.test.ts', 'timeTracking Unit Tests');

  console.log('\n> Expo Web Export (Staging-Env, kein Deploy)');
  const { url: stagingUrl, anon: stagingAnon } = resolveStagingCredentials();
  execSync('npx expo export --platform web', {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_PUBLIC_DEMO_MODE: 'false',
      EXPO_PUBLIC_SUPABASE_URL: stagingUrl,
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: stagingAnon,
      SUPABASE_PROJECT_REF: STAGING_REF,
    },
  });
  console.log('\n✓ Expo export abgeschlossen (dist/, kein Deploy)');

  console.log('\nHinweis App-Smoke: .env im Repo zeigt auf Production — Final Gate nutzt nur STAGING_* Env.');
  console.log('Office-UI manuell: lokal mit STAGING_SUPABASE_URL + Testnutzer office.staging@example.test');
  console.log('Route: /business/office/time-tracking/pruefqueue');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message ?? err}`);
  process.exitCode = 1;
});
