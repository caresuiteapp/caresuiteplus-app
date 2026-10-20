-- Automatic native portal notifications. No HTTP in business transactions.
-- Delivery is disabled until the dispatcher and its Vault scheduler are installed.
BEGIN;
ALTER TABLE public.portal_push_devices ADD COLUMN IF NOT EXISTS app_build_version bigint;
CREATE TABLE public.portal_push_runtime (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  worker_token_hash text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.portal_push_runtime(singleton) VALUES (true);
CREATE TABLE public.portal_app_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform = 'android'),
  version_code bigint NOT NULL CHECK (version_code > 0),
  version_name text NOT NULL,
  available_on_play boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(platform,version_code)
);
CREATE TABLE public.portal_push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.portal_push_devices(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  event_kind text NOT NULL CHECK (event_kind IN ('visit','message','proof','proof_signed','document','notice','update')),
  source_id uuid NOT NULL,
  route text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','processing','retry','accepted','delivered','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 6),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  expo_ticket_id text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  UNIQUE(device_id,event_key)
);
CREATE INDEX portal_push_ready ON public.portal_push_outbox(next_attempt_at) WHERE state IN ('pending','retry','processing');
CREATE INDEX portal_push_receipts ON public.portal_push_outbox(updated_at) WHERE state='accepted';
ALTER TABLE public.portal_push_runtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_push_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_app_releases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portal_push_runtime,public.portal_push_outbox,public.portal_app_releases FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.portal_push_runtime,public.portal_push_outbox,public.portal_app_releases TO service_role;

CREATE FUNCTION public.portal_push_account_active(d public.portal_push_devices) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT d.enabled AND d.permission_status='granted' AND (
   (d.portal_type='employee' AND EXISTS (SELECT 1 FROM employee_portal_accounts a WHERE a.id=d.portal_account_id AND a.tenant_id=d.tenant_id AND a.auth_user_id=d.auth_user_id AND a.employee_id=d.employee_id AND a.status='active'))
   OR (d.portal_type='client' AND (
     EXISTS (SELECT 1 FROM client_portal_access a WHERE a.id=d.portal_account_id AND a.tenant_id=d.tenant_id AND a.auth_user_id=d.auth_user_id AND a.client_id=d.client_id AND a.portal_enabled AND a.status='aktiv')
     OR EXISTS (SELECT 1 FROM client_portal_codes a WHERE a.id=d.portal_account_id AND a.tenant_id=d.tenant_id AND a.auth_user_id=d.auth_user_id AND a.client_id=d.client_id AND a.status='active' AND (a.expires_at IS NULL OR a.expires_at>now()))
   ))
 )
$$;

-- Rechecked immediately before handing the neutral notification to Expo.
CREATE FUNCTION public.portal_push_event_visible(d public.portal_push_devices, kind text, source uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT public.portal_push_account_active(d) THEN RETURN false; END IF;
 CASE kind
 WHEN 'visit' THEN RETURN EXISTS(SELECT 1 FROM assist_visits v WHERE v.id=source AND v.tenant_id=d.tenant_id AND v.planning_status<>'draft' AND ((d.portal_type='employee' AND v.employee_id=d.employee_id AND v.employee_portal_visible) OR (d.portal_type='client' AND v.client_id=d.client_id AND v.portal_release_enabled)));
 WHEN 'message' THEN RETURN EXISTS(
  SELECT 1 FROM messages m JOIN message_threads t ON t.id=m.thread_id AND t.tenant_id=m.tenant_id
  WHERE m.id=source AND m.tenant_id=d.tenant_id AND NOT m.is_internal_note AND NOT m.is_system_message AND m.status='sent' AND m.read_at IS NULL AND t.status NOT IN ('deleted','archived')
   AND (m.sender_employee_id IS NULL OR m.sender_employee_id IS DISTINCT FROM d.employee_id) AND (m.sender_client_id IS NULL OR m.sender_client_id IS DISTINCT FROM d.client_id)
   AND ((d.portal_type='client' AND t.thread_type='client' AND t.client_id=d.client_id AND m.sender_profile_id IS NOT NULL)
     OR (d.portal_type='employee' AND t.thread_type='employee' AND t.employee_id=d.employee_id AND m.sender_profile_id IS NOT NULL)
     OR (d.portal_type='employee' AND t.thread_type='employee_group' AND EXISTS (SELECT 1 FROM message_thread_employee_participants p WHERE p.thread_id=t.id AND p.tenant_id=d.tenant_id AND p.employee_id=d.employee_id AND p.is_active AND p.left_at IS NULL)))
 );
 WHEN 'proof' THEN RETURN EXISTS(SELECT 1 FROM assist_visit_proofs p JOIN assist_visits v ON v.id=p.visit_id AND v.tenant_id=p.tenant_id WHERE p.id=source AND p.tenant_id=d.tenant_id AND d.portal_type='client' AND v.client_id=d.client_id AND p.portal_visible AND p.portal_release_status IN ('released','pending_client_signature'));
 WHEN 'proof_signed' THEN RETURN EXISTS(SELECT 1 FROM assist_visit_proofs p JOIN assist_visits v ON v.id=p.visit_id AND v.tenant_id=p.tenant_id WHERE p.id=source AND p.tenant_id=d.tenant_id AND d.portal_type='employee' AND v.employee_id=d.employee_id AND p.portal_release_status='released');
 WHEN 'document' THEN RETURN EXISTS(SELECT 1 FROM cs_document_requests r WHERE r.id=source AND r.owner_tenant_id=d.tenant_id AND r.portal_visible AND r.status IN ('sent','opened','partially_signed') AND ((d.portal_type='client' AND r.client_id=d.client_id AND r.recipient_scope IN ('client','both')) OR (d.portal_type='employee' AND r.employee_id=d.employee_id AND r.recipient_scope IN ('employee','both'))));
 WHEN 'notice' THEN RETURN EXISTS(SELECT 1 FROM office_notifications n WHERE n.id=source AND n.tenant_id=d.tenant_id AND NOT n.is_read AND n.notification_type IN ('broadcast','system') AND (n.recipient_user_id=d.auth_user_id OR (d.portal_type='employee' AND n.recipient_employee_id=d.employee_id)));
 WHEN 'update' THEN RETURN EXISTS(SELECT 1 FROM portal_app_releases r WHERE r.id=source AND r.platform=d.platform AND r.available_on_play AND d.app_build_version IS NOT NULL AND d.app_build_version<r.version_code);
 ELSE RETURN false;
 END CASE;
END $$;

CREATE FUNCTION public.portal_push_enqueue_device(d public.portal_push_devices, p_event_key text, kind text, source uuid, destination text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT public.portal_push_event_visible(d,kind,source) THEN RETURN; END IF;
 INSERT INTO portal_push_outbox(tenant_id,device_id,account_id,auth_user_id,event_key,event_kind,source_id,route)
 VALUES(d.tenant_id,d.id,d.portal_account_id,d.auth_user_id,p_event_key,kind,source,destination)
 ON CONFLICT(device_id,event_key) DO NOTHING;
END $$;

CREATE FUNCTION public.portal_push_source_changed() RETURNS trigger
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
  tid:=NEW.tenant_id; kind:='proof';
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
  root:='/portal/'||d.portal_type||'/';
  CASE kind
   WHEN 'visit' THEN target:=root||CASE WHEN d.portal_type='client' THEN 'appointments/'||source ELSE 'assignments/'||source||'/execute' END;
   WHEN 'message' THEN target:=root||'messages/'||NEW.thread_id;
   WHEN 'proof' THEN target:=root||'documents/'||source;
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

CREATE TRIGGER portal_push_visit AFTER INSERT OR UPDATE ON public.assist_visits FOR EACH ROW EXECUTE FUNCTION public.portal_push_source_changed();
CREATE TRIGGER portal_push_message AFTER INSERT OR UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.portal_push_source_changed();
CREATE TRIGGER portal_push_proof AFTER INSERT OR UPDATE ON public.assist_visit_proofs FOR EACH ROW EXECUTE FUNCTION public.portal_push_source_changed();
CREATE TRIGGER portal_push_document AFTER INSERT OR UPDATE ON public.cs_document_requests FOR EACH ROW EXECUTE FUNCTION public.portal_push_source_changed();
CREATE TRIGGER portal_push_notice AFTER INSERT ON public.office_notifications FOR EACH ROW EXECUTE FUNCTION public.portal_push_source_changed();
CREATE TRIGGER portal_push_release AFTER INSERT OR UPDATE ON public.portal_app_releases FOR EACH ROW EXECUTE FUNCTION public.portal_push_source_changed();

CREATE FUNCTION public.portal_push_worker_authorized(token_hash text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM portal_push_runtime WHERE singleton AND enabled AND worker_token_hash=token_hash AND length(token_hash)=64)
$$;
CREATE FUNCTION public.portal_push_claim(batch_size integer DEFAULT 50) RETURNS SETOF public.portal_push_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM portal_push_runtime WHERE enabled) THEN RETURN; END IF;
 UPDATE portal_push_outbox SET state='cancelled',error_code='expired',updated_at=now() WHERE state IN ('pending','retry','processing') AND expires_at<=now();
 UPDATE portal_push_outbox SET state='failed',error_code='attempt_limit',updated_at=now() WHERE state IN ('retry','processing') AND attempts>=6 AND (lease_until IS NULL OR lease_until<now());
 RETURN QUERY WITH candidates AS (
  SELECT id FROM portal_push_outbox WHERE state IN ('pending','retry','processing') AND next_attempt_at<=now() AND attempts<6 AND expires_at>now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_attempt_at,id LIMIT least(greatest(batch_size,1),100) FOR UPDATE SKIP LOCKED
 ) UPDATE portal_push_outbox q SET state='processing',attempts=q.attempts+1,lease_until=now()+interval '3 minutes',lease_token=gen_random_uuid(),updated_at=now() FROM candidates c WHERE q.id=c.id RETURNING q.*;
END $$;
CREATE FUNCTION public.portal_push_delivery_target(outbox_id uuid,claim_token uuid) RETURNS TABLE(expo_push_token text,route text,account_id uuid,tenant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT d.expo_push_token,q.route,q.account_id,q.tenant_id FROM portal_push_outbox q JOIN portal_push_devices d ON d.id=q.device_id AND d.portal_account_id=q.account_id AND d.auth_user_id=q.auth_user_id AND d.tenant_id=q.tenant_id
 WHERE q.id=outbox_id AND q.state='processing' AND q.lease_token=claim_token AND q.lease_until>now() AND q.expires_at>now() AND public.portal_push_event_visible(d,q.event_kind,q.source_id)
$$;
CREATE FUNCTION public.portal_push_finish(outbox_id uuid,claim_token uuid,outcome text,ticket text DEFAULT NULL,failure text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE changed public.portal_push_outbox;
BEGIN
 IF outcome NOT IN ('accepted','retry','failed','cancelled') OR (outcome='accepted' AND nullif(ticket,'') IS NULL) THEN RAISE EXCEPTION 'invalid delivery outcome'; END IF;
 UPDATE portal_push_outbox SET state=CASE WHEN outcome='retry' AND attempts>=6 THEN 'failed' ELSE outcome END,expo_ticket_id=ticket,error_code=left(failure,100),lease_until=NULL,lease_token=NULL,next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)),updated_at=now()
 WHERE id=outbox_id AND state='processing' AND lease_token=claim_token AND lease_until>now() RETURNING * INTO changed;
 IF changed.id IS NULL THEN RETURN false; END IF;
 IF failure='DeviceNotRegistered' THEN
 UPDATE portal_push_devices SET enabled=false,invalidated_at=now(),last_error=failure WHERE id=changed.device_id AND portal_account_id=changed.account_id AND auth_user_id=changed.auth_user_id;
 END IF;
 RETURN true;
END $$;
CREATE FUNCTION public.portal_push_receipt(outbox_id uuid,ticket text,receipt_status text,failure text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE changed public.portal_push_outbox;
BEGIN
 IF receipt_status NOT IN ('ok','error') THEN RAISE EXCEPTION 'invalid receipt'; END IF;
 UPDATE portal_push_outbox SET state=CASE WHEN receipt_status='ok' THEN 'delivered' ELSE 'failed' END,error_code=left(failure,100),updated_at=now() WHERE id=outbox_id AND state='accepted' AND expo_ticket_id=ticket RETURNING * INTO changed;
 IF changed.id IS NOT NULL AND failure='DeviceNotRegistered' THEN UPDATE portal_push_devices SET enabled=false,invalidated_at=now(),last_error=failure WHERE id=changed.device_id AND portal_account_id=changed.account_id AND auth_user_id=changed.auth_user_id; END IF;
END $$;
CREATE FUNCTION public.portal_push_enqueue_broadcast(broadcast_id uuid,scope_tenant uuid) RETURNS TABLE(eligible_devices bigint,queued bigint,accepted bigint,failed bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.portal_push_devices; n public.office_notifications;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM notification_broadcasts b WHERE b.id=broadcast_id AND b.tenant_id=scope_tenant AND b.status='sent') THEN RAISE EXCEPTION 'broadcast not available'; END IF;
 FOR n IN SELECT * FROM office_notifications x WHERE x.tenant_id=scope_tenant AND x.related_broadcast_id=broadcast_id LOOP
  FOR d IN SELECT * FROM portal_push_devices x WHERE x.tenant_id=scope_tenant AND x.enabled AND (x.auth_user_id=n.recipient_user_id OR (x.portal_type='employee' AND x.employee_id=n.recipient_employee_id)) LOOP
   PERFORM public.portal_push_enqueue_device(d,'notice:'||n.id,'notice',n.id,'/portal/'||d.portal_type||'/announcements');
  END LOOP;
 END LOOP;
 RETURN QUERY SELECT count(DISTINCT q.device_id),count(*) FILTER(WHERE q.state IN ('pending','retry','processing')),count(*) FILTER(WHERE q.state IN ('accepted','delivered')),count(*) FILTER(WHERE q.state='failed') FROM portal_push_outbox q JOIN office_notifications notice ON notice.id=q.source_id WHERE q.event_kind='notice' AND notice.related_broadcast_id=broadcast_id AND q.tenant_id=scope_tenant;
END $$;
-- Functions called only by service code / owner triggers, never by portal roles.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('portal_push_enqueue_broadcast','portal_push_account_active','portal_push_event_visible','portal_push_enqueue_device','portal_push_source_changed','portal_push_worker_authorized','portal_push_claim','portal_push_delivery_target','portal_push_finish','portal_push_receipt') LOOP
 EXECUTE 'REVOKE ALL ON FUNCTION '||f.signature||' FROM PUBLIC,anon,authenticated';
 EXECUTE 'GRANT EXECUTE ON FUNCTION '||f.signature||' TO service_role';
 END LOOP;
END $$;
COMMIT;
