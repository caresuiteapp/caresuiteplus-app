import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

const migration=(name:string)=>readFileSync('supabase/migrations/'+name,'utf8');
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
describe('tenant administration with free usage, account recovery and company consent',()=>{
  let db:PGlite;
  const rows=async(sql:string,args:unknown[]=[])=> (await db.query<Record<string,any>>(sql,args)).rows;
  const scalar=async(sql:string,args:unknown[]=[])=>Object.values((await rows(sql,args))[0])[0] as any;
  const login=async(n:number)=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id(n)]);await db.exec('SET ROLE authenticated');};
  const server=async()=>{await db.exec('RESET ROLE; SET ROLE service_role');};
  const prepare=(nonce:string,action:string,email:string|null=null,user=20,tenant=1,authorized=true)=>scalar(
    'SELECT platform_prepare_account_operation($1,$2,$3,$4,$5,$6,$7)',[nonce,id(tenant),id(user),action,email,'Korrektur auf Kundenauftrag',authorized]);
  beforeAll(async()=>{
    db=new PGlite();
    await db.exec(`
      CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,deleted_at timestamptz);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
      CREATE TABLE tenants(id uuid PRIMARY KEY,name text,slug text,status text DEFAULT 'active');
      CREATE TABLE roles(id uuid PRIMARY KEY,tenant_id uuid,is_admin_role boolean,can_manage_tenant boolean,can_manage_support boolean);
      CREATE TABLE profiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auth_user_id uuid,tenant_id uuid,role_id uuid,email text,phone text,display_name text,first_name text,last_name text,status text DEFAULT 'active',is_active boolean DEFAULT true,updated_at timestamptz DEFAULT now());
      CREATE TABLE tenant_users(id uuid PRIMARY KEY,tenant_id uuid,auth_user_id uuid,employee_id uuid,display_name text,username text,email text,role_key text,status text DEFAULT 'active',last_login_at timestamptz,archived_at timestamptz,updated_at timestamptz DEFAULT now());
      CREATE TABLE clients(id uuid PRIMARY KEY,tenant_id uuid,client_number text,first_name text,last_name text,status text,updated_at timestamptz DEFAULT now(),deleted_at timestamptz,email text,phone text,street text,postal_code text,city text);
      CREATE TABLE employees(id uuid PRIMARY KEY,tenant_id uuid,employee_number text,first_name text,last_name text,status text,portal_enabled boolean,updated_at timestamptz DEFAULT now(),deleted_at timestamptz,email text,phone text);
      CREATE TABLE error_logs(id uuid PRIMARY KEY,tenant_id uuid,level text,error_code text,error_message text,stack_trace text,product_key text,page_name text,action_name text,app_version text,is_resolved boolean,created_at timestamptz DEFAULT now());
      CREATE TABLE platform_addons(addon_key text PRIMARY KEY,addon_name text);
      CREATE TABLE platform_addon_versions(id uuid PRIMARY KEY,monthly_price_cents integer,yearly_price_cents integer,currency text);
      CREATE TABLE platform_tenant_addons(id uuid PRIMARY KEY,tenant_id uuid,addon_key text,addon_version_id uuid,status text,billing_interval text,price_override_cents integer,starts_at timestamptz,ends_at timestamptz);
      CREATE TABLE registration_welcome_outbox(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,tenant_user_id uuid,auth_user_id uuid,recipient_email text,template_version text DEFAULT 'registration-welcome-v1',state text DEFAULT 'pending',provider text CHECK(provider IN ('resend','sendgrid')),attempts integer DEFAULT 0,first_attempt_at timestamptz,next_attempt_at timestamptz DEFAULT now(),lease_token uuid,lease_until timestamptz,provider_message_id text,last_error_code text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),sent_at timestamptz,UNIQUE(tenant_user_id,template_version));
    `);
    await db.exec(migration('0246_platform_console_foundation_live.sql'));
    const ops=migration('0259_platform_addons_and_tenant_records_repair.sql');
    const begin=ops.indexOf('CREATE OR REPLACE FUNCTION public.platform_assert_capability');
    const end=ops.indexOf('CREATE OR REPLACE FUNCTION public.',begin+20);
    await db.exec(ops.slice(begin,end));
    const reasonBegin=ops.indexOf('CREATE OR REPLACE FUNCTION public.platform_assert_reason');
    const reasonEnd=ops.indexOf('CREATE OR REPLACE FUNCTION public.',reasonBegin+20);
    await db.exec(ops.slice(reasonBegin,reasonEnd));
    await db.exec(migration('20260907171000_support_tickets_and_consent.sql'));
    const support=migration('20260907172000_support_attachments_and_workspace.sql');
    const a=support.indexOf('CREATE OR REPLACE FUNCTION public.support_assert_access');
    const b=support.indexOf('CREATE OR REPLACE FUNCTION public.support_workspace_read',a);
    await db.exec(support.slice(a,b));
    // Gmail is already deployed. Apply the pending administration change afterwards.
    await db.exec(migration('20261006123127_registration_gmail_smtp.sql'));
    await db.exec(migration('20261006122235_platform_tenant_operations_de.sql'));
    await db.exec(`
      INSERT INTO platform_plans(plan_key,plan_name,monthly_price_cents,yearly_price_cents,is_public)
        VALUES('free_platform','CareSuite kostenlos',0,0,true),('other_free','Anderer Bestand',0,0,false);
      INSERT INTO platform_audit_log(action,target_type,target_id,reason,user_agent)
        SELECT 'plan.created','platform_plan',id,
          'Produktiver Konfigurationsabgleich zur freigegebenen Mandantenverwaltung vom 06.10.2026: Prüfbeleg',
          'CareSuite-Konfigurationsabgleich' FROM platform_plans WHERE plan_key='free_platform';
    `);
    await db.exec(migration('20261006182606_platform_console_free_only.sql'));
    await db.exec(`
      GRANT ALL ON ALL TABLES IN SCHEMA public,auth TO service_role;
      INSERT INTO tenants(id,name) VALUES('${id(1)}','Firma A'),('${id(2)}','Firma B');
      INSERT INTO auth.users(id,email) VALUES('${id(10)}','platform@example.test'),('${id(11)}','reader@example.test'),('${id(12)}','support@example.test'),('${id(20)}','old@example.test'),('${id(21)}','second@example.test'),('${id(30)}','tenant-admin@example.test');
      INSERT INTO platform_users(user_id,email,role,status) VALUES('${id(10)}','platform@example.test','platform_owner','active'),('${id(11)}','reader@example.test','platform_readonly','active'),('${id(12)}','support@example.test','platform_support','active');
      INSERT INTO platform_tenants(tenant_id,tenant_name,primary_contact_email) VALUES('${id(1)}','Firma A','old@example.test'),('${id(2)}','Firma B','second@example.test');
      INSERT INTO roles VALUES('${id(31)}','${id(1)}',true,true,true);
      INSERT INTO profiles(auth_user_id,tenant_id,email,role_id) VALUES('${id(20)}','${id(1)}','old@example.test',null),('${id(30)}','${id(1)}','tenant-admin@example.test','${id(31)}');
      INSERT INTO tenant_users(id,tenant_id,auth_user_id,display_name,username,email,role_key) VALUES('${id(20)}','${id(1)}','${id(20)}','Geschäftsführung','admin-a','old@example.test','owner'),('${id(21)}','${id(2)}','${id(21)}','Geschäftsführung B','admin-b','second@example.test','owner');
      INSERT INTO registration_welcome_outbox(tenant_id,tenant_user_id,auth_user_id,recipient_email) VALUES('${id(1)}','${id(20)}','${id(20)}','old@example.test');
      INSERT INTO clients(id,tenant_id,client_number,first_name,last_name,status,email) VALUES('${id(40)}','${id(1)}','K-001','Anna','A','active','client-a@example.test'),('${id(41)}','${id(2)}','K-002','Bert','B','active','client-b@example.test');
      INSERT INTO error_logs(id,tenant_id,level,error_code,error_message,stack_trace,product_key,page_name,action_name,is_resolved) VALUES('${id(50)}','${id(1)}','error','visit_start_failed','never expose a password','secret stack','assist','visit','start',false),('${id(51)}','${id(2)}','critical','private','other company','other secret','office','admin','load',false);
      INSERT INTO support_workspace_tickets(id,tenant_id,created_by,client_nonce,subject) VALUES('${id(60)}','${id(1)}','${id(30)}','${id(61)}','Anfrage A'),('${id(62)}','${id(2)}','${id(21)}','${id(63)}','Anfrage B');
    `);
  },30000);
  afterAll(async()=>{await db?.close();});
  it('does not grant anonymous users a management API or table access',async()=>{
    expect(await scalar("SELECT has_function_privilege('anon','platform_prepare_account_operation(uuid,uuid,uuid,text,text,text,boolean)','EXECUTE')")).toBe(false);
    expect(await scalar("SELECT has_function_privilege('authenticated','platform_finish_account_operation(uuid,boolean,boolean)','EXECUTE')")).toBe(false);
    expect(await scalar("SELECT has_table_privilege('authenticated','platform_account_operations','SELECT')")).toBe(false);
  });
  it('rejects readonly roles, wrong-company targets and unconfirmed authorization',async()=>{
    await login(11);await expect(prepare(randomUUID(),'email_change','new@example.test')).rejects.toThrow('platform_forbidden');
    await login(10);await expect(prepare(randomUUID(),'email_change','new@example.test',21,1)).rejects.toThrow('account_not_active');
    await expect(prepare(randomUUID(),'email_change','new@example.test',20,1,false)).rejects.toThrow('account_authorization_required');
  });
  it('corrects the identity and account together, cancels the old queue, and retries idempotently',async()=>{
    await login(10);const nonce=randomUUID();const result=await prepare(nonce,'email_change','new@example.test');
    expect(result.state).toBe('prepared');expect((await prepare(nonce,'email_change','new@example.test')).id).toBe(nonce);
    await expect(prepare(nonce,'email_change','different@example.test')).rejects.toThrow('request_payload_changed');
    await server();expect(await scalar('SELECT state FROM registration_welcome_outbox WHERE tenant_user_id=$1',[id(20)])).toBe('cancelled');
    expect((await scalar('SELECT platform_claim_account_operation($1)',[nonce])).auth_user_id).toBe(id(20));
    expect(await scalar('SELECT platform_claim_account_operation($1)',[nonce])).toBeNull();
    await db.query('UPDATE auth.users SET email=$1 WHERE id=$2',['new@example.test',id(20)]);
    expect((await scalar('SELECT platform_finish_account_operation($1,true,false)',[nonce])).ok).toBe(true);
    expect(await scalar('SELECT email FROM tenant_users WHERE id=$1',[id(20)])).toBe('new@example.test');
    expect(await scalar('SELECT email FROM profiles WHERE auth_user_id=$1',[id(20)])).toBe('new@example.test');
    expect(await scalar('SELECT primary_contact_email FROM platform_tenants WHERE tenant_id=$1',[id(1)])).toBe('new@example.test');
    await login(10);expect((await prepare(nonce,'email_change','new@example.test')).state).toBe('completed');
  });
  it('uses a new delivery revision for intentional resends and preserves uncertainty as a blocked operation',async()=>{
    await login(10);const nonce=randomUUID();await prepare(nonce,'welcome_resend');await server();
    await scalar('SELECT platform_claim_account_operation($1)',[nonce]);await scalar('SELECT platform_finish_account_operation($1,true,false)',[nonce]);
    const queue=(await rows('SELECT recipient_email,delivery_revision,state FROM registration_welcome_outbox WHERE tenant_user_id=$1',[id(20)]))[0];
    expect(queue).toEqual({recipient_email:'new@example.test',delivery_revision:2,state:'pending'});
    await login(10);const failed=randomUUID();await prepare(failed,'password_recovery');await server();await scalar('SELECT platform_claim_account_operation($1)',[failed]);
    await scalar('SELECT platform_finish_account_operation($1,false,true)',[failed]);await login(10);
    await expect(prepare(randomUUID(),'password_recovery')).rejects.toThrow('account_update_needs_review');
  });
  it('keeps the existing Gmail queue compatible with corrected recipients and deliberate delivery revisions',async()=>{
    await server();
    const claimed=await rows('SELECT * FROM registration_welcome_claim($1,10,$2)',[id(1),'gmail']);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({recipient_email:'new@example.test',delivery_revision:2,provider:'gmail',state:'sending'});
    await db.query("UPDATE registration_welcome_outbox SET lease_until=now()-interval '1 minute' WHERE id=$1",[claimed[0].id]);
    expect(await rows('SELECT * FROM registration_welcome_claim($1,10,$2)',[id(1),'gmail'])).toEqual([]);
    expect((await rows('SELECT state,last_error_code FROM registration_welcome_outbox WHERE id=$1',[claimed[0].id]))[0]).toEqual({state:'failed',last_error_code:'mail_delivery_needs_review'});
  });
  it('requires tenant approval, exact scopes and the requesting operator for details and errors',async()=>{
    await login(12);const req=await scalar("SELECT support_request_access($1,$2,$3,60)",[id(60),'Fehler gemeinsam prüfen',['clients.read','clients.details.read','errors.read']]);
    await expect(scalar("SELECT support_workspace_details($1,'clients.details.read',$2,0)",[req.id,id(40)])).rejects.toThrow('support_access_denied');
    await expect(scalar("SELECT support_decide_access($1,'approve')",[req.id])).rejects.toThrow('support_tenant_approval_required');
    await login(30);await scalar("SELECT support_decide_access($1,'approve')",[req.id]);await login(12);
    const detail=await scalar("SELECT support_workspace_details($1,'clients.details.read',$2,0)",[req.id,id(40)]);
    expect(detail.rows[0].email).toBe('client-a@example.test');
    expect((await scalar("SELECT support_workspace_details($1,'clients.details.read',$2,0)",[req.id,id(41)])).rows).toEqual([]);
    const errors=await scalar("SELECT support_workspace_details($1,'errors.read',null,0)",[req.id]);expect(errors.rows).toHaveLength(1);
    expect(JSON.stringify(errors)).not.toContain('password');expect(errors.rows[0]).not.toHaveProperty('stack_trace');
    await expect(scalar("SELECT support_workspace_details($1,'employees.details.read',null,0)",[req.id])).rejects.toThrow('support_access_denied');
    await login(10);await expect(scalar("SELECT support_workspace_details($1,'errors.read',null,0)",[req.id])).rejects.toThrow('support_access_denied');
    await login(30);await scalar("SELECT support_decide_access($1,'revoke')",[req.id]);await login(12);
    await expect(scalar("SELECT support_workspace_details($1,'errors.read',null,0)",[req.id])).rejects.toThrow('support_access_denied');
  });
  it('filters support tickets by tenant before paging',async()=>{
    await login(10);const queue=await scalar("SELECT platform_tenant_ticket_queue($1,'','',0)",[id(1)]);
    expect(queue.tickets).toHaveLength(1);expect(queue.tickets[0].subject).toBe('Anfrage A');
  });
  it('stops detailed reads after expiry or closure of the approving ticket',async()=>{
    await login(12);const req=await scalar("SELECT support_request_access($1,$2,$3,15)",[id(60),'Kontaktangaben gemeinsam prüfen',['clients.read','clients.details.read']]);
    await login(30);await scalar("SELECT support_decide_access($1,'approve')",[req.id]);
    await server();await db.query("UPDATE support_access_requests SET expires_at=now()-interval '1 second' WHERE id=$1",[req.id]);
    await login(12);await expect(scalar("SELECT support_workspace_details($1,'clients.details.read',$2,0)",[req.id,id(40)])).rejects.toThrow('support_access_denied');
    await server();await db.query("UPDATE support_access_requests SET expires_at=now()+interval '15 minutes' WHERE id=$1",[req.id]);await db.query("UPDATE support_workspace_tickets SET status='closed' WHERE id=$1",[id(60)]);
    await login(12);await expect(scalar("SELECT support_workspace_details($1,'clients.details.read',$2,0)",[req.id,id(40)])).rejects.toThrow('support_access_denied');
    await server();await db.query("UPDATE support_workspace_tickets SET status='open' WHERE id=$1",[id(60)]);
  });
  it('makes recovery delivery bindings single-use and rejects an old recipient after email correction',async()=>{
    await server();const digest='a'.repeat(64);
    expect(await scalar('SELECT business_register_recovery_delivery($1,$2,$3)',[digest,id(20),'old@example.test'])).toBe(true);
    expect(await scalar('SELECT business_consume_recovery_delivery($1,$2,$3)',[digest,id(20),'new@example.test'])).toBe(false);
    expect(await scalar('SELECT business_consume_recovery_delivery($1,$2,$3)',[digest,id(20),'old@example.test'])).toBe(true);
    expect(await scalar('SELECT business_consume_recovery_delivery($1,$2,$3)',[digest,id(20),'old@example.test'])).toBe(false);
  });
  it('denies commercial credit and cost actions even to the owner',async()=>{
    await login(10);
    await expect(scalar('SELECT platform_record_tenant_credit($1,$2,2500,$3)',[randomUUID(),id(1),'Überholter Vorgang'])).rejects.toThrow('platform_forbidden');
    await expect(scalar('SELECT platform_tenant_cost_overview($1)',[id(1)])).rejects.toThrow('platform_forbidden');
    await server();expect(await scalar('SELECT count(*)::integer FROM platform_credit_ledger')).toBe(0);
  });
  it('archives only the mistaken administrative record and retains history',async()=>{
    await db.exec('RESET ROLE');
    expect((await rows("SELECT status,is_public FROM platform_plans WHERE plan_key='free_platform'"))[0]).toEqual({status:'archived',is_public:false});
    expect(await scalar("SELECT status FROM platform_plans WHERE plan_key='other_free'")).toBe('active');
    expect(await scalar("SELECT count(*)::integer FROM platform_audit_log WHERE action='plan.created' AND user_agent='CareSuite-Konfigurationsabgleich'")).toBe(1);
    expect(await scalar("SELECT count(*)::integer FROM platform_audit_log WHERE action='plan.archived' AND user_agent='CareSuite-Konfigurationskorrektur'")).toBe(1);
    const old=await scalar("SELECT monthly_price_cents FROM platform_plans WHERE plan_key='starter'");
    await login(10);await expect(scalar("SELECT platform_create_plan('new_free','Kostenlos','Überholter Vorgang')")).rejects.toThrow('platform_forbidden');
    await expect(scalar("SELECT platform_update_plan('starter','Überholter Vorgang','Basis')")).rejects.toThrow('platform_forbidden');
    await db.exec('RESET ROLE');expect(await scalar("SELECT monthly_price_cents FROM platform_plans WHERE plan_key='starter'")).toBe(old);
  });
  it('blocks tariff assignment, contract changes and changes to the free product policy',async()=>{
    await login(10);
    await expect(scalar("SELECT platform_assign_tenant_tariff($1,'starter','Überholter Vorgang','monthly',null)",[id(1)])).rejects.toThrow('platform_forbidden');
    await expect(scalar("SELECT platform_update_tenant_contract($1,'paused','Überholter Vorgang')",[id(1)])).rejects.toThrow('platform_forbidden');
    await expect(scalar("SELECT platform_update_system_setting('free_platform_enabled','false'::jsonb,'Überholter Vorgang')")).rejects.toThrow('free_usage_policy_locked');
    await server();expect(await scalar('SELECT count(*)::integer FROM platform_tenant_plans')).toBe(0);
  });
  it('denies all eight commercial capabilities for every platform role and preserves account and support permissions',async()=>{
    await db.exec('RESET ROLE');
    const roles=['platform_owner','platform_admin','platform_billing','platform_support','platform_developer','platform_readonly'];
    for(let index=0;index<roles.length;index++){
      const user=id(100+index);
      await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[user,`role-${index}@example.test`]);
      await db.query("INSERT INTO platform_users(user_id,email,role,status) VALUES($1,$2,$3,'active')",[user,`role-${index}@example.test`,roles[index]]);
    }
    for(let index=0;index<roles.length;index++){
      await login(100+index);
      for(const cap of ['plans.read','plans.write','discounts.read','discounts.write','billing.read','billing.write','payments.read','payments.write']) expect(await scalar('SELECT platform_has_capability($1)',[cap])).toBe(false);
    }
    await login(10);expect(await scalar("SELECT platform_has_capability('tenants.write')")).toBe(true);
    await login(12);expect(await scalar("SELECT platform_has_capability('support.write')")).toBe(true);
  });
});
