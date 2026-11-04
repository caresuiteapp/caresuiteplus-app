import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { jsPDF } from 'jspdf';
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPdfUploadHandler, type PdfClient } from '../../../supabase/functions/_shared/pdfUploadHandler';

const TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FOREIGN_TENANT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const PROFILE = '33333333-3333-4333-8333-333333333333';
const ROLE = '44444444-4444-4444-8444-444444444444';
const EMPLOYEE = '55555555-5555-4555-8555-555555555555';
const OTHER_EMPLOYEE = '66666666-6666-4666-8666-666666666666';
const FOREIGN_EMPLOYEE = '77777777-7777-4777-8777-777777777777';
const PDF_HASH = 'ab'.repeat(32);
const sql = (name: string) => readFileSync(resolve('supabase/migrations', name), 'utf8');

const employeeSources = ['employee_contract_settings', 'portal_uploads', 'workforce_work_sessions',
  'workforce_time_events', 'workforce_time_entry_reviews', 'workforce_time_accounts',
  'workforce_absences', 'employee_logbook_trips'];
const tenantSources = ['workforce_time_review_actions', 'assist_visits', 'assignments',
  'assist_visit_execution_state', 'workforce_approvals'];

// Authentication/session functions and unrelated source tables are synthetic.
// Payroll constraints, indexes, RLS, triggers and the office-actor predicate come
// from real migrations. These tests never connect to Supabase or use live rows.
const FIXTURE = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA care_security;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.tenants(id uuid PRIMARY KEY);
CREATE TABLE public.roles(id uuid PRIMARY KEY, key text NOT NULL, tenant_id uuid, is_admin_role boolean DEFAULT false);
CREATE TABLE public.role_permissions(role_id uuid, tenant_id uuid, permission_key text, can_view boolean);
CREATE TABLE public.profiles(id uuid PRIMARY KEY, auth_user_id uuid, tenant_id uuid, role_id uuid, status text DEFAULT 'active', is_active boolean DEFAULT true);
CREATE TABLE public.employees(id uuid PRIMARY KEY, tenant_id uuid, first_name text, last_name text, status text DEFAULT 'aktiv', updated_at timestamptz DEFAULT now());
CREATE TABLE public.clients(id uuid PRIMARY KEY, tenant_id uuid, first_name text, last_name text, full_name text);
CREATE TABLE public.employee_payroll_settings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, employee_id uuid, compensation_type text, compensation_amount numeric, updated_at timestamptz DEFAULT now());
${employeeSources.map(name => `CREATE TABLE public.${name}(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, employee_id uuid, payload jsonb DEFAULT '{}', updated_at timestamptz DEFAULT now());`).join('\n')}
${tenantSources.map(name => `CREATE TABLE public.${name}(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, payload jsonb DEFAULT '{}', updated_at timestamptz DEFAULT now());`).join('\n')}
CREATE TABLE public.document_render_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, related_entity_table text, related_entity_id uuid, job_type text DEFAULT 'pdf', job_status text DEFAULT 'completed', pdf_path text, created_by uuid, finished_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, metadata jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.tenant', true), '')::uuid $$;
CREATE FUNCTION public.resolve_current_employee_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.employee', true), '')::uuid $$;
CREATE FUNCTION public.has_permission(permission text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT permission = ANY(string_to_array(current_setting('test.permissions', true), ',')) $$;
CREATE FUNCTION public.is_tenant_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION storage.foldername(path text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(path, '/') $$;
CREATE FUNCTION care_security.generated_pdf_reader(path text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
GRANT USAGE ON SCHEMA auth, storage, care_security TO authenticated;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_storage_tenant ON storage.objects FOR SELECT TO authenticated USING ((storage.foldername(name))[2] = public.current_tenant_id()::text);
`;

type Row = Record<string, unknown>;
let db: PGlite;

async function asOwner<T>(run: () => Promise<T>): Promise<T> {
  await db.exec('RESET ROLE;');
  try { return await run(); } finally { await db.exec('SET ROLE authenticated;'); }
}

async function actor(user = USER, tenant = TENANT, permissions = 'office.employees.view,office.employees.edit') {
  await db.query("SELECT set_config('test.uid', $1, false), set_config('test.tenant', $2, false), set_config('test.permissions', $3, false), set_config('test.employee', '', false)", [user, tenant, permissions]);
}

async function stored(table: 'payroll_month_statements' | 'payroll_month_audit_log' | 'employee_expense_claims'): Promise<Row[]> {
  return asOwner(async () => (await db.query<{ row: Row }>(`SELECT to_jsonb(t) AS row FROM public.${table} t ORDER BY created_at, id`)).rows.map(({ row }) => row));
}

beforeAll(async () => {
  const { PGlite: Database } = await import('@electric-sql/pglite');
  db = new Database();
  await db.exec(FIXTURE);
  await db.exec(sql('0264_payroll_monthly_statement_and_expenses.sql'));
  const officeActorSql = sql('20261013074646_admin_pdf_and_role_completion.sql').split('-- A column revoke')[0];
  await db.exec(officeActorSql);
  await db.exec('GRANT SELECT ON ALL TABLES IN SCHEMA public, storage TO authenticated;');
  await db.exec(sql('20261018050619_payroll_office_atomic_publication.sql'));
  // Existing production server reads work; the missing receipt-table grant is
  // deliberately left absent until the upload regression below applies it.
  await db.exec('GRANT SELECT ON public.profiles, public.roles, public.employees TO service_role;');
}, 30_000);

beforeEach(async () => {
  await db.exec(`RESET ROLE; TRUNCATE public.payroll_month_audit_log, public.payroll_month_statements, public.employee_expense_claims,
    public.employee_payroll_settings, public.document_render_jobs, storage.objects, public.profiles, public.role_permissions, public.roles,
    public.clients, ${[...employeeSources, ...tenantSources].map(name => `public.${name}`).join(', ')}, public.employees, public.tenants, auth.users CASCADE;`);
  await db.query('INSERT INTO auth.users VALUES ($1), ($2)', [USER, OTHER_USER]);
  await db.query('INSERT INTO public.tenants VALUES ($1), ($2)', [TENANT, FOREIGN_TENANT]);
  await db.query("INSERT INTO public.roles(id,key,tenant_id) VALUES ($1,'payroll_manager',$2)", [ROLE, TENANT]);
  await db.query("INSERT INTO public.role_permissions(role_id,tenant_id,permission_key,can_view) VALUES ($1,$2,'office.employees.edit',true),($1,$2,'office.employees.view',true)", [ROLE, TENANT]);
  await db.query('INSERT INTO public.profiles(id,auth_user_id,tenant_id,role_id) VALUES ($1,$2,$3,$4)', [PROFILE, USER, TENANT, ROLE]);
  await db.query("INSERT INTO public.employees(id,tenant_id,first_name,last_name) VALUES ($1,$4,'Test','Person'),($2,$4,'Other','Person'),($3,$5,'Foreign','Person')", [EMPLOYEE, OTHER_EMPLOYEE, FOREIGN_EMPLOYEE, TENANT, FOREIGN_TENANT]);
  await db.query("INSERT INTO public.employee_payroll_settings(tenant_id,employee_id,compensation_type,compensation_amount) VALUES($1,$2,'hourly',15)", [TENANT, EMPLOYEE]);
  await actor();
  await db.exec('SET ROLE authenticated;');
});

afterAll(async () => { await db?.close(); });

function snapshot(overrides: Row = {}): Row {
  return {
    employeeId: EMPLOYEE, employeeName: 'Test Person', employeeNumber: 'SYNTHETIC',
    periodYear: 2026, periodMonth: 10, compensationType: 'hourly', hourlyRateCents: 1500, fixedSalaryCents: 0,
    actualWorkMinutes: 60, travelMinutes: 0, vacationMinutes: 0, sickMinutes: 0, otherPaidAbsenceMinutes: 0,
    plannedMinutes: 0, payableMinutes: 60, overtimeTransferMinutes: 0, earnedGrossCents: 1500,
    projectedGrossCents: 1500, approvedExpensesCents: 0, projectedTotalPayoutCents: 1500,
    expenseClaims: [], generatedAt: '2026-10-18T06:00:00.000Z', ...overrides,
  };
}

async function revision(employee = EMPLOYEE, tenant = TENANT): Promise<string> {
  return (await db.query<{ revision: string }>('SELECT public.payroll_office_source_revision($1,$2,2026,10) AS revision', [tenant, employee])).rows[0].revision;
}

type Publication = {
  tenant: string; employee: string; year: number; month: number; id: string;
  expectedVersion: number; expectedUpdatedAt: unknown; sourceRevision: string;
  snapshot: Row; path: string; hash: string;
};

async function preparePublication(previous?: Row, overrides: Partial<Publication> = {}): Promise<Publication> {
  const id = randomUUID();
  const request: Publication = {
    tenant: TENANT, employee: EMPLOYEE, year: 2026, month: 10, id,
    expectedVersion: Number(previous?.version ?? 0), expectedUpdatedAt: previous?.updated_at ?? null,
    sourceRevision: await revision(), snapshot: snapshot(),
    path: `tenant/${TENANT}/generated/payroll-${id}/${PDF_HASH}.pdf`, hash: PDF_HASH, ...overrides,
  };
  await asOwner(async () => {
    await db.query("INSERT INTO public.document_render_jobs(tenant_id,related_entity_table,related_entity_id,pdf_path,created_by) VALUES($1,'payroll_month_statements',$2,$3,$4)", [request.tenant, request.id, request.path, PROFILE]);
    await db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('office-documents',$1,'{\"mimetype\":\"application/pdf\",\"size\":2000}')", [request.path]);
  });
  return request;
}

async function publish(request: Publication): Promise<Row> {
  return (await db.query<{ row: Row }>('SELECT to_jsonb(public.publish_office_payroll_statement($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)) AS row', [
    request.tenant, request.employee, request.year, request.month, request.id, request.expectedVersion,
    request.expectedUpdatedAt, request.sourceRevision, JSON.stringify(request.snapshot), request.path, request.hash,
  ])).rows[0].row;
}

async function claim(overrides: Row = {}): Promise<Row> {
  const data: Row = { id: randomUUID(), tenant_id: TENANT, employee_id: EMPLOYEE, expense_date: '2026-10-07',
    category: 'receipt', description: 'Synthetic receipt', business_purpose: 'Synthetic business purpose',
    amount_cents: 1000, status: 'submitted', tax_treatment: 'taxable',
    created_at: '2026-10-07T12:00:00.000Z', updated_at: '2026-10-07T12:00:00.000Z', ...overrides };
  return asOwner(async () => (await db.query<{ row: Row }>(`INSERT INTO public.employee_expense_claims(${Object.keys(data).join(',')}) VALUES(${Object.keys(data).map((_, index) => `$${index + 1}`).join(',')}) RETURNING to_jsonb(employee_expense_claims) AS row`, Object.values(data))).rows[0].row);
}

async function review(item: Row, overrides: Row = {}): Promise<Row> {
  const data: Row = { tenant: TENANT, employee: EMPLOYEE, year: 2026, month: 10, id: item.id,
    updatedAt: item.updated_at, status: 'approved', amount: 1000, note: null, reason: null, ...overrides };
  return (await db.query<{ row: Row }>('SELECT to_jsonb(public.review_office_payroll_expense($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)) AS row', [
    data.tenant, data.employee, data.year, data.month, data.id, data.updatedAt, data.status, data.amount, data.note, data.reason,
  ])).rows[0].row;
}

describe('Office payroll publication commits the version and receipt together', () => {
  it('recovers the real PDF upload receipt under service_role and publishes it under the office actor', async () => {
    const id = randomUUID();
    const sourceRevision = await revision();
    const files = new Map<string, Uint8Array>();
    async function asService<T>(run: () => Promise<T>): Promise<T> {
      await db.exec('SET ROLE service_role;');
      try { return await run(); } finally { await db.exec('SET ROLE authenticated;'); }
    }
    const client: PdfClient = {
      auth: { getUser: async () => ({ data: { user: { id: USER } }, error: null }) },
      rpc: async (name, args) => name === 'care_security_pdf_upload_ready'
        ? { data: true, error: null }
        : { data: (await db.query<{ allowed: boolean }>('SELECT public.has_permission($1) AS allowed', [args.p_permission_key])).rows[0].allowed, error: null },
      from: table => ({
        select: () => {
          const filters: string[] = []; const values: unknown[] = [];
          const query = {
            eq: (column: string, value: unknown) => { values.push(value); filters.push(`${column}=$${values.length}`); return query; },
            or: () => { values.push(USER); filters.push(`(auth_user_id=$${values.length} OR (auth_user_id IS NULL AND id=$${values.length}))`); return query; },
            maybeSingle: async () => asService(async () => ({ data: (await db.query<Row>(`SELECT * FROM public.${table} WHERE ${filters.join(' AND ')}`, values)).rows[0] ?? null, error: null })),
            single: async () => query.maybeSingle(),
          };
          return query;
        },
        upsert: async row => asService(async () => {
          try {
            const columns = Object.keys(row);
            await db.query(`INSERT INTO public.${table}(${columns.join(',')}) VALUES(${columns.map((_, index) => `$${index + 1}`).join(',')}) ON CONFLICT(id) DO NOTHING`, Object.values(row));
            return { error: null };
          } catch (error) { return { error }; }
        }),
      }),
      storage: { from: () => ({
        upload: async (path, bytes) => {
          if (files.has(path)) return { error: { statusCode: '409' } };
          files.set(path, new Uint8Array(bytes));
          await asOwner(() => db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('office-documents',$1,$2::jsonb)", [path, JSON.stringify({ mimetype: 'application/pdf', size: bytes.length })]));
          return { error: null };
        },
        download: async path => ({ data: files.has(path) ? new Blob([new Uint8Array(files.get(path)!)]) : null, error: null }),
      }) },
    };
    const handler = createPdfUploadHandler({ userClient: () => client, serviceClient: () => client, corsHeaders: {},
      respond: (value, status = 200) => new Response(JSON.stringify(value), { status }) });
    const document = new jsPDF(); document.text('Synthetic payroll: 603 EUR; overtime 7:04 h; no travel credit', 10, 20);
    const pdfBase64 = Buffer.from(document.output('arraybuffer')).toString('base64');
    const upload = () => handler(new Request('https://example.test/render-document-pdf', { method: 'POST',
      headers: { Authorization: 'Bearer synthetic-session' },
      body: JSON.stringify({ tenantId: TENANT, employeeId: EMPLOYEE, documentId: `payroll-${id}`, pdfBase64, storeOnly: true }) }));

    await asOwner(() => db.exec('REVOKE SELECT, INSERT ON public.document_render_jobs FROM service_role;'));
    const failed = await upload();
    expect(failed.status).toBe(503);
    expect((await failed.json()).error).toContain('PDF-Upload konnte nicht vollständig bestätigt');
    expect(await stored('payroll_month_statements')).toEqual([]);
    await asOwner(() => db.exec(readFileSync(resolve('supabase/patches/pdf_upload_render_job_service_privileges.sql'), 'utf8')));
    const uploaded = await upload(); // Same file: Storage conflict is verified, never overwritten.
    expect(uploaded.status).toBe(200);
    const receipt = await uploaded.json();
    expect(files.size).toBe(1);
    expect((await db.query<{ allowed: boolean }>("SELECT has_table_privilege('service_role','public.document_render_jobs','UPDATE') OR has_table_privilege('service_role','public.document_render_jobs','DELETE') AS allowed")).rows[0].allowed).toBe(false);
    const result = await publish({ tenant: TENANT, employee: EMPLOYEE, year: 2026, month: 10, id,
      expectedVersion: 0, expectedUpdatedAt: null, sourceRevision,
      snapshot: snapshot({ actualWorkMinutes: 2836, payableMinutes: 2412, overtimeTransferMinutes: 424,
        earnedGrossCents: 60300, projectedGrossCents: 60300, projectedTotalPayoutCents: 60300 }), path: receipt.pdfPath, hash: receipt.sha256 });
    expect(result).toMatchObject({ status: 'published', pdf_path: receipt.pdfPath, pdf_sha256: receipt.sha256,
      actual_work_minutes: 2836, earned_gross_cents: 60300, overtime_transfer_minutes: 424 });
    expect(await stored('payroll_month_audit_log')).toHaveLength(1);
    expect((await db.query('SELECT name FROM storage.objects WHERE name=$1', [receipt.pdfPath])).rows).toHaveLength(1);
  });

  it('publishes the first version and makes its exact PDF readable to HR', async () => {
    const request = await preparePublication();
    // No general generated-document access: the reference becomes readable only after publication.
    expect((await db.query('SELECT name FROM storage.objects WHERE name=$1', [request.path])).rows).toEqual([]);
    const result = await publish(request);
    expect(result).toMatchObject({ id: request.id, tenant_id: TENANT, employee_id: EMPLOYEE, version: 1,
      status: 'published', snapshot_json: request.snapshot, pdf_path: request.path, pdf_sha256: PDF_HASH,
      actual_work_minutes: 60, earned_gross_cents: 1500, published_by: USER });
    expect((await db.query('SELECT name FROM storage.objects WHERE name=$1', [request.path])).rows).toEqual([{ name: request.path }]);
    expect(await stored('payroll_month_audit_log')).toEqual([expect.objectContaining({ statement_id: request.id,
      employee_id: EMPLOYEE, actor_id: USER, action: 'published', metadata: expect.objectContaining({ pdf_sha256: PDF_HASH }) })]);
  });

  it('replaces only an actionable version and appends one audit record', async () => {
    const first = await publish(await preparePublication());
    const second = await publish(await preparePublication(first));
    expect(second.version).toBe(2);
    expect((await stored('payroll_month_statements')).map(row => [row.id, row.status])).toEqual([[first.id, 'superseded'], [second.id, 'published']]);
    expect(await stored('payroll_month_audit_log')).toHaveLength(2);
  });

  it('returns the same saved version after a lost response without publishing or auditing twice', async () => {
    const request = await preparePublication();
    const first = await publish(request);
    const retry = await publish(request);
    expect(retry).toEqual(first);
    expect(await stored('payroll_month_statements')).toHaveLength(1);
    expect(await stored('payroll_month_audit_log')).toHaveLength(1);
    await expect(publish({ ...request, snapshot: { ...request.snapshot, employeeName: 'Changed' } })).rejects.toThrow(/Veröffentlichungskennung wurde bereits anders verwendet/);
  });

  it('rejects another caller using a stale version without superseding the new version', async () => {
    const firstRequest = await preparePublication();
    const concurrentRequest = await preparePublication();
    const first = await publish(firstRequest);
    await expect(publish(concurrentRequest)).rejects.toMatchObject({ code: '40001' });
    expect(await stored('payroll_month_statements')).toEqual([first]);
  });

  it('rejects a changed source revision or wage before changing the previous publication', async () => {
    const first = await publish(await preparePublication());
    const request = await preparePublication(first);
    await asOwner(() => db.query('UPDATE public.employee_payroll_settings SET compensation_amount=16 WHERE employee_id=$1', [EMPLOYEE]));
    await expect(publish(request)).rejects.toMatchObject({ code: '40001' });
    await expect(publish({ ...request, sourceRevision: await revision() })).rejects.toThrow(/Vergütung/);
    expect(await stored('payroll_month_statements')).toEqual([first]);
  });

  it.each(['confirmed', 'locked', 'paid'])('does not replace a %s month', async status => {
    const first = await publish(await preparePublication());
    await asOwner(() => db.query('UPDATE public.payroll_month_statements SET status=$1 WHERE id=$2', [status, first.id]));
    const current = (await stored('payroll_month_statements'))[0];
    await expect(publish(await preparePublication(current))).rejects.toThrow(/darf nicht ersetzt/);
    expect(await stored('payroll_month_statements')).toEqual([current]);
  });

  it('rolls back superseding the prior version when the new insert fails', async () => {
    const first = await publish(await preparePublication());
    const request = await preparePublication(first);
    await asOwner(() => db.exec('ALTER TABLE public.payroll_month_statements ADD CONSTRAINT fixture_statement_failure CHECK(version < 2);'));
    try {
      await expect(publish(request)).rejects.toMatchObject({ code: '23514' });
      expect(await stored('payroll_month_statements')).toEqual([first]);
      expect(await stored('payroll_month_audit_log')).toHaveLength(1);
    } finally { await asOwner(() => db.exec('ALTER TABLE public.payroll_month_statements DROP CONSTRAINT fixture_statement_failure;')); }
  });

  it('rolls back insert and superseding if the audit receipt cannot be stored', async () => {
    const first = await publish(await preparePublication());
    const request = await preparePublication(first);
    await asOwner(() => db.exec(`ALTER TABLE public.payroll_month_audit_log ADD CONSTRAINT fixture_audit_failure CHECK(statement_id <> '${request.id}'::uuid);`));
    try {
      await expect(publish(request)).rejects.toMatchObject({ code: '23514' });
      expect(await stored('payroll_month_statements')).toEqual([first]);
      expect(await stored('payroll_month_audit_log')).toHaveLength(1);
    } finally { await asOwner(() => db.exec('ALTER TABLE public.payroll_month_audit_log DROP CONSTRAINT fixture_audit_failure;')); }
  });

  it('rolls back the entire publication when the uploaded PDF is missing', async () => {
    const first = await publish(await preparePublication());
    const request = await preparePublication(first);
    await asOwner(() => db.query('DELETE FROM storage.objects WHERE name=$1', [request.path]));
    await expect(publish(request)).rejects.toThrow(/PDF-Datei ist nicht verfügbar/);
    expect(await stored('payroll_month_statements')).toEqual([first]);
    expect(await stored('payroll_month_audit_log')).toHaveLength(1);
  });

  it('rejects mismatched PDF identity, month, compensation and approved-expense totals', async () => {
    const request = await preparePublication();
    for (const changed of [
      { ...request, path: `tenant/${FOREIGN_TENANT}/generated/payroll-${request.id}/${PDF_HASH}.pdf` },
      { ...request, snapshot: { ...request.snapshot, employeeId: OTHER_EMPLOYEE } },
      { ...request, snapshot: { ...request.snapshot, periodMonth: 9 } },
      { ...request, snapshot: { ...request.snapshot, hourlyRateCents: 1501 } },
      { ...request, snapshot: { ...request.snapshot, approvedExpensesCents: 100 } },
      { ...request, snapshot: { ...request.snapshot, payableMinutes: -1 } },
    ]) await expect(publish(changed)).rejects.toThrow();
    expect(await stored('payroll_month_statements')).toHaveLength(0);
    expect(await stored('payroll_month_audit_log')).toHaveLength(0);
  });
});

describe('Office payroll permissions and source isolation', () => {
  it.each(['missing user', 'different tenant', 'portal role', 'inactive profile', 'missing permission'])('rejects %s without writing', async condition => {
    const request = await preparePublication();
    if (condition === 'missing user') await actor('');
    if (condition === 'different tenant') await actor(USER, FOREIGN_TENANT);
    if (condition === 'portal role') await asOwner(() => db.exec("UPDATE public.roles SET key='employee_portal';"));
    if (condition === 'inactive profile') await asOwner(() => db.exec('UPDATE public.profiles SET is_active=false;'));
    if (condition === 'missing permission') await asOwner(() => db.exec("DELETE FROM public.role_permissions WHERE permission_key='office.employees.edit';"));
    await expect(publish(request)).rejects.toMatchObject({ code: '42501' });
    expect(await stored('payroll_month_statements')).toHaveLength(0);
    expect(await stored('payroll_month_audit_log')).toHaveLength(0);
  });

  it('denies anonymous execution and foreign employee scope', async () => {
    const request = await preparePublication();
    await expect(publish({ ...request, employee: FOREIGN_EMPLOYEE, snapshot: { ...request.snapshot, employeeId: FOREIGN_EMPLOYEE } })).rejects.toThrow();
    await db.exec('SET ROLE anon;');
    await expect(publish(request)).rejects.toMatchObject({ code: '42501' });
  });

  it('detects current and historical selected-employee source changes, while ignoring another tenant', async () => {
    const original = await revision();
    await asOwner(() => db.query("INSERT INTO public.workforce_work_sessions(tenant_id,employee_id,payload) VALUES($1,$2,'{\"work_date\":\"2025-01-02\"}')", [FOREIGN_TENANT, FOREIGN_EMPLOYEE]));
    expect(await revision()).toBe(original);
    await asOwner(() => db.query("INSERT INTO public.workforce_work_sessions(tenant_id,employee_id,payload) VALUES($1,$2,'{\"work_date\":\"2025-01-02\"}')", [TENANT, EMPLOYEE]));
    expect(await revision()).not.toBe(original);
  });
});

describe('Office expense review is conditional and audited', () => {
  it('stores the exact approval and preserves the existing tax classification', async () => {
    const item = await claim();
    const result = await review(item);
    expect(result).toMatchObject({ id: item.id, status: 'approved', approved_amount_cents: 1000, tax_treatment: 'taxable', reviewed_by: USER });
    expect(await stored('payroll_month_audit_log')).toEqual([expect.objectContaining({ expense_claim_id: item.id,
      action: 'expense_reviewed', metadata: expect.objectContaining({ status: 'approved', tax_treatment: 'taxable' }) })]);
    await expect(review(item)).rejects.toMatchObject({ code: '40001' });
    expect(await stored('payroll_month_audit_log')).toHaveLength(1);
  });

  it('requires a reason for reductions or questions and validates the requested amount', async () => {
    const item = await claim();
    for (const change of [{ amount: 1001 }, { amount: -1 }, { amount: 900 },
      { status: 'partially_approved', amount: 900, note: 'short'.slice(0, 4) },
      { status: 'needs_info', note: '' }, { status: 'rejected', reason: '' }]) {
      await expect(review(item, change)).rejects.toThrow();
    }
    expect((await stored('employee_expense_claims'))[0].status).toBe('submitted');
    expect(await stored('payroll_month_audit_log')).toHaveLength(0);
    expect(await review(item, { status: 'partially_approved', amount: 700, note: 'Receipt covers only part' }))
      .toMatchObject({ status: 'partially_approved', approved_amount_cents: 700, office_note: 'Receipt covers only part' });
  });

  it('rejects wrong month, wrong employee, stale revision and non-EUR claims', async () => {
    const item = await claim();
    for (const change of [{ month: 9 }, { employee: OTHER_EMPLOYEE }, { updatedAt: '2026-10-06T00:00:00Z' }]) {
      await expect(review(item, change)).rejects.toMatchObject({ code: '40001' });
    }
    const foreignCurrency = await claim({ currency: 'USD' });
    await expect(review(foreignCurrency)).rejects.toThrow(/EUR/);
    expect(await stored('payroll_month_audit_log')).toHaveLength(0);
  });

  it.each(['confirmed', 'locked', 'paid'])('leaves expenses unchanged for a %s month', async status => {
    const item = await claim();
    const first = await publish(await preparePublication());
    await asOwner(() => db.query('UPDATE public.payroll_month_statements SET status=$1 WHERE id=$2', [status, first.id]));
    await expect(review(item)).rejects.toThrow(/bereits bestätigt/);
    expect((await stored('employee_expense_claims'))[0].status).toBe('submitted');
    expect(await stored('payroll_month_audit_log')).toHaveLength(1);
  });

  it('rolls the decision back when storing its audit fails', async () => {
    const item = await claim();
    await asOwner(() => db.exec("ALTER TABLE public.payroll_month_audit_log ADD CONSTRAINT fixture_expense_audit_failure CHECK(action <> 'expense_reviewed');"));
    try {
      await expect(review(item)).rejects.toMatchObject({ code: '23514' });
      expect(await stored('employee_expense_claims')).toEqual([item]);
      expect(await stored('payroll_month_audit_log')).toHaveLength(0);
    } finally { await asOwner(() => db.exec('ALTER TABLE public.payroll_month_audit_log DROP CONSTRAINT fixture_expense_audit_failure;')); }
  });
});
