import {afterAll,beforeAll,beforeEach,describe,expect,it} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
let db:PGlite;
const ids={admin:'10000000-0000-0000-0000-000000000001',operator:'10000000-0000-0000-0000-000000000002',client:'10000000-0000-0000-0000-000000000003',employee:'10000000-0000-0000-0000-000000000004',blocked:'10000000-0000-0000-0000-000000000005',tenant:'20000000-0000-0000-0000-000000000001'};
const fixture=`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
CREATE TABLE tenants(id uuid PRIMARY KEY,status text);CREATE TABLE roles(id serial PRIMARY KEY,tenant_id uuid,key text);CREATE TABLE profiles(auth_user_id uuid PRIMARY KEY,tenant_id uuid,role_id integer,email text,first_name text,last_name text,status text,is_active boolean);
CREATE TABLE platform_operators(user_id uuid PRIMARY KEY,can_read boolean,can_write boolean);
CREATE FUNCTION platform_has_capability(cap text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM platform_operators WHERE user_id=auth.uid() AND CASE cap WHEN 'support.read' THEN can_read WHEN 'support.write' THEN can_write ELSE false END) $$;
GRANT SELECT ON tenants,roles,profiles TO service_role;
INSERT INTO tenants VALUES('${ids.tenant}','active');INSERT INTO roles(tenant_id,key) VALUES('${ids.tenant}','admin'),('${ids.tenant}','client_portal'),('${ids.tenant}','employee_portal');
INSERT INTO profiles VALUES('${ids.admin}','${ids.tenant}',1,'admin@example.test','Anna','Admin','active',true),('${ids.client}','${ids.tenant}',2,'client@example.test','C','Client','active',true),('${ids.employee}','${ids.tenant}',3,'employee@example.test','E','Employee','active',true),('${ids.blocked}','${ids.tenant}',1,'blocked@example.test','B','Blocked','blocked',false);
INSERT INTO platform_operators VALUES('${ids.operator}',true,true);`;
const payload={name:'Anna Beispiel',email:'anna@example.test',organization:'Firma',subject:'Hilfe bei der Anmeldung',category:'account',message:'Ich komme nicht mehr in meine Verwaltung hinein.',privacyAccepted:true};
const h='a'.repeat(64);
const submit=async(nonce=randomUUID(),hash=h,emailHash='b'.repeat(64))=>(await db.query<{receipt:{reference?:string;rateLimited?:boolean}}>('SELECT public_support_submit($1,$2,$3,$4,$5::jsonb) AS receipt',[nonce,hash,'c'.repeat(64),emailHash,JSON.stringify(payload)])).rows[0].receipt;
beforeAll(async()=>{db=new PGlite();await db.exec(fixture);await db.exec(readFileSync(resolve('supabase/migrations/20261006035633_public_access_support_and_business_recovery.sql'),'utf8'));},30000);
beforeEach(async()=>{await db.exec("RESET ROLE;SET request.jwt.claim.sub='';TRUNCATE public_support_tickets,public_access_private.request_limits;");});
afterAll(async()=>{await db.close();});
describe('public access PostgreSQL rights and persistence',()=>{
  it('selects only active administration accounts, never employee/client/unknown/blocked profiles',async()=>{
    await db.exec('SET ROLE service_role');
    for(const email of ['client@example.test','employee@example.test','blocked@example.test','unknown@example.test']) expect((await db.query('SELECT business_password_recovery_target($1,NULL) AS target',[email])).rows[0].target).toBeNull();
    expect((await db.query<{target:{authUserId:string}}>('SELECT business_password_recovery_target($1,NULL) AS target',['ADMIN@example.test'])).rows[0].target.authUserId).toBe(ids.admin);
    expect((await db.query('SELECT business_password_recovery_target($1,$2) AS target',['admin@example.test',ids.client])).rows[0].target).toBeNull();
  });
  it('denies anonymous/authenticated users internal lookup, rate keys and public submission RPC',async()=>{
    for(const role of ['anon','authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      await expect(db.query("SELECT business_password_recovery_target('admin@example.test',NULL)")).rejects.toThrow('permission denied');
      await expect(db.query('SELECT * FROM public_access_private.request_limits')).rejects.toThrow('permission denied');
      await expect(submit()).rejects.toThrow('permission denied');await db.exec('RESET ROLE');
    }
  });
  it('persists a receipt once and reuses it after a lost response, without consuming more attempts',async()=>{
    await db.exec('SET ROLE service_role');const nonce=randomUUID();const receipt=await submit(nonce);
    for(let i=0;i<7;i++) expect(await submit(nonce)).toEqual(receipt);
    expect((await db.query('SELECT count(*)::integer AS count FROM public_support_tickets')).rows[0].count).toBe(1);
    expect((await db.query('SELECT max(attempts) AS attempts FROM public_access_private.request_limits')).rows[0].attempts).toBe(1);
    await expect(submit(nonce,'d'.repeat(64))).rejects.toThrow('support_invalid_nonce');
  });
  it('limits new anonymous requests but preserves confirmed receipt retries',async()=>{
    await db.exec('SET ROLE service_role');const nonce=randomUUID();const receipt=await submit(nonce);await submit();await submit();
    expect(await submit()).toEqual({rateLimited:true});expect(await submit(nonce)).toEqual(receipt);
  });
  it('enforces database validation as well as endpoint validation',async()=>{
    await db.exec('SET ROLE service_role');
    await expect(db.query('SELECT public_support_submit($1,$2,$3,$4,$5)',[randomUUID(),h,h,h,JSON.stringify({...payload,privacyAccepted:false})])).rejects.toThrow('support_invalid_privacy');
    await expect(db.query('SELECT public_support_submit($1,$2,$3,$4,$5)',[randomUUID(),h,h,h,JSON.stringify({...payload,message:'short'})])).rejects.toThrow('check constraint');
  });
  it('keeps contact data invisible to guests and tenant users while authorised support can read it',async()=>{
    await submit();await db.exec('SET ROLE anon');await expect(db.query('SELECT * FROM public_support_tickets')).rejects.toThrow('permission denied');
    await db.exec(`SET ROLE authenticated;SET request.jwt.claim.sub='${ids.admin}'`);expect((await db.query('SELECT * FROM public_support_tickets')).rows).toHaveLength(0);
    await expect(db.query("SELECT support_list_public_tickets('',0)")).rejects.toThrow('support_forbidden');
    await db.exec(`SET request.jwt.claim.sub='${ids.operator}'`);
    expect((await db.query<{data:{tickets:{email:string}[]}}>("SELECT support_list_public_tickets('',0) AS data")).rows[0].data.tickets[0].email).toBe(payload.email);
  });
  it('lets support update only status, without editing the sender or granting tenant access',async()=>{
    await submit();const id=(await db.query<{id:string}>('SELECT id FROM public_support_tickets')).rows[0].id;
    await db.exec(`SET ROLE authenticated;SET request.jwt.claim.sub='${ids.operator}'`);
    expect((await db.query('SELECT support_set_public_ticket_status($1,$2) AS confirmed',[id,'in_progress'])).rows[0].confirmed).toBe(true);
    await expect(db.query('UPDATE public_support_tickets SET email=$1 WHERE id=$2',['tampered@example.test',id])).rejects.toThrow('permission denied');
    await db.exec(`SET request.jwt.claim.sub='${ids.admin}'`);await expect(db.query('SELECT support_set_public_ticket_status($1,$2)',[id,'closed'])).rejects.toThrow('support_forbidden');
  });
});
