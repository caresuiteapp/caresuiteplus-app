-- REVIEW DRAFT ONLY, NOT APPLIED. No App change or production write.
-- Dependencies: reviewed Identity, Execution, Core RLS and ServiceRecordSealed
-- drafts, including private workflow_proof_attestations. No trusted PDF/Original
-- byte producer is implemented/claimed here. Without its receipt, fail closed.
-- Header/argument names/defaults/void result and positive Office permissions
-- remain the captured deployed API. Scoped task counterpart matching remains.
-- Proof tags/names/hashes alone cannot authorize billing readiness. Reconcile
-- cannot alter tasks underneath a signed version or reopen cancelled/no-show.
-- This narrow read-only source helper is exactly the ServiceRecord validator,
-- except it accepts a physically ended pre-completion state. No state is written
-- merely to make validation succeed; tests pin the rest of its body for parity.
BEGIN;
CREATE OR REPLACE FUNCTION public.workflow_signed_follow_up_source(t uuid,v_id uuid,p_id uuid,approved boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v public.assist_visits%ROWTYPE; p public.assist_visit_proofs%ROWTYPE;
 s public.assist_visit_signatures%ROWTYPE; doc public.assist_visit_documentation%ROWTYPE;
 snap jsonb; payload jsonb; task jsonb; r record; paused timestamptz; pause_seconds numeric:=0; seconds integer; a public.workflow_proof_attestations%ROWTYPE; result jsonb;
BEGIN
  SELECT * INTO v FROM public.assist_visits WHERE tenant_id=t AND id=v_id FOR SHARE;
  IF NOT FOUND OR COALESCE(v.canonical_status,'') NOT IN ('finished','documentation_open','signature_open','completed') OR v.actual_start_at IS NULL OR v.actual_end_at IS NULL
    OR NOT isfinite(v.actual_start_at) OR NOT isfinite(v.actual_end_at)
    OR v.actual_end_at<v.actual_start_at OR v.actual_end_at>clock_timestamp() THEN
    RAISE EXCEPTION 'Bestätigter Einsatzabschluss mit tatsächlichem Zeitpaar fehlt.';
  END IF;
  SELECT * INTO p FROM public.assist_visit_proofs WHERE tenant_id=t AND visit_id=v_id AND id=p_id FOR SHARE;
  IF NOT FOUND OR p.signature_id IS NULL OR p.status NOT IN ('pending_review','approved','exported')
    OR (approved AND (p.status NOT IN ('approved','exported') OR p.approved_at IS NULL OR p.approved_by IS NULL)) THEN
    RAISE EXCEPTION 'Bestätigter signierter Nachweis fehlt.';
  END IF;
  snap:=p.payload_snapshot;
  IF jsonb_typeof(snap)<>'object' OR p.payload_hash IS DISTINCT FROM
    'sha256:'||encode(sha256(convert_to(public.workflow_canonical_json(snap),'UTF8')),'hex')
    OR snap->>'visitId' IS DISTINCT FROM v.id::text OR snap->>'clientId' IS DISTINCT FROM v.client_id::text
    OR snap->>'employeeId' IS DISTINCT FROM v.employee_id::text
    OR (snap#>>'{visitTimes,serviceStartedAt}')::timestamptz IS DISTINCT FROM v.actual_start_at
    OR (snap#>>'{visitTimes,serviceEndedAt}')::timestamptz IS DISTINCT FROM v.actual_end_at
    OR (snap->>'plannedStartAt')::timestamptz IS DISTINCT FROM v.planned_start_at
    OR (snap->>'plannedEndAt')::timestamptz IS DISTINCT FROM v.planned_end_at THEN
    RAISE EXCEPTION 'Nachweisfassung oder tatsächliche Einsatzzeit stimmt nicht überein.';
  END IF;
  SELECT * INTO doc FROM public.assist_visit_documentation WHERE tenant_id=t AND visit_id=v_id FOR SHARE;
  SELECT * INTO s FROM public.assist_visit_signatures WHERE id=p.signature_id AND tenant_id=t AND visit_id=v_id FOR SHARE;
  IF NOT FOUND OR NOT s.is_valid OR s.invalidated_at IS NOT NULL OR NULLIF(s.storage_path,'') IS NULL
    OR COALESCE(s.signature_hash,'') !~ '^sha256:[0-9a-f]{64}$' OR doc.submitted_at IS NULL OR NULLIF(trim(doc.short_description),'') IS NULL
    OR s.signed_at<doc.submitted_at OR s.signed_at<v.actual_end_at OR s.signed_at>clock_timestamp()
    OR COALESCE(snap->>'documentationNote',snap->>'documentation') IS DISTINCT FROM trim(doc.short_description)
    OR snap#>>'{signature,signerName}' IS DISTINCT FROM s.signer_name
    OR (snap#>>'{signature,signedAt}')::timestamptz IS DISTINCT FROM s.signed_at THEN
    RAISE EXCEPTION 'Aktuelle Unterschrift und Dokumentationsfassung fehlen.';
  END IF;
  IF jsonb_typeof(snap->'tasks')<>'array' THEN RAISE EXCEPTION 'Aufgabenfassung fehlt.'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('taskId',x->>'id','status',x->>'status') ORDER BY n),'[]') INTO task
    FROM jsonb_array_elements(snap->'tasks') WITH ORDINALITY a(x,n);
  IF EXISTS((SELECT x->>'id',x->>'status' FROM jsonb_array_elements(snap->'tasks') x
      EXCEPT SELECT id::text,status::text FROM public.assist_visit_tasks WHERE tenant_id=t AND visit_id=v_id)
    UNION ALL (SELECT id::text,status::text FROM public.assist_visit_tasks WHERE tenant_id=t AND visit_id=v_id
      EXCEPT SELECT x->>'id',x->>'status' FROM jsonb_array_elements(snap->'tasks') x)) THEN
    RAISE EXCEPTION 'Aufgabenfassung wurde geändert.';
  END IF;
  payload:=jsonb_build_object('visitId',v.id,'clientId',v.client_id,'employeeId',v.employee_id,
    'plannedStartAt',snap->>'plannedStartAt','plannedEndAt',snap->>'plannedEndAt',
    'taskStatuses',task,'documentationNote',NULLIF(trim(doc.short_description),''));
  IF s.payload_hash IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(public.workflow_canonical_json(payload),'UTF8')),'hex') THEN
    RAISE EXCEPTION 'Unterschrift gehört nicht zu dieser Nachweisfassung.';
  END IF;
  -- Count every real pause once; no minimum minute, planned-time fallback or
  -- additional subtraction of an already-net serviceSeconds snapshot.
  FOR r IN SELECT event_type,occurred_at FROM public.assist_time_events WHERE tenant_id=t AND visit_id=v_id
    AND occurred_at BETWEEN v.actual_start_at AND v.actual_end_at ORDER BY occurred_at,id LOOP
    IF r.event_type='pause_start' AND paused IS NULL THEN paused:=r.occurred_at;
    ELSIF r.event_type IN ('pause_end','service_end') AND paused IS NOT NULL THEN
      pause_seconds:=pause_seconds+extract(epoch FROM r.occurred_at-paused); paused:=NULL;
    END IF;
  END LOOP;
  IF paused IS NOT NULL THEN pause_seconds:=pause_seconds+extract(epoch FROM v.actual_end_at-paused); END IF;
  seconds:=round(GREATEST(0,extract(epoch FROM v.actual_end_at-v.actual_start_at)-pause_seconds));
  IF (snap#>>'{visitTimes,serviceSeconds}')::numeric IS DISTINCT FROM seconds::numeric THEN
    RAISE EXCEPTION 'Gespeicherte Leistungsdauer entspricht nicht den vollständigen Zeitereignissen.';
  END IF;
  SELECT * INTO a FROM public.workflow_proof_attestations WHERE tenant_id=t AND visit_id=v_id AND proof_id=p_id FOR SHARE;
  IF NOT FOUND OR a.proof_payload_hash IS DISTINCT FROM p.payload_hash OR a.signature_id IS DISTINCT FROM s.id
    OR a.signature_hash IS DISTINCT FROM s.signature_hash OR a.signed_at IS DISTINCT FROM s.signed_at
    OR a.service_started_at IS DISTINCT FROM v.actual_start_at OR a.service_ended_at IS DISTINCT FROM v.actual_end_at
    OR a.actual_minutes IS DISTINCT FROM round(seconds/60.0)::integer OR a.pdf_storage_path IS DISTINCT FROM p.pdf_storage_path
    OR a.pdf_sha256 IS DISTINCT FROM p.pdf_hash OR a.verified_at<s.signed_at OR a.verified_at>clock_timestamp()
    OR a.assignment_id NOT IN (v.id,COALESCE(v.legacy_assignment_id,v.id)) OR a.producer_contract<>'verified-original-bytes-v1' THEN
    RAISE EXCEPTION 'Vertrauenswürdige Original-/PDF-Bytebestätigung fehlt; Abschlussvorbereitung ist gesperrt.'; END IF;
  RETURN jsonb_build_object('version','workflow-assignment-record-v1','tenant_id',t,'visit_id',v_id,
    'proof_id',p.id,'proof_payload_hash',p.payload_hash,'signature_id',s.id,'signature_payload_hash',s.payload_hash,
    'client_id',v.client_id,'employee_id',v.employee_id,'service_started_at',v.actual_start_at,
    'service_ended_at',v.actual_end_at,'actual_minutes',round(seconds/60.0)::integer,
    'pdf_storage_path',a.pdf_storage_path,'pdf_sha256',a.pdf_sha256,'attested_at',a.verified_at);
END $$;
REVOKE ALL ON FUNCTION public.workflow_signed_follow_up_source(uuid,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_reconcile_complete_assist_visit_follow_up(p_visit_id uuid, p_task_states jsonb, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v public.assist_visits%ROWTYPE; a public.assignments%ROWTYPE;
 v_actor uuid:=public.resolve_current_profile_id(); t uuid:=public.current_tenant_id();
 item jsonb; matched jsonb; resolved jsonb:='[]'; source_id uuid; task_id uuid; mirror_id uuid;
 task_status text; stored_status text; mapped_status text; proof_id uuid; receipt jsonb; open_titles text;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR v_actor IS NULL
   OR COALESCE(public.current_portal_type(),'business')<>'business'
   OR NOT COALESCE(public.is_internal_tenant_actor(t),FALSE)
   OR NOT (COALESCE(public.is_tenant_admin(),FALSE) OR COALESCE(public.has_permission('assist.execution.manage'),FALSE)) THEN
   RAISE EXCEPTION 'Keine Berechtigung für administrative Nachbearbeitung.' USING ERRCODE='42501'; END IF;
 IF length(trim(COALESCE(p_reason,'')))=0 THEN RAISE EXCEPTION 'Begründung ist erforderlich'; END IF;
 IF p_task_states IS NULL OR jsonb_typeof(p_task_states)<>'array' THEN RAISE EXCEPTION 'Aufgabenstatus ist ungültig'; END IF;
 SELECT * INTO v FROM public.assist_visits WHERE id=p_visit_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden'; END IF;
 IF v.canonical_status IN ('cancelled','no_show') OR v.execution_status IN ('cancelled','no_show') THEN
   RAISE EXCEPTION 'Stornierter oder nicht durchgeführter Einsatz darf nicht erneut abgeschlossen werden.'; END IF;
 SELECT * INTO a FROM public.assignments WHERE tenant_id=t AND id=COALESCE(v.legacy_assignment_id,v.id) FOR UPDATE;
 IF NOT FOUND OR a.client_id IS DISTINCT FROM v.client_id OR a.employee_id IS DISTINCT FROM v.employee_id
   OR a.actual_start_at IS DISTINCT FROM v.actual_start_at OR a.actual_end_at IS DISTINCT FROM v.actual_end_at
   OR a.status::text IN ('cancelled','no_show') OR (a.status::text='completed' AND v.canonical_status<>'completed') THEN
   RAISE EXCEPTION 'Legacy-Einsatzzuordnung oder Abschlussfassung stimmt nicht überein.'; END IF;
 IF v.actual_start_at IS NULL OR v.actual_end_at IS NULL OR NOT isfinite(v.actual_start_at) OR NOT isfinite(v.actual_end_at)
   OR v.actual_end_at<v.actual_start_at OR v.actual_end_at>clock_timestamp() THEN RAISE EXCEPTION 'Gültige Ist-Zeiten fehlen'; END IF;
 IF v.documentation_status IS DISTINCT FROM 'complete' THEN RAISE EXCEPTION 'Dokumentation ist nicht vollständig'; END IF;

 -- Validate every submitted ID/desired status and acquire all involved rowlocks
 -- BEFORE any UPDATE. A new task version needs a new signature/proof; this
 -- administrative completion is not a second unsupervised editing API.
 FOR item IN SELECT value FROM jsonb_array_elements(p_task_states) LOOP
   BEGIN source_id:=NULLIF(item->>'task_id','')::uuid;
   EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Ungültige Aufgaben-ID'; END;
   task_status:=item->>'status';
   IF source_id IS NULL OR task_status IS NULL OR task_status NOT IN ('open','done','partial','not_requested','not_possible','cancelled','deferred') THEN
     RAISE EXCEPTION 'Ungültiger Aufgabenstatus'; END IF;
   matched:=public.resolve_admin_visit_task_ids(v.id,source_id);
   task_id:=(matched->>'visit_task_id')::uuid; mirror_id:=(matched->>'assignment_task_id')::uuid;
   SELECT status INTO stored_status FROM public.assist_visit_tasks WHERE id=task_id AND tenant_id=t AND visit_id=v.id FOR UPDATE;
   IF NOT FOUND OR stored_status IS DISTINCT FROM task_status THEN
     RAISE EXCEPTION 'Aufgabenänderung benötigt eine neue unterschriebene Nachweisfassung.'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(resolved) r WHERE r->>'visit_task_id'=task_id::text) THEN
     RAISE EXCEPTION 'Aufgabenstatus darf nicht doppelt übergeben werden.'; END IF;
   IF mirror_id IS NOT NULL THEN
     PERFORM 1 FROM public.assignment_tasks WHERE id=mirror_id AND tenant_id=t AND assignment_id=a.id FOR UPDATE;
     IF NOT FOUND THEN RAISE EXCEPTION 'Aufgaben-Mirror gehört nicht zum Einsatz.'; END IF;
   END IF;
   resolved:=resolved||jsonb_build_array(jsonb_build_object('visit_task_id',task_id,'assignment_task_id',mirror_id,'status',task_status));
 END LOOP;
 SELECT string_agg(title,', ' ORDER BY sort_order) INTO open_titles FROM public.assist_visit_tasks
   WHERE tenant_id=t AND visit_id=v.id AND is_required AND status='open';
 IF open_titles IS NOT NULL THEN RAISE EXCEPTION 'Pflichtaufgaben sind noch offen: %',open_titles; END IF;
 -- Keep the legacy required-task check, evaluating the proposed exact mirror
 -- mapping without first writing it into the database.
 SELECT string_agg(x.title,', ' ORDER BY x.sort_order) INTO open_titles FROM public.assignment_tasks x
 WHERE x.tenant_id=t AND x.assignment_id=a.id AND x.is_required AND COALESCE(
   (SELECT r->>'status' FROM jsonb_array_elements(resolved) r WHERE r->>'assignment_task_id'=x.id::text),x.status::text)='open';
 IF open_titles IS NOT NULL THEN RAISE EXCEPTION 'Pflichtaufgaben sind noch offen: %',open_titles; END IF;
 SELECT id INTO proof_id FROM public.assist_visit_proofs WHERE tenant_id=t AND visit_id=v.id
   AND status IN ('approved','exported') ORDER BY created_at DESC,id DESC LIMIT 1;
 receipt:=public.workflow_signed_follow_up_source(t,v.id,proof_id,TRUE);
 -- Same source helper requires actual pairs, current valid signature, current
 -- documentation/tasks, canonical hashes AND private exact PDF-byte attestation.
 -- A pending client signature remains pending: this RPC cannot invent a seal.
 IF v.canonical_status='completed' THEN
   IF a.status::text<>'completed' OR v.execution_status<>'completed' THEN RAISE EXCEPTION 'Terminale Abschlussfassung stimmt nicht überein.'; END IF;
   IF v.billing_status='ready' THEN RETURN; END IF;
 END IF;

 -- First mutation is below the completed preflight. The canonical signed task
 -- rows/notes/timestamps and proof/signature content are never rewritten here.
 FOR item IN SELECT value FROM jsonb_array_elements(resolved) LOOP
   mapped_status:=CASE item->>'status' WHEN 'not_possible' THEN 'not_done' WHEN 'deferred' THEN 'not_done' ELSE item->>'status' END;
   UPDATE public.assignment_tasks x SET status=mapped_status::public.assignment_task_status,
     not_done_reason=CASE WHEN mapped_status='done' THEN NULL ELSE trim(p_reason) END,updated_at=now()
     WHERE x.id=(item->>'assignment_task_id')::uuid AND x.tenant_id=t AND x.assignment_id=a.id AND x.status::text IS DISTINCT FROM mapped_status;
 END LOOP;
 UPDATE public.assist_visits SET execution_status='completed',canonical_status='completed',billing_status='ready',
   finished_at=COALESCE(finished_at,actual_end_at),updated_by=v_actor,updated_at=now() WHERE id=v.id AND tenant_id=t;
 UPDATE public.assignments SET status='completed',updated_at=now() WHERE id=a.id AND tenant_id=t AND status::text<>'completed';
 INSERT INTO public.assist_visit_admin_audit(tenant_id,visit_id,action,previous_value,new_value,reason,actor_user_id)
 VALUES(t,v.id,'follow_up_completed_reconciled',jsonb_build_object('canonical_status',v.canonical_status),
   jsonb_build_object('canonical_status','completed','signature_deferred_to_client_portal',FALSE,'billing_status','ready',
     'task_state_count',jsonb_array_length(p_task_states),'confirmed_source',receipt),trim(p_reason),auth.uid());
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_reconcile_complete_assist_visit_follow_up(uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_complete_assist_visit_follow_up(uuid,jsonb,text) TO authenticated,service_role;
COMMIT;
