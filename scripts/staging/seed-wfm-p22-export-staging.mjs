#!/usr/bin/env node
/**
 * CareSuite+ — Staging-only synthetic seed for WFM P2.2 export E2E.
 *
 * Target: shwpweerzsfkqaivmaoc ONLY. Aborts on production euagyyztvmemuaiumvxm.
 *
 * Usage:
 *   node scripts/staging/seed-wfm-p22-export-staging.mjs
 *   node scripts/staging/seed-wfm-p22-export-staging.mjs --skip-p21-base
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STAGING_REF = 'shwpweerzsfkqaivmaoc';
const PRODUCTION_REF = 'euagyyztvmemuaiumvxm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const IDS = {
  tenant: 'b2222222-2222-4222-8222-222222222201',
  roleOffice: 'b2222222-2222-4222-8222-222222222211',
  employee1: 'b2222222-2222-4222-8222-222222222231',
  employee2: 'b2222222-2222-4222-8222-222222222232',
  employeeAuth: 'b2222222-2222-4222-8222-222222222212',
  employee2Auth: 'b2222222-2222-4222-8222-222222222213',
  officeAuth: 'b2222222-2222-4222-8222-222222222211',
  workSession: 'b2222222-2222-4222-8222-222222222241',
  reviewPending: 'b2222222-2222-4222-8222-222222222251',
  reviewNeedsClarification: 'b2222222-2222-4222-8222-222222222252',
  sessionExportApproved: 'b2222222-2222-4222-8222-222222222281',
  reviewExportApproved: 'b2222222-2222-4222-8222-222222222281',
  sessionCorrected: 'b2222222-2222-4222-8222-222222222282',
  reviewCorrected: 'b2222222-2222-4222-8222-222222222282',
  sessionRejected: 'b2222222-2222-4222-8222-222222222283',
  reviewRejected: 'b2222222-2222-4222-8222-222222222283',
};

const WORK_DATE = '2026-07-07';

function parseFlag(name) {
  return process.argv.includes(`--${name}`);
}

function assertStagingTarget() {
  const refPath = path.join(root, 'supabase', '.temp', 'project-ref');
  if (!existsSync(refPath)) {
    throw new Error('supabase/.temp/project-ref fehlt — zuerst: npx supabase link --project-ref shwpweerzsfkqaivmaoc');
  }
  const linked = readFileSync(refPath, 'utf8').trim();
  if (linked === PRODUCTION_REF) {
    throw new Error(`ABBRUCH: Gelinktes Projekt ist Production (${PRODUCTION_REF})`);
  }
  if (linked !== STAGING_REF) {
    throw new Error(`ABBRUCH: Gelinktes Projekt ist ${linked}, erwartet ${STAGING_REF}`);
  }

  const url = process.env.STAGING_SUPABASE_URL ?? '';
  if (url.includes(PRODUCTION_REF)) {
    throw new Error('ABBRUCH: STAGING_SUPABASE_URL enthält Production-Ref');
  }
  if (url && !url.includes(STAGING_REF)) {
    throw new Error('ABBRUCH: STAGING_SUPABASE_URL passt nicht zu Staging-Ref');
  }

  process.env.SUPABASE_PROJECT_REF = STAGING_REF;
  console.log(`✓ Staging-Ziel bestätigt: ${STAGING_REF}`);
}

function buildP22DeltaSql() {
  const refPending = `${IDS.tenant}:${IDS.employee1}:${WORK_DATE}:session:${IDS.workSession}`;
  const refNeedsClar = `${IDS.tenant}:${IDS.employee2}:${WORK_DATE}:session:${IDS.workSession}`;
  const refApproved = `${IDS.tenant}:${IDS.employee1}:${WORK_DATE}:manual:${IDS.sessionExportApproved}`;
  const refCorrected = `${IDS.tenant}:${IDS.employee1}:${WORK_DATE}:manual:${IDS.sessionCorrected}`;
  const refRejected = `${IDS.tenant}:${IDS.employee2}:${WORK_DATE}:manual:${IDS.sessionRejected}`;

  return `-- CareSuite+ Staging WFM P2.2 export seed delta (${STAGING_REF})
-- Idempotent — nur @example.test — keine Produktivdaten

INSERT INTO public.role_permissions (id, role_id, permission_key, can_view, can_create, can_update, can_delete)
VALUES (
  'b2222222-2222-4222-8222-222222222305',
  '${IDS.roleOffice}',
  'time.tracking.admin.export',
  TRUE, TRUE, TRUE, FALSE
)
ON CONFLICT (role_id, permission_key) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_update = EXCLUDED.can_update,
  can_delete = EXCLUDED.can_delete;

DELETE FROM public.workforce_time_export_items
WHERE tenant_id = '${IDS.tenant}';

DELETE FROM public.workforce_export_jobs
WHERE tenant_id = '${IDS.tenant}'
  AND export_type = 'reviewed_time';

UPDATE public.workforce_time_entry_reviews
SET
  export_status = 'not_exported',
  last_export_job_id = NULL,
  last_exported_at = NULL,
  changed_after_export = FALSE
WHERE tenant_id = '${IDS.tenant}';

INSERT INTO public.workforce_time_entry_reviews (
  id, tenant_id, employee_id, work_date, entry_kind, reference_id, reference_key,
  review_status, export_blocking, export_status, review_note, metadata
)
VALUES
  (
    '${IDS.reviewPending}', '${IDS.tenant}', '${IDS.employee1}', DATE '${WORK_DATE}',
    'session', '${IDS.workSession}', '${refPending}',
    'pending_review', TRUE, 'not_exported',
    'P2.2 synthetic pending_review (blockiert)',
    '{"seed":"wfm_p22","case":"pending_review","minutes_total":450}'::jsonb
  ),
  (
    '${IDS.reviewNeedsClarification}', '${IDS.tenant}', '${IDS.employee2}', DATE '${WORK_DATE}',
    'session', '${IDS.workSession}', '${refNeedsClar}',
    'needs_clarification', TRUE, 'not_exported',
    'P2.2 synthetic needs_clarification (blockiert)',
    '{"seed":"wfm_p22","case":"needs_clarification","minutes_total":450}'::jsonb
  ),
  (
    '${IDS.reviewExportApproved}', '${IDS.tenant}', '${IDS.employee1}', DATE '${WORK_DATE}',
    'manual', '${IDS.sessionExportApproved}', '${refApproved}',
    'approved', FALSE, 'export_ready',
    'P2.2 synthetic approved exportfähig',
    '{"seed":"wfm_p22","case":"approved_export","minutes_total":480}'::jsonb
  ),
  (
    '${IDS.reviewCorrected}', '${IDS.tenant}', '${IDS.employee1}', DATE '${WORK_DATE}',
    'manual', '${IDS.sessionCorrected}', '${refCorrected}',
    'corrected', TRUE, 'not_exported',
    'P2.2 synthetic corrected (blockiert bis erneutes approved)',
    '{"seed":"wfm_p22","case":"corrected","minutes_total":450}'::jsonb
  ),
  (
    '${IDS.reviewRejected}', '${IDS.tenant}', '${IDS.employee2}', DATE '${WORK_DATE}',
    'manual', '${IDS.sessionRejected}', '${refRejected}',
    'rejected', TRUE, 'not_exported',
    'P2.2 synthetic rejected (blockiert)',
    '{"seed":"wfm_p22","case":"rejected","minutes_total":450}'::jsonb
  )
ON CONFLICT (tenant_id, reference_key) DO UPDATE SET
  id = EXCLUDED.id,
  review_status = EXCLUDED.review_status,
  export_blocking = EXCLUDED.export_blocking,
  export_status = EXCLUDED.export_status,
  review_note = EXCLUDED.review_note,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();
`;
}

function applySeedSql(sql) {
  const tmp = path.join(root, '.tmp-staging-wfm-p22-export-seed.sql');
  writeFileSync(tmp, sql, 'utf8');
  try {
    console.log('\n> npx supabase db query --linked --file (P2.2 export seed SQL)');
    execSync(`npx supabase db query --linked --file "${tmp}"`, {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, SUPABASE_PROJECT_REF: STAGING_REF },
    });
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp);
  }
}

async function main() {
  assertStagingTarget();

  if (!parseFlag('skip-p21-base')) {
    console.log('\n> Basis P2.1 Staging-Seed …');
    execSync('node scripts/staging/seed-wfm-p21-staging.mjs', {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, SUPABASE_PROJECT_REF: STAGING_REF },
    });
  } else {
    console.log('\n↷ P2.1 Basis übersprungen (--skip-p21-base).');
  }

  applySeedSql(buildP22DeltaSql());
  console.log('\n✓ P2.2 Export-Staging-Seed angewendet.');
  console.log('  Cases: 1× approved/export_ready, pending, needs_clarification, corrected, rejected');
  console.log('  Zeitraum-Smoke: 2026-07-07 … 2026-07-07');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message ?? err}`);
  process.exitCode = 1;
});
