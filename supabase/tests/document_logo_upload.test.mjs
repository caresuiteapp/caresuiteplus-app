import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { companyFixture, id } from './company_access_fixture.mjs';

// Synthetic local Postgres records only. Real company permission helpers and
// the existing branding migrations exercise the new grant alongside old RLS.
// Storage HTTP MIME/size enforcement and image decoding are separate checks.
const readMigration = name => readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
const sql = readFileSync(new URL('../migrations/20261016072259_document_logo_upload.sql', import.meta.url), 'utf8');
const { db, actor, owner, permission } = await companyFixture();
const tenant = id(10);
const logoPath = (n, extension='png', scope=tenant) => `tenant/${scope}/document-logos/${id(n)}.${extension}`;
const upload = (path, bucket='tenant-branding') => db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)', [bucket,path]);
const legacyPolicies = () => db.query("SELECT policyname,cmd,roles,qual,with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'tenant_branding_%' ORDER BY policyname");

try {
  await owner();
  await db.exec(`
    ALTER TABLE role_permissions ADD COLUMN can_create boolean DEFAULT false;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text NOT NULL,name text NOT NULL,metadata jsonb NOT NULL DEFAULT '{}',UNIQUE(bucket_id,name));
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO authenticated,anon;
    GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
  `);
  // Load the actual established admin helper without unrelated broadcast seeds.
  const adminHelper = readMigration('0096_broadcast_rls_live_roles.sql').match(/CREATE OR REPLACE FUNCTION public\.is_tenant_admin\(\)[\s\S]*?GRANT EXECUTE ON FUNCTION public\.is_tenant_admin\(\) TO authenticated;/)?.[0];
  assert.ok(adminHelper, 'Established branding admin helper is present');
  await db.exec(adminHelper);
  await db.exec(readMigration('0237_communication_has_permission_bridge.sql'));
  await db.exec(readMigration('0077_tenant_branding_storage.sql'));
  await db.exec(readMigration('0078_tenant_settings_rls_live.sql'));
  await db.exec(readMigration('0237_communication_has_permission_bridge.sql'));
  await db.query("INSERT INTO role_permissions(role_id,permission_key) VALUES($1,'office.catalogs.edit'),($2,'office.catalogs.edit')", [id(4),id(3)]);
  // Test a catalog-only portal grant, without the fixture's unrelated legacy
  // company-management grant, so no existing branding permission masks denial.
  await db.query("DELETE FROM role_permissions WHERE role_id=$1 AND permission_key='business.tenant.manage'", [id(3)]);
  const beforePolicies = (await legacyPolicies()).rows;

  await test('catalog editors gain fresh PNG, JPG and WebP uploads without company-branding authority', async () => {
    await actor(23);
    assert.equal(await permission('office.catalogs.edit'), true);
    assert.equal(await permission('business.tenant.manage'), false);
    await assert.rejects(upload(logoPath(600)), /row-level security/);
    await owner();
    await db.exec(sql);
    await actor(23);
    for (const [n,ext] of [[600,'png'],[601,'jpg'],[602,'webp']]) await upload(logoPath(n,ext));
    assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects')).rows[0].n, 3);
  });

  await test('new authority stays within the exact tenant, bucket, UUID path and image extensions', async () => {
    await actor(23);
    const invalid = [
      logoPath(603,'png',id(11)),
      `tenant/${tenant}/logo.png`,
      `tenant/${tenant}/document-logos/not-a-uuid.png`,
      `tenant/${tenant}/document-logos/${id(603)}.svg`,
      `tenant/${tenant}/document-logos/${id(603)}.pdf`,
      `tenant/${tenant}/document-logos/${id(603)}.PNG`,
      `tenant/${tenant}/document-logos/${id(603)}.png/extra`,
      `tenant/${tenant}/document-logos/subfolder/${id(603)}.png`,
      `tenant/${tenant}/document-logos/../${id(603)}.png`,
      `tenant/${tenant}/document-logos/${id(603)}.png\n`,
      `tenant/not-a-tenant/document-logos/${id(603)}.png`,
    ];
    for (const path of invalid) await assert.rejects(upload(path), /row-level security/, path);
    await assert.rejects(upload(logoPath(603),'office-documents'), /row-level security/);
  });

  await test('catalog-only users cannot replace, rename, delete or upsert an existing logo', async () => {
    await actor(23);
    await assert.rejects(upload(logoPath(600)), /duplicate key/);
    assert.equal((await db.query("UPDATE storage.objects SET metadata='{}' WHERE name=$1 RETURNING id", [logoPath(600)])).rows.length, 0);
    assert.equal((await db.query('UPDATE storage.objects SET name=$1 WHERE name=$2 RETURNING id', [logoPath(604),logoPath(600)])).rows.length, 0);
    assert.equal((await db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING id', [logoPath(600)])).rows.length, 0);
    await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('tenant-branding',$1) ON CONFLICT(bucket_id,name) DO UPDATE SET metadata='{}'", [logoPath(600)]), /row-level security/);
    assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects WHERE name=$1',[logoPath(600)])).rows[0].n, 1);
  });

  await test('current catalog denies override an otherwise allowed staff role', async () => {
    await owner();
    await db.query("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'office.catalogs.edit',false)", [tenant,id(42)]);
    await actor(23);
    await assert.rejects(upload(logoPath(605)), /row-level security/);
    await owner();
    await db.query("DELETE FROM employee_permission_overrides WHERE employee_id=$1 AND permission_key='office.catalogs.edit'", [id(42)]);
  });

  await test('anonymous, portal, inactive and foreign sessions gain no catalog upload authority', async () => {
    await actor(null);
    await assert.rejects(upload(logoPath(606)), /permission denied/);
    await actor(22);
    await assert.rejects(upload(logoPath(606)), /row-level security/);
    await actor(23,10,{app_metadata:{portal:'employee'}});
    await assert.rejects(upload(logoPath(606)), /row-level security/);
    await actor(24,11);
    await assert.rejects(upload(logoPath(606)), /row-level security/);
    await actor(23,11);
    await assert.rejects(upload(logoPath(606,'png',id(11))), /row-level security/);
    await owner();
    await db.query('UPDATE profiles SET is_active=false WHERE id=$1', [id(23)]);
    await actor(23);
    await assert.rejects(upload(logoPath(606)), /row-level security/);
    await owner();
    await db.query('UPDATE profiles SET is_active=true WHERE id=$1', [id(23)]);
  });

  await test('record-limited catalog users cannot alter tenant-wide document branding', async () => {
    await owner();
    await db.query('INSERT INTO company_scope_profiles(tenant_id,profile_id,scope_limited,updated_by) VALUES($1,$2,true,$3)', [tenant,id(23),id(20)]);
    await actor(23);
    await assert.rejects(upload(logoPath(607)), /row-level security/);
    await owner();
    await db.query('DELETE FROM company_scope_profiles WHERE profile_id=$1', [id(23)]);
  });

  await test('existing company-logo policies and company-admin replacement behavior remain intact', async () => {
    await owner();
    assert.deepEqual((await legacyPolicies()).rows, beforePolicies);
    await actor();
    const original = `tenant/${tenant}/logo.png`;
    await upload(original);
    assert.equal((await db.query("UPDATE storage.objects SET metadata='{}' WHERE name=$1 RETURNING id", [original])).rows.length, 1);
    assert.equal((await db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING id', [original])).rows.length, 1);
  });

  await test('applying the migration again leaves exactly one additional INSERT policy', async () => {
    await owner();
    await db.exec(sql);
    const added = (await db.query("SELECT policyname,cmd,roles,permissive FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='tenant_document_logos_insert'")).rows;
    assert.deepEqual(added,[{policyname:'tenant_document_logos_insert',cmd:'INSERT',roles:['authenticated'],permissive:'PERMISSIVE'}]);
    assert.deepEqual((await legacyPolicies()).rows, beforePolicies);
    await actor(23);
    await upload(logoPath(608));
  });
} finally {
  await db.close();
}
