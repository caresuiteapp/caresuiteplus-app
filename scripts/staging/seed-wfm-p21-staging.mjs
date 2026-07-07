#!/usr/bin/env node
/**
 * CareSuite+ — Staging-only synthetic seed for WFM P2.1 review/RLS smoke data.
 *
 * Target: shwpweerzsfkqaivmaoc (caresuiteplus-staging) ONLY.
 * Aborts on production ref euagyyztvmemuaiumvxm.
 *
 * Usage:
 *   node scripts/staging/seed-wfm-p21-staging.mjs
 *   node scripts/staging/seed-wfm-p21-staging.mjs --verify-rls
 *
 * Env (staging only — never production):
 *   STAGING_SUPABASE_URL=https://shwpweerzsfkqaivmaoc.supabase.co
 *   STAGING_SUPABASE_ANON_KEY=<staging anon>   (required for --verify-rls)
 *   STAGING_SEED_PASSWORD=<optional test password>
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
  roleEmployee: 'b2222222-2222-4222-8222-222222222212',
  officeAuth: 'b2222222-2222-4222-8222-222222222211',
  employeeAuth: 'b2222222-2222-4222-8222-222222222212',
  employee2Auth: 'b2222222-2222-4222-8222-222222222213',
  employee1: 'b2222222-2222-4222-8222-222222222231',
  employee2: 'b2222222-2222-4222-8222-222222222232',
  client: 'b2222222-2222-4222-8222-222222222271',
  workSession: 'b2222222-2222-4222-8222-222222222241',
  reviewPending: 'b2222222-2222-4222-8222-222222222251',
  reviewApproved: 'b2222222-2222-4222-8222-222222222252',
  actionCreated: 'b2222222-2222-4222-8222-222222222261',
  actionStatus: 'b2222222-2222-4222-8222-222222222262',
  actionRlsSmoke: 'b2222222-2222-4222-8222-222222222263',
  actionRlsStatus: 'b2222222-2222-4222-8222-222222222264',
};

const EMAILS = {
  office: 'office.staging@example.test',
  employee: 'employee.staging@example.test',
  employee2: 'employee2.staging@example.test',
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

function seedPassword() {
  return process.env.STAGING_SEED_PASSWORD ?? 'StagingWfmP21-Example-Only';
}

function sqlEscape(value) {
  return value.replace(/'/g, "''");
}

function buildAuthUserSql(id, email, password) {
  const pw = sqlEscape(password);
  const em = sqlEscape(email);
  return `
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token,
  raw_app_meta_data, raw_user_meta_data
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '${id}',
  'authenticated',
  'authenticated',
  '${em}',
  extensions.crypt('${pw}', extensions.gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '', '', '', '',
  '', '', '', '',
  '{"provider":"email","providers":["email"],"staging_seed":"wfm_p21"}'::jsonb,
  '{"display_name":"Staging Synthetic"}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = COALESCE(auth.users.email_confirmed_at, EXCLUDED.email_confirmed_at),
  confirmation_token = COALESCE(auth.users.confirmation_token, EXCLUDED.confirmation_token),
  recovery_token = COALESCE(auth.users.recovery_token, EXCLUDED.recovery_token),
  email_change_token_new = COALESCE(auth.users.email_change_token_new, EXCLUDED.email_change_token_new),
  email_change = COALESCE(auth.users.email_change, EXCLUDED.email_change),
  email_change_token_current = COALESCE(auth.users.email_change_token_current, EXCLUDED.email_change_token_current),
  reauthentication_token = COALESCE(auth.users.reauthentication_token, EXCLUDED.reauthentication_token),
  phone_change = COALESCE(auth.users.phone_change, EXCLUDED.phone_change),
  phone_change_token = COALESCE(auth.users.phone_change_token, EXCLUDED.phone_change_token),
  updated_at = NOW();

INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id
)
VALUES (
  '${id}',
  '${id}',
  jsonb_build_object('sub', '${id}', 'email', '${em}'),
  'email',
  NOW(), NOW(), NOW(),
  '${id}'
)
ON CONFLICT (provider, provider_id) DO UPDATE SET
  identity_data = EXCLUDED.identity_data,
  updated_at = NOW();
`;
}

function buildSeedSql(password) {
  const refKeyPending = `${IDS.tenant}:${IDS.employee1}:${WORK_DATE}:session:${IDS.workSession}`;
  const refKeyApproved = `${IDS.tenant}:${IDS.employee2}:${WORK_DATE}:session:${IDS.workSession}`;

  return `-- CareSuite+ Staging WFM P2.1 synthetic seed (${STAGING_REF})
-- Idempotent INSERT/UPSERT — keine echten Personen-/Produktivdaten

${buildAuthUserSql(IDS.officeAuth, EMAILS.office, password)}
${buildAuthUserSql(IDS.employeeAuth, EMAILS.employee, password)}
${buildAuthUserSql(IDS.employee2Auth, EMAILS.employee2, password)}

INSERT INTO public.tenants (id, name, slug, legal_form, email, phone)
VALUES (
  '${IDS.tenant}',
  'Staging Test Tenant',
  'staging-wfm-p21-test',
  'GmbH',
  'tenant.staging@example.test',
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  email = EXCLUDED.email,
  updated_at = NOW();

INSERT INTO public.roles (id, key, name, description, is_admin_role)
VALUES
  ('${IDS.roleOffice}', 'staging_office_admin', 'Staging Office Admin', 'Synthetic staging office role', TRUE),
  ('${IDS.roleEmployee}', 'staging_employee', 'Staging Employee', 'Synthetic staging employee role', FALSE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_admin_role = EXCLUDED.is_admin_role;

INSERT INTO public.role_permissions (id, role_id, permission_key, can_view, can_create, can_update, can_delete)
VALUES
  ('b2222222-2222-4222-8222-222222222301', '${IDS.roleOffice}', 'time.tracking.admin.view', TRUE, FALSE, FALSE, FALSE),
  ('b2222222-2222-4222-8222-222222222302', '${IDS.roleOffice}', 'time.tracking.admin.correct', FALSE, TRUE, TRUE, FALSE),
  ('b2222222-2222-4222-8222-222222222303', '${IDS.roleOffice}', 'time.tracking.team.view', TRUE, FALSE, FALSE, FALSE),
  ('b2222222-2222-4222-8222-222222222304', '${IDS.roleEmployee}', 'time.tracking.own.start', FALSE, TRUE, FALSE, FALSE)
ON CONFLICT (role_id, permission_key) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_update = EXCLUDED.can_update,
  can_delete = EXCLUDED.can_delete;

INSERT INTO public.profiles (
  id, tenant_id, role_id, role_key, display_name, email, auth_user_id, is_active, status,
  first_name, last_name
)
VALUES
  (
    '${IDS.officeAuth}', '${IDS.tenant}', '${IDS.roleOffice}', 'staging_office_admin',
    'Staging Office Admin', '${EMAILS.office}', '${IDS.officeAuth}', TRUE, 'active',
    'Staging', 'Office'
  ),
  (
    '${IDS.employeeAuth}', '${IDS.tenant}', '${IDS.roleEmployee}', 'staging_employee',
    'Staging Employee One', '${EMAILS.employee}', '${IDS.employeeAuth}', TRUE, 'active',
    'Staging', 'Employee'
  ),
  (
    '${IDS.employee2Auth}', '${IDS.tenant}', '${IDS.roleEmployee}', 'staging_employee',
    'Staging Employee Two', '${EMAILS.employee2}', '${IDS.employee2Auth}', TRUE, 'active',
    'Staging', 'EmployeeTwo'
  )
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  role_id = EXCLUDED.role_id,
  role_key = EXCLUDED.role_key,
  auth_user_id = EXCLUDED.auth_user_id,
  email = EXCLUDED.email,
  is_active = EXCLUDED.is_active,
  status = EXCLUDED.status,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  updated_at = NOW();

INSERT INTO public.employees (
  id, tenant_id, profile_id, first_name, last_name, email, status
)
VALUES
  (
    '${IDS.employee1}', '${IDS.tenant}', '${IDS.employeeAuth}',
    'Staging', 'Employee', '${EMAILS.employee}', 'aktiv'
  ),
  (
    '${IDS.employee2}', '${IDS.tenant}', '${IDS.employee2Auth}',
    'Staging', 'EmployeeTwo', '${EMAILS.employee2}', 'aktiv'
  )
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  profile_id = EXCLUDED.profile_id,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  status = EXCLUDED.status,
  updated_at = NOW();

INSERT INTO public.clients (id, tenant_id, first_name, last_name, status)
VALUES (
  '${IDS.client}', '${IDS.tenant}', 'Client', 'Staging Demo', 'aktiv'
)
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  status = EXCLUDED.status,
  updated_at = NOW();

INSERT INTO public.workforce_work_sessions (
  id, tenant_id, employee_id, user_id, work_date, status, work_mode, display_status,
  started_at, ended_at, gross_minutes, net_minutes, pause_minutes, is_online
)
VALUES (
  '${IDS.workSession}', '${IDS.tenant}', '${IDS.employee1}', '${IDS.employeeAuth}',
  DATE '${WORK_DATE}', 'ended', 'field', 'feierabend',
  TIMESTAMPTZ '${WORK_DATE} 08:00:00+00', TIMESTAMPTZ '${WORK_DATE} 16:00:00+00',
  480, 450, 30, FALSE
)
ON CONFLICT (id) DO UPDATE SET
  employee_id = EXCLUDED.employee_id,
  user_id = EXCLUDED.user_id,
  work_date = EXCLUDED.work_date,
  status = EXCLUDED.status,
  updated_at = NOW();

INSERT INTO public.workforce_time_entry_reviews (
  id, tenant_id, employee_id, work_date, entry_kind, reference_id, reference_key,
  review_status, export_blocking, review_note, metadata
)
VALUES
  (
    '${IDS.reviewPending}', '${IDS.tenant}', '${IDS.employee1}', DATE '${WORK_DATE}',
    'session', '${IDS.workSession}', '${refKeyPending}',
    'pending_review', TRUE, 'Synthetic pending review for staging',
    '{"seed":"wfm_p21","case":"pending"}'::jsonb
  ),
  (
    '${IDS.reviewApproved}', '${IDS.tenant}', '${IDS.employee2}', DATE '${WORK_DATE}',
    'session', '${IDS.workSession}', '${refKeyApproved}',
    'needs_clarification', TRUE, 'Synthetic clarification case for staging',
    '{"seed":"wfm_p21","case":"status_change"}'::jsonb
  )
ON CONFLICT (tenant_id, reference_key) DO UPDATE SET
  review_status = EXCLUDED.review_status,
  review_note = EXCLUDED.review_note,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO public.workforce_time_review_actions (
  id, tenant_id, entry_review_id, action, prev_status, new_status, actor_id, comment, metadata
)
VALUES
  (
    '${IDS.actionCreated}', '${IDS.tenant}', '${IDS.reviewPending}', 'created',
    NULL, 'pending_review', '${IDS.officeAuth}',
    'Synthetic review created',
    '{"seed":"wfm_p21"}'::jsonb
  ),
  (
    '${IDS.actionStatus}', '${IDS.tenant}', '${IDS.reviewApproved}', 'status_changed',
    'pending_review', 'needs_clarification', '${IDS.officeAuth}',
    'Synthetic status change to needs_clarification',
    '{"seed":"wfm_p21"}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  action = EXCLUDED.action,
  prev_status = EXCLUDED.prev_status,
  new_status = EXCLUDED.new_status,
  comment = EXCLUDED.comment,
  metadata = EXCLUDED.metadata;
`;
}

function applySeedSql(sql) {
  const tmp = path.join(root, '.tmp-staging-wfm-p21-seed.sql');
  writeFileSync(tmp, sql, 'utf8');
  try {
    console.log('\n> npx supabase db query --linked --file (staging seed SQL)');
    execSync(`npx supabase db query --linked --file "${tmp}"`, {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, SUPABASE_PROJECT_REF: STAGING_REF },
    });
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp);
  }
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
  if (!res.ok) {
    throw new Error(`Login ${email} failed: ${body.error_description ?? body.msg ?? res.status}`);
  }
  return body.access_token;
}

async function restSelect(url, anonKey, token, query) {
  const res = await fetch(`${url}/rest/v1/workforce_time_entry_reviews?${query}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text ? JSON.parse(text) : [] };
}

async function restInsert(url, anonKey, token, row) {
  const res = await fetch(`${url}/rest/v1/workforce_time_entry_reviews`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text };
}

async function restPatchReview(url, anonKey, token, reviewId, patch) {
  const res = await fetch(`${url}/rest/v1/workforce_time_entry_reviews?id=eq.${reviewId}`, {
    method: 'PATCH',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(patch),
  });
  const text = await res.text();
  let body = [];
  try {
    body = text ? JSON.parse(text) : [];
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

async function restInsertAction(url, anonKey, token, row) {
  const res = await fetch(`${url}/rest/v1/workforce_time_review_actions`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });
  const text = await res.text();
  let body = [];
  try {
    body = text ? JSON.parse(text) : [];
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

async function verifyRls(password) {
  const url = process.env.STAGING_SUPABASE_URL ?? `https://${STAGING_REF}.supabase.co`;
  const anon = process.env.STAGING_SUPABASE_ANON_KEY;
  if (!anon) {
    console.warn('\n⚠ STAGING_SUPABASE_ANON_KEY fehlt — RLS-Praxisprüfung übersprungen.');
    return { skipped: true };
  }
  if (url.includes(PRODUCTION_REF)) {
    throw new Error('ABBRUCH: STAGING_SUPABASE_URL ist Production');
  }

  const results = [];
  const officeToken = await signIn(url, anon, EMAILS.office, password);
  const officeSelect = await restSelect(url, anon, officeToken, `tenant_id=eq.${IDS.tenant}&select=id,employee_id,review_status`);
  results.push({
    check: 'office_select_reviews',
    ok: officeSelect.ok && Array.isArray(officeSelect.body) && officeSelect.body.length >= 2,
    detail: officeSelect.ok ? `rows=${officeSelect.body.length}` : `${officeSelect.status}`,
  });

  const officeInsert = await restInsert(url, anon, officeToken, {
    id: 'b2222222-2222-4222-8222-222222222299',
    tenant_id: IDS.tenant,
    employee_id: IDS.employee1,
    work_date: WORK_DATE,
    entry_kind: 'session',
    reference_id: IDS.workSession,
    reference_key: `${IDS.tenant}:${IDS.employee1}:${WORK_DATE}:session:rls-insert-test`,
    review_status: 'open',
  });
  results.push({
    check: 'office_insert_review',
    ok: officeInsert.ok || officeInsert.status === 409,
    detail: officeInsert.ok ? 'ok' : officeInsert.status === 409 ? 'already_exists' : `${officeInsert.status} ${officeInsert.body}`,
  });

  const officeActionInsert = await restInsertAction(url, anon, officeToken, {
    id: IDS.actionRlsSmoke,
    tenant_id: IDS.tenant,
    entry_review_id: IDS.reviewPending,
    action: 'comment_added',
    actor_id: IDS.officeAuth,
    comment: 'Synthetic RLS smoke office action',
    metadata: { seed: 'wfm_p21', case: 'rls_smoke_action' },
  });
  results.push({
    check: 'office_insert_review_action',
    ok: officeActionInsert.ok || officeActionInsert.status === 409,
    detail: officeActionInsert.ok
      ? 'ok'
      : officeActionInsert.status === 409
        ? 'already_exists'
        : `${officeActionInsert.status} ${JSON.stringify(officeActionInsert.body)}`,
  });

  const officeStatusPatch = await restPatchReview(url, anon, officeToken, IDS.reviewPending, {
    review_status: 'needs_clarification',
  });
  const patched = Array.isArray(officeStatusPatch.body) ? officeStatusPatch.body[0] : null;
  const officeStatusAction = await restInsertAction(url, anon, officeToken, {
    id: IDS.actionRlsStatus,
    tenant_id: IDS.tenant,
    entry_review_id: IDS.reviewPending,
    action: 'status_changed',
    prev_status: 'pending_review',
    new_status: 'needs_clarification',
    actor_id: IDS.officeAuth,
    comment: 'Synthetic RLS smoke status change',
    metadata: { seed: 'wfm_p21', case: 'rls_smoke_status' },
  });
  results.push({
    check: 'office_update_review_status',
    ok: officeStatusPatch.ok
      && patched?.review_status === 'needs_clarification'
      && (officeStatusAction.ok || officeStatusAction.status === 409),
    detail: officeStatusPatch.ok
      ? `status=${patched?.review_status ?? '?'}, action=${officeStatusAction.ok ? 'ok' : officeStatusAction.status === 409 ? 'already_exists' : officeStatusAction.status}`
      : `${officeStatusPatch.status} ${JSON.stringify(officeStatusPatch.body)}`,
  });

  const employeeToken = await signIn(url, anon, EMAILS.employee, password);
  const employeeSelect = await restSelect(url, anon, employeeToken, `tenant_id=eq.${IDS.tenant}&select=id,employee_id`);
  const rows = Array.isArray(employeeSelect.body) ? employeeSelect.body : [];
  results.push({
    check: 'employee_select_own_only',
    ok: employeeSelect.ok && rows.length >= 1 && rows.every((r) => r.employee_id === IDS.employee1),
    detail: employeeSelect.ok ? `rows=${rows.length}` : `${employeeSelect.status}`,
  });

  const employeeInsert = await restInsert(url, anon, employeeToken, {
    tenant_id: IDS.tenant,
    employee_id: IDS.employee1,
    work_date: WORK_DATE,
    entry_kind: 'session',
    reference_id: IDS.workSession,
    reference_key: `${IDS.tenant}:${IDS.employee1}:${WORK_DATE}:session:employee-deny`,
    review_status: 'open',
  });
  results.push({
    check: 'employee_insert_denied',
    ok: !employeeInsert.ok,
    detail: employeeInsert.ok ? 'unexpected success' : `${employeeInsert.status}`,
  });

  const employeeStatusPatch = await restPatchReview(url, anon, employeeToken, IDS.reviewPending, {
    review_status: 'approved',
  });
  const employeePatchRows = Array.isArray(employeeStatusPatch.body) ? employeeStatusPatch.body : [];
  const employeeApproved = employeePatchRows[0]?.review_status === 'approved';
  results.push({
    check: 'employee_update_status_denied',
    ok: !employeeApproved,
    detail: employeeApproved
      ? 'unexpected success'
      : `${employeeStatusPatch.status}, rows=${employeePatchRows.length}`,
  });

  const employeeActionInsert = await restInsertAction(url, anon, employeeToken, {
    tenant_id: IDS.tenant,
    entry_review_id: IDS.reviewPending,
    action: 'review_approved',
    prev_status: 'needs_clarification',
    new_status: 'approved',
    actor_id: IDS.employeeAuth,
    comment: 'Synthetic employee approve attempt',
    metadata: { seed: 'wfm_p21', case: 'employee_deny_action' },
  });
  results.push({
    check: 'employee_insert_action_denied',
    ok: !employeeActionInsert.ok,
    detail: employeeActionInsert.ok ? 'unexpected success' : `${employeeActionInsert.status}`,
  });

  const employee2Token = await signIn(url, anon, EMAILS.employee2, password);
  const employee2ForeignSelect = await restSelect(
    url,
    anon,
    employee2Token,
    `tenant_id=eq.${IDS.tenant}&employee_id=eq.${IDS.employee1}&select=id,employee_id`,
  );
  const foreignRows = Array.isArray(employee2ForeignSelect.body) ? employee2ForeignSelect.body : [];
  const employee2AllSelect = await restSelect(
    url,
    anon,
    employee2Token,
    `tenant_id=eq.${IDS.tenant}&select=id,employee_id`,
  );
  const allRows = Array.isArray(employee2AllSelect.body) ? employee2AllSelect.body : [];
  const employee2ForeignInsert = await restInsert(url, anon, employee2Token, {
    tenant_id: IDS.tenant,
    employee_id: IDS.employee1,
    work_date: WORK_DATE,
    entry_kind: 'session',
    reference_id: IDS.workSession,
    reference_key: `${IDS.tenant}:${IDS.employee1}:${WORK_DATE}:session:employee2-deny`,
    review_status: 'open',
  });
  const employee2ForeignPatch = await restPatchReview(url, anon, employee2Token, IDS.reviewPending, {
    review_status: 'approved',
  });
  const employee2PatchRows = Array.isArray(employee2ForeignPatch.body) ? employee2ForeignPatch.body : [];
  const employee2ForeignAction = await restInsertAction(url, anon, employee2Token, {
    tenant_id: IDS.tenant,
    entry_review_id: IDS.reviewPending,
    action: 'comment_added',
    actor_id: IDS.employee2Auth,
    comment: 'Synthetic employee2 foreign action attempt',
    metadata: { seed: 'wfm_p21', case: 'employee2_deny_action' },
  });
  results.push({
    check: 'employee2_cross_employee_blocked',
    ok: employee2ForeignSelect.ok
      && foreignRows.length === 0
      && employee2AllSelect.ok
      && allRows.length >= 1
      && allRows.every((r) => r.employee_id === IDS.employee2)
      && !employee2ForeignInsert.ok
      && employee2PatchRows.length === 0
      && !employee2ForeignAction.ok,
    detail: `foreign_rows=${foreignRows.length}, own_rows=${allRows.length}, insert=${employee2ForeignInsert.status}, patch_rows=${employee2PatchRows.length}, action=${employee2ForeignAction.status}`,
  });

  return { skipped: false, results };
}

async function main() {
  assertStagingTarget();
  const password = seedPassword();

  if (!parseFlag('skip-seed')) {
    const sql = buildSeedSql(password);
    applySeedSql(sql);
    console.log('\n✓ Staging seed SQL angewendet.');
  } else {
    console.log('\n↷ Seed übersprungen (--skip-seed).');
  }

  if (parseFlag('verify-rls')) {
    const rls = await verifyRls(password);
    if (!rls.skipped) {
      console.log('\nRLS Praxisprüfung:');
      let failed = false;
      for (const row of rls.results) {
        console.log(`  ${row.ok ? '✓' : '✗'} ${row.check}: ${row.detail}`);
        if (!row.ok) failed = true;
      }
      if (failed) process.exitCode = 1;
    }
  } else {
    console.log('\nHinweis: RLS-Praxisprüfung mit --verify-rls und STAGING_SUPABASE_ANON_KEY');
  }
}

main().catch((err) => {
  console.error(`\n✗ ${err.message ?? err}`);
  process.exitCode = 1;
});
