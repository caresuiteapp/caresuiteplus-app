import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// A minimal relational fixture for the real, unmodified workspace function. The
// queue migration and registrar execute against PostgreSQL, not an SQL mock.
const fixture = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
CREATE TYPE public.product_key AS ENUM ('office','assist');
CREATE TABLE tenants(id uuid PRIMARY KEY,name text,legal_name text,slug text,legal_form text,industry text,street text,postal_code text,city text,phone text,email text,website text,ik_number text,tax_number text,vat_id text,status text,billing_email text,representative_name text);
CREATE TABLE roles(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,tenant_id uuid,key text,name text,is_admin_role boolean,can_manage_tenant boolean,can_manage_users boolean,can_manage_roles boolean,can_manage_products boolean,can_manage_clients boolean,can_manage_employees boolean,can_manage_assignments boolean,can_manage_documentation boolean,can_manage_service_records boolean,can_manage_signatures boolean,can_manage_documents boolean,can_manage_messages boolean,can_manage_billing boolean,can_view_reports boolean,can_view_audit_logs boolean,can_manage_support boolean,can_use_ai_assistant boolean,allowed_products product_key[]);
CREATE TABLE profiles(auth_user_id uuid UNIQUE,tenant_id uuid,role_id uuid,first_name text,last_name text,email text,phone text,status text,is_active boolean,activated_at timestamptz,terms_accepted_at timestamptz,privacy_accepted_at timestamptz,updated_at timestamptz);
CREATE TABLE tenant_users(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,tenant_id uuid,auth_user_id uuid,display_name text,first_name text,last_name text,email text,username text,role_key text,status text,must_change_password boolean,first_login_completed boolean,last_password_change_at timestamptz);
CREATE TABLE products(id uuid DEFAULT gen_random_uuid(),product_key product_key,is_active boolean,sort_order integer);
INSERT INTO products(product_key,is_active,sort_order) VALUES('office',true,0),('assist',true,1);
CREATE TABLE tenant_addresses(tenant_id uuid,street text,zip text,city text);
CREATE TABLE tenant_contacts(tenant_id uuid,first_name text,last_name text,role text,email text,phone text,is_primary boolean);
CREATE TABLE tenant_products(tenant_id uuid,product_id uuid,product_key product_key,status text,is_active boolean,activated_at timestamptz,access_source text,access_type text,billing_status text,price_cents integer,monthly_price integer,premium_ready boolean,is_default boolean,is_visible_in_switcher boolean);
CREATE TABLE tenant_subscriptions(tenant_id uuid,status text,billing_email text,metadata jsonb);
CREATE TABLE platform_tenants(tenant_id uuid UNIQUE,tenant_name text,legal_name text,slug text,status text,lifecycle_status text,billing_status text,plan_key text,industry_type text,primary_contact_name text,primary_contact_email text,primary_contact_phone text,activated_at timestamptz,trial_starts_at timestamptz,trial_ends_at timestamptz,updated_at timestamptz);
CREATE TABLE tenant_environment_settings(tenant_id uuid UNIQUE,mode text,is_pilot_tenant boolean,provider_sandbox_only boolean,notes text);
CREATE TABLE platform_modules(module_key text,status text); INSERT INTO platform_modules VALUES('office','available');
CREATE TABLE platform_tenant_modules(tenant_id uuid,module_key text,status text,is_trial boolean,enabled_at timestamptz,trial_ends_at timestamptz,UNIQUE(tenant_id,module_key));
`;
const registration={companyName:'New Company',legalForm:'GmbH',industry:'Pflege',street:'Street 1',zip:'12345',city:'Berlin',phone:'12345',email:'office@example.test',adminFirstName:'Test',adminLastName:'Owner',adminEmail:'owner@example.test',termsAccepted:true};

describe('transactional registration welcome database',()=>{
  let db:PGlite;
  beforeAll(async()=>{
    db=new PGlite();await db.exec(fixture);
    await db.exec(readFileSync(resolve('supabase/migrations/20261006063320_registration_welcome_outbox.sql'),'utf8'));
    await db.exec(readFileSync(resolve('supabase/migrations/20261006123127_registration_gmail_smtp.sql'),'utf8'));
  },30000);
  afterAll(async()=>{await db?.close();});
  async function register(email=`owner-${randomUUID()}@example.test`) {
    const id=randomUUID();await db.query('INSERT INTO auth.users VALUES($1,$2)',[id,email]);
    const {rows}=await db.query<{result:{tenantId:string;welcomeEmailQueued:boolean;owner:{id:string}}}>('SELECT register_business_workspace($1,$2::jsonb) result',[id,JSON.stringify({...registration,adminEmail:email})]);
    return {authId:id,email,...rows[0].result};
  }
  async function claim(tenant:string,provider='resend') {
    return (await db.query<{id:string;lease_token:string;attempts:number}>('SELECT * FROM registration_welcome_claim($1,10,$2)',[tenant,provider])).rows;
  }
  async function finish(id:string,lease:string,outcome:string) {
    return (await db.query<{ok:boolean}>('SELECT registration_welcome_finish($1,$2,$3,$4,$5) ok',[id,lease,outcome,'provider-id','mail_http_503'])).rows[0].ok;
  }
  it('commits exactly one pending message with the fully provisioned workspace and recovers RPC retries',async()=>{
    const result=await register();expect(result.welcomeEmailQueued).toBe(true);
    const retry=await db.query<{result:{tenantId:string}}>('SELECT register_business_workspace($1,$2::jsonb) result',[result.authId,JSON.stringify({...registration,adminEmail:result.email})]);
    expect(retry.rows[0].result.tenantId).toBe(result.tenantId);
    const q=await db.query('SELECT tenant_id,recipient_email,state,attempts FROM registration_welcome_outbox WHERE auth_user_id=$1',[result.authId]);
    expect(q.rows).toEqual([{tenant_id:result.tenantId,recipient_email:result.email,state:'pending',attempts:0}]);
    const columns=await db.query<{column_name:string}>("SELECT column_name FROM information_schema.columns WHERE table_name='registration_welcome_outbox'");
    expect(columns.rows.map(row=>row.column_name).join(' ')).not.toMatch(/password|secret/);
  });
  it('rolls back all company records if the mail job cannot be saved',async()=>{
    await db.exec(`CREATE FUNCTION reject_welcome_fixture() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.recipient_email='rollback@example.test' THEN RAISE EXCEPTION 'fixture_failure'; END IF; RETURN NEW; END$$; CREATE TRIGGER reject_welcome_fixture BEFORE INSERT ON registration_welcome_outbox FOR EACH ROW EXECUTE FUNCTION reject_welcome_fixture();`);
    const authId=randomUUID();await db.query('INSERT INTO auth.users VALUES($1,$2)',[authId,'rollback@example.test']);
    await expect(db.query('SELECT register_business_workspace($1,$2::jsonb)',[authId,JSON.stringify({...registration,adminEmail:'rollback@example.test'})])).rejects.toThrow('fixture_failure');
    expect((await db.query('SELECT id FROM tenant_users WHERE auth_user_id=$1',[authId])).rows).toHaveLength(0);
    expect((await db.query("SELECT id FROM tenants WHERE billing_email='rollback@example.test'")).rows).toHaveLength(0);
    await db.exec('DROP TRIGGER reject_welcome_fixture ON registration_welcome_outbox; DROP FUNCTION reject_welcome_fixture();');
  });
  it('does not enqueue historical companies when registration is retried',async()=>{
    const r=await register();await db.query('DELETE FROM registration_welcome_outbox WHERE auth_user_id=$1',[r.authId]);
    await db.query('SELECT register_business_workspace($1,$2::jsonb)',[r.authId,JSON.stringify({...registration,adminEmail:r.email})]);
    expect((await db.query('SELECT id FROM registration_welcome_outbox WHERE auth_user_id=$1',[r.authId])).rows).toHaveLength(0);
  });
  it('leases atomically, rejects old tokens and never reclaims accepted messages',async()=>{
    const r=await register();const [first]=await claim(r.tenantId);
    expect(await claim(r.tenantId)).toHaveLength(0);
    expect(await finish(first.id,randomUUID(),'sent')).toBe(false);
    expect(await finish(first.id,first.lease_token,'sent')).toBe(true);
    expect(await claim(r.tenantId)).toHaveLength(0);
    expect((await db.query<{state:string;provider_message_id:string}>('SELECT state,provider_message_id FROM registration_welcome_outbox WHERE id=$1',[first.id])).rows[0]).toEqual({state:'sent',provider_message_id:'provider-id'});
  });
  it('defers transient failures, reclaims expired Resend leases and rejects stale acceptance',async()=>{
    const r=await register();const [first]=await claim(r.tenantId);
    expect(await finish(first.id,first.lease_token,'retry')).toBe(true);expect(await claim(r.tenantId)).toHaveLength(0);
    await db.query('UPDATE registration_welcome_outbox SET next_attempt_at=now()-interval \'1 minute\' WHERE id=$1',[first.id]);
    const [second]=await claim(r.tenantId);expect(second.attempts).toBe(2);
    await db.query('UPDATE registration_welcome_outbox SET lease_until=now()-interval \'1 minute\' WHERE id=$1',[first.id]);
    const [third]=await claim(r.tenantId);expect(third.lease_token).not.toBe(second.lease_token);
    expect(await finish(second.id,second.lease_token,'sent')).toBe(false);
    expect(await finish(third.id,third.lease_token,'sent')).toBe(true);
  });
  it.each(['sendgrid','gmail'])('does not retry ambiguous %s deliveries after a worker crash',async provider=>{
    const r=await register();const [first]=await claim(r.tenantId,provider);
    await db.query('UPDATE registration_welcome_outbox SET lease_until=now()-interval \'1 minute\' WHERE id=$1',[first.id]);
    expect(await claim(r.tenantId,provider)).toHaveLength(0);
    expect((await db.query('SELECT state,last_error_code FROM registration_welcome_outbox WHERE id=$1',[first.id])).rows[0]).toEqual({state:'failed',last_error_code:'mail_delivery_needs_review'});
  });
  it('stops retries within the provider idempotency window and after eight attempts',async()=>{
    for(const expired of [false,true]) {
      const r=await register();await db.query(`UPDATE registration_welcome_outbox SET attempts=$1,first_attempt_at=now()-make_interval(hours=>$2) WHERE tenant_id=$3`,[expired?1:8,expired?24:1,r.tenantId]);
      expect(await claim(r.tenantId)).toHaveLength(0);
      expect((await db.query('SELECT state FROM registration_welcome_outbox WHERE tenant_id=$1',[r.tenantId])).rows[0]).toEqual({state:'failed'});
    }
  });
  it('denies anonymous and authenticated users access to recipients and worker RPCs',async()=>{
    for(const role of ['anon','authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      await expect(db.query('SELECT * FROM registration_welcome_outbox')).rejects.toThrow('permission denied');
      await expect(db.query('SELECT * FROM registration_welcome_claim(NULL,10,\'resend\')')).rejects.toThrow('permission denied');
      await db.exec('RESET ROLE');
    }
  });
});
