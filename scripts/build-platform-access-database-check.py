from pathlib import Path
import re
import sys
root=Path(__file__).resolve().parents[1]
source_path=Path(sys.argv[1]) if len(sys.argv)>1 else root/'supabase/pending/platform_tenant_access_controls.sql'
source=source_path.read_text()
functions=re.findall(r'CREATE OR REPLACE FUNCTION public\.\w+\([\s\S]*?\$\$;',source)
assert len(functions)==7,len(functions)
wrap=source[source.index('DO $wrap$'):source.index('END; $wrap$;')+len('END; $wrap$;')].replace('public.','pg_temp.')
functions='\n'.join(functions).replace('public.','pg_temp.').replace('auth.uid()','pg_temp.test_uid()')
# The same function bodies execute against session-local fixtures only.
head=r'''
BEGIN;
SET LOCAL statement_timeout='45s';
CREATE TEMP TABLE tenants(id uuid PRIMARY KEY);
CREATE TEMP TABLE platform_tenants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid UNIQUE,tenant_name text,status text,updated_at timestamptz DEFAULT clock_timestamp(),suspended_at timestamptz,terminated_at timestamptz);
CREATE TEMP TABLE tenant_users(id uuid PRIMARY KEY,tenant_id uuid,auth_user_id uuid,employee_id uuid,role_key text,display_name text,email text,username text,status text DEFAULT 'active',archived_at timestamptz,last_login_at timestamptz,updated_at timestamptz DEFAULT clock_timestamp());
CREATE TEMP TABLE platform_account_access_states(tenant_user_id uuid PRIMARY KEY,tenant_id uuid,state text DEFAULT 'active' CHECK(state IN('active','inactive','deleted')),prior_status text,deleted_from_state text,deleted_user_status text,deleted_user_archived_at timestamptz,updated_at timestamptz DEFAULT now());
CREATE TEMP TABLE platform_account_operations(id uuid,tenant_id uuid,auth_user_id uuid,state text,action text,created_at timestamptz DEFAULT now());
CREATE TEMP TABLE registration_welcome_outbox(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,tenant_user_id uuid,state text,lease_until timestamptz,lease_token uuid,updated_at timestamptz DEFAULT now(),recipient_email text,attempts integer DEFAULT 0,sent_at timestamptz,last_error_code text,delivery_revision integer DEFAULT 1);
CREATE TEMP TABLE profiles(id uuid DEFAULT gen_random_uuid(),auth_user_id uuid,tenant_id uuid);
CREATE TEMP TABLE audit_records(action text,tenant_id uuid,before_state jsonb,after_state jsonb,reason text);
CREATE TEMP TABLE client_records(id integer,tenant_id uuid);
CREATE FUNCTION pg_temp.test_uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('caresuite.access_check_actor',true),'')::uuid $$;
CREATE FUNCTION pg_temp.fixture_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid $$;
CREATE FUNCTION pg_temp.is_platform_user() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT pg_temp.test_uid()=pg_temp.fixture_id(10) $$;
CREATE FUNCTION pg_temp.platform_assert_capability(capability text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF pg_temp.test_uid()<>pg_temp.fixture_id(10) AND NOT(pg_temp.test_uid()=pg_temp.fixture_id(11) AND capability='tenants.read') THEN RAISE EXCEPTION 'platform_forbidden'; END IF;
END; $$;
CREATE FUNCTION pg_temp.platform_write_audit_log(a text,t text,record uuid,company uuid,b jsonb,c jsonb,r text) RETURNS void LANGUAGE sql AS $$ INSERT INTO pg_temp.audit_records VALUES(a,company,b,c,r) $$;
CREATE FUNCTION pg_temp.check_true(value boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %',label;END IF;END;$$;
CREATE FUNCTION pg_temp.check_error(command text,expected text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 BEGIN EXECUTE command; EXCEPTION WHEN OTHERS THEN IF SQLERRM=expected THEN RETURN; ELSE RAISE; END IF; END;
 RAISE EXCEPTION 'Expected error: %',expected;
END; $$;
SELECT set_config('caresuite.access_check_actor',pg_temp.fixture_id(10)::text,true);
INSERT INTO pg_temp.tenants VALUES(pg_temp.fixture_id(1)),(pg_temp.fixture_id(2));
INSERT INTO pg_temp.platform_tenants(tenant_id,tenant_name,status) VALUES(pg_temp.fixture_id(1),'Firma A','active'),(pg_temp.fixture_id(2),'Firma B','active');
INSERT INTO pg_temp.tenant_users(id,tenant_id,auth_user_id,role_key,display_name,email) VALUES
 (pg_temp.fixture_id(20),pg_temp.fixture_id(1),pg_temp.fixture_id(20),'owner','Leitung A','a@example.test'),
 (pg_temp.fixture_id(21),pg_temp.fixture_id(2),pg_temp.fixture_id(20),'owner','Leitung B','b@example.test');
INSERT INTO pg_temp.profiles(auth_user_id,tenant_id) VALUES(pg_temp.fixture_id(20),pg_temp.fixture_id(1));
INSERT INTO pg_temp.registration_welcome_outbox(tenant_id,tenant_user_id,state) VALUES(pg_temp.fixture_id(1),pg_temp.fixture_id(20),'pending');
INSERT INTO pg_temp.client_records VALUES(1,pg_temp.fixture_id(1)),(2,pg_temp.fixture_id(2));
'''
privileges='\n'.join(re.findall(r'(?:REVOKE|GRANT)[^;]*ON FUNCTION[^;]*;',source)).replace('public.','pg_temp.')
core=r'''
CREATE FUNCTION pg_temp.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT tenant_id FROM pg_temp.profiles WHERE auth_user_id=pg_temp.test_uid() LIMIT 1 $$;
CREATE FUNCTION pg_temp.caresuite_current_tenant_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT pg_temp.current_tenant_id() $$;
CREATE FUNCTION pg_temp.is_tenant_member(p_tenant_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM pg_temp.tenant_users WHERE auth_user_id=pg_temp.test_uid() AND tenant_id=p_tenant_id) $$;
CREATE FUNCTION pg_temp.is_internal_tenant_actor(p_tenant_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT pg_temp.is_tenant_member(p_tenant_id) $$;
CREATE FUNCTION pg_temp.support_is_tenant_member(p_tenant_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT pg_temp.is_tenant_member(p_tenant_id) $$;
'''
helpers=r'''
CREATE FUNCTION pg_temp.company_action(action text,confirmation text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
 SELECT pg_temp.platform_manage_tenant_access(pt.tenant_id,action,pt.status,pt.updated_at,confirmation,'Prüfung mit temporären Daten') FROM pg_temp.platform_tenants pt WHERE pt.tenant_id=pg_temp.fixture_id(1)
$$;
CREATE FUNCTION pg_temp.account_action(action text,confirmation text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
 SELECT pg_temp.platform_manage_account_access(u.tenant_id,u.id,action,u.status,u.updated_at,confirmation,'Prüfung mit temporären Daten') FROM pg_temp.tenant_users u WHERE u.id=pg_temp.fixture_id(20)
$$;
ALTER TABLE pg_temp.client_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY original_permission ON pg_temp.client_records TO authenticated,anon USING(pg_temp.is_tenant_member(tenant_id)) WITH CHECK(pg_temp.is_tenant_member(tenant_id));
GRANT SELECT ON pg_temp.client_records TO authenticated,anon;
DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated,anon', (SELECT nspname FROM pg_namespace WHERE oid=pg_my_temp_schema())); END; $$;
REVOKE ALL ON pg_temp.platform_account_access_states FROM authenticated,anon;
'''
tests=[]
def check(sql):tests.append(sql)
check("SELECT pg_temp.check_true(jsonb_array_length(pg_temp.platform_list_tenant_account_access(pg_temp.fixture_id(1))->'items')=1,'initial account list');")
check("SELECT set_config('caresuite.access_check_actor',pg_temp.fixture_id(11)::text,true); SELECT pg_temp.check_error($q$SELECT pg_temp.company_action('deactivate','DEAKTIVIEREN')$q$,'platform_forbidden'); SELECT set_config('caresuite.access_check_actor',pg_temp.fixture_id(10)::text,true);")
check("SELECT pg_temp.check_error($q$SELECT pg_temp.company_action('deactivate','bad')$q$,'access_confirmation_required');")
check("SELECT pg_temp.check_error($q$SELECT pg_temp.platform_manage_tenant_access(pg_temp.fixture_id(1),'delete','active',now(),'Firma A','Prüfung')$q$,'access_record_changed');")
check("SELECT pg_temp.check_error($q$SELECT pg_temp.company_action('invalid')$q$,'access_action_invalid');")
check("SELECT pg_temp.check_error($q$SELECT pg_temp.account_action('deactivate','DEAKTIVIEREN')$q$,'last_tenant_owner_protected');")
check("INSERT INTO pg_temp.tenant_users(id,tenant_id,auth_user_id,role_key,display_name,email) VALUES(pg_temp.fixture_id(22),pg_temp.fixture_id(1),pg_temp.fixture_id(22),'owner','Zweite Leitung','second@example.test'); SELECT pg_temp.account_action('deactivate','DEAKTIVIEREN'); SELECT pg_temp.check_true((SELECT status='blocked' FROM pg_temp.tenant_users WHERE id=pg_temp.fixture_id(20)),'account deactivated');")
check("SELECT pg_temp.check_true((SELECT state='cancelled' FROM pg_temp.registration_welcome_outbox WHERE tenant_user_id=pg_temp.fixture_id(20)),'pending mail cancelled');")
check("SELECT set_config('caresuite.access_check_actor',pg_temp.fixture_id(20)::text,true); SELECT pg_temp.check_true(NOT pg_temp.platform_tenant_access_allowed(pg_temp.fixture_id(1),false),'deactivated access denied'); SELECT pg_temp.check_true(pg_temp.platform_tenant_access_allowed(pg_temp.fixture_id(2),false),'shared identity in other company retained'); SELECT pg_temp.check_true((pg_temp.platform_business_access_state()->>'allowed')::boolean=false,'business login denied');")
check("SET ROLE authenticated; SELECT pg_temp.check_true((SELECT count(*)=1 FROM pg_temp.client_records),'existing tenant helper enforces RLS immediately'); RESET ROLE;")
check("SET ROLE authenticated; SELECT pg_temp.check_error($q$UPDATE pg_temp.platform_account_access_states SET state='active'$q$,'permission denied for table platform_account_access_states'); RESET ROLE;")
check("SELECT set_config('caresuite.access_check_actor',pg_temp.fixture_id(10)::text,true); SELECT pg_temp.account_action('reactivate'); SELECT set_config('caresuite.access_check_actor',pg_temp.fixture_id(20)::text,true); SELECT pg_temp.check_true((pg_temp.platform_business_access_state()->>'allowed')::boolean,'business login restored'); SELECT set_config('caresuite.access_check_actor',pg_temp.fixture_id(10)::text,true);")
check("SELECT pg_temp.check_error($q$SELECT pg_temp.account_action('delete','incorrect')$q$,'access_confirmation_required'); SELECT pg_temp.account_action('delete','Leitung A'); SELECT pg_temp.check_true(jsonb_array_length(pg_temp.platform_list_tenant_account_access(pg_temp.fixture_id(1))->'items')=1,'deleted hidden'); SELECT pg_temp.check_true(jsonb_array_length(pg_temp.platform_list_tenant_account_access(pg_temp.fixture_id(1),true)->'items')=2,'deleted explicit list'); SELECT pg_temp.account_action('restore');")
check("SELECT pg_temp.account_action('deactivate','DEAKTIVIEREN'); SELECT pg_temp.account_action('delete','Leitung A'); SELECT pg_temp.account_action('restore'); SELECT pg_temp.check_true((SELECT state='inactive' FROM pg_temp.platform_account_access_states WHERE tenant_user_id=pg_temp.fixture_id(20)),'restore preserves previous deactivation');")
check("SELECT pg_temp.check_error($q$SELECT pg_temp.platform_manage_account_access(pg_temp.fixture_id(1),pg_temp.fixture_id(21),'delete','active',now(),'Leitung B','Prüfung')$q$,'account_not_found');")
check("INSERT INTO pg_temp.platform_account_operations(id,tenant_id,auth_user_id,state) VALUES(pg_temp.fixture_id(40),pg_temp.fixture_id(1),pg_temp.fixture_id(20),'prepared'); SELECT pg_temp.check_error($q$SELECT pg_temp.company_action('deactivate','DEAKTIVIEREN')$q$,'account_update_needs_review'); SELECT pg_temp.check_error($q$SELECT pg_temp.account_action('reactivate')$q$,'account_update_needs_review'); DELETE FROM pg_temp.platform_account_operations;")
check("UPDATE pg_temp.registration_welcome_outbox SET state='sending',lease_until=now()+interval '1 hour'; SELECT pg_temp.check_error($q$SELECT pg_temp.company_action('delete','Firma A')$q$,'account_mail_in_progress'); UPDATE pg_temp.registration_welcome_outbox SET state='sent',lease_until=NULL;")
check("SELECT pg_temp.company_action('deactivate','DEAKTIVIEREN'); SELECT set_config('caresuite.access_check_actor',pg_temp.fixture_id(20)::text,true); SELECT pg_temp.check_true(NOT pg_temp.platform_tenant_access_allowed(pg_temp.fixture_id(1),false),'company deactivated'); SELECT set_config('caresuite.access_check_actor',pg_temp.fixture_id(10)::text,true); SELECT pg_temp.check_true((SELECT state='sent' FROM pg_temp.registration_welcome_outbox LIMIT 1),'sent mail retained');")
check("SELECT pg_temp.company_action('delete','Firma A'); SELECT pg_temp.check_error($q$SELECT pg_temp.account_action('restore')$q$,'tenant_deleted_restore_first'); SELECT pg_temp.company_action('restore'); SELECT pg_temp.check_true((SELECT status='terminated' FROM pg_temp.platform_tenants WHERE tenant_id=pg_temp.fixture_id(1)),'restored company remains deactivated');")
check("SELECT pg_temp.company_action('reactivate'); SELECT set_config('caresuite.access_check_actor',pg_temp.fixture_id(20)::text,true); SELECT pg_temp.check_true(NOT pg_temp.platform_tenant_access_allowed(pg_temp.fixture_id(1),false),'company activation preserves account deactivation'); SELECT set_config('caresuite.access_check_actor',pg_temp.fixture_id(10)::text,true); SELECT pg_temp.account_action('reactivate');")
check("SELECT pg_temp.platform_update_tenant_status(pg_temp.fixture_id(1),'suspended','Bestandszugriff geprüft'); SELECT pg_temp.platform_update_tenant_status(pg_temp.fixture_id(1),'active','Bestandszugriff geprüft'); SELECT pg_temp.check_error($q$SELECT pg_temp.platform_update_tenant_status(pg_temp.fixture_id(1),'deleted_soft','Bestandszugriff geprüft')$q$,'access_action_invalid');")
check("SELECT pg_temp.check_true(EXISTS(SELECT 1 FROM pg_temp.audit_records WHERE action='tenant.account.deleted' AND before_state IS NOT NULL AND after_state IS NOT NULL AND length(reason)>=5),'account audit'); SELECT pg_temp.check_true(EXISTS(SELECT 1 FROM pg_temp.audit_records WHERE action='tenant.deleted'),'company audit');")
output=head+'\n'+functions+'\n'+privileges+'\n'+core+'\n'+wrap+'\n'+helpers+'\n'+'\n'.join(tests)+f"\nROLLBACK;\nSELECT {len(tests)} AS passed_scenarios, 'temporary fixtures only; rolled back' AS scope;\n"
if len(sys.argv)>2:
    Path(sys.argv[2]).write_text(output)
else:
    sys.stdout.write(output)
print(f'{len(tests)} SQL scenarios; seven original function bodies; {len(output)} bytes', file=sys.stderr)
