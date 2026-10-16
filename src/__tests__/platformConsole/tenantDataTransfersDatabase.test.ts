import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('tenant data transfer PostgreSQL authorization and lifecycle', () => {
  let db: PGlite;
  let request: string;
  const scalar = async (sql: string, args: unknown[] = []) => Object.values((await db.query<Record<string, unknown>>(sql, args)).rows[0])[0] as any;
  const login = async (n: number, role = 'authenticated') => { await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id(n)]); await db.exec(`SET ROLE ${role}`); };
  const action = (name: string, opts: { tenant?: number; request?: string; file?: number; name?: string; size?: number; offset?: number } = {}) => scalar('SELECT tenant_data_transfer($1,$2,$3,$4,$5,$6,$7)', [name, id(opts.tenant ?? 1), opts.request ?? request ?? null, opts.file ? id(opts.file) : null, opts.name ?? null, opts.size ?? null, opts.offset ?? 0]);
  const object = async (n: number, size = 7, mime = 'application/octet-stream') => {
    const path = `${id(1)}/${request}/${id(n)}`;
    await db.query('INSERT INTO storage.objects(bucket_id,name,metadata) VALUES($1,$2,$3)', ['tenant-data-transfers', path, JSON.stringify({ size, mimetype: mime })]);
  };
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth,storage TO anon,authenticated;
      CREATE TABLE tenants(id uuid PRIMARY KEY,status text);
      CREATE TABLE tenant_users(id uuid PRIMARY KEY,tenant_id uuid,auth_user_id uuid,role_key text,employee_id uuid,status text,archived_at timestamptz);
      CREATE TABLE platform_users(user_id uuid PRIMARY KEY,role text,status text);
      CREATE TABLE platform_tenants(tenant_id uuid,status text);
      CREATE TABLE platform_account_access_states(tenant_id uuid,auth_user_id uuid,state text);
      CREATE TABLE platform_audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_user_id uuid,actor_role text,action text,target_type text,target_id uuid,tenant_id uuid,reason text);
      CREATE FUNCTION platform_tenant_access_allowed(t uuid,p boolean) RETURNS boolean LANGUAGE sql SET search_path=public AS $$ SELECT NOT EXISTS(SELECT 1 FROM platform_tenants WHERE tenant_id=t AND status<>'active') AND NOT EXISTS(SELECT 1 FROM platform_account_access_states WHERE tenant_id=t AND auth_user_id=auth.uid() AND state<>'active') $$;
      CREATE FUNCTION platform_write_audit_log(p_action text,p_target_type text DEFAULT NULL,p_target_id uuid DEFAULT NULL,p_tenant_id uuid DEFAULT NULL,p_before jsonb DEFAULT NULL,p_after jsonb DEFAULT NULL,p_reason text DEFAULT NULL,p_ip_address text DEFAULT NULL,p_user_agent text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$ DECLARE v_id uuid; BEGIN
        IF NOT EXISTS(SELECT 1 FROM platform_users WHERE user_id=auth.uid() AND status='active') THEN RAISE EXCEPTION 'platform_forbidden'; END IF;
        INSERT INTO platform_audit_log(actor_user_id,action,target_type,target_id,tenant_id,reason) VALUES(auth.uid(),p_action,p_target_type,p_target_id,p_tenant_id,p_reason) RETURNING id INTO v_id; RETURN v_id; END; $$;
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb,UNIQUE(bucket_id,name));
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,anon;
      -- Simulate broad legacy policies: new restrictive guards must still protect this bucket.
      CREATE POLICY legacy_storage ON storage.objects FOR ALL TO authenticated,anon USING(true) WITH CHECK(true);
      INSERT INTO tenants VALUES('${id(1)}','active'),('${id(2)}','active');
      INSERT INTO platform_tenants VALUES('${id(1)}','active'),('${id(2)}','active');
      INSERT INTO platform_users VALUES('${id(10)}','platform_owner','active'),('${id(11)}','platform_admin','active'),('${id(12)}','platform_support','active');
      INSERT INTO tenant_users VALUES('${id(31)}','${id(1)}','${id(20)}','owner',NULL,'active',NULL),('${id(32)}','${id(2)}','${id(21)}','owner',NULL,'active',NULL),('${id(33)}','${id(1)}','${id(22)}','employee','${id(33)}','active',NULL),('${id(34)}','${id(1)}','${id(23)}','admin',NULL,'inactive',NULL);
    `);
    await db.exec(readFileSync('supabase/migrations/20261016061112_tenant_data_transfers.sql', 'utf8'));
  }, 30000);
  afterAll(async () => { await db?.close(); });
  it('denies anonymous execution and direct metadata writes', async () => {
    expect(await scalar("SELECT has_function_privilege('anon','tenant_data_transfer(text,uuid,uuid,uuid,text,bigint,integer)','EXECUTE')")).toBe(false);
    await login(20);
    await expect(db.exec('SELECT * FROM tenant_data_files')).rejects.toThrow('permission denied');
    await expect(db.exec('DELETE FROM tenant_data_requests')).rejects.toThrow('permission denied');
  });
  it('only an active platform owner creates an idempotent company-specific request', async () => {
    for (const user of [11,12,20,21,22,23,999]) { await login(user); await expect(action('create', { name: 'Daten bitte' })).rejects.toThrow('transfer_forbidden'); }
    await login(10); request = (await action('create', { name: 'Daten bitte' })).id;
    expect((await action('create', { name: 'Retry' })).id).toBe(request);
    expect((await action('list')).items).toHaveLength(1);
    await login(21); expect((await action('open', { tenant: 2 })).request).toBeNull();
    await expect(action('open')).rejects.toThrow('transfer_forbidden');
    await login(20); expect((await action('open')).request.id).toBe(request);
    await expect(action('files', { tenant: 2 })).rejects.toThrow('transfer_forbidden');
  });
  it('accepts arbitrary extensions, huge sizes and zero bytes without filename-based paths', async () => {
    await login(20);
    const large = await action('begin', { file: 100, name: 'Kundenexport.unknown', size: 900 * 1024 ** 3 });
    expect(large.object_path).toBe(`${id(1)}/${request}/${id(100)}`);
    expect(large.size).toBe(900 * 1024 ** 3);
    await action('discard', { file: 100 });
    await action('begin', { file: 101, name: 'leer.dat', size: 0 });
    await object(101, 0); await action('finish', { file: 101 });
    await expect(action('begin', { file: 102, name: 'bad\nname', size: 1 })).rejects.toThrow('transfer_invalid');
  });
  it('reserves paths server-side and rejects cross-tenant uploads even with permissive legacy policies', async () => {
    await login(20); await action('begin', { file: 103, name: 'bericht.html', size: 7 });
    await object(103);
    await expect(object(999)).rejects.toThrow('row-level security');
    await login(21); await expect(object(103)).rejects.toThrow();
    expect(await scalar("SELECT count(*)::int FROM storage.objects WHERE bucket_id='tenant-data-transfers'")).toBe(0);
    await login(20, 'anon'); expect(await scalar("SELECT count(*)::int FROM storage.objects WHERE bucket_id='tenant-data-transfers'")).toBe(0);
    await expect(object(997)).rejects.toThrow('row-level security');
    await login(20); await expect(db.exec("UPDATE storage.objects SET metadata='{}' WHERE bucket_id='tenant-data-transfers'")).resolves.toBeDefined();
    expect(await scalar("SELECT (metadata->>'size')::int FROM storage.objects WHERE name=$1", [`${id(1)}/${request}/${id(103)}`])).toBe(7);
  });
  it('does not expose drafts to the operator and checks real object size and safe content type', async () => {
    await login(10); expect((await action('files')).items).toEqual([]);
    await expect(action('download', { file: 103 })).rejects.toThrow('transfer_not_submitted');
    expect(await scalar("SELECT count(*)::int FROM storage.objects WHERE bucket_id='tenant-data-transfers'")).toBe(0);
    await login(20); await action('begin', { file: 104, name: 'falsch.pdf', size: 20 });
    await object(104, 10); await expect(action('finish', { file: 104 })).rejects.toThrow('transfer_incomplete');
    await action('begin', { file: 105, name: 'aktiv.svg', size: 7 }); await object(105, 7, 'image/svg+xml');
    await expect(action('finish', { file: 105 })).rejects.toThrow('transfer_incomplete');
    await expect(action('submit')).rejects.toThrow('transfer_incomplete');
    for (const file of [104,105]) { await action('discard', { file }); await db.query("DELETE FROM storage.objects WHERE name=$1", [`${id(1)}/${request}/${id(file)}`]); }
    await action('finish', { file: 103 }); await action('finish', { file: 103 });
  });
  it('atomically submits, makes files immutable and audits the tenant actor', async () => {
    await login(20);
    const submitted = await action('submit'); expect(submitted.state).toBe('submitted');
    expect((await action('submit')).submitted_at).toBe(submitted.submitted_at);
    await expect(action('discard', { file: 103 })).rejects.toThrow('transfer_closed');
    await expect(action('begin', { file: 106, name: 'spät.txt', size: 1 })).rejects.toThrow('transfer_closed');
    await db.exec("DELETE FROM storage.objects WHERE bucket_id='tenant-data-transfers'");
    await db.exec('RESET ROLE'); expect(await scalar("SELECT count(*)::int FROM storage.objects WHERE bucket_id='tenant-data-transfers'")).toBe(2);
    expect(await scalar("SELECT count(*)::int FROM platform_audit_log WHERE action='data_transfer.submitted' AND actor_user_id=$1", [id(20)])).toBe(1);
  });
  it('authorizes only submitted files for the live owner and verifies request/file/tenant binding', async () => {
    await login(10); expect((await action('files')).items).toHaveLength(2);
    expect((await action('download', { file: 103 })).name).toBe('bericht.html');
    await expect(action('download', { file: 104 })).rejects.toThrow('transfer_not_found');
    await expect(action('download', { file: 103, tenant: 2 })).rejects.toThrow('transfer_not_found');
    for (const user of [11,12,20,21]) { await login(user); await expect(action('download', { file: 103 })).rejects.toThrow('transfer_forbidden'); }
    await db.exec('RESET ROLE'); await db.exec(`UPDATE platform_users SET status='inactive' WHERE user_id='${id(10)}'`);
    await login(10); await expect(action('download', { file: 103 })).rejects.toThrow('transfer_forbidden');
    await db.exec('RESET ROLE'); await db.exec(`UPDATE platform_users SET status='active' WHERE user_id='${id(10)}'`);
  });
  it('supports paging beyond API row caps and revokes expired/cancelled/disabled access', async () => {
    await login(10); await action('process');
    expect((await action('list')).items[0].state).toBe('processed');
    request = (await action('create', { name: 'Weitere Daten' })).id;
    await login(20); await action('begin', { file: 200, name: 'wartend.txt', size: 7 });
    await db.exec('RESET ROLE');
    await db.query("UPDATE tenant_data_requests SET expires_at=now()-interval '1 second' WHERE id=$1", [request]);
    await login(20); await expect(object(200)).rejects.toThrow('row-level security'); await expect(action('begin', { file: 201, name: 'late', size: 1 })).rejects.toThrow('transfer_closed');
    await login(10); request = (await action('create', { name: 'Erneute Anfrage' })).id;
    await action('cancel'); await login(20); expect((await action('open')).request).toBeNull();
    await login(10); request = (await action('create', { name: 'Aktive Anfrage' })).id;
    await db.exec('RESET ROLE'); await db.exec(`UPDATE platform_tenants SET status='suspended' WHERE tenant_id='${id(1)}'`);
    await login(20); await expect(action('open')).rejects.toThrow('transfer_forbidden');
    await db.exec('RESET ROLE'); await db.exec(`UPDATE platform_tenants SET status='active' WHERE tenant_id='${id(1)}'; INSERT INTO platform_account_access_states VALUES('${id(1)}','${id(20)}','inactive')`);
    await login(20); await expect(action('open')).rejects.toThrow('transfer_forbidden');
    await db.exec('RESET ROLE'); await db.exec('DELETE FROM platform_account_access_states');
    await db.exec(`INSERT INTO tenant_data_files(id,request_id,tenant_id,created_by,name,size,object_path)
      SELECT gen_random_uuid(),'${request}','${id(1)}','${id(20)}','file-'||n,1,'paged/'||n FROM generate_series(1,1055) n`);
    await login(20); const seen = new Set();
    for (let offset=0;offset<1055;offset+=50) { const page = await action('files', { offset }); expect(page.total).toBe(1055); for (const row of page.items) seen.add(row.id); }
    expect(seen.size).toBe(1055);
  });
});
