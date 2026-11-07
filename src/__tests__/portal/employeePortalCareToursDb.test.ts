import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('reads only the active employee’s released tours and rejects revoked or foreign access', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE ROLE anon;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('test.auth_user',true),'')::uuid
      $$;
      GRANT USAGE ON SCHEMA auth TO authenticated, anon;
      CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('test.tenant',true),'')::uuid
      $$;
      CREATE FUNCTION public.resolve_current_employee_id() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('test.employee',true),'')::uuid
      $$;
      CREATE FUNCTION public.current_portal_account_id() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('test.account',true),'')::uuid
      $$;
      CREATE FUNCTION public.current_portal_type() RETURNS text LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('test.portal_type',true),'')
      $$;
      CREATE FUNCTION public.platform_tenant_access_allowed(uuid,boolean) RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT current_setting('test.tenant_disabled',true) IS DISTINCT FROM 'true'
      $$;
      CREATE FUNCTION public.tenant_has_platform_module(text,uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('test.care',true),'')::boolean
      $$;
      CREATE FUNCTION public.is_internal_tenant_actor(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT public.current_portal_type() IS NULL
      $$;
      CREATE TYPE public.product_key AS ENUM ('assist','pflege','office','beratung','akademie','stationaer');
      CREATE TABLE public.employees (id uuid PRIMARY KEY, tenant_id uuid, status text, deleted_at timestamptz, allowed_products public.product_key[]);
      CREATE TABLE public.employee_portal_accounts (id uuid, tenant_id uuid, employee_id uuid, auth_user_id uuid, status text);
      CREATE TABLE public.tenant_products (tenant_id uuid, product_key text, status text, is_active boolean, billing_status text);
      CREATE TABLE public.care_tours (id uuid, tenant_id uuid, employee_id uuid, tour_date date, name text, status text, vehicle_label_snapshot text, notes text);
      CREATE TABLE public.care_tour_stops (id uuid, tenant_id uuid, tour_id uuid, sequence_no integer, client_name_snapshot text,
        address_snapshot text, planned_start time, planned_end time, service_summary text, status text, notes text);
      ALTER TABLE public.care_tours ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.care_tour_stops ENABLE ROW LEVEL SECURITY;
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_tours,public.care_tour_stops TO authenticated;
      CREATE POLICY care_tours_tenant_all ON public.care_tours FOR ALL TO authenticated USING (true);
      CREATE POLICY care_tour_stops_tenant_all ON public.care_tour_stops FOR ALL TO authenticated USING (true);
      SET test.tenant = '00000000-0000-0000-0000-000000000001';
      SET test.employee = '00000000-0000-0000-0000-000000000002';
      SET test.account = '00000000-0000-0000-0000-000000000003';
      SET test.auth_user = '00000000-0000-0000-0000-000000000004';
      SET test.portal_type = 'employee';
      SET test.care = 'true';
      INSERT INTO public.employees VALUES (public.resolve_current_employee_id(),public.current_tenant_id(),'active',null,'{pflege}');
      INSERT INTO public.employee_portal_accounts VALUES (public.current_portal_account_id(),public.current_tenant_id(),public.resolve_current_employee_id(),auth.uid(),'active');
      INSERT INTO public.care_tours VALUES
        ('10000000-0000-0000-0000-000000000001',public.current_tenant_id(),public.resolve_current_employee_id(),'2026-11-07','Eigene Tour','published','','Interne Notiz'),
        ('10000000-0000-0000-0000-000000000002',public.current_tenant_id(),public.resolve_current_employee_id(),'2026-11-07','Entwurf','draft','',''),
        ('10000000-0000-0000-0000-000000000003',public.current_tenant_id(),'00000000-0000-0000-0000-000000000009','2026-11-07','Andere Tour','published','',''),
        ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000009',public.resolve_current_employee_id(),'2026-11-07','Fremder Mandant','published','','');
      INSERT INTO public.care_tour_stops VALUES
        ('20000000-0000-0000-0000-000000000001',public.current_tenant_id(),'10000000-0000-0000-0000-000000000001',1,'Testkontakt','Teststraße 1','10:00','11:00','Pflege','planned','Interne Notiz');
    `);
    const patch = readFileSync('supabase/patches/employee_portal_care_tours.sql', 'utf8');
    await db.exec(patch);
    await db.exec(patch);
    await db.exec('SET ROLE authenticated');
    const read = () => db.query("select public.get_employee_portal_care_day('2026-11-07') as tours");
    const result = await read();
    expect(result.rows).toEqual([{ tours: [expect.objectContaining({ name: 'Eigene Tour', stops: [expect.objectContaining({ client: 'Testkontakt' })] })] }]);
    expect(JSON.stringify(result.rows)).not.toContain('Interne Notiz');
    expect((await db.query('select id from public.care_tours')).rows).toHaveLength(0);
    expect((await db.query('select id from public.care_tour_stops')).rows).toHaveLength(0);
    expect((await db.query("update public.care_tours set name='Unerlaubt' returning id")).rows).toHaveLength(0);
    await db.exec("SET test.care = 'false'");
    await expect(read()).rejects.toMatchObject({ code: '42501' });
    await db.exec("SET test.care = 'true'; SET test.tenant_disabled = 'true'");
    await expect(read()).rejects.toMatchObject({ code: '42501' });
    await db.exec("SET test.tenant_disabled = 'false'; SET test.auth_user = '00000000-0000-0000-0000-000000000099'");
    await expect(read()).rejects.toMatchObject({ code: '42501' });
    await db.exec("RESET ROLE; SET test.auth_user = '00000000-0000-0000-0000-000000000004'; UPDATE public.employees SET allowed_products='{assist}'; SET ROLE authenticated");
    await expect(read()).rejects.toMatchObject({ code: '42501' });
    await db.exec("RESET ROLE; SET test.portal_type = ''; SET ROLE authenticated");
    expect((await db.query('select id from public.care_tours')).rows).toHaveLength(3);
  } finally {
    await db.close();
  }
}, 15_000);
