import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('owner company dossier reads against PostgreSQL', () => {
  let db: PGlite;
  const scalar = async (sql: string, args: unknown[] = []) => Object.values((await db.query<Record<string, any>>(sql, args)).rows[0])[0] as any;
  const login = async (n: number, role = 'authenticated') => { await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id(n)]); await db.exec(`SET ROLE ${role}`); };
  const page = (section: string, options: { tenant?: number; parent?: number; record?: number; offset?: number; limit?: number; search?: string; status?: string; deleted?: boolean } = {}) => scalar('SELECT platform_read_tenant_dossier($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id(options.tenant ?? 1), section, options.parent ? id(options.parent) : null, options.record ? id(options.record) : null, options.search ?? null, options.status ?? null, options.offset ?? 0, options.limit ?? 50, options.deleted ?? false]);
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE platform_users(user_id uuid PRIMARY KEY,role text,status text,full_name text);
      CREATE TABLE tenants(id uuid PRIMARY KEY,name text,street text,postal_code text,city text,country text,created_at timestamptz,updated_at timestamptz);
      CREATE TABLE platform_tenants(id uuid PRIMARY KEY,tenant_id uuid,tenant_name text,primary_contact_email text);
      CREATE TABLE clients(id uuid PRIMARY KEY,tenant_id uuid,client_number text,first_name text,last_name text,email text,phone text,street text,postal_code text,city text,status text,portal_enabled boolean DEFAULT false,deleted_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),metadata jsonb);
      CREATE TABLE employees(id uuid PRIMARY KEY,tenant_id uuid,profile_id uuid,employee_number text,first_name text,last_name text,email text,phone text,mobile text,employment_type text,entry_date date,status text,portal_enabled boolean DEFAULT false,deleted_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
      CREATE TABLE tenant_users(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid,auth_user_id uuid,role_key text,status text,archived_at timestamptz,last_login_at timestamptz);
      CREATE TABLE profiles(id uuid PRIMARY KEY,tenant_id uuid,auth_user_id uuid,full_name text,status text);
      CREATE TABLE tenant_branding(id uuid PRIMARY KEY,tenant_id uuid,logo_url text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
      CREATE TABLE client_contacts(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,name text,created_at timestamptz DEFAULT now());
      CREATE TABLE platform_audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,actor_user_id uuid,actor_role text,action text,target_type text,target_id uuid,reason text,before jsonb,after jsonb,created_at timestamptz DEFAULT now());
      CREATE TABLE audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,profile_id uuid,action text,table_name text,record_id uuid,title text,description text,old_data jsonb,new_data jsonb,created_at timestamptz DEFAULT now());
      CREATE FUNCTION public.platform_write_audit_log(p_action text,p_target_type text DEFAULT NULL,p_target_id uuid DEFAULT NULL,p_tenant_id uuid DEFAULT NULL,p_before jsonb DEFAULT NULL,p_after jsonb DEFAULT NULL,p_reason text DEFAULT NULL,p_ip_address text DEFAULT NULL,p_user_agent text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$ DECLARE v_id uuid; BEGIN INSERT INTO platform_audit_log(action,target_type,target_id,tenant_id,before,after,reason,actor_user_id) VALUES(p_action,p_target_type,p_target_id,p_tenant_id,p_before,p_after,p_reason,auth.uid()) RETURNING id INTO v_id; RETURN v_id; END $$;
      ALTER TABLE clients ENABLE ROW LEVEL SECURITY; ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
      INSERT INTO platform_users VALUES('${id(10)}','platform_owner','active','Inhaber'),('${id(11)}','platform_admin','active','Verwaltung'),('${id(12)}','platform_support','active','Support');
      INSERT INTO tenants(id,name) VALUES('${id(1)}','Firma A'),('${id(2)}','Firma B');
      INSERT INTO platform_tenants VALUES('${id(3)}','${id(1)}','Firma A','a@example.test'),('${id(4)}','${id(2)}','Firma B','b@example.test');
      INSERT INTO tenant_branding VALUES('${id(5)}','${id(1)}','https://example.test/a.png',now(),now());
      INSERT INTO clients(id,tenant_id,client_number,first_name,last_name,street,postal_code,city,status,metadata)
        SELECT ('00000000-0000-4000-8000-'||lpad((1000+n)::text,12,'0'))::uuid,'${id(1)}','K-'||n,'Anna','Person', 'Testweg','12345','Berlin','active',jsonb_build_object('api_key','never-expose','nested',jsonb_build_object('portal_code','hidden','valid',false)) FROM generate_series(1,1055) n;
      INSERT INTO clients(id,tenant_id,client_number,first_name,last_name,street,postal_code,city,status,deleted_at) VALUES('${id(500)}','${id(1)}','deleted','Deleted','Person','Test','12345','Berlin','inactive',now()),('${id(501)}','${id(2)}','B-only','Private','Other','Test','12345','Berlin','active',null);
      INSERT INTO employees(id,tenant_id,first_name,last_name,email,employment_type,entry_date,status,portal_enabled) VALUES('${id(600)}','${id(1)}','Emma','Person','emma@example.test','part_time','2026-10-01','active',true);
      INSERT INTO tenant_users(id,tenant_id,employee_id,auth_user_id,role_key,status,last_login_at) VALUES('${id(610)}','${id(1)}','${id(600)}','${id(611)}','staff','active',now()),('${id(612)}','${id(1)}',null,'${id(613)}','owner','active',now());
      INSERT INTO client_contacts VALUES('${id(700)}','${id(1)}','${id(1001)}','Kontakt A',now()),('${id(701)}','${id(2)}','${id(501)}','Kontakt B',now());
      INSERT INTO platform_audit_log(tenant_id,actor_user_id,action,target_type,reason,before,after) VALUES('${id(1)}','${id(10)}','tenant.record_updated','tenants','Firmenkontakt geändert','{"email":"old@example.test","password":"hidden"}','{"email":"new@example.test","password":"hidden2"}'),('${id(2)}','${id(10)}','other','tenants','Other company',null,null);
      INSERT INTO audit_logs(tenant_id,action,table_name,title,description,old_data,new_data) VALUES('${id(1)}','updated','clients','Datensatz ergänzt','Adresse geprüft','{"city":null}','{"city":"Berlin"}');
    `);
    await db.exec(readFileSync('supabase/migrations/20261009032326_platform_tenant_dossier.sql', 'utf8'));
  }, 30000);
  afterAll(async () => { await db?.close(); });

  it('denies anonymous callers, every non-owner and direct helper access', async () => {
    expect(await scalar("SELECT has_function_privilege('anon','public.platform_read_tenant_dossier(uuid,text,uuid,uuid,text,text,integer,integer,boolean)','EXECUTE')")).toBe(false);
    expect(await scalar("SELECT has_function_privilege('authenticated','private.platform_dossier_page(uuid,text,uuid,uuid,text,text,integer,integer,boolean)','EXECUTE')")).toBe(false);
    for (const user of [11, 12, 999]) { await login(user); await expect(page('clients')).rejects.toThrow('dossier_owner_required'); }
    await login(10, 'anon'); await expect(page('clients')).rejects.toThrow('permission denied');
  });
  it('shows complete counts and every record after 1000 rows without crossing companies', async () => {
    await login(10); const found: string[] = [];
    for (let offset = 0; offset < 1055; offset += 100) {
      const result = await page('clients', { offset, limit: 100 });
      expect(result.total).toBe(1055); expect(result.rows.every((row: any) => row.tenant_id === id(1))).toBe(true);
      found.push(...result.rows.map((row: any) => row.id));
      expect(result.hasMore).toBe(offset + result.rows.length < 1055);
    }
    expect(new Set(found).size).toBe(1055);
    expect((await page('clients', { search: 'B-only' })).rows).toEqual([]);
    expect((await page('clients', { deleted: true })).total).toBe(1056);
  });
  it('filters before counting and paging and treats wildcard characters literally', async () => {
    await login(10);
    const found = await page('clients', { search: 'K-1055' }); expect(found.total).toBe(1); expect(found.rows[0].client_number).toBe('K-1055');
    expect((await page('clients', { search: '%' })).total).toBe(0);
    expect((await page('clients', { status: 'inactive' })).total).toBe(0);
    expect((await page('clients', { deleted: true, status: 'inactive' })).total).toBe(1);
  });
  it('checks parent and record ownership and restricts tables to the fixed registry', async () => {
    await login(10);
    expect((await page('client_contacts', { parent: 1001 })).rows[0].name).toBe('Kontakt A');
    await expect(page('client_contacts', { parent: 501 })).rejects.toThrow('dossier_record_not_found');
    expect((await page('clients', { record: 501 })).rows).toEqual([]);
    await expect(page('auth.users')).rejects.toThrow('dossier_section_invalid');
    await expect(page('client_portal_codes')).rejects.toThrow('dossier_section_invalid');
    await expect(page('clients', { tenant: 999 })).rejects.toThrow('tenant_not_found');
  });
  it('removes nested authentication secrets while preserving false values', async () => {
    await login(10); const result = await page('clients', { limit: 1 });
    expect(result.rows[0].metadata).toEqual({ nested: { valid: false } });
    expect(JSON.stringify(result)).not.toContain('never-expose');
  });
  it('returns source availability, real counts and portal association in the snapshot', async () => {
    await login(10); const snapshot = await page('summary');
    expect(snapshot.tenantId).toBe(id(1)); expect(snapshot.counts.clients).toMatchObject({ total: 1055, complete: 1055, deleted: 1 });
    expect(snapshot.counts.employees).toMatchObject({ total: 1, complete: 1, portalEnabled: 1, portalLinked: 1 });
    expect(snapshot.branding.logo_url).toBe('https://example.test/a.png');
    expect(snapshot.sections.find((section: any) => section.key === 'tenant_tax_profiles')).toMatchObject({ available: false, count: null });
    expect(snapshot.sections.find((section: any) => section.key === 'clients')).toMatchObject({ available: true, count: 1056 });
  });
  it('shows only stored history with safe changes and does not present read access as a setup action', async () => {
    await login(10); const history = await page('history'); expect(history.total).toBe(2);
    expect(history.rows.find((row: any) => row.action === 'tenant.record_updated')).toMatchObject({ actor_name: 'Inhaber', before: { email: 'old@example.test' }, after: { email: 'new@example.test' } });
    expect(JSON.stringify(history)).not.toContain('Other company');
    await db.exec('RESET ROLE'); const audit = await scalar("SELECT count(*)::integer FROM platform_audit_log WHERE action='tenant.dossier_read'"); expect(audit).toBeGreaterThan(1);
  });
  it('rechecks owner status on every request and validates complete batch targets', async () => {
    await login(10); expect((await scalar('SELECT platform_list_tenant_dossier_summaries($1)', [[id(1), id(2)]])).items).toHaveLength(2);
    await expect(scalar('SELECT platform_list_tenant_dossier_summaries($1)', [[id(1), id(999)]])).rejects.toThrow('tenant_not_found');
    await db.exec('RESET ROLE'); await db.exec(`UPDATE platform_users SET status='inactive' WHERE user_id='${id(10)}'`);
    await login(10); await expect(page('summary')).rejects.toThrow('dossier_owner_required');
    await db.exec('RESET ROLE'); await db.exec(`UPDATE platform_users SET status='active' WHERE user_id='${id(10)}'`);
  });
});
