import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Functional transaction tests. The dedicated company-access suite verifies real RBAC helpers;
// these tiny permission stubs isolate resource constraints, CAS and transaction rollback.
const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const EMPLOYEE = '33333333-3333-4333-8333-333333333333';
const SITE = '44444444-4444-4444-8444-444444444444';
const DOCUMENT = '55555555-5555-4555-8555-555555555555';
const LOGBOOK = '66666666-6666-4666-8666-666666666666';
let db: PGlite;
type Row = Record<string, unknown>;
const base = { entity_id: null, site_id: null, department_id: null, notes: null };
const vehicle = (extra: Row = {}) => ({ ...base, plate: 'BO AB 123', vin: null, make: 'VW', model: 'Golf', vehicle_type: 'car', ownership: 'owned', status: 'available', mileage: 100, ...extra });
async function command(kind: string, input: Row, tenant = TENANT) { return (await db.query<{ result: Row }>('select public.company_resources_save($1,$2,$3::jsonb) result', [tenant, kind, JSON.stringify(input)])).rows[0].result; }
const count = async (table: string) => (await db.query<{ n: number }>(`select count(*)::integer n from public.${table}`)).rows[0].n;

beforeAll(async () => {
 db = new PGlite();
 await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE SCHEMA care_security; GRANT USAGE ON SCHEMA care_security TO authenticated;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '${EMPLOYEE}'::uuid$$;
 CREATE TABLE public.tenants(id uuid primary key);
 CREATE TABLE public.employees(id uuid primary key,tenant_id uuid,first_name text,last_name text,status text,deleted_at timestamptz);
 CREATE TABLE public.company_legal_entities(id uuid primary key,tenant_id uuid,name text,status text,unique(tenant_id,id));
 CREATE TABLE public.company_sites(id uuid primary key,tenant_id uuid,name text,status text,entity_id uuid,unique(tenant_id,id));
 CREATE TABLE public.company_departments(id uuid primary key,tenant_id uuid,name text,status text,entity_id uuid,site_id uuid,unique(tenant_id,id));
 CREATE TABLE public.inventory_categories(id uuid primary key,tenant_id uuid,group_key text);
 CREATE TABLE public.inventory_items(id uuid primary key,tenant_id uuid,category_id uuid,name text,status text);
 CREATE TABLE public.central_document_records(id uuid primary key,tenant_id uuid,target text,entity_id uuid,title text,state text,revision integer,snapshot_json jsonb,created_at timestamptz);
 CREATE TABLE public.employee_logbook_vehicles(id uuid primary key,tenant_id uuid,employee_id uuid,ownership text,plate text,make text,model text,active boolean,updated_at timestamptz,unique(tenant_id,employee_id,plate));
 CREATE FUNCTION care_security.company_actor(t uuid,p text) RETURNS boolean LANGUAGE sql AS $$SELECT t='${TENANT}'::uuid$$;
 CREATE FUNCTION care_security.company_can_read(t uuid,p text) RETURNS boolean LANGUAGE sql AS $$SELECT t='${TENANT}'::uuid$$;
 CREATE FUNCTION care_security.company_record_access(t uuid,p text,e uuid,s uuid,d uuid) RETURNS boolean LANGUAGE sql AS $$SELECT t='${TENANT}'::uuid$$;
 CREATE FUNCTION care_security.company_organization_employee_access(t uuid,e uuid) RETURNS boolean LANGUAGE sql AS $$SELECT EXISTS(SELECT 1 FROM public.employees WHERE tenant_id=t AND id=e)$$;
 CREATE FUNCTION public.company_access_permissions(t uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '{"permissions":["business.tenant.manage"],"scope_limited":false,"can_manage_scopes":true}'::jsonb$$;
 INSERT INTO public.tenants VALUES('${TENANT}'),('${OTHER}');
 INSERT INTO public.employees VALUES('${EMPLOYEE}','${TENANT}','Eva','Test','aktiv',NULL);
 INSERT INTO public.company_sites VALUES('${SITE}','${TENANT}','Zentrale','active',NULL);
 INSERT INTO public.central_document_records VALUES('${DOCUMENT}','${OTHER}','company','${OTHER}','Fremddokument','issued',1,'{}',now());
 INSERT INTO public.employee_logbook_vehicles VALUES('${LOGBOOK}','${TENANT}','${EMPLOYEE}','company','ALT 12','Old','Car',true,now());
 `);
 await db.exec(readFileSync('supabase/migrations/20261015085836_company_resources.sql', 'utf8'));
}, 30000);
afterAll(async () => { await db?.close(); });

describe('company resources transactional SQL', () => {
 it('creates and updates a contract with compare-and-swap and audit', async () => {
  const c = await command('contract', { ...base, title: 'Miete', contract_type: 'rent', counterparty: 'Vermieter', status: 'active', cost_cents: 125000, payment_interval: 'monthly', currency: 'EUR' });
  expect(c.version).toBe(1);
  const updated = await command('contract', { id: c.id, expected_version: 1, title: 'Büromiete' });
  expect(updated.version).toBe(2);
  await expect(command('contract', { id: c.id, expected_version: 1, title: 'Veralteter Stand' })).rejects.toThrow('inzwischen');
  expect((await db.query<{ title: string }>('select title from company_contracts where id=$1', [c.id])).rows[0].title).toBe('Büromiete');
 });
 it('rejects foreign documents and tenant access without partial writes', async () => {
  const before = await count('company_contracts');
  await expect(command('contract', { ...base, title: 'Fremd', contract_type: 'other', counterparty: 'X', document_id: DOCUMENT })).rejects.toThrow('nicht verfügbar');
  await expect(command('vehicle', vehicle(), OTHER)).rejects.toThrow('Berechtigung');
  expect(await count('company_contracts')).toBe(before);
 });
 it('normalizes plates and refuses duplicates and falling mileage', async () => {
  const v = await command('vehicle', vehicle());
  await expect(command('vehicle', vehicle({ plate: 'bo-ab123' }))).rejects.toThrow();
  await expect(command('vehicle', { id: v.id, expected_version: 1, mileage: 99 })).rejects.toThrow('nicht sinken');
 });
 it('reserves a vehicle without overlap and returns an actual active allocation atomically', async () => {
  const v = await command('vehicle', vehicle({ plate: 'BO AB 124' }));
  const start = new Date(Date.now() - 3600000).toISOString();
  const a = await command('allocation', { vehicle_id: v.id, employee_id: EMPLOYEE, starts_at: start, ends_at: null, status: 'active', issue_mileage: 100, issue_condition: 'Ohne Schäden', notes: null });
  await expect(command('allocation', { vehicle_id: v.id, employee_id: EMPLOYEE, starts_at: start, ends_at: null, status: 'active', issue_mileage: 100, issue_condition: 'Gut' })).rejects.toThrow('bereits vergeben');
  await expect(command('vehicle', { id: v.id, expected_version: 2, archive: true })).rejects.toThrow('Offene');
  const r = (await db.query<{ result: Row }>('select public.company_resources_return_vehicle($1,$2::jsonb) result', [TENANT, JSON.stringify({ id: a.id, expected_version: 1, returned_at: new Date().toISOString(), return_mileage: 120, return_condition: 'Unbeschädigt' })])).rows[0].result;
  expect(r.status).toBe('returned');
  expect(Number((await db.query<{ mileage: string }>('select mileage from company_vehicles where id=$1', [v.id])).rows[0].mileage)).toBe(120);
  await expect(command('allocation', { id: a.id, expected_version: 2, notes: 'Überschreiben' })).rejects.toThrow('Abgeschlossene');
 });
 it('links a central identity to an existing logbook row without replacing its ID', async () => {
  const v = await command('vehicle', vehicle({ plate: 'BO AB 125' }));
  await db.query('select public.company_resources_link_logbook($1,$2::jsonb)', [TENANT, JSON.stringify({ vehicle_id: v.id, logbook_vehicle_id: LOGBOOK, expected_version: 1 })]);
  const row = (await db.query<Row>('select * from employee_logbook_vehicles where id=$1', [LOGBOOK])).rows[0];
  expect(row.company_vehicle_id).toBe(v.id); expect(row.plate).toBe('BO AB 125');
  await expect(db.query('update employee_logbook_vehicles set plate=$1 where id=$2', ['CHANGED', LOGBOOK])).rejects.toThrow('zentral');
  await command('vehicle', { id: v.id, expected_version: 2, plate: 'BO AB 126' });
  expect((await db.query<Row>('select plate from employee_logbook_vehicles where id=$1', [LOGBOOK])).rows[0].plate).toBe('BO AB 126');
 });
 it('rolls back the vehicle when its audit cannot be written', async () => {
  await db.exec(`CREATE FUNCTION public.test_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'audit unavailable'; END$$; CREATE TRIGGER test_audit_fail BEFORE INSERT ON company_resource_audit FOR EACH ROW EXECUTE FUNCTION test_audit_fail();`);
  const before = await count('company_vehicles');
  await expect(command('vehicle', vehicle({ plate: 'FAIL 1' }))).rejects.toThrow('audit unavailable');
  expect(await count('company_vehicles')).toBe(before);
  await db.exec('DROP TRIGGER test_audit_fail ON company_resource_audit; DROP FUNCTION public.test_audit_fail();');
 });
 it('blocks deactivating an organization still used by active resources', async () => {
  await command('vehicle', vehicle({ plate: 'BO AB 127', site_id: SITE }));
  await expect(db.query("update company_sites set status='inactive' where id=$1", [SITE])).rejects.toThrow('aktive Verträge');
 });
 it('serves only current tenant snapshot and minimal employee fields', async () => {
  const r = (await db.query<{ result: Row }>('select public.company_resources_snapshot($1) result', [TENANT])).rows[0].result;
  expect(r.vehicles).toBeInstanceOf(Array);
  expect(r.employees).toEqual([{ id: EMPLOYEE, first_name: 'Eva', last_name: 'Test', status: 'aktiv' }]);
  expect(r.documents).toEqual([]);
 });
});
