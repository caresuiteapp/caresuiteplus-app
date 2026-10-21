-- STAGED FOUNDATION ONLY. Keeps personal family accounts disabled until verified activation.
-- Applies the identity columns and guarded RPC contract needed by academy_workspace.sql.
-- Does not install a Data API hook or modify public/storage/realtime RLS policies.
-- Activate later with academy_family_access.sql only after its effective-hook preflight.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';
DO $$
DECLARE v_exists boolean;
BEGIN
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.client_portal_access'::regclass
   AND attname='account_kind' AND NOT attisdropped) THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.client_portal_access WHERE account_kind=''academy_family'')' INTO v_exists;
  IF v_exists THEN RAISE EXCEPTION 'Die gestaffelte Grundlage darf bestehende Angehörigenzugänge nicht deaktivieren.' USING ERRCODE='55000'; END IF;
 END IF;
 IF to_regclass('academy_family_private.gateway_config') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM academy_family_private.gateway_config)' INTO v_exists;
  IF v_exists THEN RAISE EXCEPTION 'Eine bereits aktivierte Akademie-Anfragesperre darf nicht durch die gestaffelte Grundlage ersetzt werden.' USING ERRCODE='55000'; END IF;
 END IF;
 IF to_regprocedure('academy_family_private.request_guard()') IS NOT NULL
   OR nullif(current_setting('pgrst.db_pre_request',true),'')='academy_family_private.request_guard'
   OR EXISTS(SELECT 1 FROM pg_db_role_setting r CROSS JOIN LATERAL unnest(r.setconfig) s
     WHERE s='pgrst.db_pre_request=academy_family_private.request_guard') THEN
  RAISE EXCEPTION 'Eine vorhandene Akademie-Anfragesperre darf nicht durch die gestaffelte Grundlage ersetzt werden.' USING ERRCODE='55000';
 END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS academy_family_private;
REVOKE ALL ON SCHEMA academy_family_private FROM PUBLIC;
GRANT USAGE ON SCHEMA academy_family_private TO anon,authenticated,service_role;

ALTER TABLE public.client_portal_access ADD COLUMN IF NOT EXISTS account_kind text;
ALTER TABLE public.client_portal_access ADD COLUMN IF NOT EXISTS access_scope text;
ALTER TABLE public.client_portal_access ADD COLUMN IF NOT EXISTS access_generation bigint NOT NULL DEFAULT 1 CHECK(access_generation BETWEEN 1 AND 9007199254740991);
UPDATE public.client_portal_access SET account_kind=CASE WHEN contact_id IS NULL THEN 'self' ELSE 'legacy_contact' END
 WHERE account_kind IS NULL;
UPDATE public.client_portal_access SET access_scope='client' WHERE access_scope IS NULL;
ALTER TABLE public.client_portal_access ALTER COLUMN account_kind SET DEFAULT 'self';
ALTER TABLE public.client_portal_access ALTER COLUMN account_kind SET NOT NULL;
ALTER TABLE public.client_portal_access ALTER COLUMN access_scope SET DEFAULT 'client';
ALTER TABLE public.client_portal_access ALTER COLUMN access_scope SET NOT NULL;
ALTER TABLE public.client_portal_access DROP CONSTRAINT IF EXISTS academy_family_access_scope;
ALTER TABLE public.client_portal_access ADD CONSTRAINT academy_family_access_scope CHECK (
 (account_kind IN ('self','legacy_contact') AND access_scope='client')
 OR (account_kind='academy_family' AND access_scope='academy'));
CREATE UNIQUE INDEX IF NOT EXISTS academy_family_one_contact_account
 ON public.client_portal_access(tenant_id,client_id,contact_id) WHERE account_kind='academy_family' AND contact_id IS NOT NULL;
GRANT SELECT(account_kind,access_scope,access_generation) ON public.client_portal_access TO authenticated;
ALTER TYPE public.portal_type ADD VALUE IF NOT EXISTS 'academy_family';

CREATE TABLE IF NOT EXISTS academy_family_private.gateway_config (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), previous_hook regprocedure,
 installed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS academy_family_private.access_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, client_id uuid NOT NULL,
 account_id uuid NOT NULL, contact_id uuid, action text NOT NULL, actor_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ALL TABLES IN SCHEMA academy_family_private FROM PUBLIC,anon,authenticated;
ALTER TABLE academy_family_private.gateway_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_family_private.access_events ENABLE ROW LEVEL SECURITY;

-- A request marker cannot activate this staged foundation, even when forged by a
-- privileged caller. Only the separate, verified activation migration changes it.
CREATE OR REPLACE FUNCTION academy_family_private.gateway_ready() RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT false $$;
REVOKE ALL ON FUNCTION academy_family_private.gateway_ready() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION academy_family_private.safe_access(a public.client_portal_access) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT to_jsonb(a)-'portal_access_code_hash'-'auth_user_id'
$$;

CREATE OR REPLACE FUNCTION academy_family_private.account_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_service boolean:=coalesce(auth.jwt()->>'role','')='service_role'
 OR current_setting('role',true) IN ('service_role','postgres','supabase_admin')
 OR (coalesce(current_setting('role',true),'none')='none' AND session_user IN ('postgres','supabase_admin'));
BEGIN
 -- Staged rollout: even service-role writes cannot create or activate this identity.
 -- The verified full activation migration replaces this function explicitly.
 IF (TG_OP<>'DELETE' AND NEW.account_kind='academy_family')
   OR (TG_OP<>'INSERT' AND OLD.account_kind='academy_family') THEN
  RAISE EXCEPTION 'Persönliche Angehörigenzugänge sind noch nicht für die Anmeldung freigegeben.' USING ERRCODE='42501';
 END IF;
 IF TG_OP='DELETE' THEN
  IF OLD.account_kind='academy_family' THEN
   IF NOT v_service THEN RAISE EXCEPTION 'Persönliche Akademiezugänge werden deaktiviert und nicht direkt gelöscht.' USING ERRCODE='42501'; END IF;
   UPDATE public.portal_sessions SET status='revoked',revoked_at=now(),revoked_reason='Persönlicher Akademiezugang entfernt',updated_at=now()
    WHERE tenant_id=OLD.tenant_id AND portal_type::text='academy_family'
     AND coalesce(metadata->>'portal_account_id',metadata->>'portal_access_id')=OLD.id::text AND status::text='active';
  END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND (NEW.account_kind IS DISTINCT FROM OLD.account_kind OR NEW.access_scope IS DISTINCT FROM OLD.access_scope) THEN
  RAISE EXCEPTION 'Die persönliche Kontoart kann nicht geändert werden.' USING ERRCODE='42501';
 END IF;
 IF NEW.account_kind='self' AND NEW.contact_id IS NOT NULL THEN
  RAISE EXCEPTION 'Ein Selbstzugang darf nicht mit einem Angehörigenkontakt verbunden werden.' USING ERRCODE='42501';
 END IF;
 IF NEW.account_kind<>'academy_family' THEN RETURN NEW; END IF;
 -- Old login deployments must not mint this newly introduced account through
 -- their generic client branch. Bind only an Auth identity already minted with
 -- the exact immutable Academy scope, even while Edge rollout is in progress.
 IF NEW.auth_user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=NEW.auth_user_id
   AND u.raw_app_meta_data->>'portal_type'='academy_family' AND u.raw_app_meta_data->>'role_key'='family_portal'
   AND u.raw_app_meta_data->>'portal_account_id'=NEW.id::text AND u.raw_app_meta_data->>'tenant_id'=NEW.tenant_id::text
   AND u.raw_app_meta_data->>'access_scope'='academy') THEN
  RAISE EXCEPTION 'Die Auth-Identität besitzt nicht den exakten persönlichen Akademiebereich.' USING ERRCODE='42501';
 END IF;
 -- Each credential generation uses its own Auth user. An old refresh token
 -- must never become current by raising metadata on its existing Auth user,
 -- nor may an in-flight old mint rebind the account after rotation.
 IF NEW.auth_user_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id)
  AND NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=NEW.auth_user_id
   AND u.raw_app_meta_data->>'academy_access_generation'=NEW.access_generation::text
   AND u.raw_app_meta_data->>'relative_contact_id'=NEW.contact_id::text) THEN
  RAISE EXCEPTION 'Die Auth-Identität gehört nicht zur aktuellen Generation dieses persönlichen Kontakts.' USING ERRCODE='42501';
 END IF;
 IF TG_OP='UPDATE' AND NEW.access_generation IS DISTINCT FROM OLD.access_generation THEN
  RAISE EXCEPTION 'Die Zugangsgeneration wird ausschließlich bei einer Zugangsänderung fortgeschrieben.' USING ERRCODE='42501';
 END IF;
 IF TG_OP='UPDATE' AND (NEW.tenant_id<>OLD.tenant_id OR NEW.client_id<>OLD.client_id
   OR (NEW.contact_id IS DISTINCT FROM OLD.contact_id AND NEW.contact_id IS NOT NULL)) THEN
  RAISE EXCEPTION 'Die persönliche Kontaktbindung kann nicht geändert werden.' USING ERRCODE='42501';
 END IF;
 -- The existing FK clears contact_id on deletion. Preserve the immutable kind,
 -- disable the orphan and revoke its exact sessions instead of creating a self access.
 IF TG_OP='UPDATE' AND OLD.contact_id IS NOT NULL AND NEW.contact_id IS NULL THEN
  NEW.portal_enabled:=false; NEW.status:='deaktiviert';
 ELSIF NOT v_service AND current_setting('academy_family.managed_write',true) IS DISTINCT FROM 'v1' THEN
  RAISE EXCEPTION 'Angehörigenzugänge werden über die zentrale Zugangsverwaltung geändert.' USING ERRCODE='42501';
 END IF;
 IF NEW.portal_enabled AND (NEW.contact_id IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.client_contacts cc JOIN public.clients c ON c.id=cc.client_id AND c.tenant_id=cc.tenant_id
  WHERE cc.id=NEW.contact_id AND cc.client_id=NEW.client_id AND cc.tenant_id=NEW.tenant_id
   AND c.deleted_at IS NULL AND c.status::text IN ('active','aktiv'))) THEN
  RAISE EXCEPTION 'Der Angehörigenkontakt ist nicht mehr aktiv mit dieser Klientenakte verbunden.' USING ERRCODE='42501';
 END IF;
 IF TG_OP='UPDATE' AND ((OLD.portal_enabled AND NOT NEW.portal_enabled) OR (OLD.status='aktiv' AND NEW.status<>'aktiv')
   OR NEW.contact_id IS DISTINCT FROM OLD.contact_id OR NEW.portal_access_code_hash IS DISTINCT FROM OLD.portal_access_code_hash) THEN
  NEW.access_generation:=OLD.access_generation+1;
  UPDATE public.portal_sessions SET status='revoked',revoked_at=now(),revoked_reason='Persönlicher Akademiezugang geändert',updated_at=now()
   WHERE tenant_id=OLD.tenant_id AND portal_type::text='academy_family'
    AND coalesce(metadata->>'portal_account_id',metadata->>'portal_access_id')=OLD.id::text AND status::text='active';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION academy_family_private.account_guard(),academy_family_private.safe_access(public.client_portal_access) FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS academy_family_account_guard ON public.client_portal_access;
CREATE TRIGGER academy_family_account_guard BEFORE INSERT OR UPDATE OR DELETE ON public.client_portal_access FOR EACH ROW EXECUTE FUNCTION academy_family_private.account_guard();

CREATE OR REPLACE FUNCTION academy_family_private.manage(p_tenant uuid,p_client uuid,p_contact uuid,p_action text,p_account uuid,p_username text,p_code_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a public.client_portal_access%ROWTYPE; v_actor uuid; v_permission text; v_list jsonb; v_username text:=lower(btrim(p_username));
BEGIN
 v_permission:=CASE WHEN p_action='list' THEN 'office.clients.view_sensitive' ELSE 'office.clients.manage_consents' END;
 IF auth.uid() IS NULL OR NOT coalesce(care_security.company_permission(p_tenant,'office.access'),false)
   OR NOT coalesce(care_security.company_record_access(p_tenant,v_permission,p_client),false) THEN
  RAISE EXCEPTION 'Die Verwaltung dieser persönlichen Zugänge ist nicht freigegeben.' USING ERRCODE='42501'; END IF;
 v_actor:=care_security.company_profile(p_tenant);
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=p_client AND c.tenant_id=p_tenant AND c.deleted_at IS NULL) THEN
  RAISE EXCEPTION 'Klientenakte nicht verfügbar.' USING ERRCODE='42501'; END IF;
 IF p_action='list' THEN
  SELECT coalesce(jsonb_agg(academy_family_private.safe_access(x) ORDER BY x.created_at),'[]') INTO v_list
   FROM public.client_portal_access x WHERE x.tenant_id=p_tenant AND x.client_id=p_client AND x.account_kind='academy_family';
  RETURN jsonb_build_object('accesses',v_list,'ready',coalesce(academy_family_private.gateway_ready(),false));
 END IF;
 IF p_action NOT IN ('setup','rotate','enable','disable') OR p_action IS NULL THEN RAISE EXCEPTION 'Unbekannter Zugangsvorgang.' USING ERRCODE='22023'; END IF;
 IF p_action<>'disable' AND NOT coalesce(academy_family_private.gateway_ready(),false) THEN
  RAISE EXCEPTION 'Der geschützte Akademiezugang ist noch nicht für die Anmeldung freigegeben.' USING ERRCODE='55000'; END IF;
 IF p_contact IS NULL OR NOT EXISTS(SELECT 1 FROM public.client_contacts cc WHERE cc.id=p_contact AND cc.tenant_id=p_tenant AND cc.client_id=p_client) THEN
  RAISE EXCEPTION 'Der ausgewählte Kontakt gehört nicht zu dieser Klientenakte.' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||':'||p_client::text||':'||p_contact::text,0));
 IF p_action='setup' THEN
  SELECT * INTO a FROM public.client_portal_access x WHERE x.tenant_id=p_tenant AND x.client_id=p_client AND x.contact_id=p_contact AND x.account_kind='academy_family' FOR UPDATE;
  IF FOUND THEN RAISE EXCEPTION 'Für diese Person besteht bereits ein Akademiezugang. Bitte den vorhandenen Zugang verwalten.' USING ERRCODE='23505'; END IF;
 ELSE
  SELECT * INTO a FROM public.client_portal_access x WHERE x.id=p_account AND x.tenant_id=p_tenant AND x.client_id=p_client AND x.contact_id=p_contact AND x.account_kind='academy_family' AND x.access_scope='academy' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Persönlicher Akademiezugang nicht gefunden.' USING ERRCODE='42501'; END IF;
 END IF;
 IF p_action IN ('setup','rotate') AND (p_code_hash IS NULL OR p_code_hash !~ '^pbkdf2-sha256:[1-9][0-9]{5,6}:[a-f0-9]{32,128}:[a-f0-9]{64}$'
   OR split_part(p_code_hash,':',2)::integer NOT BETWEEN 100000 AND 1000000) THEN
  RAISE EXCEPTION 'Der Zugangscode wurde nicht mit dem freigegebenen Verfahren geschützt.' USING ERRCODE='22023'; END IF;
 PERFORM set_config('academy_family.managed_write','v1',true);
 IF p_action='setup' THEN
  IF v_username IS NULL OR v_username !~ '^[a-z0-9][a-z0-9._-]{2,99}$' THEN RAISE EXCEPTION 'Benutzername ungültig.' USING ERRCODE='22023'; END IF;
  INSERT INTO public.client_portal_access(tenant_id,client_id,contact_id,email,portal_username,portal_access_code_hash,portal_enabled,status,code_created_at,modules_enabled,two_factor_enabled,account_kind,access_scope)
   VALUES(p_tenant,p_client,p_contact,NULL,v_username,p_code_hash,true,'aktiv',now(),ARRAY['academy'],false,'academy_family','academy') RETURNING * INTO a;
 ELSIF p_action='rotate' THEN
  UPDATE public.client_portal_access SET portal_access_code_hash=p_code_hash,code_rotated_at=now(),updated_at=now() WHERE id=a.id RETURNING * INTO a;
 ELSIF p_action='disable' THEN
  UPDATE public.client_portal_access SET portal_enabled=false,status='deaktiviert',updated_at=now() WHERE id=a.id RETURNING * INTO a;
 ELSE
  IF a.portal_access_code_hash IS NULL OR a.portal_username IS NULL THEN RAISE EXCEPTION 'Zugangsdaten fehlen.' USING ERRCODE='55000'; END IF;
  UPDATE public.client_portal_access SET portal_enabled=true,status='aktiv',updated_at=now() WHERE id=a.id RETURNING * INTO a;
 END IF;
 PERFORM set_config('academy_family.managed_write','',true);
 INSERT INTO academy_family_private.access_events(tenant_id,client_id,account_id,contact_id,action,actor_id) VALUES(p_tenant,p_client,a.id,p_contact,p_action,v_actor);
 RETURN jsonb_build_object('access',academy_family_private.safe_access(a));
END $$;
CREATE OR REPLACE FUNCTION public.academy_family_access_manage(p_tenant uuid,p_client uuid,p_contact uuid,p_action text,p_account uuid DEFAULT NULL,p_username text DEFAULT NULL,p_code_hash text DEFAULT NULL) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT academy_family_private.manage(p_tenant,p_client,p_contact,p_action,p_account,p_username,p_code_hash) $$;
REVOKE ALL ON FUNCTION academy_family_private.manage(uuid,uuid,uuid,text,uuid,text,text),public.academy_family_access_manage(uuid,uuid,uuid,text,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION academy_family_private.manage(uuid,uuid,uuid,text,uuid,text,text),public.academy_family_access_manage(uuid,uuid,uuid,text,uuid,text,text) TO authenticated;

-- Service-only pre-login/refresh gate. No auth_user_id requirement before the
-- first mint; the Academy learner resolver verifies auth.uid() on every call.
CREATE OR REPLACE FUNCTION academy_family_private.auth_identity(p_account uuid,p_tenant uuid,p_contact uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_identity jsonb;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' OR NOT coalesce(academy_family_private.gateway_ready(),false)
   OR NOT coalesce(public.platform_tenant_access_allowed(p_tenant,false),false) THEN
  RAISE EXCEPTION 'Geschützte Akademieanmeldung nicht verfügbar.' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('accountId',a.id,'tenantId',a.tenant_id,'contactId',cc.id,'clientId',a.client_id,'accessGeneration',a.access_generation,
  'firstName',nullif(btrim(cc.first_name),''),'lastName',nullif(btrim(cc.last_name),''),
  'displayName',coalesce(nullif(btrim(concat_ws(' ',cc.first_name,cc.last_name)),''),a.portal_username),'username',a.portal_username)
 INTO v_identity FROM public.client_portal_access a JOIN public.client_contacts cc ON cc.id=a.contact_id AND cc.client_id=a.client_id AND cc.tenant_id=a.tenant_id
 JOIN public.clients c ON c.id=a.client_id AND c.tenant_id=a.tenant_id
 WHERE a.id=p_account AND a.tenant_id=p_tenant AND a.contact_id=p_contact AND a.account_kind='academy_family' AND a.access_scope='academy'
  AND a.portal_enabled AND a.status='aktiv' AND a.portal_username IS NOT NULL AND a.portal_access_code_hash IS NOT NULL
  AND c.deleted_at IS NULL AND c.status::text IN ('active','aktiv');
 IF v_identity IS NULL THEN RAISE EXCEPTION 'Persönlicher Akademiezugang nicht mehr aktiv.' USING ERRCODE='42501'; END IF;
 RETURN v_identity;
END $$;
CREATE OR REPLACE FUNCTION public.academy_family_auth_identity(p_account uuid,p_tenant uuid,p_contact uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT academy_family_private.auth_identity(p_account,p_tenant,p_contact) $$;
REVOKE ALL ON FUNCTION academy_family_private.auth_identity(uuid,uuid,uuid),public.academy_family_auth_identity(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION academy_family_private.auth_identity(uuid,uuid,uuid),public.academy_family_auth_identity(uuid,uuid,uuid) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
