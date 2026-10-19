-- CareSuite+ ambulant: S-01..S-10 connected Web/Desktop visit execution proposal.
-- Prepared only. Apply solely in an isolated approved environment after native-writer,
-- RLS, grant, trigger, lock, rollback, parallel-request and PostgREST verification.

CREATE SCHEMA IF NOT EXISTS care_private;

CREATE TABLE IF NOT EXISTS care_private.visit_execution_roots (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 stop_id uuid NOT NULL REFERENCES public.care_tour_stops(id) ON DELETE RESTRICT,
 head_event_id uuid, event_count integer NOT NULL DEFAULT 0 CHECK(event_count>=0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,stop_id)
);
CREATE TABLE IF NOT EXISTS care_private.visit_execution_events (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 stop_id uuid NOT NULL REFERENCES public.care_tour_stops(id) ON DELETE RESTRICT,
 sequence_no integer NOT NULL CHECK(sequence_no>0), previous_id uuid,
 request_id uuid NOT NULL, actor_id uuid NOT NULL, actor_name text NOT NULL,
 kind text NOT NULL CHECK(kind IN('open','time','task','unreachable','proof','confirm','correct','complete','emergency')),
 occurred_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 command jsonb NOT NULL CHECK(jsonb_typeof(command)='object'),
 source_fingerprint text NOT NULL,
 UNIQUE(tenant_id,stop_id,sequence_no), UNIQUE(tenant_id,stop_id,request_id)
);
CREATE TABLE IF NOT EXISTS care_private.visit_execution_receipts (
 tenant_id uuid NOT NULL, stop_id uuid NOT NULL, request_id uuid NOT NULL,
 actor_id uuid NOT NULL, command jsonb NOT NULL, receipt jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,stop_id,request_id)
);
ALTER TABLE care_private.visit_execution_roots ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_private.visit_execution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_private.visit_execution_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON care_private.visit_execution_roots,care_private.visit_execution_events,care_private.visit_execution_receipts FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION care_private.guard_visit_execution_immutable() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN RAISE EXCEPTION 'Gebundene Einsatzoriginale sind append-only.' USING ERRCODE='42501';END$$;
DROP TRIGGER IF EXISTS visit_execution_events_immutable ON care_private.visit_execution_events;
CREATE TRIGGER visit_execution_events_immutable BEFORE UPDATE OR DELETE ON care_private.visit_execution_events FOR EACH ROW EXECUTE FUNCTION care_private.guard_visit_execution_immutable();
DROP TRIGGER IF EXISTS visit_execution_receipts_immutable ON care_private.visit_execution_receipts;
CREATE TRIGGER visit_execution_receipts_immutable BEFORE UPDATE OR DELETE ON care_private.visit_execution_receipts FOR EACH ROW EXECUTE FUNCTION care_private.guard_visit_execution_immutable();

CREATE OR REPLACE FUNCTION care_private.visit_actor(p_tenant uuid,p_actor uuid,p_write boolean,p_proof boolean DEFAULT false) RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE n text;BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor OR public.current_tenant_id() IS DISTINCT FROM p_tenant THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501';END IF;
 IF NOT public.has_permission('pflege.plans.view') OR NOT public.has_permission('pflege.risks.view') OR NOT public.has_permission('pflege.proofs.view') OR NOT public.has_permission('office.clients.view') OR NOT public.has_permission('office.clients.view_sensitive') OR p_write AND NOT public.has_permission(CASE WHEN p_proof THEN 'pflege.proofs.create' ELSE 'pflege.plans.manage' END) THEN RAISE EXCEPTION 'Aktuelles Einsatzrecht fehlt.' USING ERRCODE='42501';END IF;
 n:=NULLIF(public.clinical_actor_name(),''); IF n IS NULL THEN RAISE EXCEPTION 'Aktive Akteursidentität fehlt.' USING ERRCODE='42501';END IF; RETURN n;
END$$;

CREATE OR REPLACE FUNCTION care_private.visit_sources(p_tenant uuid,p_stop uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE s public.care_tour_stops;tr public.care_tours;a public.care_admissions;cp public.care_plans;admission_count integer;plan_count integer;BEGIN
 SELECT * INTO s FROM public.care_tour_stops WHERE tenant_id=p_tenant AND id=p_stop; IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden.' USING ERRCODE='42501';END IF;
 SELECT * INTO tr FROM public.care_tours WHERE tenant_id=p_tenant AND id=s.tour_id; IF NOT FOUND THEN RAISE EXCEPTION 'Tourfassung fehlt.' USING ERRCODE='40001';END IF;
 SELECT count(*) INTO admission_count FROM public.care_admissions WHERE tenant_id=p_tenant AND client_id=s.client_id AND status IN('active','closed') AND starts_on<=tr.tour_date AND(ends_on IS NULL OR ends_on>=tr.tour_date) AND(s.admission_id IS NULL OR id=s.admission_id);
 IF admission_count<>1 THEN RAISE EXCEPTION 'Für den Einsatz muss genau eine gültige Aufnahmefassung vorliegen.' USING ERRCODE='23514';END IF;
 SELECT * INTO a FROM public.care_admissions WHERE tenant_id=p_tenant AND client_id=s.client_id AND status IN('active','closed') AND starts_on<=tr.tour_date AND(ends_on IS NULL OR ends_on>=tr.tour_date) AND(s.admission_id IS NULL OR id=s.admission_id) ORDER BY starts_on DESC,id DESC LIMIT 1;
 SELECT count(*) INTO plan_count FROM public.care_plans WHERE tenant_id=p_tenant AND client_id=s.client_id AND status IN('active','aktiv') AND valid_from<=tr.tour_date AND(valid_until IS NULL OR valid_until>=tr.tour_date);
 IF plan_count<>1 THEN RAISE EXCEPTION 'Für den Einsatz muss genau eine gültige aktive Pflegeplanfassung vorliegen.' USING ERRCODE='23514';END IF;
 SELECT * INTO cp FROM public.care_plans WHERE tenant_id=p_tenant AND client_id=s.client_id AND status IN('active','aktiv') AND valid_from<=tr.tour_date AND(valid_until IS NULL OR valid_until>=tr.tour_date) ORDER BY updated_at DESC,id DESC LIMIT 1;
 RETURN jsonb_build_array(
  jsonb_build_object('kind','stop','id',s.id,'snapshot',to_jsonb(s)),
  jsonb_build_object('kind','tour','id',tr.id,'snapshot',to_jsonb(tr)),
  jsonb_build_object('kind','admission','id',a.id,'snapshot',to_jsonb(a)),
  jsonb_build_object('kind','care_plan','id',cp.id,'snapshot',to_jsonb(cp))
 ) || COALESCE((SELECT jsonb_agg(jsonb_build_object('kind','task','id',i.id,'snapshot',to_jsonb(i)) ORDER BY i.id) FROM public.care_plan_items i WHERE i.tenant_id=p_tenant AND i.care_plan_id=cp.id),'[]'::jsonb)
   || COALESCE((SELECT jsonb_agg(jsonb_build_object('kind','service','id',i.id,'snapshot',to_jsonb(i)) ORDER BY i.id) FROM public.care_plan_items i WHERE i.tenant_id=p_tenant AND i.care_plan_id=cp.id),'[]'::jsonb)
   || COALESCE((SELECT jsonb_agg(jsonb_build_object('kind','tariff','id',t.id,'snapshot',to_jsonb(t)) ORDER BY t.service_code,t.id) FROM public.care_tariffs t WHERE t.tenant_id=p_tenant AND t.legal_basis=a.legal_basis AND t.valid_from<=tr.tour_date AND(t.valid_until IS NULL OR t.valid_until>=tr.tour_date) AND(t.payer_ik='' OR t.payer_ik=a.payer_ik)),'[]'::jsonb)
   || COALESCE((SELECT jsonb_agg(jsonb_build_object('kind','contact','id',c.id,'snapshot',to_jsonb(c)) ORDER BY c.id) FROM public.client_contacts c WHERE c.tenant_id=p_tenant AND c.client_id=s.client_id),'[]'::jsonb)
   || COALESCE((SELECT jsonb_agg(jsonb_build_object('kind','risk','id',r.id,'snapshot',to_jsonb(r)) ORDER BY r.updated_at,r.id) FROM public.client_risks r WHERE r.tenant_id=p_tenant AND r.client_id=s.client_id),'[]'::jsonb);
END$$;

CREATE OR REPLACE FUNCTION care_private.visit_history(p_tenant uuid,p_stop uuid) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('version','2026-10-16.1','tenantId',p_tenant,'stopId',p_stop,'count',r.event_count,'headId',r.head_event_id,
  'events',COALESCE(jsonb_agg(jsonb_build_object('id',e.id,'sequence',e.sequence_no,'previousId',e.previous_id,'tenantId',e.tenant_id,'stopId',e.stop_id,'actorId',e.actor_id,'actorName',e.actor_name,'recordedAt',e.recorded_at,'command',e.command) ORDER BY e.sequence_no) FILTER(WHERE e.id IS NOT NULL),'[]'::jsonb))
 FROM care_private.visit_execution_roots r LEFT JOIN care_private.visit_execution_events e ON e.tenant_id=r.tenant_id AND e.stop_id=r.stop_id WHERE r.tenant_id=p_tenant AND r.stop_id=p_stop GROUP BY r.tenant_id,r.stop_id,r.event_count,r.head_event_id
$$;

CREATE OR REPLACE FUNCTION care_private.visit_stops(p_tenant uuid,p_actor uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE ignored text;BEGIN ignored:=care_private.visit_actor(p_tenant,p_actor,false);RETURN jsonb_build_object('version','2026-10-16.1','tenantId',p_tenant,'actorId',p_actor,'count',(SELECT count(*) FROM public.care_tour_stops s JOIN public.care_tours t ON t.id=s.tour_id AND t.tenant_id=s.tenant_id WHERE s.tenant_id=p_tenant AND s.status<>'cancelled' AND t.status<>'cancelled' AND(public.has_permission('pflege.proofs.review') OR t.employee_id IN(SELECT e.id FROM public.employees e JOIN public.profiles p ON p.id=e.profile_id AND p.tenant_id=e.tenant_id WHERE e.tenant_id=p_tenant AND e.profile_id=p_actor AND e.status='aktiv' AND p.is_active))),
 'stops',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY t.tour_date,s.planned_start,s.sequence_no,s.id) FROM public.care_tour_stops s JOIN public.care_tours t ON t.id=s.tour_id AND t.tenant_id=s.tenant_id WHERE s.tenant_id=p_tenant AND s.status<>'cancelled' AND t.status<>'cancelled' AND(public.has_permission('pflege.proofs.review') OR t.employee_id IN(SELECT e.id FROM public.employees e JOIN public.profiles p ON p.id=e.profile_id AND p.tenant_id=e.tenant_id WHERE e.tenant_id=p_tenant AND e.profile_id=p_actor AND e.status='aktiv' AND p.is_active))),'[]'::jsonb));END$$;

CREATE OR REPLACE FUNCTION care_private.visit_context(p_tenant uuid,p_stop uuid,p_actor uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE ignored text;s public.care_tour_stops;tr public.care_tours;src jsonb;hist jsonb;people jsonb;BEGIN
 ignored:=care_private.visit_actor(p_tenant,p_actor,false);SELECT * INTO s FROM public.care_tour_stops WHERE tenant_id=p_tenant AND id=p_stop;IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden.' USING ERRCODE='42501';END IF;
 SELECT * INTO tr FROM public.care_tours WHERE tenant_id=p_tenant AND id=s.tour_id;IF NOT FOUND THEN RAISE EXCEPTION 'Tourfassung fehlt.' USING ERRCODE='40001';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.id=tr.employee_id AND e.tenant_id=p_tenant AND e.profile_id=p_actor AND e.status='aktiv') AND NOT public.has_permission('pflege.proofs.review') THEN RAISE EXCEPTION 'Einsatz ist diesem Konto nicht aktuell zugeordnet.' USING ERRCODE='42501';END IF;
 INSERT INTO care_private.visit_execution_roots(tenant_id,stop_id) VALUES(p_tenant,p_stop) ON CONFLICT DO NOTHING;src:=care_private.visit_sources(p_tenant,p_stop);hist:=care_private.visit_history(p_tenant,p_stop);
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',p.id,'profileId',p.id,'tenantId',p.tenant_id,'name',concat_ws(' ',e.first_name,e.last_name),'roleKey',coalesce(p.role_key,'unassigned'),'active',true,'updatedAt',to_char(greatest(e.updated_at,p.updated_at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) ORDER BY e.id),'[]'::jsonb) INTO people FROM public.employees e JOIN public.profiles p ON p.id=e.profile_id AND p.tenant_id=e.tenant_id WHERE e.tenant_id=p_tenant AND e.id=tr.employee_id AND e.status='aktiv' AND p.is_active;
 RETURN jsonb_build_object('version','2026-10-16.1','tenantId',p_tenant,'stopId',p_stop,'actorId',p_actor,'loadedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'stop',to_jsonb(s),'sources',jsonb_build_object('count',jsonb_array_length(src),'rows',src),'people',jsonb_build_object('count',jsonb_array_length(people),'rows',people),'history',hist);
END$$;

CREATE OR REPLACE FUNCTION care_private.commit_visit_execution(p_command jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE t uuid:=(p_command->>'tenantId')::uuid;s uuid:=(p_command->>'stopId')::uuid;a uuid:=(p_command->>'actorId')::uuid;r uuid:=(p_command->>'requestId')::uuid;e uuid:=(p_command->>'eventId')::uuid;k text:=p_command->>'kind';expected uuid:=NULLIF(p_command->>'expectedHeadId','')::uuid;root care_private.visit_execution_roots;existing care_private.visit_execution_receipts;actor text;seq integer;actual timestamptz;receipt jsonb;src jsonb;BEGIN
 IF p_command->>'version'<>'2026-10-16.1' OR jsonb_typeof(p_command->'payload')<>'object' OR k NOT IN('open','time','task','unreachable','proof','confirm','correct','complete','emergency') OR r=e THEN RAISE EXCEPTION 'Einsatzanfrage ist ungültig.' USING ERRCODE='23514';END IF;
 actor:=care_private.visit_actor(t,a,true,k IN('proof','confirm'));PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext(s::text));SELECT * INTO existing FROM care_private.visit_execution_receipts WHERE tenant_id=t AND stop_id=s AND request_id=r;IF FOUND THEN IF existing.actor_id IS DISTINCT FROM a OR existing.command IS DISTINCT FROM p_command THEN RAISE EXCEPTION 'Diese Anfrage wurde bereits anders verwendet.' USING ERRCODE='40001';END IF;RETURN existing.receipt;END IF;
 PERFORM 1 FROM public.care_tour_stops ss JOIN public.care_tours tt ON tt.id=ss.tour_id AND tt.tenant_id=ss.tenant_id WHERE ss.tenant_id=t AND ss.id=s AND ss.status<>'cancelled' AND tt.status<>'cancelled' AND(public.has_permission('pflege.proofs.review') OR tt.employee_id IN(SELECT emp.id FROM public.employees emp JOIN public.profiles p ON p.id=emp.profile_id AND p.tenant_id=emp.tenant_id WHERE emp.tenant_id=t AND emp.profile_id=a AND emp.status='aktiv' AND p.is_active)) FOR UPDATE OF ss;IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz ist diesem Konto nicht aktuell zugeordnet.' USING ERRCODE='42501';END IF;
 INSERT INTO care_private.visit_execution_roots(tenant_id,stop_id) VALUES(t,s) ON CONFLICT DO NOTHING;SELECT * INTO root FROM care_private.visit_execution_roots WHERE tenant_id=t AND stop_id=s FOR UPDATE;IF root.head_event_id IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Einsatz wurde parallel geändert.' USING ERRCODE='40001';END IF;
 src:=care_private.visit_sources(t,s);IF k='open' AND EXISTS(SELECT 1 FROM care_private.visit_execution_events x WHERE x.tenant_id=t AND x.stop_id=s) THEN RAISE EXCEPTION 'Einsatz wurde bereits geöffnet.' USING ERRCODE='40001';END IF;
 IF k<>'open' AND NOT EXISTS(SELECT 1 FROM care_private.visit_execution_events x WHERE x.tenant_id=t AND x.stop_id=s AND x.kind='open') THEN RAISE EXCEPTION 'Bestätigte Einsatzöffnung fehlt.' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM care_private.visit_execution_events x WHERE x.tenant_id=t AND x.stop_id=s AND x.kind='complete') THEN RAISE EXCEPTION 'Abgeschlossener Einsatz ist unveränderlich.' USING ERRCODE='40001';END IF;
 IF k='complete' AND EXISTS(SELECT 1 FROM care_private.visit_execution_events x WHERE x.tenant_id=t AND x.stop_id=s AND x.kind='emergency' AND x.command#>>'{payload,stage}'<>'close' AND NOT EXISTS(SELECT 1 FROM care_private.visit_execution_events c WHERE c.tenant_id=t AND c.stop_id=s AND c.kind='emergency' AND c.sequence_no>x.sequence_no AND c.command#>>'{payload,stage}'='close')) THEN RAISE EXCEPTION 'Offener Notfallvorgang sperrt den Abschluss.' USING ERRCODE='23514';END IF;
 seq:=root.event_count+1;actual:=clock_timestamp();receipt:=jsonb_build_object('version','2026-10-16.1','requestId',r,'command',p_command,'event',jsonb_build_object('id',e,'sequence',seq,'previousId',expected,'tenantId',t,'stopId',s,'actorId',a,'actorName',actor,'recordedAt',actual,'command',p_command));
 INSERT INTO care_private.visit_execution_events(id,tenant_id,stop_id,sequence_no,previous_id,request_id,actor_id,actor_name,kind,occurred_at,recorded_at,command,source_fingerprint) VALUES(e,t,s,seq,expected,r,a,actor,k,(p_command->>'occurredAt')::timestamptz,actual,p_command,encode(public.digest(pg_catalog.convert_to(src::text,'UTF8'),'sha256'),'hex'));
 UPDATE care_private.visit_execution_roots SET head_event_id=e,event_count=seq,updated_at=actual WHERE tenant_id=t AND stop_id=s;INSERT INTO care_private.visit_execution_receipts(tenant_id,stop_id,request_id,actor_id,command,receipt,created_at) VALUES(t,s,r,a,p_command,receipt,actual);RETURN receipt;
END$$;

CREATE OR REPLACE FUNCTION care_private.confirm_visit_execution(p_tenant uuid,p_stop uuid,p_actor uuid,p_request uuid,p_command jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE ignored text;r care_private.visit_execution_receipts;BEGIN ignored:=care_private.visit_actor(p_tenant,p_actor,false);SELECT * INTO r FROM care_private.visit_execution_receipts WHERE tenant_id=p_tenant AND stop_id=p_stop AND request_id=p_request;IF NOT FOUND OR r.actor_id IS DISTINCT FROM p_actor OR r.command IS DISTINCT FROM p_command THEN RAISE EXCEPTION 'Passende Einsatzquittung fehlt.' USING ERRCODE='P0P01';END IF;RETURN r.receipt;END$$;

CREATE OR REPLACE FUNCTION public.web_visit_execution_stops(p_tenant_id uuid,p_actor_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.visit_stops(p_tenant_id,p_actor_id)$$;
CREATE OR REPLACE FUNCTION public.web_visit_execution_context(p_tenant_id uuid,p_actor_id uuid,p_stop_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.visit_context(p_tenant_id,p_stop_id,p_actor_id)$$;
CREATE OR REPLACE FUNCTION public.web_commit_visit_execution_event(p_command jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.commit_visit_execution(p_command)$$;
CREATE OR REPLACE FUNCTION public.web_confirm_visit_execution_event(p_tenant_id uuid,p_actor_id uuid,p_stop_id uuid,p_request_id uuid,p_command jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.confirm_visit_execution(p_tenant_id,p_stop_id,p_actor_id,p_request_id,p_command)$$;
REVOKE ALL ON FUNCTION care_private.guard_visit_execution_immutable(),care_private.visit_actor(uuid,uuid,boolean,boolean),care_private.visit_sources(uuid,uuid),care_private.visit_history(uuid,uuid),care_private.visit_stops(uuid,uuid),care_private.visit_context(uuid,uuid,uuid),care_private.commit_visit_execution(jsonb),care_private.confirm_visit_execution(uuid,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.web_visit_execution_stops(uuid,uuid),public.web_visit_execution_context(uuid,uuid,uuid),public.web_commit_visit_execution_event(jsonb),public.web_confirm_visit_execution_event(uuid,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.web_visit_execution_stops(uuid,uuid),public.web_visit_execution_context(uuid,uuid,uuid),public.web_commit_visit_execution_event(jsonb),public.web_confirm_visit_execution_event(uuid,uuid,uuid,uuid,jsonb) TO authenticated;
