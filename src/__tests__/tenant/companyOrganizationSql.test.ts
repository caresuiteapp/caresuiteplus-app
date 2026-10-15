import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL execution for the organization transaction and constraints.
// Authorization helpers are explicit fixtures; the independent access suite tests real RBAC.
const tenant = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const employee = '33333333-3333-4333-8333-333333333333';
const actor = '44444444-4444-4444-8444-444444444444';
let db: PGlite;
type Row = { id: string; version: number; status: string; name?: string; [key: string]: unknown };
async function save(kind: string, data: Record<string, unknown>, id: string | null = null, version: number | null = null, tenantId = tenant): Promise<Row> {
  const result = await db.query<{ record: Row }>('SELECT public.company_organization_save($1,$2,$3,$4,$5::jsonb) AS record', [tenantId, kind, id, version, JSON.stringify(data)]);
  return result.rows[0].record;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA care_security;
    GRANT USAGE ON SCHEMA public,care_security,auth TO authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '${actor}'::uuid$$;
    CREATE TABLE public.tenants(id uuid PRIMARY KEY);
    CREATE TABLE public.employees(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,first_name text,last_name text,status text);
    CREATE TABLE public.tenant_cost_centers(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,code text,name text,is_active boolean);
    INSERT INTO public.tenants VALUES('${tenant}'),('${other}');
    INSERT INTO public.employees VALUES('${employee}','${tenant}','Erika','Beispiel','aktiv');
    CREATE FUNCTION care_security.company_actor(t uuid,p text) RETURNS boolean LANGUAGE sql AS $$SELECT t='${tenant}'::uuid AND coalesce(current_setting('test.site',true),'')='' AND coalesce(current_setting('test.entity',true),'')=''$$;
    CREATE FUNCTION care_security.company_can_read(t uuid,p text) RETURNS boolean LANGUAGE sql AS $$SELECT t='${tenant}'::uuid$$;
    CREATE FUNCTION care_security.company_record_access(t uuid,p text,e uuid DEFAULT NULL,s uuid DEFAULT NULL,d uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql AS $$SELECT t='${tenant}'::uuid AND (care_security.company_actor(t,p) OR s::text=current_setting('test.site',true) OR e::text=current_setting('test.entity',true))$$;
  `);
  await db.exec(readFileSync(resolve('supabase/migrations/20261015085834_company_organization.sql'), 'utf8'));
}, 20000);
afterAll(async () => { await db?.close(); });

describe('company organization SQL transactions', () => {
  it('creates a canonical-company site and atomically writes its audit', async () => {
    const site = await save('site', { name: 'Hauptsitz', kind: 'headquarters', city: 'Herne' });
    expect(site.version).toBe(1); expect(site.status).toBe('active'); expect(site.entity_id).toBeNull();
    const audit = await db.query<{ action: string; actor_id: string }>('SELECT action,actor_id FROM public.company_organization_audit WHERE record_id=$1', [site.id]);
    expect(audit.rows).toEqual([{ action: 'created', actor_id: actor }]);
    await expect(save('site', { name: 'Zweiter Hauptsitz', kind: 'headquarters' })).rejects.toMatchObject({ code: '23505' });
  });
  it('rejects stale edits without writing a second audit and permits a fresh CAS edit', async () => {
    const site = await save('site', { name: 'CAS', kind: 'office' });
    await expect(save('site', { name: 'Veraltet' }, site.id, 8)).rejects.toMatchObject({ code: '40001' });
    const fresh = await save('site', { name: 'Aktuell' }, site.id, 1); expect(fresh.version).toBe(2);
    expect((await db.query<{ count: number }>('SELECT count(*)::integer AS count FROM public.company_organization_audit WHERE record_id=$1', [site.id])).rows[0].count).toBe(2);
  });
  it('blocks cross-tenant writes and foreign-tenant reference IDs', async () => {
    await expect(save('entity', { name: 'Fremd' }, null, null, other)).rejects.toMatchObject({ code: '42501' });
    await db.query('INSERT INTO public.company_legal_entities(tenant_id,name,id) VALUES($1,$2,$3)', [other, 'Fremd', '55555555-5555-4555-8555-555555555555']);
    await expect(save('site', { name: 'Falsche Zuordnung', kind: 'office', entity_id: '55555555-5555-4555-8555-555555555555' })).rejects.toMatchObject({ code: '23514' });
  });
  it('rejects entity and department cycles', async () => {
    const a = await save('entity', { name: 'Gesellschaft A' });
    const b = await save('entity', { name: 'Gesellschaft B', parent_entity_id: a.id });
    await expect(save('entity', { parent_entity_id: b.id }, a.id, 1)).rejects.toMatchObject({ code: '23514' });
    const d1 = await save('department', { name: 'Bereich A' });
    const d2 = await save('department', { name: 'Bereich B', parent_department_id: d1.id });
    await expect(save('department', { parent_department_id: d2.id }, d1.id, 1)).rejects.toMatchObject({ code: '23514' });
  });
  it('requires consistent site/entity and department/site context and protects active descendants', async () => {
    const entity = await save('entity', { name: 'Gesellschaft mit Standort' });
    const site = await save('site', { name: 'Standort mit Team', kind: 'branch', entity_id: entity.id });
    await expect(save('department', { name: 'Falsche Gesellschaft', site_id: site.id })).rejects.toMatchObject({ code: '23514' });
    const department = await save('department', { name: 'Team', entity_id: entity.id, site_id: site.id });
    await expect(save('site', { status: 'archived' }, site.id, 1)).rejects.toMatchObject({ code: '23514' });
    await expect(save('entity', { status: 'archived' }, entity.id, 1)).rejects.toMatchObject({ code: '23514' });
    await save('department', { status: 'archived' }, department.id, 1);
    await save('site', { status: 'archived' }, site.id, 1);
    const archived = await save('entity', { status: 'archived' }, entity.id, 1); expect(archived.status).toBe('archived');
  });
  it('blocks overlapping main placements while allowing a following period', async () => {
    const site = await save('site', { name: 'Zuordnung', kind: 'office' });
    await save('placement', { employee_id: employee, site_id: site.id, starts_on: '2026-01-01', ends_on: '2026-06-30', is_primary: true });
    await expect(save('placement', { employee_id: employee, site_id: site.id, starts_on: '2026-06-30', ends_on: '2026-12-31', is_primary: true })).rejects.toMatchObject({ code: '23514' });
    expect((await save('placement', { employee_id: employee, site_id: site.id, starts_on: '2026-07-01', ends_on: '2026-12-31', is_primary: true })).version).toBe(1);
  });
  it('rolls back the record if the required audit insert fails', async () => {
    await db.exec(`ALTER TABLE public.company_organization_audit ADD CONSTRAINT simulated_audit_failure CHECK(record_kind<>'relationship')`);
    await expect(save('relationship', { kind: 'franchise', partner_name: 'Franchise-Partner' })).rejects.toMatchObject({ code: '23514' });
    const result = await db.query<{ count: number }>('SELECT count(*)::integer AS count FROM public.company_relationships'); expect(result.rows[0].count).toBe(0);
    await db.exec('ALTER TABLE public.company_organization_audit DROP CONSTRAINT simulated_audit_failure');
  });
  it('rejects immutable/unrecognized fields even for authorized users', async () => {
    await expect(save('site', { name: 'Injected', kind: 'office', tenant_id: other })).rejects.toMatchObject({ code: '22023' });
    await expect(save('site', { name: 'Injected', kind: 'office', version: 999 })).rejects.toMatchObject({ code: '22023' });
  });
  it('enforces both previous and new scope contexts and prevents global entity writes', async () => {
    const outsideEntity = await save('entity', { name: 'Andere Gesellschaft' });
    const own = await save('site', { name: 'Eigener Standort', kind: 'office' });
    const foreign = await save('site', { name: 'Anderer Standort', kind: 'office' });
    const department = await save('department', { name: 'Eigenes Team', site_id: own.id });
    await db.query("SELECT set_config('test.site',$1,false)", [own.id]);
    try {
      await save('site', { name: 'Erlaubte Änderung' }, own.id, 1);
      await expect(save('site', { name: 'Fremde Änderung' }, foreign.id, 1)).rejects.toMatchObject({ code: '42501' });
      await expect(save('department', { site_id: foreign.id }, department.id, 1)).rejects.toMatchObject({ code: '42501' });
      await expect(save('entity', { name: 'Global' })).rejects.toMatchObject({ code: '42501' });
      await expect(save('site', { entity_id: outsideEntity.id }, own.id, 2)).rejects.toMatchObject({ code: '42501' });
    } finally { await db.query("SELECT set_config('test.site','',false)"); }
  });
  it('exposes no direct authenticated writes and reads minimal choice records', async () => {
    await db.exec('SET ROLE authenticated');
    try {
      await expect(db.exec(`INSERT INTO public.company_sites(tenant_id,name,kind) VALUES('${tenant}','Direkt','office')`)).rejects.toMatchObject({ code: '42501' });
      const choices = await db.query<{ list: Row[] }>('SELECT public.company_organization_choices($1,$2,0) AS list', [tenant, 'employees']);
      expect(Object.keys(choices.rows[0].list[0]).sort()).toEqual(['first_name', 'id', 'last_name', 'status']);
    } finally { await db.exec('RESET ROLE'); }
  });

  it('allows a scoped entity to manage external partners while protecting internal and unrelated partners', async () => {
    const own = await save('entity', { name: 'Freigegebene Gesellschaft' });
    const outside = await save('entity', { name: 'Nicht freigegebene Gesellschaft' });
    const hiddenExternal = await save('relationship', { kind: 'franchise', entity_id: outside.id, partner_name: 'Fremder externer Partner' });
    const hiddenInternal = await save('relationship', { kind: 'cooperation', entity_id: own.id, partner_entity_id: outside.id, partner_name: 'Interner Partner' });
    await db.query("SELECT set_config('test.entity',$1,false)", [own.id]);
    await db.exec('SET ROLE authenticated');
    try {
      const external = await save('relationship', { kind: 'franchise', entity_id: own.id, partner_entity_id: null, partner_name: 'Eigener externer Partner' });
      expect((await save('relationship', { territory: 'Herne' }, external.id, 1)).version).toBe(2);
      const visible = await db.query<{ id: string }>('SELECT id FROM public.company_relationships');
      expect(visible.rows.map(row => row.id)).toContain(external.id);
      expect(visible.rows.map(row => row.id)).not.toContain(hiddenExternal.id);
      expect(visible.rows.map(row => row.id)).not.toContain(hiddenInternal.id);
      await expect(save('relationship', { kind: 'franchise', entity_id: outside.id, partner_name: 'Fremd' })).rejects.toMatchObject({ code: '42501' });
      await expect(save('relationship', { partner_entity_id: outside.id }, external.id, 2)).rejects.toMatchObject({ code: '42501' });
      await expect(save('relationship', { partner_entity_id: null }, hiddenInternal.id, 1)).rejects.toMatchObject({ code: '42501' });
    } finally {
      await db.exec('RESET ROLE');
      await db.query("SELECT set_config('test.entity','',false)");
    }
  });
});
