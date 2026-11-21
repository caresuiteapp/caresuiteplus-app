import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
const tenant = '11111111-1111-4111-8111-111111111111', user = '22222222-2222-4222-8222-222222222222', person = '33333333-3333-4333-8333-333333333333', id = '44444444-4444-4444-8444-444444444444', other = '55555555-5555-4555-8555-555555555555';
let db: PGlite;
const payload = () => ({ title: 'Beratung', startsAt: '2090-11-21T13:00:00Z', endsAt: '2090-11-21T13:30:00Z', location: '', clientId: person });
async function actor(permission = true, actor = user, company = tenant, portal = 'business') { await db.query("SELECT set_config('test.uid',$1,false),set_config('test.tenant',$2,false),set_config('test.allowed',$3,false),set_config('test.portal',$4,false)", [actor, company, String(permission), portal]); }
const create = (body: unknown = payload(), requestId = id, company = tenant) => db.query<{ receipt: { id: string; requestId: string; tenantId: string } }>('SELECT public.neo_create_appointment($1,$2,$3::jsonb) AS receipt', [company, requestId, JSON.stringify(body)]);
beforeAll(async () => {
  db = new PGlite(); await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA care_security;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.tenant',true),'')::uuid $$;
    CREATE FUNCTION public.has_permission(text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.allowed',true)='true' $$;
    CREATE FUNCTION public.current_portal_type() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('test.portal',true) $$;
    CREATE FUNCTION care_security.documentation_profile(uuid) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT auth.uid() $$;
    CREATE FUNCTION care_security.documentation_actor(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid() IS NOT NULL AND current_setting('test.allowed',true)='true' $$;
    CREATE TABLE public.tenants(id uuid PRIMARY KEY); INSERT INTO public.tenants VALUES('${tenant}'),('${other}');
    CREATE TABLE public.clients(id uuid PRIMARY KEY,tenant_id uuid,first_name text,last_name text,deleted_at timestamptz);
    INSERT INTO public.clients VALUES('${person}','${tenant}','Test','Person',NULL),('${other}','${other}','Fremde','Person',NULL);
    ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY; CREATE POLICY tenant_select ON public.clients FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id());
    CREATE TABLE public.care_assessments(id uuid PRIMARY KEY,tenant_id uuid,subject_id uuid,subject_type text,status text);
    CREATE TABLE public.appointments(id uuid PRIMARY KEY,tenant_id uuid,title text,client_name text,location text,starts_at timestamptz,ends_at timestamptz,status text,notes text);
    CREATE TABLE public.calendar_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,module_key text,source_type text,source_id uuid,event_type text,title text,start_at timestamptz,end_at timestamptz,timezone text,related_client_id uuid,location_name text,is_office_visible boolean,is_module_visible boolean,is_client_portal_visible boolean,is_employee_portal_visible boolean,created_by uuid,updated_by uuid,status text DEFAULT 'aktiv',archived_at timestamptz,UNIQUE(tenant_id,source_type,source_id));
    GRANT USAGE ON SCHEMA public,auth TO authenticated; GRANT SELECT ON public.clients,public.care_assessments,public.appointments,public.calendar_events TO authenticated;
  `);
  await db.exec(readFileSync('supabase/migrations/20261121011544_neo_voice_and_appointments.sql', 'utf8'));
}, 30000);
beforeEach(async () => { await db.exec('RESET ROLE; TRUNCATE care_security.neo_action_receipts,public.appointments,public.calendar_events,public.care_assessments; SET ROLE authenticated;'); await actor(); });
afterAll(async () => { await db?.close(); });
describe('NEO atomic appointment writer in PostgreSQL', () => {
  it('writes one appointment, linked calendar entry and receipt and replays the exact request', async () => {
    expect((await create()).rows[0].receipt).toEqual({ id, requestId: id, tenantId: tenant }); await create();
    expect((await db.query('SELECT * FROM public.appointments')).rows).toHaveLength(1);
    const rows = (await db.query('SELECT * FROM public.calendar_events')).rows; expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source_id: id, related_client_id: person, created_by: user, is_client_portal_visible: false, is_employee_portal_visible: false });
  });
  it('rejects request identity reuse for changed payload or another actor', async () => {
    await create(); await expect(create({ ...payload(), title: 'Anderer Titel' })).rejects.toMatchObject({ code: '23514' });
    await actor(true, other); await expect(create()).rejects.toMatchObject({ code: '23514' });
  });
  it('rejects missing rights, foreign tenants, portal identities and foreign persons', async () => {
    await actor(false); await expect(create()).rejects.toMatchObject({ code: '42501' });
    await actor(); await expect(create(payload(), id, other)).rejects.toMatchObject({ code: '42501' });
    await actor(true, user, tenant, 'employee'); await expect(create()).rejects.toMatchObject({ code: '42501' });
    await actor(); await expect(create({ ...payload(), clientId: other })).rejects.toMatchObject({ code: '42501' });
  });
  it('rejects an overlapping appointment while allowing adjacent times', async () => {
    await create(); await expect(create(payload(), other)).rejects.toMatchObject({ code: '23514' });
    await expect(create({ ...payload(), startsAt: '2090-11-21T13:30:00Z', endsAt: '2090-11-21T14:00:00Z' }, other)).resolves.toBeTruthy();
  });
  it.each([{ ...payload(), endsAt: payload().startsAt }, { ...payload(), title: '' }, { ...payload(), title: 42 }, { ...payload(), tool: 'delete' }, { ...payload(), startsAt: '2000-01-01T12:00Z', endsAt: '2000-01-01T13:00Z' }])('rejects malformed or past appointments %j', async body => { await expect(create(body)).rejects.toBeTruthy(); expect((await db.query('SELECT * FROM public.appointments')).rows).toEqual([]); });
  it('rolls the appointment back if calendar persistence fails', async () => {
    await db.exec("RESET ROLE; ALTER TABLE public.calendar_events ADD CONSTRAINT test_failure CHECK(title<>'Beratung'); SET ROLE authenticated;");
    try { await expect(create()).rejects.toMatchObject({ code: '23514' }); expect((await db.query('SELECT * FROM public.appointments')).rows).toEqual([]); }
    finally { await db.exec('RESET ROLE; ALTER TABLE public.calendar_events DROP CONSTRAINT test_failure; SET ROLE authenticated;'); }
  });
  it('does not grant authenticated users direct receipt access or bypass person RLS for voice', async () => {
    await expect(db.query('SELECT * FROM care_security.neo_action_receipts')).rejects.toMatchObject({ code: '42501' });
    expect((await db.query('SELECT public.neo_voice_authorize($1,$2,NULL) AS allowed', [tenant, person])).rows[0]).toEqual({ allowed: true });
    expect((await db.query('SELECT public.neo_voice_authorize($1,$2,NULL) AS allowed', [tenant, other])).rows[0]).toEqual({ allowed: false });
    await actor(false); expect((await db.query('SELECT public.neo_voice_authorize($1,$2,NULL) AS allowed', [tenant, person])).rows[0]).toEqual({ allowed: false });
  });
});
