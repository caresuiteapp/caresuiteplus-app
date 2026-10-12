-- Future assignment reminders and explicit signature requests.
-- No tenant setting or device permission is enabled by this migration.
BEGIN;

ALTER TABLE public.portal_push_runtime
  ADD COLUMN reminders_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN reminders_started_at timestamptz,
  ADD COLUMN reminder_lead_minutes integer NOT NULL DEFAULT 15 CHECK (reminder_lead_minutes BETWEEN 1 AND 60),
  ADD COLUMN overdue_grace_minutes integer NOT NULL DEFAULT 5 CHECK (overdue_grace_minutes BETWEEN 0 AND 60);
ALTER TABLE public.portal_push_outbox DROP CONSTRAINT portal_push_outbox_event_kind_check;
ALTER TABLE public.portal_push_outbox ADD CONSTRAINT portal_push_outbox_event_kind_check
  CHECK (event_kind IN ('visit','visit_reminder','visit_overdue','message','proof','proof_signature','proof_signed','document','notice','update'));

CREATE INDEX assist_visit_push_unstarted_time ON public.assist_visits(planned_start_at)
  WHERE actual_start_at IS NULL AND actual_end_at IS NULL AND finished_at IS NULL AND employee_portal_visible;

-- The sender honours each tenant's master switch and event preferences.
CREATE FUNCTION public.portal_push_kind_enabled(scope_tenant uuid, kind text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM portal_push_runtime WHERE singleton AND enabled)
 AND EXISTS(SELECT 1 FROM tenant_notification_settings s WHERE s.tenant_id=scope_tenant AND s.push_notifications_enabled
   AND CASE
     WHEN kind IN ('visit','visit_reminder','visit_overdue') THEN s.notify_assignment_changes
     WHEN kind='message' THEN s.notify_new_message
     WHEN kind IN ('proof_signature','proof_signed','document') THEN s.notify_signature_required
     WHEN kind='proof' THEN s.notify_service_record_ready
     WHEN kind IN ('notice','update') THEN true
     ELSE false
   END)
$$;

-- Check all persisted workflow mirrors: an old planning status alone is not
-- evidence that an assignment was never started.
CREATE FUNCTION public.portal_push_visit_unstarted(v public.assist_visits) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT v.planning_status NOT IN ('draft','cancelled')
   AND v.canonical_status IN ('planned','scheduled','confirmed','on_the_way','arrived')
   AND v.execution_status IN ('pending','on_way','arrived')
   AND v.actual_start_at IS NULL AND v.actual_end_at IS NULL AND v.finished_at IS NULL
   AND NOT EXISTS(SELECT 1 FROM assist_time_events e WHERE e.tenant_id=v.tenant_id AND e.visit_id=v.id AND e.event_type IN ('service_start','service_end'))
   AND NOT EXISTS(SELECT 1 FROM assist_visit_execution_state s WHERE s.tenant_id=v.tenant_id AND s.visit_id=v.id
     AND (s.service_started_at IS NOT NULL OR s.service_ended_at IS NOT NULL OR s.finalized_at IS NOT NULL
       OR s.assignment_status IN ('gestartet','pausiert','beendet','dokumentation_offen','unterschrift_offen','abgeschlossen','storniert','nicht_erschienen')
       OR s.current_step IN ('in_service','documentation','signature','proof','completed')))
   AND NOT EXISTS(SELECT 1 FROM assignments a WHERE a.tenant_id=v.tenant_id AND a.id=coalesce(v.legacy_assignment_id,v.id)
     AND a.status::text IN ('started','paused','completed','cancelled','no_show','finished','documentation_open','signature_open'))
$$;

CREATE OR REPLACE FUNCTION public.portal_push_event_visible(d public.portal_push_devices, kind text, source uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT public.portal_push_account_active(d) OR NOT public.portal_push_kind_enabled(d.tenant_id,kind) THEN RETURN false; END IF;
 CASE kind
 WHEN 'visit' THEN RETURN EXISTS(SELECT 1 FROM assist_visits v WHERE v.id=source AND v.tenant_id=d.tenant_id
   AND v.planning_status<>'draft' AND v.planned_end_at>now()
   AND ((d.portal_type='employee' AND v.employee_id=d.employee_id AND v.employee_portal_visible) OR (d.portal_type='client' AND v.client_id=d.client_id AND v.portal_release_enabled)));
 WHEN 'visit_reminder','visit_overdue' THEN RETURN EXISTS(
   SELECT 1 FROM assist_visits v CROSS JOIN portal_push_runtime r WHERE r.singleton AND r.enabled AND r.reminders_enabled
     AND v.id=source AND v.tenant_id=d.tenant_id AND d.portal_type='employee' AND v.employee_id=d.employee_id AND v.employee_portal_visible
     AND v.planned_start_at>=r.reminders_started_at AND public.portal_push_visit_unstarted(v)
     AND CASE WHEN kind='visit_reminder' THEN v.planned_start_at>now() AND v.planned_start_at<=now()+make_interval(mins=>r.reminder_lead_minutes)
       ELSE v.planned_start_at+make_interval(mins=>r.overdue_grace_minutes)<=now() AND now()<least(v.planned_end_at,v.planned_start_at+interval '2 hours') END
 );
 WHEN 'message' THEN RETURN EXISTS(
   SELECT 1 FROM messages m JOIN message_threads t ON t.id=m.thread_id AND t.tenant_id=m.tenant_id
   WHERE m.id=source AND m.tenant_id=d.tenant_id AND NOT m.is_internal_note AND NOT m.is_system_message AND m.status='sent' AND m.read_at IS NULL AND t.status NOT IN ('deleted','archived')
     AND (m.sender_employee_id IS NULL OR m.sender_employee_id IS DISTINCT FROM d.employee_id) AND (m.sender_client_id IS NULL OR m.sender_client_id IS DISTINCT FROM d.client_id)
     AND ((d.portal_type='client' AND t.thread_type='client' AND t.client_id=d.client_id AND m.sender_profile_id IS NOT NULL)
       OR (d.portal_type='employee' AND t.thread_type='employee' AND t.employee_id=d.employee_id AND m.sender_profile_id IS NOT NULL)
       OR (d.portal_type='employee' AND t.thread_type='employee_group' AND EXISTS(SELECT 1 FROM message_thread_employee_participants p WHERE p.thread_id=t.id AND p.tenant_id=d.tenant_id AND p.employee_id=d.employee_id AND p.is_active AND p.left_at IS NULL)))
 );
 WHEN 'proof','proof_signature' THEN RETURN EXISTS(
   SELECT 1 FROM assist_visit_proofs p JOIN assist_visits v ON v.id=p.visit_id AND v.tenant_id=p.tenant_id
   WHERE p.id=source AND p.tenant_id=d.tenant_id AND d.portal_type='client' AND v.client_id=d.client_id AND p.portal_visible
     AND v.canonical_status NOT IN ('cancelled','no_show')
     AND CASE WHEN kind='proof_signature' THEN p.portal_release_status='pending_client_signature' AND p.signature_id IS NULL ELSE p.portal_release_status='released' END
 );
 WHEN 'proof_signed' THEN RETURN EXISTS(
   SELECT 1 FROM assist_visit_proofs p JOIN assist_visits v ON v.id=p.visit_id AND v.tenant_id=p.tenant_id
   JOIN assist_visit_signatures s ON s.id=p.signature_id AND s.tenant_id=p.tenant_id AND s.visit_id=p.visit_id AND s.is_valid AND s.signer_role='client'
   WHERE p.id=source AND p.tenant_id=d.tenant_id AND d.portal_type='employee' AND v.employee_id=d.employee_id AND p.portal_release_status='released'
 );
 WHEN 'document' THEN RETURN EXISTS(SELECT 1 FROM cs_document_requests r WHERE r.id=source AND r.owner_tenant_id=d.tenant_id AND r.portal_visible AND r.status IN ('sent','opened','partially_signed') AND ((d.portal_type='client' AND r.client_id=d.client_id AND r.recipient_scope IN ('client','both')) OR (d.portal_type='employee' AND r.employee_id=d.employee_id AND r.recipient_scope IN ('employee','both'))));
 WHEN 'notice' THEN RETURN EXISTS(SELECT 1 FROM office_notifications n WHERE n.id=source AND n.tenant_id=d.tenant_id AND NOT n.is_read AND n.notification_type IN ('broadcast','system') AND (n.recipient_user_id=d.auth_user_id OR (d.portal_type='employee' AND n.recipient_employee_id=d.employee_id)));
 WHEN 'update' THEN RETURN EXISTS(SELECT 1 FROM portal_app_releases r WHERE r.id=source AND r.platform=d.platform AND r.available_on_play AND d.app_build_version IS NOT NULL AND d.app_build_version<r.version_code);
 ELSE RETURN false;
 END CASE;
END $$;

-- Called by the protected dispatcher, every minute. At most one reminder of
-- each kind per device and planned start; no old-assignment replay on activation.
CREATE FUNCTION public.portal_push_queue_assignment_reminders(batch_size integer DEFAULT 1000) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE queued_count integer;
BEGIN
 INSERT INTO portal_push_outbox(tenant_id,device_id,account_id,auth_user_id,event_key,event_kind,source_id,route,expires_at)
 SELECT candidates.tenant_id,candidates.device_id,candidates.account_id,candidates.auth_user_id,candidates.event_key,candidates.event_kind,candidates.source_id,candidates.route,candidates.expires_at
 FROM (
   SELECT v.tenant_id,d.id AS device_id,d.portal_account_id AS account_id,d.auth_user_id,v.id AS source_id,
     k.kind AS event_kind,k.kind||':'||v.id||':'||extract(epoch FROM v.planned_start_at)::text AS event_key,
     '/portal/employee/assignments/'||v.id||'/execute' AS route,
     CASE WHEN k.kind='visit_reminder' THEN v.planned_start_at ELSE least(v.planned_end_at,v.planned_start_at+interval '2 hours') END AS expires_at
   FROM assist_visits v
   JOIN portal_push_devices d ON d.tenant_id=v.tenant_id AND d.employee_id=v.employee_id AND d.portal_type='employee'
   CROSS JOIN portal_push_runtime r
   CROSS JOIN LATERAL (SELECT CASE WHEN v.planned_start_at>now() THEN 'visit_reminder' ELSE 'visit_overdue' END AS kind) k
   WHERE r.singleton AND r.enabled AND r.reminders_enabled AND r.reminders_started_at IS NOT NULL
     AND v.actual_start_at IS NULL AND v.actual_end_at IS NULL AND v.finished_at IS NULL AND v.employee_portal_visible
     AND v.planned_start_at>=r.reminders_started_at AND v.planned_start_at>now()-interval '2 hours'
     AND v.planned_start_at<=now()+make_interval(mins=>r.reminder_lead_minutes)
     AND public.portal_push_event_visible(d,k.kind,v.id)
     AND NOT EXISTS(SELECT 1 FROM portal_push_outbox q WHERE q.device_id=d.id AND q.event_key=k.kind||':'||v.id||':'||extract(epoch FROM v.planned_start_at)::text)
   ORDER BY v.planned_start_at,v.id,d.id
   LIMIT least(greatest(batch_size,1),1000)
 ) candidates ON CONFLICT(device_id,event_key) DO NOTHING;
 GET DIAGNOSTICS queued_count=ROW_COUNT;
 RETURN queued_count;
END $$;

-- A rescheduled assignment invalidates its old reminder, even if it happens to
-- fall into the same window when delivery is retried.
CREATE OR REPLACE FUNCTION public.portal_push_delivery_target(outbox_id uuid,claim_token uuid) RETURNS TABLE(expo_push_token text,route text,account_id uuid,tenant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT d.expo_push_token,q.route,q.account_id,q.tenant_id FROM portal_push_outbox q
 JOIN portal_push_devices d ON d.id=q.device_id AND d.portal_account_id=q.account_id AND d.auth_user_id=q.auth_user_id AND d.tenant_id=q.tenant_id
 WHERE q.id=outbox_id AND q.state='processing' AND q.lease_token=claim_token AND q.lease_until>now() AND q.expires_at>now()
   AND public.portal_push_event_visible(d,q.event_kind,q.source_id)
   AND (q.event_kind NOT IN ('visit_reminder','visit_overdue') OR EXISTS(SELECT 1 FROM assist_visits v WHERE v.id=q.source_id AND v.tenant_id=q.tenant_id AND q.event_key=q.event_kind||':'||v.id||':'||extract(epoch FROM v.planned_start_at)::text))
$$;

CREATE OR REPLACE FUNCTION public.portal_push_source_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.portal_push_devices; source uuid; tid uuid; kind text; target text; root text; event text; v public.assist_visits; r public.cs_document_requests;
BEGIN
 source:=NEW.id;
 IF TG_TABLE_NAME='assist_visits' THEN
  IF TG_OP='UPDATE' AND ROW(NEW.planned_start_at,NEW.planned_end_at,NEW.employee_id,NEW.client_id,NEW.title,NEW.address_snapshot,NEW.planning_status,NEW.portal_release_enabled,NEW.employee_portal_visible) IS NOT DISTINCT FROM ROW(OLD.planned_start_at,OLD.planned_end_at,OLD.employee_id,OLD.client_id,OLD.title,OLD.address_snapshot,OLD.planning_status,OLD.portal_release_enabled,OLD.employee_portal_visible) THEN RETURN NEW; END IF;
  tid:=NEW.tenant_id; kind:='visit';
 ELSIF TG_TABLE_NAME='messages' THEN
  IF TG_OP='UPDATE' AND (OLD.status='sent' OR NEW.status<>'sent') THEN RETURN NEW; END IF;
  tid:=NEW.tenant_id; kind:='message';
 ELSIF TG_TABLE_NAME='assist_visit_proofs' THEN
  IF TG_OP='UPDATE' AND ROW(NEW.portal_visible,NEW.portal_release_status) IS NOT DISTINCT FROM ROW(OLD.portal_visible,OLD.portal_release_status) THEN RETURN NEW; END IF;
  tid:=NEW.tenant_id; kind:=CASE WHEN NEW.portal_release_status='pending_client_signature' THEN 'proof_signature' ELSE 'proof' END;
  SELECT * INTO v FROM assist_visits WHERE id=NEW.visit_id AND tenant_id=tid;
 ELSIF TG_TABLE_NAME='cs_document_requests' THEN
  IF TG_OP='UPDATE' AND ROW(NEW.portal_visible,NEW.status,NEW.client_id,NEW.employee_id) IS NOT DISTINCT FROM ROW(OLD.portal_visible,OLD.status,OLD.client_id,OLD.employee_id) THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status IN ('sent','opened','partially_signed') AND NEW.status IN ('sent','opened','partially_signed') AND ROW(NEW.portal_visible,NEW.client_id,NEW.employee_id) IS NOT DISTINCT FROM ROW(OLD.portal_visible,OLD.client_id,OLD.employee_id) THEN RETURN NEW; END IF;
  tid:=NEW.owner_tenant_id; kind:='document';
 ELSIF TG_TABLE_NAME='office_notifications' THEN
  IF NEW.notification_type<>'system' THEN RETURN NEW; END IF;
  tid:=NEW.tenant_id; kind:='notice';
 ELSIF TG_TABLE_NAME='portal_app_releases' THEN
  IF NOT NEW.available_on_play OR (TG_OP='UPDATE' AND OLD.available_on_play) THEN RETURN NEW; END IF;
  kind:='update';
 ELSE RETURN NEW;
 END IF;
 event:=kind||':'||source||':'||txid_current()::text;
 FOR d IN SELECT * FROM portal_push_devices WHERE enabled AND permission_status='granted' AND portal_type IN ('employee','client') AND (tid IS NULL OR tenant_id=tid) LOOP
  -- Signing completes the client's pending request; it is not a new request.
  IF TG_TABLE_NAME='assist_visit_proofs' AND TG_OP='UPDATE' THEN
   IF OLD.portal_release_status='pending_client_signature' AND NEW.portal_release_status='released' AND d.portal_type='client'
     AND EXISTS(SELECT 1 FROM assist_visit_signatures s WHERE s.id=NEW.signature_id AND s.tenant_id=NEW.tenant_id AND s.visit_id=NEW.visit_id AND s.is_valid AND s.signer_role='client') THEN CONTINUE; END IF;
  END IF;
  root:='/portal/'||d.portal_type||'/';
  CASE kind
   WHEN 'visit' THEN target:=root||CASE WHEN d.portal_type='client' THEN 'appointments/'||source ELSE 'assignments/'||source||'/execute' END;
   WHEN 'message' THEN target:=root||'messages/'||NEW.thread_id;
   WHEN 'proof','proof_signature' THEN target:=root||'documents/'||source;
   WHEN 'document' THEN target:=root||'documents/signatures/'||source;
   WHEN 'notice' THEN target:=root||'announcements';
   WHEN 'update' THEN target:=root||'profile?pushUpdate='||NEW.version_code;
  END CASE;
  PERFORM public.portal_push_enqueue_device(d,event,kind,source,target);
  IF TG_TABLE_NAME='assist_visit_proofs' AND TG_OP='UPDATE' THEN
   IF OLD.portal_release_status='pending_client_signature' AND NEW.portal_release_status='released' AND d.portal_type='employee' THEN
    PERFORM public.portal_push_enqueue_device(d,'proof_signed:'||source||':'||txid_current(),'proof_signed',source,root||'assignments/'||v.id||'/execute');
   END IF;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;


-- Service-only entry points; portal roles cannot bypass a tenant's preferences,
-- create jobs, or inspect assignments belonging to another account.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('portal_push_kind_enabled','portal_push_visit_unstarted','portal_push_queue_assignment_reminders') LOOP
   EXECUTE 'REVOKE ALL ON FUNCTION '||f.signature||' FROM PUBLIC,anon,authenticated';
   EXECUTE 'GRANT EXECUTE ON FUNCTION '||f.signature||' TO service_role';
 END LOOP;
END $$;
COMMIT;
