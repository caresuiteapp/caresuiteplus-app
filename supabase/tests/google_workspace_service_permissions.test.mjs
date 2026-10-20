// Real PostgreSQL privilege/RLS regression tests in isolated PGlite only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const tenant = '00000000-0000-4000-8000-000000000001';
const admin = '00000000-0000-4000-8000-000000000002';
const client = '00000000-0000-4000-8000-000000000003';
const adminRole = '00000000-0000-4000-8000-000000000004';
const clientRole = '00000000-0000-4000-8000-000000000005';
const migration = readFileSync(new URL('../migrations/20260911233000_google_workspace_service_permissions.sql', import.meta.url), 'utf8');
const asRole = async (role, sql) => {
  await db.exec('SET ROLE ' + role);
  try { return (await db.query(sql)).rows; }
  finally { await db.exec('RESET ROLE'); }
};
const denied = (role, sql) => assert.rejects(() => asRole(role, sql), error => error.code === '42501');

try {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
      SELECT nullif(current_setting('test.actor', true), '')::uuid
    $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    CREATE TABLE public.tenants (id uuid PRIMARY KEY);
    CREATE TABLE public.roles (id uuid PRIMARY KEY, key text);
    CREATE TABLE public.profiles (id uuid PRIMARY KEY, tenant_id uuid, role_id uuid);
    GRANT SELECT ON public.profiles, public.roles TO authenticated;
    INSERT INTO public.tenants VALUES ('${tenant}');
    INSERT INTO public.roles VALUES ('${adminRole}','business_admin'), ('${clientRole}','client');
    INSERT INTO public.profiles VALUES ('${admin}','${tenant}','${adminRole}'), ('${client}','${tenant}','${clientRole}');
  `);
  await db.exec(readFileSync(new URL('../migrations/0269_google_workspace_live.sql', import.meta.url), 'utf8'));
  await db.exec(`
    GRANT TRUNCATE, REFERENCES, TRIGGER ON
      public.google_workspace_connections, public.google_workspace_oauth_states,
      public.google_workspace_audit_events TO service_role;
    GRANT TRUNCATE, REFERENCES, TRIGGER ON public.google_workspace_audit_events TO authenticated;
  `);
  await test('reproduces live status failure despite service_role bypassing RLS', async () => {
    await denied('service_role', 'SELECT * FROM public.google_workspace_connections LIMIT 2');
    await denied('service_role', 'SELECT * FROM public.google_workspace_oauth_states LIMIT 2');
  });
  await db.exec(migration);

  await test('service status succeeds for a tenant with no connected Google account', async () => {
    assert.deepEqual(await asRole('service_role',
      `SELECT * FROM public.google_workspace_connections WHERE tenant_id='${tenant}' LIMIT 2`), []);
  });
  await test('service can complete the OAuth state lifecycle', async () => {
    await asRole('service_role', `
      INSERT INTO public.google_workspace_oauth_states
        (tenant_id, initiated_by, state_hash, pkce_verifier_cipher, requested_scopes, return_url, expires_at)
      VALUES ('${tenant}','${admin}','isolated-state-hash','isolated-encrypted-verifier',
        ARRAY['openid'],'https://example.invalid/callback',now()+interval '10 minutes') RETURNING id
    `);
    const claimed = await asRole('service_role',
      "UPDATE public.google_workspace_oauth_states SET consumed_at=now() WHERE state_hash='isolated-state-hash' AND consumed_at IS NULL RETURNING id");
    assert.equal(claimed.length, 1);
    const deleted = await asRole('service_role',
      "DELETE FROM public.google_workspace_oauth_states WHERE state_hash='isolated-state-hash' RETURNING id");
    assert.equal(deleted.length, 1);
  });
  await test('service can create, read and update a connection and append audit events', async () => {
    await asRole('service_role', `
      INSERT INTO public.google_workspace_connections (tenant_id,connected_user_id,connection_status)
      VALUES ('${tenant}','${admin}','connected') RETURNING id
    `);
    const result = await asRole('service_role',
      `UPDATE public.google_workspace_connections SET connection_status='revoked' WHERE tenant_id='${tenant}' RETURNING connection_status`);
    assert.equal(result[0].connection_status, 'revoked');
    await asRole('service_role', `
      INSERT INTO public.google_workspace_audit_events (tenant_id,actor_user_id,service_key,action_key,result_status)
      VALUES ('${tenant}','${admin}','oauth','isolated-test','success') RETURNING id
    `);
    assert.equal((await asRole('service_role', 'SELECT id FROM public.google_workspace_audit_events')).length, 1);
    await denied('service_role', 'DELETE FROM public.google_workspace_audit_events');
    await denied('service_role', "UPDATE public.google_workspace_audit_events SET action_key='changed'");
  });
  await test('browser roles cannot read or modify token and OAuth state tables', async () => {
    for (const role of ['anon','authenticated']) {
      for (const table of ['google_workspace_connections','google_workspace_oauth_states']) {
        await denied(role, 'SELECT * FROM public.' + table);
        await denied(role, 'DELETE FROM public.' + table);
      }
    }
  });
  await test('authenticated audit access stays restricted by tenant/admin RLS', async () => {
    await db.query("SELECT set_config('test.actor',$1,false)", [admin]);
    assert.equal((await asRole('authenticated', 'SELECT id FROM public.google_workspace_audit_events')).length, 1);
    await db.query("SELECT set_config('test.actor',$1,false)", [client]);
    assert.deepEqual(await asRole('authenticated', 'SELECT id FROM public.google_workspace_audit_events'), []);
    await db.query("UPDATE public.profiles SET tenant_id='00000000-0000-4000-8000-000000000099' WHERE id=$1", [admin]);
    await db.query("SELECT set_config('test.actor',$1,false)", [admin]);
    assert.deepEqual(await asRole('authenticated', 'SELECT id FROM public.google_workspace_audit_events'), []);
    await denied('anon', 'SELECT * FROM public.google_workspace_audit_events');
    await denied('authenticated', 'DELETE FROM public.google_workspace_audit_events');
  });
  await test('migration is repeatable and never grants truncate or structural privileges', async () => {
    await db.exec(migration);
    const rows = (await db.query(`
      SELECT role_name, table_name, privilege,
        has_table_privilege(role_name, 'public.' || table_name, privilege) AS allowed
      FROM unnest(ARRAY['anon','authenticated','service_role']) AS role_name
      CROSS JOIN unnest(ARRAY['google_workspace_connections','google_workspace_oauth_states','google_workspace_audit_events']) AS table_name
      CROSS JOIN unnest(ARRAY['TRUNCATE','REFERENCES','TRIGGER']) AS privilege
    `)).rows;
    assert.ok(rows.every(row => row.allowed === false));
    assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_class WHERE oid IN ('google_workspace_connections'::regclass,'google_workspace_oauth_states'::regclass,'google_workspace_audit_events'::regclass) AND relrowsecurity")).rows[0].n, 3);
  });
} finally { await db.close(); }
