-- Reviewed executable migration candidate. No production data repairs.
-- Apply together with the complete-client-intake Edge function and versioned Web caller.
BEGIN;
CREATE SCHEMA IF NOT EXISTS client_intake_private;
REVOKE ALL ON SCHEMA client_intake_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.client_intake_drafts (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 client_id uuid NOT NULL REFERENCES public.clients(id),
 actor_profile_id uuid NOT NULL REFERENCES public.profiles(id),
 actor_auth_user_id uuid NOT NULL,
 form_json jsonb NOT NULL CHECK (jsonb_typeof(form_json)='object'),
 revision bigint NOT NULL CHECK (revision>0),
 form_hash text NOT NULL CHECK (form_hash ~ '^sha256:[0-9a-f]{64}$'),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completed')),
 client_updated_at timestamptz NOT NULL,
 core_json jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 completed_receipt jsonb,
 PRIMARY KEY(tenant_id,client_id)
);
ALTER TABLE public.client_intake_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_intake_drafts FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS client_intake_private.client_intake_operations (
 tenant_id uuid NOT NULL, client_id uuid NOT NULL, operation_id uuid NOT NULL,
 actor_profile_id uuid NOT NULL REFERENCES public.profiles(id),
 expected_revision bigint NOT NULL, form_hash text NOT NULL, form_json jsonb NOT NULL, receipt jsonb NOT NULL,
 operation_kind text NOT NULL DEFAULT 'save' CHECK(operation_kind IN ('save','reconcile')),
 expected_client_updated_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,client_id,operation_id),
 FOREIGN KEY(tenant_id,client_id) REFERENCES public.client_intake_drafts(tenant_id,client_id)
);
CREATE TABLE IF NOT EXISTS client_intake_private.client_intake_completions (
 tenant_id uuid NOT NULL, client_id uuid NOT NULL,
 actor_profile_id uuid NOT NULL REFERENCES public.profiles(id), actor_auth_user_id uuid NOT NULL,
 revision bigint NOT NULL, form_hash text NOT NULL, form_json jsonb NOT NULL,
 documents_hash text NOT NULL, receipt jsonb NOT NULL,
 completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,client_id),
 FOREIGN KEY(tenant_id,client_id) REFERENCES public.client_intake_drafts(tenant_id,client_id)
);
CREATE TABLE IF NOT EXISTS client_intake_private.client_intake_originals (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, client_id uuid NOT NULL,
 template_key text NOT NULL, content_hash text NOT NULL, original_html text NOT NULL,
 signatures_json jsonb NOT NULL, template_snapshot jsonb NOT NULL,
 finalized_at timestamptz NOT NULL,
 UNIQUE(tenant_id,client_id,template_key),
 FOREIGN KEY(tenant_id,client_id) REFERENCES client_intake_private.client_intake_completions(tenant_id,client_id)
);
ALTER TABLE client_intake_private.client_intake_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_intake_private.client_intake_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_intake_private.client_intake_originals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON client_intake_private.client_intake_operations,client_intake_private.client_intake_completions,client_intake_private.client_intake_originals FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION client_intake_private.client_intake_actor(p_tenant uuid,p_auth uuid,p_expected_profile uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_profile uuid; v_count integer;
BEGIN
 IF p_tenant IS NULL OR p_auth IS NULL THEN RAISE EXCEPTION 'Anmeldung oder Mandant fehlt' USING ERRCODE='42501'; END IF;
 SELECT count(*),min(p.id::text)::uuid INTO v_count,v_profile FROM public.profiles p
 JOIN public.roles r ON r.id=p.role_id JOIN public.tenants t ON t.id=p.tenant_id
 WHERE p.tenant_id=p_tenant AND (p.auth_user_id=p_auth OR (p.auth_user_id IS NULL AND p.id=p_auth))
  AND p.is_active AND p.status::text='active' AND p.locked_at IS NULL
  AND t.status::text IN ('active','trial') AND (r.tenant_id IS NULL OR r.tenant_id=p_tenant)
  AND NOT EXISTS(SELECT 1 FROM public.platform_tenants pt WHERE pt.tenant_id=p_tenant AND pt.status<>'active')
  AND NOT EXISTS(SELECT 1 FROM public.platform_account_access_states s
   JOIN public.tenant_users u ON u.id=s.tenant_user_id AND u.tenant_id=s.tenant_id
   WHERE s.tenant_id=p_tenant AND u.auth_user_id=p_auth AND s.state IN ('inactive','deleted'))
  AND r.key NOT IN ('employee_portal','client_portal','family_portal','relative_portal')
  AND NOT EXISTS(SELECT 1 FROM public.tenant_users u WHERE u.auth_user_id=p_auth AND u.tenant_id=p_tenant
   AND (u.status<>'active' OR u.archived_at IS NOT NULL OR u.must_change_password OR NOT u.first_login_completed))
  AND (r.is_admin_role OR r.key IN ('owner','admin','management','geschaeftsfuehrung','business_admin') OR NOT EXISTS(
   SELECT 1 FROM unnest(ARRAY['office.clients.create','office.clients.view','office.clients.view_sensitive']) required(permission)
   WHERE NOT EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.tenant_id IS NOT DISTINCT FROM r.tenant_id
    AND (rp.permission_key=required.permission OR (rp.permission_key='clients' AND
     ((required.permission='office.clients.create' AND rp.can_create) OR (required.permission='office.clients.view' AND rp.can_view)))))));
 IF v_count<>1 OR (p_expected_profile IS NOT NULL AND v_profile IS DISTINCT FROM p_expected_profile) THEN
  RAISE EXCEPTION 'Das aktive Office-Profil ist nicht zur Neuaufnahme berechtigt' USING ERRCODE='42501';
 END IF;
 RETURN v_profile;
END $$;
REVOKE ALL ON FUNCTION client_intake_private.client_intake_actor(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION client_intake_private.client_intake_string_array(p_form jsonb,p_key text)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT coalesce(array_agg(value ORDER BY ordinal),'{}'::text[])
 FROM jsonb_array_elements_text(coalesce(p_form->p_key,'[]'::jsonb)) WITH ORDINALITY a(value,ordinal)
$$;
REVOKE ALL ON FUNCTION client_intake_private.client_intake_string_array(jsonb,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION client_intake_private.client_intake_draft_date(p_value text)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE v_date date;
BEGIN
 IF p_value IS NULL OR p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN NULL; END IF;
 v_date:=p_value::date;
 RETURN CASE WHEN to_char(v_date,'YYYY-MM-DD')=p_value THEN v_date ELSE NULL END;
EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION client_intake_private.client_intake_draft_date(text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION client_intake_private.client_intake_primary_carrier(p_form jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT nullif(btrim(p_form->>CASE value WHEN 'pflegekasse' THEN 'careFundName' WHEN 'krankenkasse' THEN 'healthInsurance'
  ELSE value||'Name' END),'') FROM jsonb_array_elements_text(coalesce(p_form->'costBearerTypes','[]')) WITH ORDINALITY x(value,ordinal)
 ORDER BY ordinal LIMIT 1
$$;
REVOKE ALL ON FUNCTION client_intake_private.client_intake_primary_carrier(jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION client_intake_private.client_intake_write_core(p_tenant uuid,p_client uuid,p_actor uuid,p_form jsonb)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_updated timestamptz; v_level public.care_level;
BEGIN
 v_level:=CASE WHEN p_form->>'careLevel' IN ('none','pg1','pg2','pg3','pg4','pg5','unknown') THEN p_form->>'careLevel'
  WHEN p_form->>'careLevel'='kein' THEN 'none' WHEN p_form->>'careLevel'='unbekannt' THEN 'unknown' ELSE NULL END::public.care_level;
 INSERT INTO public.clients(id,tenant_id,first_name,last_name,status,created_by,updated_by)
 VALUES(p_client,p_tenant,coalesce(nullif(btrim(p_form->>'firstName'),''),'Entwurf'),
  coalesce(nullif(btrim(p_form->>'lastName'),''),'—'),'lead',p_actor,p_actor)
 ON CONFLICT(id) DO NOTHING;
 UPDATE public.clients SET first_name=coalesce(nullif(btrim(p_form->>'firstName'),''),'Entwurf'),
  last_name=coalesce(nullif(btrim(p_form->>'lastName'),''),'—'),date_of_birth=client_intake_private.client_intake_draft_date(p_form->>'dateOfBirth'),
  gender=nullif(p_form->>'gender',''),salutation=nullif(p_form->>'salutation',''),
  street=nullif(btrim(p_form->>'street'),''),house_number=nullif(btrim(p_form->>'houseNumber'),''),
  postal_code=nullif(btrim(p_form->>'zip'),''),city=nullif(btrim(p_form->>'city'),''),
  phone=nullif(btrim(p_form->>'phone'),''),mobile=nullif(btrim(p_form->>'mobile'),''),email=nullif(btrim(p_form->>'email'),''),
  care_level=v_level,insurance_number=nullif(btrim(p_form->>'insuranceNumber'),''),
  insurance_name=client_intake_private.client_intake_primary_carrier(p_form),cost_bearer=client_intake_private.client_intake_primary_carrier(p_form),
  admission_date=client_intake_private.client_intake_draft_date(p_form->>'admissionDate'),service_start=client_intake_private.client_intake_draft_date(p_form->>'serviceStart'),
  housing_form=nullif(p_form->>'housingForm',''),preferred_contact=nullif(p_form->>'preferredContact',''),
  special_notes=nullif(p_form->>'specialNotes',''),internal_notes=nullif(p_form->>'specialNotes',''),
  floor=nullif(p_form->>'floor',''),doorbell_name=nullif(p_form->>'bellName',''),access_notes=nullif(p_form->>'accessNotes',''),
  updated_by=p_actor,updated_at=clock_timestamp()
 WHERE id=p_client AND tenant_id=p_tenant AND status='lead' AND deleted_at IS NULL RETURNING updated_at INTO v_updated;
 IF NOT FOUND THEN RAISE EXCEPTION 'Diese Aufnahme ist kein bearbeitbarer Entwurf mehr' USING ERRCODE='40001'; END IF;
 RETURN v_updated;
END $$;
REVOKE ALL ON FUNCTION client_intake_private.client_intake_write_core(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.client_intake_save_draft(p_tenant uuid,p_client uuid,p_form jsonb,p_expected_revision bigint,p_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_actor uuid; v_hash text; v_draft public.client_intake_drafts%ROWTYPE;
 v_op client_intake_private.client_intake_operations%ROWTYPE; v_revision bigint; v_receipt jsonb; v_updated timestamptz; v_client_updated timestamptz;
BEGIN
 IF p_tenant IS DISTINCT FROM public.current_tenant_id() OR NOT coalesce(public.is_internal_tenant_actor(p_tenant),false)
  OR NOT coalesce(public.has_permission('office.clients.create'),false) OR NOT coalesce(public.has_permission('office.clients.view'),false)
  OR NOT coalesce(public.has_permission('office.clients.view_sensitive'),false) THEN RAISE EXCEPTION 'Keine Berechtigung für diesen Aufnahmeentwurf' USING ERRCODE='42501'; END IF;
 v_actor:=client_intake_private.client_intake_actor(p_tenant,auth.uid());
 IF p_client IS NULL OR p_operation_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0
  OR jsonb_typeof(p_form) IS DISTINCT FROM 'object' OR octet_length(p_form::text)>24000000 THEN
  RAISE EXCEPTION 'Der Aufnahmeentwurf ist ungültig oder zu groß' USING ERRCODE='22023'; END IF;
 v_hash:='sha256:'||encode(sha256(convert_to(p_form::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended('client-intake:'||p_tenant::text||':'||p_client::text,0));
 SELECT * INTO v_op FROM client_intake_private.client_intake_operations WHERE tenant_id=p_tenant AND client_id=p_client AND operation_id=p_operation_id;
 IF FOUND THEN
  IF v_op.operation_kind<>'save' OR v_op.actor_profile_id<>v_actor OR v_op.form_hash<>v_hash OR v_op.expected_revision<>p_expected_revision THEN
   RAISE EXCEPTION 'Dieser Speichervorgang gehört zu einer anderen Fassung' USING ERRCODE='40001'; END IF;
  RETURN v_op.receipt||jsonb_build_object('replayed',true);
 END IF;
 SELECT * INTO v_draft FROM public.client_intake_drafts WHERE tenant_id=p_tenant AND client_id=p_client FOR UPDATE;
 IF FOUND AND (v_draft.status<>'draft' OR v_draft.revision<>p_expected_revision) OR NOT FOUND AND p_expected_revision<>0 THEN
  RAISE EXCEPTION 'Der Entwurf wurde zwischenzeitlich geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
 IF EXISTS(SELECT 1 FROM public.clients WHERE id=p_client AND (tenant_id<>p_tenant OR status<>'lead' OR deleted_at IS NOT NULL)) THEN
  RAISE EXCEPTION 'Diese Klientenakte gehört nicht zu dieser offenen Aufnahme' USING ERRCODE='42501'; END IF;
 SELECT updated_at INTO v_client_updated FROM public.clients WHERE id=p_client AND tenant_id=p_tenant FOR UPDATE;
 IF v_draft.revision IS NOT NULL AND v_client_updated IS DISTINCT FROM v_draft.client_updated_at THEN
  RAISE EXCEPTION 'Die Stammdaten wurden außerhalb dieses Entwurfs geändert. Bitte die aktuellen Aktenangaben prüfen; der Entwurf bleibt erhalten.' USING ERRCODE='40001'; END IF;
 IF EXISTS(SELECT 1 FROM public.client_intake_documents WHERE tenant_id=p_tenant AND client_id=p_client
   AND (status='finalized' OR finalized_html IS NOT NULL OR finalized_at IS NOT NULL))
  OR EXISTS(SELECT 1 FROM public.client_document_signatures WHERE tenant_id=p_tenant AND client_id=p_client) THEN
  RAISE EXCEPTION 'Vorhandene gespeicherte Originale dürfen nicht durch einen neuen Entwurf ersetzt werden' USING ERRCODE='40001'; END IF;
 v_updated:=client_intake_private.client_intake_write_core(p_tenant,p_client,v_actor,p_form);
 v_revision:=p_expected_revision+1;
 v_receipt:=jsonb_build_object('contract','client-intake-draft-v1','tenantId',p_tenant,'clientId',p_client,
  'revision',v_revision,'formHash',v_hash,'operationId',p_operation_id,'status','draft','replayed',false);
 INSERT INTO public.client_intake_drafts(tenant_id,client_id,actor_profile_id,actor_auth_user_id,form_json,revision,form_hash,client_updated_at,core_json)
 VALUES(p_tenant,p_client,v_actor,auth.uid(),p_form,v_revision,v_hash,v_updated,(SELECT to_jsonb(c) FROM public.clients c WHERE c.id=p_client AND c.tenant_id=p_tenant))
 ON CONFLICT(tenant_id,client_id) DO UPDATE SET actor_profile_id=excluded.actor_profile_id,actor_auth_user_id=excluded.actor_auth_user_id,
  form_json=excluded.form_json,revision=excluded.revision,form_hash=excluded.form_hash,client_updated_at=excluded.client_updated_at,core_json=excluded.core_json,updated_at=clock_timestamp();
 INSERT INTO client_intake_private.client_intake_operations(tenant_id,client_id,operation_id,actor_profile_id,expected_revision,form_hash,form_json,receipt)
 VALUES(p_tenant,p_client,p_operation_id,v_actor,p_expected_revision,v_hash,p_form,v_receipt);
 RETURN v_receipt;
END $$;
REVOKE ALL ON FUNCTION public.client_intake_save_draft(uuid,uuid,jsonb,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.client_intake_save_draft(uuid,uuid,jsonb,bigint,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.client_intake_load_draft(p_tenant uuid,p_client uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_draft public.client_intake_drafts%ROWTYPE; v_client_updated timestamptz;
BEGIN
 IF p_tenant IS DISTINCT FROM public.current_tenant_id() OR NOT coalesce(public.is_internal_tenant_actor(p_tenant),false)
  OR NOT coalesce(public.has_permission('office.clients.create'),false) OR NOT coalesce(public.has_permission('office.clients.view'),false)
  OR NOT coalesce(public.has_permission('office.clients.view_sensitive'),false) THEN RAISE EXCEPTION 'Keine Berechtigung für diesen Aufnahmeentwurf' USING ERRCODE='42501'; END IF;
 PERFORM client_intake_private.client_intake_actor(p_tenant,auth.uid());
 SELECT * INTO v_draft FROM public.client_intake_drafts WHERE tenant_id=p_tenant AND client_id=p_client;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT updated_at INTO v_client_updated FROM public.clients WHERE id=p_client AND tenant_id=p_tenant;
 RETURN jsonb_build_object('contract','client-intake-draft-v1','tenantId',p_tenant,'clientId',p_client,'revision',v_draft.revision,
  'formHash',v_draft.form_hash,'form',v_draft.form_json,'status',v_draft.status,'updatedAt',v_draft.updated_at,
  'actorProfileId',v_draft.actor_profile_id,'completedReceipt',v_draft.completed_receipt,
  'coreChanged',v_draft.status='draft' AND v_client_updated IS DISTINCT FROM v_draft.client_updated_at,'currentClientUpdatedAt',v_client_updated);
END $$;
REVOKE ALL ON FUNCTION public.client_intake_load_draft(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.client_intake_load_draft(uuid,uuid) TO authenticated;

-- Explicit user-directed reconciliation. A read never changes the draft. The old
-- complete form remains in operations; only changed authoritative core fields merge.
CREATE OR REPLACE FUNCTION public.client_intake_reconcile_draft(p_tenant uuid,p_client uuid,p_expected_revision bigint,p_expected_client_updated_at timestamptz,p_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d public.client_intake_drafts%ROWTYPE; c public.clients%ROWTYPE;
 op client_intake_private.client_intake_operations%ROWTYPE; actor uuid; f jsonb; core jsonb;
 mapping jsonb:='{"first_name":"firstName","last_name":"lastName","date_of_birth":"dateOfBirth","gender":"gender","salutation":"salutation","street":"street","house_number":"houseNumber","postal_code":"zip","city":"city","phone":"phone","mobile":"mobile","email":"email","care_level":"careLevel","insurance_number":"insuranceNumber","admission_date":"admissionDate","service_start":"serviceStart","housing_form":"housingForm","preferred_contact":"preferredContact","floor":"floor","doorbell_name":"bellName","access_notes":"accessNotes"}';
 column_key text; form_key text; carrier_key text; new_hash text; receipt jsonb;
BEGIN
 IF p_tenant IS DISTINCT FROM public.current_tenant_id() OR NOT coalesce(public.is_internal_tenant_actor(p_tenant),false)
  OR NOT coalesce(public.has_permission('office.clients.create'),false) OR NOT coalesce(public.has_permission('office.clients.view'),false)
  OR NOT coalesce(public.has_permission('office.clients.view_sensitive'),false) THEN RAISE EXCEPTION 'Keine Berechtigung für diesen Aufnahmeentwurf' USING ERRCODE='42501'; END IF;
 actor:=client_intake_private.client_intake_actor(p_tenant,auth.uid());
 IF p_client IS NULL OR p_operation_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<1 OR p_expected_client_updated_at IS NULL THEN
  RAISE EXCEPTION 'Die zu übernehmende Fassung ist unvollständig' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('client-intake:'||p_tenant::text||':'||p_client::text,0));
 SELECT * INTO op FROM client_intake_private.client_intake_operations WHERE tenant_id=p_tenant AND client_id=p_client AND operation_id=p_operation_id;
 IF FOUND THEN
  IF op.operation_kind<>'reconcile' OR op.actor_profile_id<>actor OR op.expected_revision<>p_expected_revision
   OR op.expected_client_updated_at IS DISTINCT FROM p_expected_client_updated_at THEN
   RAISE EXCEPTION 'Dieser Übernahmevorgang gehört zu einer anderen Fassung' USING ERRCODE='40001'; END IF;
  RETURN op.receipt||jsonb_build_object('replayed',true);
 END IF;
 SELECT * INTO d FROM public.client_intake_drafts WHERE tenant_id=p_tenant AND client_id=p_client FOR UPDATE;
 IF NOT FOUND OR d.status<>'draft' OR d.revision<>p_expected_revision THEN RAISE EXCEPTION 'Der Entwurf wurde zwischenzeitlich geändert' USING ERRCODE='40001'; END IF;
 SELECT * INTO c FROM public.clients WHERE tenant_id=p_tenant AND id=p_client FOR UPDATE;
 IF NOT FOUND OR c.status<>'lead' OR c.deleted_at IS NOT NULL OR c.updated_at IS DISTINCT FROM p_expected_client_updated_at
  OR c.updated_at IS NOT DISTINCT FROM d.client_updated_at THEN
  RAISE EXCEPTION 'Die Aktenangaben wurden zwischenzeitlich geändert. Bitte erneut laden.' USING ERRCODE='40001'; END IF;
 f:=d.form_json; core:=to_jsonb(c);
 FOR column_key,form_key IN SELECT key,value FROM jsonb_each_text(mapping) LOOP
  IF core->column_key IS DISTINCT FROM d.core_json->column_key THEN
   f:=jsonb_set(f,ARRAY[form_key],to_jsonb(CASE WHEN column_key='care_level' THEN
    CASE core->>column_key WHEN 'none' THEN 'kein' WHEN 'unknown' THEN 'unbekannt' ELSE coalesce(core->>column_key,'') END
    ELSE coalesce(core->>column_key,'') END),true);
  END IF;
 END LOOP;
 IF core->'special_notes' IS DISTINCT FROM d.core_json->'special_notes' THEN
  f:=jsonb_set(f,'{specialNotes}',to_jsonb(coalesce(c.special_notes,'')),true);
 ELSIF core->'internal_notes' IS DISTINCT FROM d.core_json->'internal_notes' THEN
  f:=jsonb_set(f,'{specialNotes}',to_jsonb(coalesce(c.internal_notes,'')),true);
 END IF;
 SELECT CASE value WHEN 'pflegekasse' THEN 'careFundName' WHEN 'krankenkasse' THEN 'healthInsurance' ELSE value||'Name' END INTO carrier_key
 FROM jsonb_array_elements_text(coalesce(f->'costBearerTypes','[]')) WITH ORDINALITY x(value,n) ORDER BY n LIMIT 1;
 IF carrier_key IS NOT NULL THEN
  IF core->'cost_bearer' IS DISTINCT FROM d.core_json->'cost_bearer' THEN
   f:=jsonb_set(f,ARRAY[carrier_key],to_jsonb(coalesce(c.cost_bearer,'')),true);
  ELSIF core->'insurance_name' IS DISTINCT FROM d.core_json->'insurance_name' THEN
   f:=jsonb_set(f,ARRAY[carrier_key],to_jsonb(coalesce(c.insurance_name,'')),true);
  END IF;
 END IF;
 new_hash:='sha256:'||encode(sha256(convert_to(f::text,'UTF8')),'hex');
 receipt:=jsonb_build_object('contract','client-intake-draft-v1','tenantId',p_tenant,'clientId',p_client,'revision',d.revision+1,
  'formHash',new_hash,'operationId',p_operation_id,'status','draft','replayed',false);
 UPDATE public.client_intake_drafts SET form_json=f,form_hash=new_hash,revision=d.revision+1,core_json=core,client_updated_at=c.updated_at,
  actor_profile_id=actor,actor_auth_user_id=auth.uid(),updated_at=clock_timestamp() WHERE tenant_id=p_tenant AND client_id=p_client;
 INSERT INTO client_intake_private.client_intake_operations(tenant_id,client_id,operation_id,actor_profile_id,expected_revision,form_hash,form_json,receipt,operation_kind,expected_client_updated_at)
 VALUES(p_tenant,p_client,p_operation_id,actor,d.revision,new_hash,f,receipt,'reconcile',p_expected_client_updated_at);
 RETURN receipt;
END $$;
REVOKE ALL ON FUNCTION public.client_intake_reconcile_draft(uuid,uuid,bigint,timestamptz,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.client_intake_reconcile_draft(uuid,uuid,bigint,timestamptz,uuid) TO authenticated;

-- Internal scoped projection writer. Only fixed intake tables/columns below are callers.
CREATE OR REPLACE FUNCTION client_intake_private.client_intake_project_one(p_table text,p_tenant uuid,p_client uuid,p_values jsonb,p_filter jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_ids uuid[]; v_columns text; v_assignments text; v_values jsonb;
BEGIN
 IF p_table NOT IN ('client_support_preferences','client_addresses','client_billing_profiles','client_insurance_profiles',
  'client_contacts','client_ambulatory_details','client_stationary_details') THEN RAISE EXCEPTION 'Unbekannte Aufnahmeprojektion'; END IF;
 EXECUTE format('SELECT array_agg(id) FROM (SELECT id FROM public.%I row WHERE tenant_id=$1 AND client_id=$2 AND to_jsonb(row) @> $3 FOR UPDATE) locked',p_table)
 INTO v_ids USING p_tenant,p_client,p_filter;
 IF cardinality(v_ids)>1 THEN RAISE EXCEPTION 'Die Aufnahme enthält mehrdeutige bestehende Angaben in %',p_table USING ERRCODE='40001'; END IF;
 v_values:=p_values||jsonb_build_object('tenant_id',p_tenant,'client_id',p_client);
 SELECT string_agg(format('%I',key),',' ORDER BY key),string_agg(format('%1$I=src.%1$I',key),',' ORDER BY key)
 INTO v_columns,v_assignments FROM jsonb_object_keys(v_values) key;
 IF cardinality(v_ids)=1 THEN
  EXECUTE format('UPDATE public.%1$I SET %2$s FROM jsonb_populate_record(NULL::public.%1$I,$1) src WHERE %1$I.id=$2 AND %1$I.tenant_id=$3',p_table,v_assignments)
  USING v_values,v_ids[1],p_tenant;
 ELSE
  EXECUTE format('INSERT INTO public.%1$I(%2$s) SELECT %2$s FROM jsonb_populate_record(NULL::public.%1$I,$1)',p_table,v_columns) USING v_values;
 END IF;
END $$;
REVOKE ALL ON FUNCTION client_intake_private.client_intake_project_one(text,uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION client_intake_private.client_intake_entitlement_grade(value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT CASE normalized WHEN 'none' THEN 'kein' WHEN 'unknown' THEN 'kein' WHEN 'unbekannt' THEN 'kein'
  ELSE CASE WHEN normalized IN ('kein','pg1','pg2','pg3','pg4','pg5','hospiz') THEN normalized END END
 FROM (SELECT regexp_replace(lower(btrim(value)),'\s+','','g') normalized) x
$$;
REVOKE ALL ON FUNCTION client_intake_private.client_intake_entitlement_grade(text) FROM PUBLIC,anon,authenticated;

-- Mirrors the existing budget/default and legacy-entitlement helpers. Amounts
-- come only from the tenant defaults and active catalog; existing usage and
-- individual overrides are never rewritten by intake.
CREATE OR REPLACE FUNCTION client_intake_private.client_intake_project_budgets(p_tenant uuid,p_client uuid,p_actor uuid,f jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.clients%ROWTYPE; level_row public.client_care_levels%ROWTYPE; insurance public.client_insurance_profiles%ROWTYPE;
 current_e public.client_care_entitlement%ROWTYPE; template public.budget_template_catalog%ROWTYPE;
 grade text; valid_from_date date; valid_until_date date; fund_name text; member_id text; md_date date; notes_text text; source_key text;
 entitlement_id uuid; account_id uuid; first_day date; last_day date; snapshot jsonb;
 today date:=(clock_timestamp() AT TIME ZONE 'UTC')::date;
 funding text[]:=client_intake_private.client_intake_string_array(f,'fundingSources');
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.client_budget_settings WHERE tenant_id=p_tenant AND client_id=p_client) THEN
  INSERT INTO public.client_budget_settings(tenant_id,client_id,budget_year_id,budget_type_id,allocated_cents,conversion_rate_pct,monthly_limit_cents,yearly_limit_cents,notes)
  SELECT p_tenant,p_client,d.budget_year_id,d.budget_type_id,coalesce(d.yearly_amount_cents,d.amount_cents),d.conversion_rate_pct,
   d.monthly_amount_cents,d.yearly_amount_cents,d.notes
  FROM public.tenant_budget_defaults d JOIN public.tenant_budget_years y ON y.id=d.budget_year_id AND y.tenant_id=p_tenant
  JOIN public.tenant_budget_types bt ON bt.id=d.budget_type_id AND bt.tenant_id=p_tenant
  WHERE d.tenant_id=p_tenant AND y.budget_year=extract(year FROM coalesce(nullif(f->>'serviceStart','')::date,today))
  ON CONFLICT(tenant_id,client_id,budget_year_id,budget_type_id) DO NOTHING;
 END IF;
 SELECT * INTO c FROM public.clients WHERE tenant_id=p_tenant AND id=p_client;
 SELECT * INTO level_row FROM public.client_care_levels WHERE tenant_id=p_tenant AND client_id=p_client ORDER BY valid_from DESC LIMIT 1 FOR SHARE;
 grade:=client_intake_private.client_intake_entitlement_grade(level_row.grade);
 IF grade IS NOT NULL THEN
  valid_from_date:=level_row.valid_from; valid_until_date:=level_row.valid_until; fund_name:=level_row.care_fund_name;
  member_id:=level_row.care_fund_member_id; md_date:=level_row.md_assessment_date; notes_text:=level_row.notes; source_key:='client_care_levels';
 ELSE
  grade:=client_intake_private.client_intake_entitlement_grade(c.care_level::text);
  IF grade IS NOT NULL THEN
   valid_from_date:=today; fund_name:=c.insurance_name; member_id:=c.insurance_number; source_key:='clients.care_level';
  ELSE
   SELECT * INTO insurance FROM public.client_insurance_profiles WHERE tenant_id=p_tenant AND client_id=p_client AND is_primary LIMIT 1 FOR SHARE;
   grade:=client_intake_private.client_intake_entitlement_grade(insurance.care_level);
   IF grade IS NOT NULL THEN
    valid_from_date:=insurance.care_level_valid_from; fund_name:=insurance.care_fund_name; member_id:=insurance.insurance_number; source_key:='client_insurance_profiles';
   END IF;
  END IF;
 END IF;
 IF grade IS NOT NULL THEN
  IF valid_from_date IS NULL OR valid_from_date<DATE '1995-01-01' OR valid_from_date>today OR valid_from_date=c.date_of_birth THEN valid_from_date:=today; END IF;
  SELECT * INTO current_e FROM public.client_care_entitlement WHERE tenant_id=p_tenant AND client_id=p_client AND valid_until IS NULL ORDER BY valid_from DESC LIMIT 1 FOR UPDATE;
  IF current_e.id IS NULL OR ROW(current_e.care_grade,current_e.valid_from,current_e.care_fund_name,current_e.care_fund_member_id)
   IS DISTINCT FROM ROW(grade,valid_from_date,fund_name,member_id) THEN
   IF current_e.id IS NOT NULL THEN UPDATE public.client_care_entitlement SET valid_until=valid_from_date-1 WHERE id=current_e.id AND tenant_id=p_tenant; END IF;
   INSERT INTO public.client_care_entitlement(tenant_id,client_id,care_grade,valid_from,valid_until,conversion_enabled,care_fund_name,care_fund_member_id,md_assessment_date,notes,source,metadata)
   VALUES(p_tenant,p_client,grade,valid_from_date,valid_until_date,grade IN ('pg2','pg3','pg4','pg5'),fund_name,member_id,md_date,notes_text,source_key,jsonb_build_object('synced_at',clock_timestamp())) RETURNING id INTO entitlement_id;
   INSERT INTO public.client_billing_audit_log(tenant_id,client_id,action,entity_type,entity_id,payload,actor_id)
   VALUES(p_tenant,p_client,'sync_from_legacy','client_care_entitlement',entitlement_id,jsonb_build_object('previousGrade',current_e.care_grade,'nextGrade',grade,'source',source_key),p_actor);
  END IF;
  -- The legacy sync uses the current year/current month, not serviceStart, and
  -- then applies the selected funding sources to the generated accounts.
  FOR template IN SELECT * FROM public.budget_template_catalog t WHERE t.is_active AND t.budget_year=extract(year FROM today)
   AND t.auto_generate AND t.default_amount_cents IS NOT NULL
   AND (t.catalog_key NOT LIKE 'umwandlung\_%' ESCAPE '\' OR grade IN ('pg2','pg3','pg4','pg5'))
   AND ((grade IN ('kein','hospiz') AND t.catalog_key IN ('selbstzahler','kulanz','ungeklaert')) OR
    (grade IN ('pg1','pg2','pg3','pg4','pg5') AND (t.care_grade_min='kein' OR t.care_grade_max='kein'
     OR grade BETWEEN coalesce(t.care_grade_min,'pg1') AND coalesce(t.care_grade_max,'pg5'))))
   ORDER BY t.billing_priority,t.catalog_key FOR SHARE LOOP
   first_day:=CASE WHEN template.period='monthly' THEN date_trunc('month',today)::date ELSE date_trunc('year',today)::date END;
   last_day:=CASE WHEN template.catalog_key='paragraph_45b' THEN make_date(extract(year FROM today)::integer+1,6,30)
    WHEN template.period='monthly' THEN (first_day+interval '1 month - 1 day')::date ELSE make_date(extract(year FROM today)::integer,12,31) END;
   -- Preserve suspended overrides too. Creating a new active account here could
   -- bypass a manual lock or collide when a funding-only lock is later lifted.
   IF EXISTS(SELECT 1 FROM public.client_budget_accounts WHERE tenant_id=p_tenant AND client_id=p_client AND catalog_key=template.catalog_key
    AND period_start=first_day AND period_end=last_day AND status IN ('active','suspended')) THEN CONTINUE; END IF;
   snapshot:=jsonb_build_object('catalogKey',template.catalog_key,'budgetYear',template.budget_year,'defaultAmountCents',template.default_amount_cents,'label',template.label,'frozenAt',clock_timestamp());
   INSERT INTO public.client_budget_accounts(tenant_id,client_id,catalog_template_id,catalog_key,catalog_year,period,period_start,period_end,
    allocated_cents,used_cents,reserved_cents,is_individual_override,standard_amount_cents,is_enabled,locked,catalog_snapshot,billing_priority,status)
   VALUES(p_tenant,p_client,template.id,template.catalog_key,template.budget_year,template.period,first_day,last_day,
    template.default_amount_cents,0,0,false,template.default_amount_cents,true,false,snapshot,template.billing_priority,'active') RETURNING id INTO account_id;
   INSERT INTO public.client_budget_transactions(tenant_id,client_id,budget_account_id,transaction_type,amount_cents,balance_after_cents,note,created_by)
   VALUES(p_tenant,p_client,account_id,'allocation',template.default_amount_cents,template.default_amount_cents,'Automatische Konteneröffnung '||template.label,p_actor);
   INSERT INTO public.client_billing_audit_log(tenant_id,client_id,action,entity_type,entity_id,payload,actor_id)
   VALUES(p_tenant,p_client,'auto_generate_account','client_budget_accounts',account_id,snapshot,p_actor);
  END LOOP;
 END IF;
 -- Same enable/lock transitions as set_client_funding_sources (0272). A manual
 -- lock is never cleared merely because the funding source is selected.
 UPDATE public.client_care_entitlement SET conversion_enabled='umwandlung'=ANY(funding)
  WHERE tenant_id=p_tenant AND client_id=p_client AND valid_until IS NULL;
 UPDATE public.client_budget_accounts SET is_enabled=false,status='suspended',locked=true,
  lock_reason=CASE WHEN locked AND lock_reason IS DISTINCT FROM 'Finanzierungsart nicht ausgewählt' THEN lock_reason ELSE 'Finanzierungsart nicht ausgewählt' END
  WHERE tenant_id=p_tenant AND client_id=p_client AND ((catalog_key='paragraph_45b' AND NOT 'entlastungsleistung'=ANY(funding))
   OR (catalog_key LIKE 'umwandlung_%' AND NOT 'umwandlung'=ANY(funding))
   OR (catalog_key IN ('verhinderungspflege','gemeinsames_jahresbudget') AND NOT 'verhinderungspflege'=ANY(funding))
   OR (catalog_key='selbstzahler' AND NOT 'selbstzahler'=ANY(funding)));
 UPDATE public.client_budget_accounts SET is_enabled=true,status='active',locked=false,lock_reason=NULL
  WHERE tenant_id=p_tenant AND client_id=p_client AND lock_reason='Finanzierungsart nicht ausgewählt'
   AND ((catalog_key='paragraph_45b' AND 'entlastungsleistung'=ANY(funding)) OR (catalog_key LIKE 'umwandlung_%' AND 'umwandlung'=ANY(funding))
    OR (catalog_key IN ('verhinderungspflege','gemeinsames_jahresbudget') AND 'verhinderungspflege'=ANY(funding)) OR (catalog_key='selbstzahler' AND 'selbstzahler'=ANY(funding)));
END $$;
REVOKE ALL ON FUNCTION client_intake_private.client_intake_project_budgets(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION client_intake_private.client_intake_project(p_tenant uuid,p_client uuid,p_actor uuid,f jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE contexts text[]:=client_intake_private.client_intake_string_array(f,'careContexts');
 funding text[]:=client_intake_private.client_intake_string_array(f,'fundingSources');
 billing text[]:=client_intake_private.client_intake_string_array(f,'billingTypes');
 carriers text[]:=client_intake_private.client_intake_string_array(f,'costBearerTypes');
 modules text[]:=client_intake_private.client_intake_string_array(f,'assignedModules');
 start_date date:=coalesce(nullif(f->>'serviceStart','')::date,nullif(f->>'admissionDate','')::date,current_date);
 billing_type text; primary_carrier text:=client_intake_private.client_intake_primary_carrier(f);
 k text; service_key text; service_id uuid; n integer:=0; v_carrier_type text; carrier_prefix text; carrier_name text;
 carrier_ik text; template_id uuid; override_id uuid; contact_name text; contact_kind text;
BEGIN
 PERFORM public.seed_tenant_client_core_templates(p_tenant);
 IF cardinality(contexts)=0 OR NOT contexts <@ ARRAY['daily_assistance','support_care','companionship','ambulatory_care','stationary_care','consulting']
  OR cardinality(funding)=0 OR NOT funding <@ ARRAY['entlastungsleistung','umwandlung','verhinderungspflege','selbstzahler']
  OR NOT carriers <@ ARRAY['pflegekasse','krankenkasse','privatversicherung','sozialamt','beihilfe','selbstzahler','berufsgenossenschaft','unfallversicherung','sonstiger'] THEN
  RAISE EXCEPTION 'Leistungsart, Finanzierung oder Kostenträger ist ungültig' USING ERRCODE='22023'; END IF;
 billing_type:=CASE WHEN cardinality(billing)>1 OR 'kombination'=ANY(billing) OR 'kombi'=ANY(billing) THEN 'kombi'
  WHEN billing[1] IN ('selbstzahler','pflegekasse','beihilfe') THEN billing[1] WHEN billing[1]='kostenuebernahme' THEN 'beihilfe' ELSE 'sonstige' END;
 DELETE FROM public.client_care_contexts WHERE tenant_id=p_tenant AND client_id=p_client;
 FOREACH k IN ARRAY contexts LOOP
  INSERT INTO public.client_care_contexts(tenant_id,client_id,context_key,is_primary) VALUES(p_tenant,p_client,k,n=0);
  service_key:=CASE k WHEN 'daily_assistance' THEN 'alltagsbegleitung' WHEN 'support_care' THEN 'betreuung' WHEN 'companionship' THEN 'begleitung'
   WHEN 'ambulatory_care' THEN 'ambulante_pflege' WHEN 'stationary_care' THEN 'stationaere_pflege' WHEN 'consulting' THEN 'beratung' END;
  INSERT INTO public.tenant_client_service_types(tenant_id,service_type_key,care_context_key,name,is_system_template)
   VALUES(p_tenant,service_key,k,CASE k WHEN 'daily_assistance' THEN 'Alltagsbegleitung' WHEN 'support_care' THEN 'Betreuung'
    WHEN 'companionship' THEN 'Begleitung' WHEN 'ambulatory_care' THEN 'Ambulante Pflege' WHEN 'stationary_care' THEN 'Stationäre Pflege' ELSE 'Beratung' END,true)
   ON CONFLICT(tenant_id,service_type_key) DO NOTHING;
  SELECT id INTO service_id FROM public.tenant_client_service_types WHERE tenant_id=p_tenant AND service_type_key=service_key AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Die gewählte Leistungsart ist im Mandanten deaktiviert'; END IF;
  INSERT INTO public.client_service_profiles(tenant_id,client_id,service_type_id,is_primary,status,started_on)
   VALUES(p_tenant,p_client,service_id,n=0,'active',start_date)
   ON CONFLICT(tenant_id,client_id,service_type_id) DO UPDATE SET is_primary=excluded.is_primary,status='active',started_on=excluded.started_on,ended_on=NULL,updated_at=clock_timestamp();
  n:=n+1;
 END LOOP;
 UPDATE public.client_service_profiles p SET status='ended',is_primary=false,ended_on=current_date,updated_at=clock_timestamp()
 WHERE p.tenant_id=p_tenant AND p.client_id=p_client AND NOT EXISTS(SELECT 1 FROM public.tenant_client_service_types t
  WHERE t.id=p.service_type_id AND t.tenant_id=p_tenant AND t.care_context_key=ANY(contexts));
 PERFORM client_intake_private.client_intake_project_one('client_support_preferences',p_tenant,p_client,jsonb_build_object(
  'support_wishes',client_intake_private.client_intake_string_array(f,'supportWishes'),'preferred_times',client_intake_private.client_intake_string_array(f,'preferredTimes'),
  'excluded_times',client_intake_private.client_intake_string_array(f,'excludedTimes'),'mobility',nullif(f->>'mobility',''),'orientation',nullif(f->>'orientation',''),
  'communication',nullif(f->>'communication',''),'special_wishes',nullif(f->>'specialNotes','')));
 PERFORM client_intake_private.client_intake_project_one('client_addresses',p_tenant,p_client,jsonb_build_object(
  'address_type','hauptwohnsitz','street',btrim(concat_ws(' ',f->>'street',f->>'houseNumber')),'zip',coalesce(f->>'zip',''),
  'city',coalesce(f->>'city',''),'country','DE','is_primary',true,'access_notes',nullif(f->>'accessNotes',''),
  'floor',nullif(f->>'floor',''),'door_code',nullif(f->>'doorCode','')),jsonb_build_object('is_primary',true));
 IF f->>'careLevel' IN ('kein','pg1','pg2','pg3','pg4','pg5','hospiz') THEN
  INSERT INTO public.client_care_levels(tenant_id,client_id,grade,valid_from,care_fund_name,care_fund_member_id,notes)
  VALUES(p_tenant,p_client,f->>'careLevel',coalesce(nullif(f->>'careLevelValidFrom','')::date,start_date),
   coalesce(nullif(f->>'careFundName',''),primary_carrier,'Unbekannt'),nullif(f->>'insuranceNumber',''),nullif(f->>'careLevelStatus',''));
 END IF;
 PERFORM client_intake_private.client_intake_project_one('client_billing_profiles',p_tenant,p_client,jsonb_build_object(
  'billing_type',billing_type,'hourly_rate_cents',round(coalesce(nullif(replace(f->>'hourlyRate',',','.'),''),'0')::numeric*100)::integer,
  'service_type',CASE WHEN 'ambulatory_care'=ANY(contexts) THEN 'sachleistung' WHEN 'stationary_care'=ANY(contexts) THEN 'haushalt' ELSE 'betreuung' END,
  'cost_bearer_name',primary_carrier,'cost_bearer_reference',nullif(f->>'insuranceNumber',''),'invoice_recipient',nullif(f->>'selbstzahlerName',''),
  'notes',array_to_string(billing,', ')));
 PERFORM client_intake_private.client_intake_project_one('client_insurance_profiles',p_tenant,p_client,jsonb_build_object(
  'care_level',nullif(f->>'careLevel',''),'care_level_status',nullif(f->>'careLevelStatus',''),
  'care_level_valid_from',nullif(f->>'careLevelValidFrom','')::date,'care_fund_name',nullif(f->>'careFundName',''),
  'health_insurance',nullif(f->>'healthInsurance',''),'cost_bearer_ik',coalesce(nullif(f->>'costBearerIk',''),nullif(f->>'healthInsuranceIk','')),
  'insurance_number',nullif(f->>'insuranceNumber',''),'billing_type',billing_type,'self_pay','selbstzahler'=ANY(funding),'is_primary',true),jsonb_build_object('is_primary',true));
 FOREACH contact_kind IN ARRAY ARRAY['emergency_contact','doctor'] LOOP
  contact_name:=btrim(coalesce(f->>CASE WHEN contact_kind='doctor' THEN 'familyDoctor' ELSE 'emergencyContactName' END,''));
  IF contact_name<>'' OR (contact_kind='emergency_contact' AND nullif(f->>'emergencyContactPhone','') IS NOT NULL) THEN
   contact_name:=coalesce(nullif(contact_name,''),'Kontakt');
   PERFORM client_intake_private.client_intake_project_one('client_contacts',p_tenant,p_client,jsonb_build_object(
    'contact_type',contact_kind,'first_name',split_part(contact_name,' ',1),'last_name',ltrim(substr(contact_name,length(split_part(contact_name,' ',1))+1)),
    'relationship',CASE WHEN contact_kind='doctor' THEN 'arzt' ELSE 'notfallkontakt' END,
    'phone',CASE WHEN contact_kind='emergency_contact' THEN nullif(f->>'emergencyContactPhone','') ELSE NULL END,
    'is_emergency_contact',contact_kind='emergency_contact'),jsonb_build_object('contact_type',contact_kind));
  ELSE DELETE FROM public.client_contacts WHERE tenant_id=p_tenant AND client_id=p_client AND contact_type::text=contact_kind;
  END IF;
 END LOOP;
 PERFORM client_intake_private.client_intake_project_one('client_ambulatory_details',p_tenant,p_client,jsonb_build_object(
  'home_access',nullif(array_to_string(client_intake_private.client_intake_string_array(f,'homeAccess'),','),''),
  'key_status',nullif(f->>'keyStatus',''),'key_number',nullif(f->>'keyNumber',''),'key_safe_code',nullif(f->>'keySafeCode',''),
  'door_code',nullif(f->>'doorCode',''),'bell_name',nullif(f->>'bellName',''),'floor',nullif(f->>'floor',''),
  'elevator_available',coalesce((f->>'elevatorAvailable')::boolean,false),'parking_notes',nullif(f->>'parkingNotes',''),
  'access_notes',nullif(f->>'accessNotes',''),'hazard_notes',nullif(f->>'hazardNotes',''),'pets',nullif(f->>'pets',''),
  'smoker_household',coalesce((f->>'smokerHousehold')::boolean,false),'aids_on_site',nullif(f->>'aidsOnSite',''),
  'hygiene_notes',nullif(f->>'hygieneNotes',''),'infection_notes',nullif(f->>'infectionNotes',''),'family_doctor',nullif(f->>'familyDoctor','')));
 PERFORM client_intake_private.client_intake_project_one('client_stationary_details',p_tenant,p_client,jsonb_build_object(
  'facility_name',nullif(f->>'facilityName',''),'facility_location',nullif(f->>'facilityLocation',''),'care_area',nullif(f->>'careArea',''),
  'room_number',nullif(f->>'roomNumber',''),'bed_position',nullif(f->>'bedPosition',''),
  'admission_date',coalesce(nullif(f->>'admissionDateStationary','')::date,nullif(f->>'admissionDate','')::date),
  'resident_status',nullif(f->>'residentStatus',''),'room_status',nullif(f->>'roomStatus',''),'primary_nurse',nullif(f->>'primaryNurse',''),
  'area_manager',nullif(f->>'areaManager',''),'cost_form',nullif(f->>'costForm',''),'meal_notes',nullif(f->>'mealNotes',''),'daily_structure',nullif(f->>'dailyStructure','')));
 UPDATE public.client_cost_carrier_assignments SET archived_at=clock_timestamp(),is_primary=false,updated_by=p_actor
  WHERE tenant_id=p_tenant AND client_id=p_client AND archived_at IS NULL;
 FOREACH k IN ARRAY carriers LOOP
  v_carrier_type:=CASE k WHEN 'pflegekasse' THEN 'care_insurance' WHEN 'krankenkasse' THEN 'health_insurance'
   WHEN 'privatversicherung' THEN 'private_insurance' WHEN 'sozialamt' THEN 'social_welfare_office'
   WHEN 'berufsgenossenschaft' THEN 'employers_liability_insurance' WHEN 'unfallversicherung' THEN 'accident_insurance' ELSE k END;
  carrier_prefix:=CASE k WHEN 'pflegekasse' THEN 'careFund' WHEN 'krankenkasse' THEN 'healthInsurance' ELSE k END;
  carrier_name:=nullif(btrim(f->>CASE k WHEN 'krankenkasse' THEN 'healthInsurance' ELSE carrier_prefix||'Name' END),'');
  carrier_ik:=nullif(f->>CASE k WHEN 'pflegekasse' THEN 'costBearerIk' ELSE carrier_prefix||'Ik' END,'');
  IF carrier_name IS NULL THEN RAISE EXCEPTION 'Der ausgewählte Kostenträger hat keinen Namen'; END IF;
  template_id:=NULL; override_id:=NULL;
  IF nullif(f->'costBearerTemplateIds'->>k,'') IS NOT NULL THEN
   SELECT t.id INTO template_id FROM public.cost_carrier_system_templates t WHERE t.id=(f->'costBearerTemplateIds'->>k)::uuid AND t.carrier_type=v_carrier_type FOR SHARE;
   IF NOT FOUND THEN
    SELECT o.id INTO override_id FROM public.tenant_cost_carrier_overrides o WHERE o.id=(f->'costBearerTemplateIds'->>k)::uuid AND o.tenant_id=p_tenant AND o.is_active AND o.carrier_type=v_carrier_type FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Die gewählte Kostenträgervorlage gehört nicht zum Mandanten oder ist nicht verfügbar'; END IF;
   END IF;
  END IF;
  INSERT INTO public.client_cost_carrier_assignments(tenant_id,client_id,carrier_type,system_template_id,tenant_override_id,name_snapshot,ik_number_snapshot,
   address_snapshot,insurance_number,care_level_relevant,billing_relevant,is_primary,valid_from,created_by,updated_by)
  VALUES(p_tenant,p_client,v_carrier_type,template_id,override_id,carrier_name,carrier_ik,
   jsonb_build_object('street',coalesce(f->>(carrier_prefix||'Street'),''),'postalCode',coalesce(f->>(carrier_prefix||'Zip'),''),'city',coalesce(f->>(carrier_prefix||'City'),''),'country','DE'),
   CASE WHEN k IN ('pflegekasse','krankenkasse','privatversicherung') THEN nullif(f->>'insuranceNumber','') ELSE NULL END,
   k='pflegekasse',true,true,start_date,p_actor,p_actor);
 END LOOP;
 UPDATE public.client_funding_selections SET replaced_at=clock_timestamp() WHERE tenant_id=p_tenant AND client_id=p_client AND replaced_at IS NULL;
 INSERT INTO public.client_funding_selections(tenant_id,client_id,sources,effective_from,created_by) VALUES(p_tenant,p_client,funding,start_date,p_actor);
 modules:=ARRAY(SELECT DISTINCT x FROM unnest(modules) x WHERE x IN ('office','assist','pflege','stationaer','beratung','akademie')
  ORDER BY x);
 SELECT array_agg(x ORDER BY CASE x WHEN 'pflege' THEN 1 WHEN 'stationaer' THEN 2 WHEN 'assist' THEN 3 WHEN 'beratung' THEN 4 WHEN 'office' THEN 5 ELSE 6 END)
  INTO modules FROM unnest(modules) x;
 modules:=coalesce(modules,'{}'::text[]);
 UPDATE public.client_module_assignments SET is_active=false,is_primary=false,status='inactive',updated_at=clock_timestamp()
  WHERE tenant_id=p_tenant AND client_id=p_client AND NOT module_key=ANY(modules);
 FOREACH k IN ARRAY modules LOOP
  UPDATE public.client_module_assignments SET is_active=true,is_primary=k=modules[1],status='active',assigned_by=p_actor,updated_at=clock_timestamp()
   WHERE tenant_id=p_tenant AND client_id=p_client AND module_key=k;
  IF NOT FOUND THEN INSERT INTO public.client_module_assignments(tenant_id,client_id,module_key,status,is_active,is_primary,assigned_by)
   VALUES(p_tenant,p_client,k,'active',true,k=modules[1],p_actor); END IF;
 END LOOP;
 -- Inheritance preserves the existing tenant visibility policy; no account or code is created.
 INSERT INTO public.client_portal_settings(tenant_id,client_id,inherit_tenant_defaults) VALUES(p_tenant,p_client,true)
  ON CONFLICT(tenant_id,client_id) DO NOTHING;
 PERFORM client_intake_private.client_intake_project_budgets(p_tenant,p_client,p_actor,f);
END $$;
REVOKE ALL ON FUNCTION client_intake_private.client_intake_project(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;

-- Only the trusted Edge verifier may invoke this transaction. It cannot change
-- the reviewed form; the hash is computed by PostgreSQL over the saved JSONB.
CREATE OR REPLACE FUNCTION public.client_intake_commit_completion(
 p_tenant uuid,p_client uuid,p_actor uuid,p_auth_user uuid,p_expected_revision bigint,p_form_hash text,p_documents jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d public.client_intake_drafts%ROWTYPE; c public.clients%ROWTYPE;
 done client_intake_private.client_intake_completions%ROWTYPE; company public.tenants%ROWTYPE;
 t public.intake_document_system_templates%ROWTYPE; own public.tenant_document_templates%ROWTYPE;
 entry jsonb; original jsonb; signature jsonb; slot jsonb; expected_keys text[]; received_keys text[]; needed_roles text[];
 contract_type text; contract_key text; key text; role_key text; document_id uuid; content_hash text;
 receipt jsonb; template_snapshot jsonb; source_updated timestamptz; finalized timestamptz; signature_at timestamptz;
 company_snapshot jsonb; now_at timestamptz:=clock_timestamp();
BEGIN
 PERFORM client_intake_private.client_intake_actor(p_tenant,p_auth_user,p_actor);
 IF p_client IS NULL OR p_expected_revision IS NULL OR p_expected_revision<1 OR p_form_hash IS NULL
  OR jsonb_typeof(p_documents) IS DISTINCT FROM 'array' OR jsonb_array_length(p_documents)>16
  OR octet_length(p_documents::text)>48000000 THEN RAISE EXCEPTION 'Der geprüfte Aufnahmeabschluss ist unvollständig' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('client-intake:'||p_tenant::text||':'||p_client::text,0));
 SELECT * INTO d FROM public.client_intake_drafts WHERE tenant_id=p_tenant AND client_id=p_client FOR UPDATE;
 IF NOT FOUND OR d.revision<>p_expected_revision OR d.form_hash IS DISTINCT FROM p_form_hash THEN
  RAISE EXCEPTION 'Der Entwurf wurde seit der Prüfung geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
 SELECT * INTO done FROM client_intake_private.client_intake_completions WHERE tenant_id=p_tenant AND client_id=p_client;
 IF FOUND THEN
  IF done.revision<>p_expected_revision OR done.form_hash IS DISTINCT FROM p_form_hash
   OR done.documents_hash IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(p_documents::text,'UTF8')),'hex') THEN
   RAISE EXCEPTION 'Dieser Abschluss gehört zu einer anderen geprüften Fassung' USING ERRCODE='40001'; END IF;
  RETURN done.receipt||jsonb_build_object('replayed',true);
 END IF;
 SELECT * INTO c FROM public.clients WHERE id=p_client AND tenant_id=p_tenant FOR UPDATE;
 IF NOT FOUND OR c.status<>'lead' OR c.deleted_at IS NOT NULL OR c.updated_at IS DISTINCT FROM d.client_updated_at OR d.status<>'draft' THEN
  RAISE EXCEPTION 'Die Klientenakte wurde seit der Entwurfsicherung geändert' USING ERRCODE='40001'; END IF;
 SELECT * INTO company FROM public.tenants WHERE id=p_tenant FOR SHARE;
 company_snapshot:=jsonb_build_object('name',company.name,'street',company.street,'house_number',company.house_number,'postal_code',company.postal_code,'city',company.city);
 IF nullif(btrim(d.form_json->>'firstName'),'') IS NULL OR nullif(btrim(d.form_json->>'lastName'),'') IS NULL
  OR client_intake_private.client_intake_draft_date(d.form_json->>'dateOfBirth') IS NULL THEN
  RAISE EXCEPTION 'Die erforderlichen Klientenstammdaten fehlen'; END IF;
 contract_type:=nullif(d.form_json->>'intakeContractType','');
 IF contract_type IS NULL THEN
  SELECT CASE value WHEN 'daily_assistance' THEN 'assist' WHEN 'support_care' THEN 'assist' WHEN 'companionship' THEN 'assist'
   WHEN 'ambulatory_care' THEN 'ambulatory_care' WHEN 'stationary_care' THEN 'stationary_care' WHEN 'consulting' THEN 'care_consulting' END
   INTO contract_type FROM jsonb_array_elements_text(d.form_json->'careContexts') WITH ORDINALITY x(value,n) ORDER BY n LIMIT 1;
 END IF;
 IF contract_type IS NULL OR contract_type NOT IN ('assist','ambulatory_care','stationary_care','day_care','care_consulting','relief_services') THEN
  RAISE EXCEPTION 'Ein gültiger Aufnahmevertrag fehlt'; END IF;
 contract_key:='client_contract_'||contract_type;
 expected_keys:=ARRAY['privacy_consent_default',contract_key];
 IF coalesce((d.form_json->>'intakeAssignmentEnabled')::boolean,false) THEN expected_keys:=array_append(expected_keys,'assignment_declaration_care_health_insurance'); END IF;
 FOREACH key IN ARRAY client_intake_private.client_intake_string_array(d.form_json,'intakeOptionalConsents') LOOP
  IF key NOT IN ('confidentiality_release_default','communication_consent_default','photo_media_consent_default','emergency_contact_consent_default')
   OR key=ANY(expected_keys) THEN RAISE EXCEPTION 'Unbekannte oder doppelte Zusatzeinwilligung'; END IF;
  expected_keys:=array_append(expected_keys,key);
 END LOOP;
 SELECT array_agg(value->>'templateKey' ORDER BY value->>'templateKey') INTO received_keys FROM jsonb_array_elements(p_documents);
 IF cardinality(received_keys) IS DISTINCT FROM cardinality(expected_keys) OR NOT received_keys @> expected_keys
  OR (SELECT count(DISTINCT value->>'templateKey') FROM jsonb_array_elements(p_documents))<>cardinality(expected_keys) THEN
  RAISE EXCEPTION 'Datenschutz, gewählter Vertrag oder ausgewählte Einwilligungen sind nicht vollständig'; END IF;
 IF EXISTS(SELECT 1 FROM public.client_document_signatures WHERE tenant_id=p_tenant AND client_id=p_client)
  OR EXISTS(SELECT 1 FROM public.client_intake_documents WHERE tenant_id=p_tenant AND client_id=p_client
   AND (status='finalized' OR finalized_html IS NOT NULL OR finalized_at IS NOT NULL)) THEN
  RAISE EXCEPTION 'Eine vorhandene signierte Originalfassung darf nicht überschrieben werden'; END IF;
 -- Bind the selected tenant overlay, including the absence of an overlay. A row
 -- lock alone cannot protect against a new active template being inserted.
 LOCK TABLE public.tenant_document_templates IN SHARE MODE;
 -- Validate every reviewed byte and source before any completion evidence exists.
 FOR entry IN SELECT value FROM jsonb_array_elements(p_documents) ORDER BY value->>'templateKey' LOOP
  key:=entry->>'templateKey';
  SELECT value INTO original FROM jsonb_array_elements(d.form_json->'intakeDocuments') WHERE value->>'templateKey'=key;
  IF original IS NULL OR (SELECT count(*) FROM jsonb_array_elements(d.form_json->'intakeDocuments') WHERE value->>'templateKey'=key)<>1
   OR original IS DISTINCT FROM entry-ARRAY['contentHash','templateUpdatedAt','systemTemplateUpdatedAt','systemTemplateSnapshot','tenantTemplateSnapshot','tenantDisplaySnapshot']
   OR entry->>'status' IS DISTINCT FROM 'finalized' OR nullif(entry->>'finalizedHtml','') IS NULL
   OR entry->>'previewHtml' IS DISTINCT FROM entry->>'finalizedHtml' OR jsonb_array_length(coalesce(entry->'missingPlaceholders','[]'))<>0
   OR jsonb_typeof(entry->'signatures') IS DISTINCT FROM 'object' THEN
   RAISE EXCEPTION 'Geprüftes Original und gespeicherter Entwurf stimmen nicht überein'; END IF;
  content_hash:='sha256:'||encode(sha256(convert_to(entry->>'finalizedHtml','UTF8')),'hex');
  IF entry->>'contentHash' IS DISTINCT FROM content_hash OR entry->'tenantDisplaySnapshot' IS DISTINCT FROM company_snapshot THEN
   RAISE EXCEPTION 'Originalinhalt oder Unternehmensangaben wurden seit der Prüfung geändert' USING ERRCODE='40001'; END IF;
  SELECT * INTO t FROM public.intake_document_system_templates WHERE template_key=key FOR SHARE;
  IF NOT FOUND OR NOT t.is_active OR t.version IS DISTINCT FROM (entry->>'version')::integer OR t.document_type IS DISTINCT FROM entry->>'documentType'
   OR t.updated_at IS DISTINCT FROM (entry->>'systemTemplateUpdatedAt')::timestamptz
   OR (to_jsonb(t)-ARRAY['created_at','updated_at']) IS DISTINCT FROM ((entry->'systemTemplateSnapshot')-ARRAY['created_at','updated_at']) THEN
   RAISE EXCEPTION 'Die Systemvorlage wurde seit der Prüfung geändert' USING ERRCODE='40001'; END IF;
  source_updated:=t.updated_at;
  IF entry->>'source'='tenant' THEN
   SELECT * INTO own FROM public.tenant_document_templates WHERE id=(entry->>'tenantTemplateId')::uuid AND tenant_id=p_tenant AND template_key=key FOR SHARE;
   IF NOT FOUND OR NOT own.is_active
    OR (to_jsonb(own)-ARRAY['created_at','updated_at']) IS DISTINCT FROM ((entry->'tenantTemplateSnapshot')-ARRAY['created_at','updated_at']) THEN
    RAISE EXCEPTION 'Die eigene Vorlage wurde seit der Prüfung geändert' USING ERRCODE='40001'; END IF;
   source_updated:=own.updated_at;
  ELSIF entry->>'source' IS DISTINCT FROM 'system' OR nullif(entry->>'tenantTemplateId','') IS NOT NULL THEN
   RAISE EXCEPTION 'Die Dokumentquelle ist nicht verifiziert';
  END IF;
  IF EXISTS(SELECT 1 FROM public.tenant_document_templates x WHERE x.tenant_id=p_tenant AND x.template_key=key AND x.is_active
    AND (entry->>'source'<>'tenant' OR x.id IS DISTINCT FROM (entry->>'tenantTemplateId')::uuid)) THEN
   RAISE EXCEPTION 'Die ausgewählte eigene Vorlage wurde seit der Prüfung geändert' USING ERRCODE='40001'; END IF;
  IF source_updated IS DISTINCT FROM (entry->>'templateUpdatedAt')::timestamptz THEN
   RAISE EXCEPTION 'Die Vorlagenfassung wurde seit der Prüfung geändert' USING ERRCODE='40001'; END IF;
  needed_roles:=ARRAY[]::text[];
  IF t.requires_client_signature THEN needed_roles:=array_append(needed_roles,'client'); END IF;
  IF t.requires_employee_signature THEN needed_roles:=array_append(needed_roles,'employee'); END IF;
  IF t.requires_representative_signature THEN needed_roles:=array_append(needed_roles,'legal_representative'); END IF;
  FOR slot IN SELECT value FROM jsonb_array_elements(t.signature_slots) LOOP
   IF coalesce((slot->>'required')::boolean,false) AND NOT (slot->>'role')=ANY(needed_roles) THEN needed_roles:=array_append(needed_roles,slot->>'role'); END IF;
  END LOOP;
  FOREACH role_key IN ARRAY needed_roles LOOP
   IF nullif(entry->'signatures'->role_key->>'dataUrl','') IS NULL THEN RAISE EXCEPTION 'Eine erforderliche Unterschrift fehlt'; END IF;
  END LOOP;
  FOR role_key,signature IN SELECT k,v FROM jsonb_each(entry->'signatures') x(k,v) LOOP
   IF role_key NOT IN ('client','employee','legal_representative') OR signature->>'role' IS DISTINCT FROM role_key
    OR NOT (role_key=ANY(needed_roles) OR EXISTS(SELECT 1 FROM jsonb_array_elements(t.signature_slots) s WHERE s->>'role'=role_key))
    OR nullif(signature->>'dataUrl','') IS NULL OR length(signature->>'dataUrl')>3000000
    OR signature->>'dataUrl' !~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$'
    OR position(signature->>'dataUrl' IN entry->>'finalizedHtml')=0
    OR substring(decode(substring(signature->>'dataUrl',23),'base64'),1,8)<>decode('89504e470d0a1a0a','hex') THEN
    RAISE EXCEPTION 'Die Signatur gehört nicht zur geprüften Originalfassung'; END IF;
   signature_at:=(signature->>'signedAt')::timestamptz;
   IF signature_at IS NULL OR signature_at>now_at+interval '5 minutes' THEN RAISE EXCEPTION 'Der Signaturzeitpunkt ist ungültig'; END IF;
  END LOOP;
  finalized:=(entry->>'finalizedAt')::timestamptz;
  IF finalized IS NULL OR finalized>now_at+interval '5 minutes' THEN RAISE EXCEPTION 'Der Abschlusszeitpunkt ist ungültig'; END IF;
 END LOOP;
 PERFORM client_intake_private.client_intake_write_core(p_tenant,p_client,p_actor,d.form_json);
 PERFORM client_intake_private.client_intake_project(p_tenant,p_client,p_actor,d.form_json);
 receipt:=jsonb_build_object('contract','client-intake-completion-v1','tenantId',p_tenant,'clientId',p_client,
  'revision',d.revision,'status','active','confirmed',true,'portalAccountCreated',false,'replayed',false);
 INSERT INTO client_intake_private.client_intake_completions(tenant_id,client_id,actor_profile_id,actor_auth_user_id,revision,form_hash,form_json,documents_hash,receipt)
 VALUES(p_tenant,p_client,p_actor,p_auth_user,d.revision,d.form_hash,d.form_json,'sha256:'||encode(sha256(convert_to(p_documents::text,'UTF8')),'hex'),receipt);
 FOR entry IN SELECT value FROM jsonb_array_elements(p_documents) LOOP
  SELECT id INTO document_id FROM public.client_intake_documents WHERE tenant_id=p_tenant AND client_id=p_client AND template_key=entry->>'templateKey' FOR UPDATE;
  document_id:=coalesce(document_id,gen_random_uuid());
  finalized:=(entry->>'finalizedAt')::timestamptz;
  INSERT INTO client_intake_private.client_intake_originals(id,tenant_id,client_id,template_key,content_hash,original_html,signatures_json,template_snapshot,finalized_at)
  VALUES(document_id,p_tenant,p_client,entry->>'templateKey',entry->>'contentHash',entry->>'finalizedHtml',entry->'signatures',
   jsonb_build_object('system',entry->'systemTemplateSnapshot','tenant',entry->'tenantTemplateSnapshot','company',entry->'tenantDisplaySnapshot'),finalized);
  INSERT INTO public.client_intake_documents(id,tenant_id,client_id,template_key,document_type,title,status,is_required,version,source,tenant_template_id,
   preview_html,finalized_html,missing_placeholders,preview_opened_at,finalized_at,updated_by)
  VALUES(document_id,p_tenant,p_client,entry->>'templateKey',entry->>'documentType',entry->>'title','finalized',true,(entry->>'version')::integer,
   entry->>'source',nullif(entry->>'tenantTemplateId','')::uuid,entry->>'finalizedHtml',entry->>'finalizedHtml','[]'::jsonb,
   nullif(entry->>'previewOpenedAt','')::timestamptz,finalized,p_actor)
  ON CONFLICT(id) DO UPDATE SET document_type=excluded.document_type,title=excluded.title,status=excluded.status,is_required=true,
   version=excluded.version,source=excluded.source,tenant_template_id=excluded.tenant_template_id,preview_html=excluded.preview_html,
   finalized_html=excluded.finalized_html,missing_placeholders='[]',preview_opened_at=excluded.preview_opened_at,finalized_at=excluded.finalized_at,
   generated_document_id=NULL,rendered_pdf_path=NULL,updated_by=p_actor,updated_at=now_at;
  FOR role_key,signature IN SELECT k,v FROM jsonb_each(entry->'signatures') x(k,v) LOOP
   INSERT INTO public.client_document_signatures(tenant_id,client_id,document_id,signer_role,signature_data,signed_at,signer_name)
   VALUES(p_tenant,p_client,document_id,role_key,signature->>'dataUrl',(signature->>'signedAt')::timestamptz,nullif(btrim(signature->>'signerName'),''));
  END LOOP;
  INSERT INTO public.client_documents(tenant_id,client_id,title,file_name,mime_type,category,status,sensitivity,source,intake_document_id,portal_visible,uploaded_by,signed_at,signature_required)
  VALUES(p_tenant,p_client,entry->>'title',(entry->>'templateKey')||'.html','text/html',
   CASE WHEN entry->>'documentType' IN ('privacy_consent','additional_consent') THEN 'einwilligung' ELSE 'vertrag' END,
   'abgeschlossen','care','intake',document_id,false,p_actor,finalized,false);
  INSERT INTO public.client_document_events(tenant_id,client_id,document_id,event_type,summary,metadata_json,actor_profile_id)
  VALUES(p_tenant,p_client,document_id,'document_finalized','Geprüftes Aufnahmeoriginal dauerhaft gespeichert',
   jsonb_build_object('contract','client-intake-completion-v1','revision',d.revision,'formHash',d.form_hash,'contentHash',entry->>'contentHash','collectorProfileId',p_actor),p_actor);
 END LOOP;
 INSERT INTO public.client_contract_selection(tenant_id,client_id,contract_type,selected_template_key,updated_by)
 VALUES(p_tenant,p_client,contract_type,contract_key,p_actor)
 ON CONFLICT(tenant_id,client_id) DO UPDATE SET contract_type=excluded.contract_type,selected_template_key=excluded.selected_template_key,updated_by=p_actor,updated_at=now_at;
 INSERT INTO public.client_consent_status(tenant_id,client_id,privacy_status,contract_status,assignment_status,privacy_finalized_at,contract_finalized_at,updated_by)
 VALUES(p_tenant,p_client,'finalized','finalized',CASE WHEN 'assignment_declaration_care_health_insurance'=ANY(expected_keys) THEN 'finalized' ELSE 'not_started' END,now_at,now_at,p_actor)
 ON CONFLICT(tenant_id,client_id) DO UPDATE SET privacy_status=excluded.privacy_status,contract_status=excluded.contract_status,assignment_status=excluded.assignment_status,
  privacy_finalized_at=excluded.privacy_finalized_at,contract_finalized_at=excluded.contract_finalized_at,updated_by=p_actor,updated_at=now_at;
 INSERT INTO public.client_timeline_events(tenant_id,client_id,event_type,title,status,is_internal,metadata)
 VALUES(p_tenant,p_client,'status','Klientenaufnahme abgeschlossen','completed',true,receipt||jsonb_build_object('actorProfileId',p_actor,'formHash',d.form_hash));
 UPDATE public.client_intake_drafts SET status='completed',completed_receipt=receipt,updated_at=now_at WHERE tenant_id=p_tenant AND client_id=p_client;
 UPDATE public.clients SET status='active',updated_by=p_actor,updated_at=now_at WHERE tenant_id=p_tenant AND id=p_client;
 RETURN receipt;
END $$;
REVOKE ALL ON FUNCTION public.client_intake_commit_completion(uuid,uuid,uuid,uuid,bigint,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.client_intake_commit_completion(uuid,uuid,uuid,uuid,bigint,text,jsonb) TO service_role;

-- A private origin marker protects new intakes even through intermediate statuses,
-- without treating historical paused clients as unfinished intakes.
CREATE TABLE IF NOT EXISTS client_intake_private.client_intake_pending_clients(
 tenant_id uuid NOT NULL,client_id uuid NOT NULL,PRIMARY KEY(tenant_id,client_id));
ALTER TABLE client_intake_private.client_intake_pending_clients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON client_intake_private.client_intake_pending_clients FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION client_intake_private.reject_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Gesicherte Aufnahmefassungen und Originale sind unveränderlich' USING ERRCODE='42501'; END $$;
REVOKE ALL ON FUNCTION client_intake_private.reject_evidence_mutation() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER client_intake_operations_immutable BEFORE UPDATE OR DELETE ON client_intake_private.client_intake_operations
 FOR EACH ROW EXECUTE FUNCTION client_intake_private.reject_evidence_mutation();
CREATE TRIGGER client_intake_completions_immutable BEFORE UPDATE OR DELETE ON client_intake_private.client_intake_completions
 FOR EACH ROW EXECUTE FUNCTION client_intake_private.reject_evidence_mutation();
CREATE TRIGGER client_intake_originals_immutable BEFORE UPDATE OR DELETE ON client_intake_private.client_intake_originals
 FOR EACH ROW EXECUTE FUNCTION client_intake_private.reject_evidence_mutation();
CREATE TRIGGER client_intake_pending_immutable BEFORE UPDATE OR DELETE ON client_intake_private.client_intake_pending_clients
 FOR EACH ROW EXECUTE FUNCTION client_intake_private.reject_evidence_mutation();

CREATE OR REPLACE FUNCTION client_intake_private.guard_draft_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP<>'INSERT' AND OLD.status='completed' THEN RAISE EXCEPTION 'Die abgeschlossene Aufnahmefassung ist unveränderlich' USING ERRCODE='42501'; END IF;
 IF TG_OP<>'DELETE' AND (NEW.status='completed' OR NEW.completed_receipt IS NOT NULL) AND NOT EXISTS(
  SELECT 1 FROM client_intake_private.client_intake_completions e WHERE e.tenant_id=NEW.tenant_id AND e.client_id=NEW.client_id
   AND e.revision=NEW.revision AND e.form_hash=NEW.form_hash AND e.form_json=NEW.form_json AND e.receipt=NEW.completed_receipt) THEN
  RAISE EXCEPTION 'Ein bestätigter atomarer Abschluss fehlt' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION client_intake_private.guard_draft_completion() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER client_intake_draft_completion_guard BEFORE INSERT OR UPDATE OR DELETE ON public.client_intake_drafts
 FOR EACH ROW EXECUTE FUNCTION client_intake_private.guard_draft_completion();

CREATE OR REPLACE FUNCTION client_intake_private.guard_client_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE pending boolean;
BEGIN
 IF TG_OP='UPDATE' AND (OLD.id IS DISTINCT FROM NEW.id OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id)
  AND (OLD.status='lead' OR EXISTS(SELECT 1 FROM client_intake_private.client_intake_pending_clients WHERE tenant_id=OLD.tenant_id AND client_id=OLD.id)
   OR EXISTS(SELECT 1 FROM public.client_intake_drafts WHERE tenant_id=OLD.tenant_id AND client_id=OLD.id)) THEN
  RAISE EXCEPTION 'Die Zuordnung einer laufenden Aufnahme ist unveränderlich' USING ERRCODE='42501'; END IF;
 IF (TG_OP='INSERT' AND NEW.status='lead') OR (TG_OP='UPDATE' AND OLD.status='lead') THEN
  INSERT INTO client_intake_private.client_intake_pending_clients(tenant_id,client_id) VALUES(NEW.tenant_id,NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 pending:=EXISTS(SELECT 1 FROM client_intake_private.client_intake_pending_clients WHERE tenant_id=NEW.tenant_id AND client_id=NEW.id)
  OR EXISTS(SELECT 1 FROM public.client_intake_drafts WHERE tenant_id=NEW.tenant_id AND client_id=NEW.id);
 IF NEW.status='active' AND pending AND NOT EXISTS(SELECT 1 FROM client_intake_private.client_intake_completions
  WHERE tenant_id=NEW.tenant_id AND client_id=NEW.id) THEN
  RAISE EXCEPTION 'Die Neuaufnahme kann nur mit bestätigtem atomarem Abschluss aktiviert werden' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION client_intake_private.guard_client_activation() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER client_intake_activation_guard BEFORE INSERT OR UPDATE ON public.clients
 FOR EACH ROW EXECUTE FUNCTION client_intake_private.guard_client_activation();

CREATE OR REPLACE FUNCTION client_intake_private.guard_original()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP<>'INSERT' AND (OLD.status='finalized' OR OLD.finalized_html IS NOT NULL OR OLD.finalized_at IS NOT NULL
  OR EXISTS(SELECT 1 FROM public.client_document_signatures WHERE document_id=OLD.id)) THEN
  RAISE EXCEPTION 'Ein signiertes Aufnahmeoriginal darf nicht verändert oder entfernt werden' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM client_intake_private.client_intake_originals WHERE id=OLD.id) THEN
   RAISE EXCEPTION 'Ein gesichertes Aufnahmeoriginal darf nicht entfernt werden' USING ERRCODE='42501'; END IF;
  RETURN OLD;
 END IF;
 IF NEW.status='finalized' OR NEW.finalized_html IS NOT NULL OR NEW.finalized_at IS NOT NULL THEN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' OR NOT EXISTS(
   SELECT 1 FROM client_intake_private.client_intake_originals o WHERE o.id=NEW.id AND o.tenant_id=NEW.tenant_id AND o.client_id=NEW.client_id
    AND o.template_key=NEW.template_key AND o.original_html=NEW.finalized_html AND o.original_html=NEW.preview_html AND o.finalized_at=NEW.finalized_at) THEN
   RAISE EXCEPTION 'Das signierte Original benötigt den geprüften Serverabschluss' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION client_intake_private.guard_original() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER client_intake_original_guard BEFORE INSERT OR UPDATE OR DELETE ON public.client_intake_documents
 FOR EACH ROW EXECUTE FUNCTION client_intake_private.guard_original();

CREATE OR REPLACE FUNCTION client_intake_private.guard_signature()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Gesicherte Unterschriften sind unveränderlich' USING ERRCODE='42501'; END IF;
 IF current_setting('role',true) IS DISTINCT FROM 'service_role' OR NOT EXISTS(
  SELECT 1 FROM client_intake_private.client_intake_originals o WHERE o.id=NEW.document_id AND o.tenant_id=NEW.tenant_id AND o.client_id=NEW.client_id
   AND o.signatures_json->NEW.signer_role->>'dataUrl'=NEW.signature_data
   AND (o.signatures_json->NEW.signer_role->>'signedAt')::timestamptz=NEW.signed_at) THEN
  RAISE EXCEPTION 'Eine Unterschrift benötigt das unveränderliche geprüfte Original' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION client_intake_private.guard_signature() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER client_intake_signature_guard BEFORE INSERT OR UPDATE OR DELETE ON public.client_document_signatures
 FOR EACH ROW EXECUTE FUNCTION client_intake_private.guard_signature();

CREATE OR REPLACE FUNCTION client_intake_private.guard_archive()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP<>'INSERT' AND OLD.intake_document_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_intake_private.client_intake_originals WHERE id=OLD.intake_document_id) THEN
  IF TG_OP='DELETE' OR (to_jsonb(OLD)-ARRAY['portal_visible','updated_at','updated_by']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['portal_visible','updated_at','updated_by']) THEN
   RAISE EXCEPTION 'Der Verweis auf ein gesichertes Aufnahmeoriginal ist unveränderlich' USING ERRCODE='42501'; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.intake_document_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.client_intake_documents d
  WHERE d.id=NEW.intake_document_id AND d.tenant_id=NEW.tenant_id AND d.client_id=NEW.client_id) THEN
  RAISE EXCEPTION 'Das Aufnahmeoriginal gehört nicht zu dieser Klientenakte' USING ERRCODE='42501'; END IF;
 IF (NEW.source='intake' OR NEW.intake_document_id IS NOT NULL) AND (NEW.status='abgeschlossen' OR NEW.signed_at IS NOT NULL) THEN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' OR NOT EXISTS(SELECT 1 FROM client_intake_private.client_intake_originals o
   WHERE o.id=NEW.intake_document_id AND o.tenant_id=NEW.tenant_id AND o.client_id=NEW.client_id AND o.finalized_at=NEW.signed_at) THEN
   RAISE EXCEPTION 'Der Archiveintrag benötigt das geprüfte Aufnahmeoriginal' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION client_intake_private.guard_archive() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER client_intake_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.client_documents
 FOR EACH ROW EXECUTE FUNCTION client_intake_private.guard_archive();

CREATE OR REPLACE FUNCTION client_intake_private.guard_consent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP<>'INSERT' AND (OLD.privacy_status='finalized' OR OLD.contract_status='finalized' OR OLD.assignment_status='finalized')
  AND EXISTS(SELECT 1 FROM client_intake_private.client_intake_completions WHERE tenant_id=OLD.tenant_id AND client_id=OLD.client_id) THEN
  IF TG_OP='DELETE' OR (to_jsonb(OLD)-ARRAY['updated_at','updated_by']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['updated_at','updated_by']) THEN
   RAISE EXCEPTION 'Der bestätigte Einwilligungsnachweis ist unveränderlich' USING ERRCODE='42501'; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.privacy_status='finalized' OR NEW.contract_status='finalized' OR NEW.assignment_status='finalized' THEN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' OR NOT EXISTS(SELECT 1 FROM client_intake_private.client_intake_completions
   WHERE tenant_id=NEW.tenant_id AND client_id=NEW.client_id) THEN
   RAISE EXCEPTION 'Einwilligungen dürfen nur mit geprüftem Aufnahmeabschluss bestätigt werden' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION client_intake_private.guard_consent() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER client_intake_consent_guard BEFORE INSERT OR UPDATE OR DELETE ON public.client_consent_status
 FOR EACH ROW EXECUTE FUNCTION client_intake_private.guard_consent();

CREATE OR REPLACE FUNCTION client_intake_private.guard_receipt_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE old_metadata jsonb; new_metadata jsonb;
BEGIN
 IF TG_TABLE_NAME='client_timeline_events' THEN old_metadata:=to_jsonb(OLD)->'metadata'; new_metadata:=to_jsonb(NEW)->'metadata';
 ELSE old_metadata:=to_jsonb(OLD)->'metadata_json'; new_metadata:=to_jsonb(NEW)->'metadata_json'; END IF;
 IF TG_OP<>'INSERT' AND old_metadata->>'contract'='client-intake-completion-v1' THEN
  RAISE EXCEPTION 'Der bestätigte Abschlussnachweis ist unveränderlich' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF new_metadata->>'contract'='client-intake-completion-v1' AND (current_setting('role',true) IS DISTINCT FROM 'service_role' OR NOT EXISTS(
  SELECT 1 FROM client_intake_private.client_intake_completions c WHERE c.tenant_id=NEW.tenant_id AND c.client_id=NEW.client_id
   AND c.revision=(new_metadata->>'revision')::bigint AND c.form_hash=new_metadata->>'formHash')) THEN
  RAISE EXCEPTION 'Ein Abschlussnachweis darf nicht selbst behauptet werden' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION client_intake_private.guard_receipt_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER client_intake_timeline_receipt_guard BEFORE INSERT OR UPDATE OR DELETE ON public.client_timeline_events
 FOR EACH ROW EXECUTE FUNCTION client_intake_private.guard_receipt_event();
CREATE TRIGGER client_intake_document_receipt_guard BEFORE INSERT OR UPDATE OR DELETE ON public.client_document_events
 FOR EACH ROW EXECUTE FUNCTION client_intake_private.guard_receipt_event();
COMMIT;
