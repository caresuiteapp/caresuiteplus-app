import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const id = (n: number) => `50000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tenant=id(1), client=id(3), otherClient=id(4), profile=id(20), user=id(10);
const migration=readFileSync('supabase/migrations/20261105085138_portal_request_atomic_office_delivery.sql','utf8');
let db: PGlite;
async function owner<T>(action:()=>Promise<T>) {
  await db.exec('RESET ROLE');
  try { return await action(); } finally { await db.exec('SET ROLE authenticated'); }
}
const rows=async (sql:string,params:unknown[]=[]) => owner(async()=> (await db.query<Record<string,any>>(sql,params)).rows);
async function counts() {
  return (await rows(`SELECT (SELECT count(*) FROM portal_requests) requests,
    (SELECT count(*) FROM message_threads) threads,(SELECT count(*) FROM messages) messages,
    (SELECT count(*) FROM communication_notifications) notifications,
    (SELECT count(*) FROM portal_request_status_history) history,(SELECT count(*) FROM audit_logs) audit`))[0];
}
async function submit(n:number,patch:Record<string,unknown>={}) {
  const p={tenant,client,type:'rueckruf',title:`Rückruf ${n}`,description:`Bitte zurückrufen ${n}`,
    payload:{nachricht:`Original ${n}`},module:'assist',request:id(n),...patch};
  return (await db.query<{result:Record<string,any>}>(
    'SELECT public.portal_submit_request($1,$2,$3,$4,$5,$6::jsonb,$7,$8) result',
    [p.tenant,p.client,p.type,p.title,p.description,JSON.stringify(p.payload),p.module,p.request],
  )).rows[0].result;
}

beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
    CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.tenant',true),'')::uuid$$;
    CREATE FUNCTION current_client_id() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.client',true),'')::uuid$$;
    CREATE FUNCTION resolve_current_profile_id() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.profile',true),'')::uuid$$;
    CREATE FUNCTION has_permission(text) RETURNS boolean LANGUAGE sql AS $$SELECT coalesce(current_setting('test.office',true),'false')='true'$$;
    CREATE TYPE portal_request_type AS ENUM ('termin_aendern','zusatztermin','rueckruf','nachricht','upload','nachweise','sonstiges');
    CREATE TYPE portal_request_status AS ENUM ('offen','in_bearbeitung','erledigt','abgelehnt','zurueckgestellt');
    CREATE TYPE message_priority AS ENUM ('low','normal','high','urgent');
    CREATE TYPE message_thread_type AS ENUM ('client','employee','employee_group','internal','support','system');
    CREATE TABLE tenants(id uuid PRIMARY KEY);
    CREATE TABLE clients(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id));
    CREATE TABLE profiles(id uuid PRIMARY KEY,tenant_id uuid,auth_user_id uuid);
    CREATE TABLE portal_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,
      client_id uuid NOT NULL,portal_user_id uuid,module_key text DEFAULT 'assist',request_type portal_request_type NOT NULL,
      status portal_request_status DEFAULT 'offen',title text NOT NULL,description text,payload jsonb DEFAULT '{}',
      created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
    CREATE TABLE message_threads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,thread_type message_thread_type,
      status text,priority message_priority,subject text,client_id uuid,employee_id uuid,created_by_client_id uuid,
      last_message_at timestamptz,last_message_preview text,office_unread_count int DEFAULT 0,portal_unread_count int DEFAULT 0,
      created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
    CREATE TABLE messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,thread_id uuid REFERENCES message_threads(id),
      body text,sender_client_id uuid,sender_employee_id uuid,sender_profile_id uuid,status text,sent_at timestamptz,read_at timestamptz,
      is_internal_note bool DEFAULT false,is_system_message bool DEFAULT false,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
    CREATE TABLE communication_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,type text,
      office_thread_id uuid REFERENCES message_threads(id),title text,body text,action_route text);
    CREATE TABLE portal_request_status_history(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,request_id uuid REFERENCES portal_requests(id),
      from_status portal_request_status,to_status portal_request_status,changed_by uuid,note text,created_at timestamptz DEFAULT now());
    CREATE TABLE portal_activities(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,client_id uuid,portal_user_id uuid,module_key text,
      activity_type text,title text,description text,metadata jsonb,created_at timestamptz DEFAULT now());
    CREATE TABLE audit_logs(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,profile_id uuid,action text,table_name text,record_id uuid,
      title text,description text,new_data jsonb,created_at timestamptz DEFAULT now());
    ALTER TABLE portal_requests ENABLE ROW LEVEL SECURITY; ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE messages ENABLE ROW LEVEL SECURITY; ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_profile ON profiles FOR SELECT TO authenticated USING(auth_user_id=auth.uid() OR id=auth.uid());
    CREATE POLICY portal_requests_portal_insert ON portal_requests FOR INSERT TO authenticated
      WITH CHECK(tenant_id=current_tenant_id() AND client_id=current_client_id());
    CREATE POLICY portal_requests_portal_select ON portal_requests FOR SELECT TO authenticated
      USING(tenant_id=current_tenant_id() AND client_id=current_client_id());
    CREATE POLICY portal_requests_office ON portal_requests FOR ALL TO authenticated
      USING(tenant_id=current_tenant_id() AND has_permission('office.access')) WITH CHECK(tenant_id=current_tenant_id() AND has_permission('office.access'));
    CREATE POLICY message_threads_select_own_tenant ON message_threads FOR SELECT TO authenticated USING(tenant_id=current_tenant_id());
    CREATE POLICY messages_select_own_tenant ON messages FOR SELECT TO authenticated USING(tenant_id=current_tenant_id());
    CREATE POLICY own_client_thread ON message_threads FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND client_id=current_client_id());
    CREATE POLICY own_client_message ON messages FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND sender_client_id=current_client_id());
    CREATE POLICY office_thread ON message_threads FOR ALL TO authenticated USING(tenant_id=current_tenant_id() AND has_permission('office.access'));
    CREATE POLICY office_message ON messages FOR ALL TO authenticated USING(tenant_id=current_tenant_id() AND has_permission('office.access'));
    GRANT USAGE ON SCHEMA auth TO authenticated;
    REVOKE ALL ON FUNCTION resolve_current_profile_id() FROM PUBLIC, authenticated;
    GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
    INSERT INTO tenants VALUES('${tenant}'),('${id(2)}');
    INSERT INTO clients VALUES('${client}','${tenant}'),('${otherClient}','${tenant}'),('${id(5)}','${id(2)}');
    INSERT INTO profiles VALUES('${profile}','${tenant}','${user}'),('${id(21)}','${id(2)}','${id(11)}');
    INSERT INTO portal_requests(id,tenant_id,client_id,portal_user_id,request_type,title,description,payload,created_at,updated_at) VALUES
      ('${id(100)}','${tenant}','${client}','${profile}','rueckruf','Rückruf','Historischer Originaltext','{"nachricht":"Original"}','2026-07-10T06:57:03Z','2026-07-10T06:57:03Z'),
      ('${id(101)}','${id(2)}','${id(5)}','${id(21)}','termin_aendern','Einsatzänderung','Bitte absagen','{}','2026-08-10T19:15:47Z','2026-08-10T19:15:47Z'),
      ('${id(102)}','${tenant}','${otherClient}','${profile}','rueckruf','Andere Klientin','Nur für diese Klientin','{}','2026-08-11T10:00:00Z','2026-08-11T10:00:00Z');
    INSERT INTO portal_activities(tenant_id,client_id,portal_user_id,activity_type,title,metadata)
      VALUES('${tenant}','${client}','${profile}','request_created','Vorhandene Aktivität','{"requestId":"${id(100)}"}');
  `);
  // Exercise the real unread contribution and counter triggers, rather than
  // asserting that the new migration happens to contain a particular string.
  const unread=readFileSync('supabase/migrations/20260801103000_communication_center_unread_integrity.sql','utf8');
  await db.exec(unread.split('-- --------------------------------------------------------------------------')[0]);
  await db.exec(migration);
},60000);
beforeEach(async()=>{
  await db.exec(`RESET ROLE; SELECT set_config('test.uid','${user}',false),set_config('test.tenant','${tenant}',false),
    set_config('test.client','${client}',false),set_config('test.profile','${profile}',false),set_config('test.office','false',false); SET ROLE authenticated;`);
});
afterAll(()=>db?.close());

describe('transactional portal request delivery',()=>{
  it('restores historical requests across tenants, preserving the text, sender and real send time',async()=>{
    const restored=await rows('SELECT r.id,r.office_delivered_at,m.body,m.sent_at,m.sender_client_id,t.office_unread_count,t.portal_unread_count FROM portal_requests r JOIN messages m ON m.id=r.office_message_id JOIN message_threads t ON t.id=r.office_thread_id ORDER BY r.id');
    expect(restored).toHaveLength(3);
    expect(restored[0]).toMatchObject({body:'Historischer Originaltext',sender_client_id:client,office_unread_count:1,portal_unread_count:0});
    expect(new Date(restored[0].sent_at).toISOString()).toBe('2026-07-10T06:57:03.000Z');
    expect((await rows('SELECT * FROM portal_activities WHERE client_id=$1',[client]))).toHaveLength(1);
    const audit=await rows('SELECT new_data,profile_id,created_at FROM audit_logs WHERE record_id=$1',[id(100)]);
    expect(audit[0].new_data.restored).toBe(true);
    expect(audit[0].profile_id).toBeNull();
  });

  it('does not duplicate history, messages, activities or notifications when the migration runs again',async()=>{
    const before=await counts();
    await owner(()=>db.exec(migration));
    expect(await counts()).toEqual(before);
  });

  it.each(['rueckruf','termin_aendern','zusatztermin','nachricht','upload','nachweise','sonstiges','stammdaten','beschwerde','lob'])(
    'commits a fully delivered and unread %s request from a real portal role',async type=>{
      const n=200+['rueckruf','termin_aendern','zusatztermin','nachricht','upload','nachweise','sonstiges','stammdaten','beschwerde','lob'].indexOf(type);
      const receipt=await submit(n,{type});
      expect(receipt).toMatchObject({id:id(n),portal_user_id:profile,client_id:client});
      expect(receipt.office_thread_id).toBeTruthy();expect(receipt.office_message_id).toBeTruthy();expect(receipt.office_delivered_at).toBeTruthy();
      const thread=(await rows('SELECT * FROM message_threads WHERE id=$1',[receipt.office_thread_id]))[0];
      expect(thread).toMatchObject({status:'new',office_unread_count:1,portal_unread_count:0,client_id:client});
      expect((await rows('SELECT * FROM communication_notifications WHERE office_thread_id=$1',[thread.id]))).toHaveLength(1);
      expect((await rows('SELECT * FROM portal_request_status_history WHERE request_id=$1',[id(n)]))).toHaveLength(1);
    },
  );

  it('returns the same receipt on retries and concurrent submissions, and rejects reuse with different content',async()=>{
    const first=await submit(300);const before=await counts();
    const retried=await Promise.all([submit(300),submit(300)]);
    expect(retried.map(r=>r.office_thread_id)).toEqual([first.office_thread_id,first.office_thread_id]);
    expect(await counts()).toEqual(before);
    await expect(submit(300,{description:'Anderer Inhalt'})).rejects.toThrow(/Versandkennung/);
    expect(await counts()).toEqual(before);
  });

  it('rolls the entire request back if notification or audit creation fails',async()=>{
    const before=await counts();
    await owner(()=>db.exec(`CREATE FUNCTION public.fail_request_test() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'injected delivery failure';END$$;
      CREATE TRIGGER fail_request_notice BEFORE INSERT ON communication_notifications FOR EACH ROW EXECUTE FUNCTION fail_request_test();`));
    await expect(submit(301)).rejects.toThrow(/injected delivery failure/);
    expect(await counts()).toEqual(before);
    await owner(()=>db.exec('DROP TRIGGER fail_request_notice ON communication_notifications; CREATE TRIGGER fail_request_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_request_test();'));
    await expect(submit(302)).rejects.toThrow(/injected delivery failure/);
    expect(await counts()).toEqual(before);
    await owner(()=>db.exec('DROP TRIGGER fail_request_audit ON audit_logs; DROP FUNCTION fail_request_test();'));
  });

  it('refuses to acknowledge an installation with its delivery trigger missing',async()=>{
    const before=await counts();
    await owner(()=>db.exec('DROP TRIGGER portal_request_deliver_to_office ON portal_requests'));
    await expect(submit(303)).rejects.toThrow(/Eingang im Office/);
    expect(await counts()).toEqual(before);
    await owner(()=>db.exec(migration));
  });

  it('also delivers direct request INSERTs from older clients and prevents spoofed authors',async()=>{
    await db.query(`INSERT INTO portal_requests(id,tenant_id,client_id,portal_user_id,request_type,title) VALUES($1,$2,$3,$4,'rueckruf','Alter Client')`,[id(304),tenant,client,profile]);
    expect((await rows('SELECT office_delivered_at FROM portal_requests WHERE id=$1',[id(304)]))[0].office_delivered_at).toBeTruthy();
    const before=await counts();
    await expect(db.query(`INSERT INTO portal_requests(id,tenant_id,client_id,portal_user_id,request_type,title) VALUES($1,$2,$3,$4,'rueckruf','Falscher Absender')`,[id(305),tenant,client,id(21)])).rejects.toThrow(/Klientenprofil/);
    expect(await counts()).toEqual(before);
  });

  it('isolates another client and tenant, denies anonymous and private function calls, and protects receipts',async()=>{
    const before=await counts();
    await expect(submit(306,{client:otherClient})).rejects.toThrow(/Klientenprofil/);
    await expect(submit(307,{tenant:id(2)})).rejects.toThrow(/Klientenprofil/);
    expect((await db.query('SELECT id FROM portal_requests WHERE id=$1',[id(102)])).rows).toHaveLength(0);
    const privateThread=(await rows('SELECT office_thread_id FROM portal_requests WHERE id=$1',[id(102)]))[0].office_thread_id;
    expect((await db.query('SELECT id FROM message_threads WHERE id=$1',[privateThread])).rows).toHaveLength(0);
    expect((await db.query('SELECT id FROM messages WHERE sender_client_id=$1',[otherClient])).rows).toHaveLength(0);
    await expect(db.query('SELECT portal_request_private.deliver_request($1,true)',[id(100)])).rejects.toThrow(/permission denied/);
    await db.exec("SELECT set_config('test.office','true',false)");
    await expect(db.query('UPDATE portal_requests SET office_delivered_at=null WHERE id=$1',[id(100)])).rejects.toThrow(/Empfangsbestätigung/);
    await db.exec('RESET ROLE; SET ROLE anon');
    await expect(submit(308)).rejects.toThrow(/permission denied/);
    expect(await counts()).toEqual(before);
  });
});
