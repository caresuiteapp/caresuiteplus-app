import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('registration scheduler configuration and authorization',()=>{
  let db:PGlite;
  beforeAll(async()=>{
    db=new PGlite({extensions:{pgcrypto}});
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
      CREATE TABLE registration_welcome_outbox(state text,next_attempt_at timestamptz,lease_until timestamptz);
      CREATE SCHEMA vault; CREATE TABLE vault.secrets(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,secret text,name text);
      CREATE VIEW vault.decrypted_secrets AS SELECT id,secret AS decrypted_secret FROM vault.secrets;
      CREATE FUNCTION vault.create_secret(s text,n text,d text) RETURNS uuid LANGUAGE sql AS $$INSERT INTO vault.secrets(secret,name) VALUES(s,n) RETURNING id$$;
      CREATE SCHEMA cron; CREATE TABLE cron.fixture_jobs(name text UNIQUE,schedule text,command text);
      CREATE FUNCTION cron.schedule(n text,s text,c text) RETURNS bigint LANGUAGE sql AS $$INSERT INTO cron.fixture_jobs VALUES(n,s,c) ON CONFLICT(name) DO UPDATE SET schedule=EXCLUDED.schedule,command=EXCLUDED.command RETURNING 1::bigint$$;
      CREATE SCHEMA net; CREATE TABLE net.fixture_calls(url text,headers jsonb,body jsonb);
      CREATE FUNCTION net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) RETURNS bigint LANGUAGE sql AS $$INSERT INTO net.fixture_calls VALUES(url,headers,body) RETURNING 1::bigint$$;`);
    // Embedded PostgreSQL cannot load the hosted scheduler/HTTP extensions. The
    // exact application SQL executes against explicit adapter fixtures above.
    const source=readFileSync(resolve('supabase/migrations/20261006063341_registration_welcome_scheduler.sql'),'utf8');
    const lines=source.split('\n').filter(line=>!/^CREATE EXTENSION IF NOT EXISTS (pg_net|pg_cron)/.test(line));
    expect(source.split('\n').length-lines.length).toBe(2);
    await db.exec(lines.join('\n'));
  },30000);
  afterAll(async()=>{await db?.close();});
  it('does not activate any worker just by installing the migration',async()=>{
    expect((await db.query('SELECT * FROM cron.fixture_jobs')).rows).toHaveLength(0);
    expect((await db.query('SELECT * FROM registration_mail_private.registration_welcome_scheduler')).rows).toHaveLength(0);
  });
  it('stores a dedicated token in Vault, authorizes only its hash, and schedules every minute',async()=>{
    await db.query('SELECT registration_mail_private.configure_registration_welcome_scheduler($1)',['https://abcdefghijklmnopqrst.supabase.co']);
    const secret=(await db.query<{secret:string}>('SELECT secret FROM vault.secrets')).rows[0].secret;
    expect(secret).toMatch(/^[a-f0-9]{64}$/);
    const settings=(await db.query<{token_hash:string;project_url:string}>('SELECT token_hash,project_url FROM registration_mail_private.registration_welcome_scheduler')).rows[0];
    expect(settings.token_hash).not.toBe(secret);
    expect((await db.query("SELECT public.registration_welcome_worker_authorized('wrong') ok")).rows[0]).toEqual({ok:false});
    expect((await db.query('SELECT public.registration_welcome_worker_authorized($1) ok',[settings.token_hash])).rows[0]).toEqual({ok:true});
    expect((await db.query('SELECT * FROM cron.fixture_jobs')).rows[0]).toEqual({name:'caresuite-registration-welcome',schedule:'* * * * *',command:'SELECT registration_mail_private.dispatch_registration_welcome();'});
  });
  it('does not make idle requests and attaches the dedicated token only to the project worker',async()=>{
    expect((await db.query('SELECT registration_mail_private.dispatch_registration_welcome() id')).rows[0]).toEqual({id:null});
    expect((await db.query('SELECT * FROM net.fixture_calls')).rows).toHaveLength(0);
    await db.exec("INSERT INTO registration_welcome_outbox VALUES('pending',now(),NULL)");
    await db.query('SELECT registration_mail_private.dispatch_registration_welcome()');
    const call=(await db.query<{url:string;headers:Record<string,string>;body:unknown}>('SELECT * FROM net.fixture_calls')).rows[0];
    expect(call.url).toBe('https://abcdefghijklmnopqrst.supabase.co/functions/v1/registration-welcome-dispatch');
    expect(call.headers.Authorization).toMatch(/^Bearer [a-f0-9]{64}$/);
    expect(call.body).toEqual({});
  });
  it('rejects foreign URLs, rotates the existing token and keeps exactly one job',async()=>{
    const previous=(await db.query<{token_hash:string}>('SELECT token_hash FROM registration_mail_private.registration_welcome_scheduler')).rows[0].token_hash;
    await expect(db.query('SELECT registration_mail_private.configure_registration_welcome_scheduler($1)',['https://attacker.example/'])).rejects.toThrow('invalid_registration_project_url');
    await db.query('SELECT registration_mail_private.configure_registration_welcome_scheduler($1)',['https://abcdefghijklmnopqrst.supabase.co']);
    expect((await db.query('SELECT public.registration_welcome_worker_authorized($1) ok',[previous])).rows[0]).toEqual({ok:false});
    expect((await db.query('SELECT * FROM vault.secrets')).rows).toHaveLength(1);
    expect((await db.query('SELECT * FROM cron.fixture_jobs')).rows).toHaveLength(1);
  });
  it('does not expose scheduler settings or its configuration to frontend roles',async()=>{
    for(const role of ['anon','authenticated','service_role']) {
      await db.exec(`SET ROLE ${role}`);
      await expect(db.query("SELECT registration_mail_private.configure_registration_welcome_scheduler('https://abcdefghijklmnopqrst.supabase.co')")).rejects.toThrow('permission denied');
      if(role!=='service_role') await expect(db.query('SELECT token_hash FROM registration_mail_private.registration_welcome_scheduler')).rejects.toThrow('permission denied');
      await db.exec('RESET ROLE');
    }
  });
});
