-- CP251 / W-01: additive, unapplied preparation for version-exact ambulatory handovers.
CREATE TABLE IF NOT EXISTS public.ambulatory_handovers(
 id uuid PRIMARY KEY,client_request_id uuid NOT NULL,tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
 title text NOT NULL CHECK(btrim(title)<>''),priority text NOT NULL CHECK(priority IN('normal','important','urgent','critical')),content_sha256 text NOT NULL CHECK(content_sha256~'^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL,created_by uuid NOT NULL,created_by_name text NOT NULL CHECK(btrim(created_by_name)<>''),request_fingerprint text NOT NULL CHECK(request_fingerprint~'^[0-9a-f]{32}$'),
 UNIQUE(tenant_id,client_request_id),UNIQUE(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS public.ambulatory_handover_changes(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,handover_id uuid NOT NULL REFERENCES public.ambulatory_handovers(id) ON DELETE RESTRICT,position_no integer NOT NULL CHECK(position_no>=1),
 source_type text NOT NULL CHECK(btrim(source_type)<>''),source_entity_id uuid NOT NULL,source_version_id uuid NOT NULL,occurred_at timestamptz NOT NULL,summary text NOT NULL CHECK(btrim(summary)<>''),record_locator text NOT NULL CHECK(btrim(record_locator)<>''),source_sha256 text NOT NULL CHECK(source_sha256~'^[0-9a-f]{64}$'),
 UNIQUE(handover_id,position_no),UNIQUE(handover_id,id)
);
CREATE TABLE IF NOT EXISTS public.ambulatory_handover_consequences(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,handover_id uuid NOT NULL REFERENCES public.ambulatory_handovers(id) ON DELETE RESTRICT,position_no integer NOT NULL CHECK(position_no>=1),
 native_task_id uuid NOT NULL,title text NOT NULL CHECK(btrim(title)<>''),responsibility_id uuid NOT NULL,responsibility_name text NOT NULL CHECK(btrim(responsibility_name)<>''),due_at timestamptz NOT NULL,priority text NOT NULL CHECK(priority IN('normal','important','urgent','critical')),consequence text NOT NULL CHECK(btrim(consequence)<>''),source_change_ids uuid[] NOT NULL CHECK(cardinality(source_change_ids)>0),
 UNIQUE(handover_id,position_no),UNIQUE(handover_id,id)
);
CREATE TABLE IF NOT EXISTS public.ambulatory_handover_recipients(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,handover_id uuid NOT NULL REFERENCES public.ambulatory_handovers(id) ON DELETE RESTRICT,position_no integer NOT NULL CHECK(position_no>=1),
 profile_id uuid NOT NULL,name text NOT NULL CHECK(btrim(name)<>''),role_snapshot text NOT NULL CHECK(btrim(role_snapshot)<>''),responsibility text NOT NULL CHECK(btrim(responsibility)<>''),
 UNIQUE(handover_id,position_no),UNIQUE(handover_id,id),UNIQUE(handover_id,profile_id)
);
CREATE TABLE IF NOT EXISTS public.ambulatory_handover_acknowledgements(
 id uuid PRIMARY KEY,client_request_id uuid NOT NULL,tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,handover_id uuid NOT NULL REFERENCES public.ambulatory_handovers(id) ON DELETE RESTRICT,recipient_id uuid NOT NULL REFERENCES public.ambulatory_handover_recipients(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL,actor_name text NOT NULL CHECK(btrim(actor_name)<>''),acknowledged_at timestamptz NOT NULL,content_sha256 text NOT NULL CHECK(content_sha256~'^[0-9a-f]{64}$'),acknowledged_change_ids uuid[] NOT NULL CHECK(cardinality(acknowledged_change_ids)>0),acknowledged_consequence_ids uuid[] NOT NULL CHECK(cardinality(acknowledged_consequence_ids)>0),statement text NOT NULL CHECK(btrim(statement)<>''),request_fingerprint text NOT NULL CHECK(request_fingerprint~'^[0-9a-f]{32}$'),
 UNIQUE(tenant_id,client_request_id),UNIQUE(handover_id,recipient_id),UNIQUE(handover_id,id)
);

ALTER TABLE public.ambulatory_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulatory_handover_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulatory_handover_consequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulatory_handover_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulatory_handover_acknowledgements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ambulatory_handovers,public.ambulatory_handover_changes,public.ambulatory_handover_consequences,public.ambulatory_handover_recipients,public.ambulatory_handover_acknowledgements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ambulatory_handovers,public.ambulatory_handover_changes,public.ambulatory_handover_consequences,public.ambulatory_handover_recipients,public.ambulatory_handover_acknowledgements TO authenticated;
CREATE POLICY ambulatory_handovers_read ON public.ambulatory_handovers FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.handovers.view'));
CREATE POLICY ambulatory_handover_changes_read ON public.ambulatory_handover_changes FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.handovers.view'));
CREATE POLICY ambulatory_handover_consequences_read ON public.ambulatory_handover_consequences FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.handovers.view'));
CREATE POLICY ambulatory_handover_recipients_read ON public.ambulatory_handover_recipients FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.handovers.view'));
CREATE POLICY ambulatory_handover_acknowledgements_read ON public.ambulatory_handover_acknowledgements FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.handovers.view'));

CREATE OR REPLACE FUNCTION care_private.protect_ambulatory_handover_history()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN RAISE EXCEPTION 'Übergabehistorie bleibt append-only.' USING ERRCODE='42501';END$$;
CREATE TRIGGER protect_ambulatory_handovers BEFORE UPDATE OR DELETE ON public.ambulatory_handovers FOR EACH ROW EXECUTE FUNCTION care_private.protect_ambulatory_handover_history();
CREATE TRIGGER protect_ambulatory_handover_changes BEFORE UPDATE OR DELETE ON public.ambulatory_handover_changes FOR EACH ROW EXECUTE FUNCTION care_private.protect_ambulatory_handover_history();
CREATE TRIGGER protect_ambulatory_handover_consequences BEFORE UPDATE OR DELETE ON public.ambulatory_handover_consequences FOR EACH ROW EXECUTE FUNCTION care_private.protect_ambulatory_handover_history();
CREATE TRIGGER protect_ambulatory_handover_recipients BEFORE UPDATE OR DELETE ON public.ambulatory_handover_recipients FOR EACH ROW EXECUTE FUNCTION care_private.protect_ambulatory_handover_history();
CREATE TRIGGER protect_ambulatory_handover_acknowledgements BEFORE UPDATE OR DELETE ON public.ambulatory_handover_acknowledgements FOR EACH ROW EXECUTE FUNCTION care_private.protect_ambulatory_handover_history();

CREATE OR REPLACE FUNCTION public.create_ambulatory_handover(p_payload jsonb,p_client_request_id uuid)RETURNS public.ambulatory_handovers
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();actor_name text:=public.clinical_actor_name();actual_time timestamptz:=clock_timestamp();result public.ambulatory_handovers;prior public.ambulatory_handovers;root_fp text;item record;change_ids uuid[];source_ids uuid[];
BEGIN
 IF t IS NULL OR actor IS NULL OR NOT public.has_permission('pflege.handovers.manage')THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501';END IF;
 IF p_payload IS NULL OR p_client_request_id IS NULL OR p_payload->>'clientRequestId' IS DISTINCT FROM p_client_request_id::text OR jsonb_typeof(p_payload->'changes')<>'array' OR jsonb_array_length(p_payload->'changes')<1 OR jsonb_typeof(p_payload->'openConsequences')<>'array' OR jsonb_array_length(p_payload->'openConsequences')<1 OR jsonb_typeof(p_payload->'recipients')<>'array' OR jsonb_array_length(p_payload->'recipients')<1 OR jsonb_array_length(COALESCE(p_payload->'acknowledgements','[]'::jsonb))<>0 OR COALESCE(p_payload->>'contentSha256','')!~'^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Übergabe ist unvollständig oder nimmt einen Empfang vorweg.' USING ERRCODE='23514';END IF;
 IF(p_payload->>'tenantId')::uuid IS DISTINCT FROM t OR(p_payload->>'createdBy')::uuid IS DISTINCT FROM actor OR btrim(p_payload->>'createdByName')IS DISTINCT FROM btrim(actor_name)OR(p_payload->>'createdAt')::timestamptz>actual_time THEN RAISE EXCEPTION 'Mandant, Person oder Zeitfolge ist widersprüchlich.' USING ERRCODE='23514';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=(p_payload->>'clientId')::uuid AND c.tenant_id=t)THEN RAISE EXCEPTION 'Pflegefall gehört nicht zum Mandanten.' USING ERRCODE='42501';END IF;
 root_fp:=md5(p_payload::text);PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext(p_client_request_id::text));
 SELECT*INTO prior FROM public.ambulatory_handovers WHERE tenant_id=t AND client_request_id=p_client_request_id;
 IF FOUND THEN IF prior.id IS DISTINCT FROM(p_payload->>'handoverId')::uuid OR prior.request_fingerprint IS DISTINCT FROM root_fp THEN RAISE EXCEPTION 'Anfrage-ID wurde anders verwendet.' USING ERRCODE='40001';END IF;RETURN prior;END IF;
 INSERT INTO public.ambulatory_handovers(id,client_request_id,tenant_id,client_id,title,priority,content_sha256,created_at,created_by,created_by_name,request_fingerprint)VALUES((p_payload->>'handoverId')::uuid,p_client_request_id,t,(p_payload->>'clientId')::uuid,btrim(p_payload->>'title'),p_payload->>'priority',p_payload->>'contentSha256',(p_payload->>'createdAt')::timestamptz,actor,actor_name,root_fp)RETURNING*INTO result;
 FOR item IN SELECT value,ordinality FROM jsonb_array_elements(p_payload->'changes')WITH ORDINALITY LOOP
  IF COALESCE(item.value->>'sourceSha256','')!~'^[0-9a-f]{64}$'OR btrim(COALESCE(item.value->>'summary',''))=''OR(item.value->>'occurredAt')::timestamptz>actual_time THEN RAISE EXCEPTION 'Relevante Änderung ist unvollständig.' USING ERRCODE='23514';END IF;
  INSERT INTO public.ambulatory_handover_changes(id,tenant_id,handover_id,position_no,source_type,source_entity_id,source_version_id,occurred_at,summary,record_locator,source_sha256)VALUES((item.value->>'changeId')::uuid,t,result.id,item.ordinality,btrim(item.value->>'sourceType'),(item.value->>'sourceEntityId')::uuid,(item.value->>'sourceVersionId')::uuid,(item.value->>'occurredAt')::timestamptz,btrim(item.value->>'summary'),btrim(item.value->>'recordLocator'),item.value->>'sourceSha256');
 END LOOP;
 SELECT array_agg(id)INTO change_ids FROM public.ambulatory_handover_changes WHERE tenant_id=t AND handover_id=result.id;
 FOR item IN SELECT value,ordinality FROM jsonb_array_elements(p_payload->'openConsequences')WITH ORDINALITY LOOP
  source_ids:=ARRAY(SELECT jsonb_array_elements_text(item.value->'sourceChangeIds')::uuid);IF cardinality(source_ids)<1 OR EXISTS(SELECT 1 FROM unnest(source_ids)s WHERE NOT s=ANY(change_ids))OR(item.value->>'dueAt')::timestamptz<=result.created_at THEN RAISE EXCEPTION 'Offene Folge muss eine Änderung und spätere Aufgabenfrist referenzieren.' USING ERRCODE='23514';END IF;
  INSERT INTO public.ambulatory_handover_consequences(id,tenant_id,handover_id,position_no,native_task_id,title,responsibility_id,responsibility_name,due_at,priority,consequence,source_change_ids)VALUES((item.value->>'consequenceId')::uuid,t,result.id,item.ordinality,(item.value->>'nativeTaskId')::uuid,btrim(item.value->>'title'),(item.value->>'responsibilityId')::uuid,btrim(item.value->>'responsibilityName'),(item.value->>'dueAt')::timestamptz,item.value->>'priority',btrim(item.value->>'consequence'),source_ids);
 END LOOP;
 FOR item IN SELECT value,ordinality FROM jsonb_array_elements(p_payload->'recipients')WITH ORDINALITY LOOP INSERT INTO public.ambulatory_handover_recipients(id,tenant_id,handover_id,position_no,profile_id,name,role_snapshot,responsibility)VALUES((item.value->>'recipientId')::uuid,t,result.id,item.ordinality,(item.value->>'profileId')::uuid,btrim(item.value->>'name'),btrim(item.value->>'roleSnapshot'),btrim(item.value->>'responsibility'));END LOOP;
 INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)VALUES(t,result.client_id,'ambulatory_handover',result.id,'created','Übergabe als exakte Fassung mit Änderungen, offenen Folgen und benannten Empfängern erstellt; kein Auftrag wurde erledigt.',to_jsonb(result),actor,actor_name);RETURN result;
END$$;

CREATE OR REPLACE FUNCTION public.acknowledge_ambulatory_handover(p_handover_id uuid,p_recipient_id uuid,p_acknowledgement_id uuid,p_client_request_id uuid,p_content_sha256 text,p_change_ids uuid[],p_consequence_ids uuid[],p_statement text)RETURNS public.ambulatory_handover_acknowledgements
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();actor_name text:=public.clinical_actor_name();h public.ambulatory_handovers;r public.ambulatory_handover_recipients;result public.ambulatory_handover_acknowledgements;expected_changes uuid[];expected_consequences uuid[];fp text:=md5(jsonb_build_array(p_handover_id,p_recipient_id,p_content_sha256,p_change_ids,p_consequence_ids,p_statement)::text);
BEGIN
 IF t IS NULL OR actor IS NULL OR NOT public.has_permission('pflege.handovers.manage')THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext(p_handover_id::text));SELECT*INTO h FROM public.ambulatory_handovers WHERE id=p_handover_id AND tenant_id=t;SELECT*INTO r FROM public.ambulatory_handover_recipients WHERE id=p_recipient_id AND handover_id=p_handover_id AND tenant_id=t;
 IF h.id IS NULL OR r.id IS NULL OR r.profile_id IS DISTINCT FROM actor OR btrim(r.name)IS DISTINCT FROM btrim(actor_name)THEN RAISE EXCEPTION 'Nur die benannte native Empfangsperson darf quittieren.' USING ERRCODE='42501';END IF;
 SELECT array_agg(id ORDER BY id)INTO expected_changes FROM public.ambulatory_handover_changes WHERE handover_id=h.id;SELECT array_agg(id ORDER BY id)INTO expected_consequences FROM public.ambulatory_handover_consequences WHERE handover_id=h.id;
 IF p_content_sha256 IS DISTINCT FROM h.content_sha256 OR(SELECT array_agg(v ORDER BY v)FROM unnest(p_change_ids)v)IS DISTINCT FROM expected_changes OR(SELECT array_agg(v ORDER BY v)FROM unnest(p_consequence_ids)v)IS DISTINCT FROM expected_consequences OR btrim(COALESCE(p_statement,''))=''THEN RAISE EXCEPTION 'Empfang muss die exakte Fassung, alle Änderungen und alle offenen Folgen bestätigen.' USING ERRCODE='23514';END IF;
 SELECT*INTO result FROM public.ambulatory_handover_acknowledgements WHERE tenant_id=t AND client_request_id=p_client_request_id;IF FOUND THEN IF result.request_fingerprint IS DISTINCT FROM fp THEN RAISE EXCEPTION 'Empfangsanfrage wurde anders verwendet.' USING ERRCODE='40001';END IF;RETURN result;END IF;
 INSERT INTO public.ambulatory_handover_acknowledgements(id,client_request_id,tenant_id,handover_id,recipient_id,actor_id,actor_name,acknowledged_at,content_sha256,acknowledged_change_ids,acknowledged_consequence_ids,statement,request_fingerprint)VALUES(p_acknowledgement_id,p_client_request_id,t,h.id,r.id,actor,actor_name,clock_timestamp(),h.content_sha256,p_change_ids,p_consequence_ids,btrim(p_statement),fp)RETURNING*INTO result;
 INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)VALUES(t,h.client_id,'ambulatory_handover',h.id,'recipient_acknowledged','Benannte Person hat exakt diese Übergabefassung samt allen offenen Folgen empfangen; Aufgabenabschluss und klinische Durchführung werden nicht abgeleitet.',to_jsonb(result),actor,actor_name);RETURN result;
END$$;
REVOKE ALL ON FUNCTION public.create_ambulatory_handover(jsonb,uuid),public.acknowledge_ambulatory_handover(uuid,uuid,uuid,uuid,text,uuid[],uuid[],text)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_ambulatory_handover(jsonb,uuid),public.acknowledge_ambulatory_handover(uuid,uuid,uuid,uuid,text,uuid[],uuid[],text)TO authenticated;
