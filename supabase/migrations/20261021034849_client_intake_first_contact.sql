-- Web intake v2: all selected contracts; partial first contact; explicit draft deletion.
-- Existing/native v1 completion remains supported. No existing data is rewritten.
BEGIN;
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
 -- Prepared interest stays in the immutable intake form, never in active service/module assignments.
 IF f->>'intakeWorkflowVersion'='2' THEN contexts:=array_remove(contexts,'academy_prepared'); modules:=array_remove(modules,'akademie'); END IF;
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
 IF d.form_json->>'intakeWorkflowVersion' IS DISTINCT FROM '2' THEN
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
 END IF;
 IF d.form_json->>'intakeWorkflowVersion'='2' THEN
  IF d.form_json->>'intakeStage'='first_contact' THEN RAISE EXCEPTION 'Bitte den Erstkontakt zunächst vervollständigen'; END IF;
  expected_keys:=ARRAY['privacy_consent_default']; contract_type:=NULL; contract_key:=NULL;
  FOR key IN SELECT CASE value WHEN 'daily_assistance' THEN 'assist' WHEN 'support_care' THEN 'assist' WHEN 'companionship' THEN 'assist'
   WHEN 'ambulatory_care' THEN 'ambulatory_care' WHEN 'stationary_care' THEN 'stationary_care' WHEN 'consulting' THEN 'care_consulting' END
   FROM jsonb_array_elements_text(d.form_json->'careContexts') WITH ORDINALITY x(value,n) ORDER BY n LOOP
   IF key IS NULL THEN CONTINUE; END IF;
   IF contract_type IS NULL THEN contract_type:=key; contract_key:='client_contract_'||key; END IF;
   IF NOT ('client_contract_'||key)=ANY(expected_keys) THEN expected_keys:=array_append(expected_keys,'client_contract_'||key); END IF;
  END LOOP;
  IF contract_type IS NULL THEN RAISE EXCEPTION 'Für diese Auswahl ist noch kein Aufnahmevertrag verfügbar'; END IF;
 END IF;
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


CREATE OR REPLACE FUNCTION public.client_intake_load_draft(p_tenant uuid,p_client uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_draft public.client_intake_drafts%ROWTYPE; v_client_updated timestamptz;
BEGIN
 IF p_tenant IS DISTINCT FROM public.current_tenant_id() OR NOT coalesce(public.is_internal_tenant_actor(p_tenant),false)
  OR NOT coalesce(public.has_permission('office.clients.create'),false) OR NOT coalesce(public.has_permission('office.clients.view'),false)
  OR NOT coalesce(public.has_permission('office.clients.view_sensitive'),false) THEN RAISE EXCEPTION 'Keine Berechtigung für diesen Aufnahmeentwurf' USING ERRCODE='42501'; END IF;
 PERFORM client_intake_private.client_intake_actor(p_tenant,auth.uid());
 IF EXISTS(SELECT 1 FROM public.clients WHERE tenant_id=p_tenant AND id=p_client AND (status='deleted' OR deleted_at IS NOT NULL)) THEN
  RAISE EXCEPTION 'Dieser Aufnahmeentwurf wurde gelöscht' USING ERRCODE='P0002'; END IF;
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

CREATE OR REPLACE FUNCTION public.client_intake_delete_draft(p_tenant uuid,p_client uuid,p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid; c public.clients%ROWTYPE; d public.client_intake_drafts%ROWTYPE;
BEGIN
 IF p_tenant IS DISTINCT FROM public.current_tenant_id() OR NOT coalesce(public.is_internal_tenant_actor(p_tenant),false)
  OR NOT coalesce(public.has_permission('office.clients.delete'),false) THEN RAISE EXCEPTION 'Keine Berechtigung zum Löschen von Aufnahmeentwürfen' USING ERRCODE='42501'; END IF;
 actor:=client_intake_private.client_intake_actor(p_tenant,auth.uid());
 IF p_client IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 THEN RAISE EXCEPTION 'Die Entwurfsfassung ist ungültig' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('client-intake:'||p_tenant::text||':'||p_client::text,0));
 SELECT * INTO d FROM public.client_intake_drafts WHERE tenant_id=p_tenant AND client_id=p_client FOR UPDATE;
 SELECT * INTO c FROM public.clients WHERE tenant_id=p_tenant AND id=p_client FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Der Aufnahmeentwurf wurde nicht gefunden' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM client_intake_private.client_intake_completions WHERE tenant_id=p_tenant AND client_id=p_client)
  OR d.status='completed' OR c.status NOT IN ('lead','deleted')
  OR EXISTS(SELECT 1 FROM public.client_document_signatures WHERE tenant_id=p_tenant AND client_id=p_client)
  OR EXISTS(SELECT 1 FROM public.client_intake_documents WHERE tenant_id=p_tenant AND client_id=p_client
   AND (status='finalized' OR finalized_at IS NOT NULL OR finalized_html IS NOT NULL)) THEN
  RAISE EXCEPTION 'Abgeschlossene Aufnahmen und gespeicherte Originale können hier nicht gelöscht werden' USING ERRCODE='42501'; END IF;
 IF c.status='deleted' AND c.deleted_at IS NOT NULL THEN
  RETURN jsonb_build_object('contract','client-intake-delete-v1','clientId',p_client,'deleted',true); END IF;
 IF coalesce(d.revision,0)<>p_expected_revision OR (d.client_id IS NOT NULL AND c.updated_at IS DISTINCT FROM d.client_updated_at) THEN
  RAISE EXCEPTION 'Der Entwurf wurde inzwischen geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
 -- Same soft-deletion convention as client records. Immutable evidence/history stays retained.
 UPDATE public.clients SET status='deleted',deleted_at=clock_timestamp(),updated_at=clock_timestamp(),updated_by=actor WHERE tenant_id=p_tenant AND id=p_client;
 UPDATE public.calendar_events SET archived_at=clock_timestamp(),status='archiviert',updated_by=actor
  WHERE tenant_id=p_tenant AND source_type='intake_appointment' AND source_id=p_client AND related_client_id=p_client AND archived_at IS NULL;
 RETURN jsonb_build_object('contract','client-intake-delete-v1','clientId',p_client,'deleted',true);
END $$;
REVOKE ALL ON FUNCTION public.client_intake_delete_draft(uuid,uuid,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.client_intake_delete_draft(uuid,uuid,bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.client_intake_first_appointment(p_tenant uuid,p_client uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE e public.calendar_events%ROWTYPE;
BEGIN
 IF p_tenant IS DISTINCT FROM public.current_tenant_id() OR NOT coalesce(public.is_internal_tenant_actor(p_tenant),false)
  OR NOT (coalesce(public.has_permission('office.appointments.view'),false) OR coalesce(public.has_permission('office.appointments.edit'),false)) THEN
  RAISE EXCEPTION 'Keine Berechtigung für diesen Ersttermin' USING ERRCODE='42501'; END IF;
 PERFORM client_intake_private.client_intake_actor(p_tenant,auth.uid());
 SELECT * INTO e FROM public.calendar_events WHERE tenant_id=p_tenant AND source_type='intake_appointment' AND source_id=p_client AND related_client_id=p_client;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('id',e.id,'startAt',e.start_at,'endAt',e.end_at,'location',coalesce(e.location_name,''),'status',CASE WHEN e.archived_at IS NOT NULL THEN 'archiviert' ELSE e.status END);
END $$;
REVOKE ALL ON FUNCTION public.client_intake_first_appointment(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.client_intake_first_appointment(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.client_intake_schedule_first_appointment(p_tenant uuid,p_client uuid,p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid; d public.client_intake_drafts%ROWTYPE; c public.clients%ROWTYPE; e public.calendar_events%ROWTYPE;
 start_local timestamp; end_local timestamp; starts timestamptz; ends timestamptz;
BEGIN
 IF p_tenant IS DISTINCT FROM public.current_tenant_id() OR NOT coalesce(public.is_internal_tenant_actor(p_tenant),false)
  OR NOT coalesce(public.has_permission('office.appointments.edit'),false) THEN RAISE EXCEPTION 'Keine Berechtigung zur Terminplanung' USING ERRCODE='42501'; END IF;
 actor:=client_intake_private.client_intake_actor(p_tenant,auth.uid());
 IF p_client IS NULL OR p_expected_revision IS NULL OR p_expected_revision<1 THEN RAISE EXCEPTION 'Die Entwurfsfassung fehlt' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('client-intake:'||p_tenant::text||':'||p_client::text,0));
 SELECT * INTO d FROM public.client_intake_drafts WHERE tenant_id=p_tenant AND client_id=p_client FOR UPDATE;
 SELECT * INTO c FROM public.clients WHERE tenant_id=p_tenant AND id=p_client FOR UPDATE;
 IF c.id IS NULL OR c.status<>'lead' OR c.deleted_at IS NOT NULL OR d.status IS DISTINCT FROM 'draft'
  OR d.revision IS DISTINCT FROM p_expected_revision OR c.updated_at IS DISTINCT FROM d.client_updated_at THEN
  RAISE EXCEPTION 'Die Aufnahme wurde inzwischen geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
 IF d.form_json->>'intakeStage' IS DISTINCT FROM 'first_contact' OR d.form_json->>'intakeAppointmentRequested' IS DISTINCT FROM 'true'
  OR nullif(btrim(d.form_json->>'lastName'),'') IS NULL
  OR coalesce(nullif(btrim(d.form_json->>'phone'),''),nullif(btrim(d.form_json->>'mobile'),''),nullif(btrim(d.form_json->>'email'),'')) IS NULL THEN
  RAISE EXCEPTION 'Name, Kontaktweg oder Terminwunsch fehlen' USING ERRCODE='22023'; END IF;
 SELECT * INTO e FROM public.calendar_events WHERE tenant_id=p_tenant AND source_type='intake_appointment' AND source_id=p_client FOR UPDATE;
 IF FOUND THEN
  IF e.related_client_id IS DISTINCT FROM p_client THEN RAISE EXCEPTION 'Die Terminzuordnung wurde geändert' USING ERRCODE='40001'; END IF;
  -- A repeat never overwrites changes made in the calendar, nor recreates an archived event.
  RETURN public.client_intake_first_appointment(p_tenant,p_client);
 END IF;
 IF coalesce(d.form_json->>'intakeAppointmentStart','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$'
  OR coalesce(d.form_json->>'intakeAppointmentEnd','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$' THEN
  RAISE EXCEPTION 'Bitte einen gültigen Terminbeginn und ein Terminende angeben' USING ERRCODE='22023'; END IF;
 start_local:=(d.form_json->>'intakeAppointmentStart')::timestamp; end_local:=(d.form_json->>'intakeAppointmentEnd')::timestamp;
 starts:=start_local AT TIME ZONE 'Europe/Berlin'; ends:=end_local AT TIME ZONE 'Europe/Berlin';
 IF starts AT TIME ZONE 'Europe/Berlin'<>start_local OR ends AT TIME ZONE 'Europe/Berlin'<>end_local OR ends<=starts
  OR (starts-interval '1 hour') AT TIME ZONE 'Europe/Berlin'=start_local OR (ends-interval '1 hour') AT TIME ZONE 'Europe/Berlin'=end_local THEN
  RAISE EXCEPTION 'Der Zeitraum ist ungültig oder wegen der Zeitumstellung nicht eindeutig. Bitte eine andere Uhrzeit wählen.' USING ERRCODE='22023'; END IF;
 INSERT INTO public.calendar_events(tenant_id,module_key,source_type,source_id,event_type,title,start_at,end_at,timezone,location_name,related_client_id,
  visibility_scope,is_office_visible,is_module_visible,is_client_portal_visible,is_employee_portal_visible,status,created_by,updated_by)
 VALUES(p_tenant,'office','intake_appointment',p_client,'termin','Ersttermin · '||btrim(coalesce(d.form_json->>'firstName','')||' '||(d.form_json->>'lastName')),
  starts,ends,'Europe/Berlin',nullif(btrim(d.form_json->>'intakeAppointmentLocation'),''),p_client,'tenant',true,false,false,false,'aktiv',actor,actor);
 RETURN public.client_intake_first_appointment(p_tenant,p_client);
END $$;
REVOKE ALL ON FUNCTION public.client_intake_schedule_first_appointment(uuid,uuid,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.client_intake_schedule_first_appointment(uuid,uuid,bigint) TO authenticated;
-- The link is stable even when the existing calendar editor changes time or location.
CREATE OR REPLACE FUNCTION client_intake_private.guard_first_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.source_type='intake_appointment' AND
  (NEW.source_type IS DISTINCT FROM OLD.source_type OR NEW.source_id IS DISTINCT FROM OLD.source_id
   OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.related_client_id IS DISTINCT FROM OLD.related_client_id) THEN
  RAISE EXCEPTION 'Die Zuordnung des Ersttermins zur Aufnahme ist unveränderlich' USING ERRCODE='42501'; END IF;
 IF NEW.source_type='intake_appointment' AND
  (NEW.source_id IS NULL OR NEW.source_id IS DISTINCT FROM NEW.related_client_id OR NEW.module_key<>'office'
   OR NEW.is_client_portal_visible OR NEW.is_employee_portal_visible OR NEW.end_at<=NEW.start_at
   OR NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=NEW.related_client_id AND c.tenant_id=NEW.tenant_id)) THEN
  RAISE EXCEPTION 'Ein Ersttermin muss intern mit seiner Aufnahme verbunden bleiben' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION client_intake_private.guard_first_appointment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER client_intake_first_appointment_guard BEFORE INSERT OR UPDATE ON public.calendar_events
 FOR EACH ROW EXECUTE FUNCTION client_intake_private.guard_first_appointment();
COMMIT;
