BEGIN;
-- No raw audio or transcripts are stored by this migration.
CREATE TABLE IF NOT EXISTS care_security.neo_action_receipts (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id), request_id uuid NOT NULL,
 actor_user_id uuid NOT NULL, payload jsonb NOT NULL, resource_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,request_id)
);
ALTER TABLE care_security.neo_action_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON care_security.neo_action_receipts FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.neo_voice_authorize(p_tenant_id uuid,p_subject_id uuid,p_assessment_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN RETURN false; END IF;
 IF p_assessment_id IS NOT NULL THEN
  RETURN coalesce(public.has_permission('pflege.plans.view'),false)
    AND coalesce(public.has_permission('pflege.assessments.manage'),false)
    AND EXISTS(SELECT 1 FROM public.care_assessments a WHERE a.id=p_assessment_id AND a.tenant_id=p_tenant_id AND a.subject_id=p_subject_id AND a.subject_type='client' AND a.status::text IN('draft','in_progress'));
 END IF;
 RETURN coalesce(public.has_permission('office.access'),false)
   AND EXISTS(SELECT 1 FROM public.clients c WHERE c.id=p_subject_id AND c.tenant_id=p_tenant_id AND c.deleted_at IS NULL);
END $$;
REVOKE ALL ON FUNCTION public.neo_voice_authorize(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.neo_voice_authorize(uuid,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.neo_create_appointment(p_tenant_id uuid,p_request_id uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 actor_profile uuid; receipt care_security.neo_action_receipts%rowtype;
 person_id uuid; person_name text; begin_at timestamptz; finish_at timestamptz; title_value text; place_value text;
BEGIN
 IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
 OR coalesce(public.has_permission('office.appointments.edit'),false) IS NOT TRUE
 OR coalesce(public.current_portal_type(),'business')<>'business' THEN RAISE EXCEPTION 'Aktuelle Terminberechtigung erforderlich.' USING ERRCODE='42501'; END IF;
 actor_profile:=care_security.documentation_profile(p_tenant_id);
 IF actor_profile IS NULL OR care_security.documentation_actor(p_tenant_id) IS NOT TRUE THEN RAISE EXCEPTION 'Aktiver Unternehmenszugang erforderlich.' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
 OR p_payload-'title'-'startsAt'-'endsAt'-'location'-'clientId'<>'{}'::jsonb
 OR NOT p_payload ?& ARRAY['title','startsAt','endsAt','location','clientId'] THEN RAISE EXCEPTION 'Unvollständiger Terminauftrag.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(p_payload) AS entry WHERE jsonb_typeof(entry.value)<>'string') THEN RAISE EXCEPTION 'Terminangaben müssen Textwerte sein.' USING ERRCODE='22023'; END IF;
 title_value:=btrim(p_payload->>'title'); place_value:=btrim(p_payload->>'location');
 person_id:=(p_payload->>'clientId')::uuid; begin_at:=(p_payload->>'startsAt')::timestamptz; finish_at:=(p_payload->>'endsAt')::timestamptz;
 IF title_value IS NULL OR title_value='' OR length(title_value)>180 OR length(place_value)>500 OR begin_at IS NULL OR finish_at IS NULL
 OR finish_at<=begin_at OR finish_at-begin_at>interval '12 hours' THEN RAISE EXCEPTION 'Titel oder Terminzeit ungültig.' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('neo:'||p_tenant_id||':'||p_request_id,0));
 SELECT * INTO receipt FROM care_security.neo_action_receipts r WHERE r.tenant_id=p_tenant_id AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id<>auth.uid() OR receipt.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Die Anfragekennung gehört zu einem anderen Auftrag.' USING ERRCODE='23514'; END IF;
  RETURN jsonb_build_object('requestId',p_request_id,'tenantId',p_tenant_id,'id',receipt.resource_id);
 END IF;
 IF begin_at<clock_timestamp()-interval '1 minute' THEN RAISE EXCEPTION 'Bitte einen zukünftigen Termin auswählen.' USING ERRCODE='23514'; END IF;
 SELECT concat_ws(' ',c.first_name,c.last_name) INTO person_name FROM public.clients c
 WHERE c.id=person_id AND c.tenant_id=p_tenant_id AND c.deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Die Person ist in diesem Unternehmen nicht verfügbar.' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.calendar_events e WHERE e.tenant_id=p_tenant_id AND e.related_client_id=person_id AND e.archived_at IS NULL
   AND e.status NOT IN('cancelled','storniert','archiviert') AND e.start_at<finish_at AND e.end_at>begin_at)
 THEN RAISE EXCEPTION 'Die Terminzeit überschneidet sich mit einem bestehenden Kalendereintrag.' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.appointments a WHERE a.id=p_request_id)
 THEN RAISE EXCEPTION 'Diese Terminidentität wird bereits verwendet.' USING ERRCODE='23514'; END IF;
 INSERT INTO public.appointments(id,tenant_id,title,client_name,location,starts_at,ends_at,status,notes)
 VALUES(p_request_id,p_tenant_id,title_value,person_name,nullif(place_value,''),begin_at,finish_at,'aktiv','Über NEO angelegt.');
 INSERT INTO public.calendar_events(tenant_id,module_key,source_type,source_id,event_type,title,start_at,end_at,timezone,related_client_id,location_name,
   is_office_visible,is_module_visible,is_client_portal_visible,is_employee_portal_visible,created_by,updated_by)
 VALUES(p_tenant_id,'office','appointment',p_request_id,'termin',title_value,begin_at,finish_at,'Europe/Berlin',person_id,nullif(place_value,''),true,true,false,false,actor_profile,actor_profile);
 INSERT INTO care_security.neo_action_receipts(tenant_id,request_id,actor_user_id,payload,resource_id)
 VALUES(p_tenant_id,p_request_id,auth.uid(),p_payload,p_request_id);
 RETURN jsonb_build_object('requestId',p_request_id,'tenantId',p_tenant_id,'id',p_request_id);
END $$;
REVOKE ALL ON FUNCTION public.neo_create_appointment(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.neo_create_appointment(uuid,uuid,jsonb) TO authenticated;
COMMIT;
