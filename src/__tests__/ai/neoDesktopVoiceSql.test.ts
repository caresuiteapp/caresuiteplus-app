import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const tenant = '11111111-1111-4111-8111-111111111111';
const actor = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
let db: PGlite;
async function identity(values: { uid?: string; tenantId?: string; portal?: string; coarse?: boolean; company?: boolean } = {}) {
  await db.query("SELECT set_config('test.uid',$1,false),set_config('test.tenant',$2,false),set_config('test.portal',$3,false),set_config('test.coarse',$4,false),set_config('test.company',$5,false)",
    [values.uid ?? actor, values.tenantId ?? tenant, values.portal ?? 'business', String(values.coarse ?? true), String(values.company ?? true)]);
}
async function allowed(company: string | null = tenant) { return (await db.query<{ allowed: boolean }>('SELECT public.neo_desktop_voice_authorize($1) AS allowed', [company])).rows[0].allowed; }

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA care_security;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.tenant',true),'')::uuid $$;
    CREATE FUNCTION public.current_portal_type() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.portal',true),'') $$;
    CREATE FUNCTION public.has_permission(text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.coarse',true)='true' $$;
    CREATE FUNCTION care_security.company_actor(uuid,text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.company',true)='true' $$;
    REVOKE ALL ON FUNCTION care_security.company_actor(uuid,text) FROM PUBLIC;
    GRANT USAGE ON SCHEMA public,auth,care_security TO authenticated;
    GRANT EXECUTE ON FUNCTION care_security.company_actor(uuid,text) TO authenticated;
  `);
  const files = readdirSync('supabase/migrations').filter(name => name.endsWith('_neo_desktop_voice_authorization.sql'));
  if (files.length !== 1) throw Error('Exactly one recorded desktop voice authorization migration is required.');
  await db.exec(readFileSync(`supabase/migrations/${files[0]}`, 'utf8'));
}, 30000);
beforeEach(async () => { await db.exec('RESET ROLE; SET ROLE authenticated;'); await identity(); });
afterAll(async () => { await db?.close(); });

describe('NEO desktop voice SQL authorization', () => {
  it('permits an active authorized business actor only in the current tenant', async () => {
    expect(await allowed()).toBe(true); expect(await allowed(other)).toBe(false); expect(await allowed(null)).toBe(false);
  });
  it.each(['employee', 'client', 'relative', 'family', 'unexpected'])('refuses portal audience %s even when coarse permissions remain true', async portal => {
    await identity({ portal }); expect(await allowed()).toBe(false);
  });
  it('refuses an anonymous actor and absent current tenant', async () => {
    await identity({ uid: '' }); expect(await allowed()).toBe(false);
    await identity({ tenantId: '' }); expect(await allowed()).toBe(false);
  });
  it('requires both current coarse access and the authoritative active company guard', async () => {
    await identity({ coarse: true, company: false }); expect(await allowed()).toBe(false);
    await identity({ coarse: false, company: true }); expect(await allowed()).toBe(false);
    await identity({ portal: '', company: true }); expect(await allowed()).toBe(true);
    await identity({ portal: '', company: false }); expect(await allowed()).toBe(false);
  });
  it('does not grant anonymous or service-role execution and uses invoker authority', async () => {
    await db.exec('RESET ROLE;');
    const result = (await db.query<{ anon: boolean; service: boolean; authenticated: boolean; privileged: boolean }>(`SELECT
      has_function_privilege('anon','public.neo_desktop_voice_authorize(uuid)','EXECUTE') AS anon,
      has_function_privilege('service_role','public.neo_desktop_voice_authorize(uuid)','EXECUTE') AS service,
      has_function_privilege('authenticated','public.neo_desktop_voice_authorize(uuid)','EXECUTE') AS authenticated,
      (SELECT prosecdef FROM pg_proc WHERE oid='public.neo_desktop_voice_authorize(uuid)'::regprocedure) AS privileged`)).rows[0];
    expect(result).toEqual({ anon: false, service: false, authenticated: true, privileged: false });
  });
});
