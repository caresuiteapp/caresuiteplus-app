-- Requires existing office_notifications + portal automatic push pipeline.
-- No HTTP or notification delivery takes place inside care transactions.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS care_portal_notification_once
 ON public.office_notifications(tenant_id,(metadata->>'careEventKey'),(COALESCE(recipient_user_id,recipient_employee_id))) WHERE metadata ? 'careEventKey';
CREATE OR REPLACE FUNCTION care_private.care_portal_notification_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE recipient uuid; event_key text; source_kind text; notice uuid;
BEGIN
 source_kind:=CASE TG_TABLE_NAME WHEN 'care_tours' THEN 'tour' ELSE 'proof' END;
 -- Retire notices as soon as the pending action disappears or the recipient changes.
 IF TG_OP='UPDATE' THEN
  IF TG_TABLE_NAME='care_tours' THEN
   IF NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.employee_id IS NOT DISTINCT FROM OLD.employee_id THEN RETURN NEW; END IF;
  ELSE
   IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  END IF;
  UPDATE public.office_notifications SET is_read=true,read_at=clock_timestamp()
   WHERE tenant_id=NEW.tenant_id AND metadata->>'careSourceKind'=source_kind AND metadata->>'careSourceId'=NEW.id::text AND NOT is_read;
 END IF;
 IF TG_TABLE_NAME='care_tours' THEN
  IF NEW.status<>'published' OR NEW.employee_id IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.employees WHERE id=NEW.employee_id AND tenant_id=NEW.tenant_id AND deleted_at IS NULL AND status::text='active' AND 'pfleger'=ANY(allowed_products::text[])) THEN RETURN NEW; END IF;
  event_key:='tour:'||NEW.id::text||':'||NEW.employee_id::text;
  INSERT INTO public.office_notifications(tenant_id,recipient_employee_id,notification_type,title,body_preview,action_url,metadata)
   VALUES(NEW.tenant_id,NEW.employee_id,'system','Neue Pflegetour bereitgestellt','Ihre Tourenplanung wurde aktualisiert. Öffnen Sie Ihr Mitarbeiterportal.','/portal/employee',jsonb_build_object('careEventKey',event_key,'careSourceKind',source_kind,'careSourceId',NEW.id)) ON CONFLICT DO NOTHING RETURNING id INTO notice;
  IF notice IS NOT NULL THEN UPDATE public.portal_push_outbox SET route='/portal/employee' WHERE tenant_id=NEW.tenant_id AND source_id=notice AND event_kind='notice'; END IF;
 ELSE
  IF NEW.status<>'submitted' THEN RETURN NEW; END IF;
  FOR recipient IN
   SELECT DISTINCT a.auth_user_id FROM (
    SELECT auth_user_id FROM public.client_portal_access WHERE tenant_id=NEW.tenant_id AND client_id=NEW.client_id AND portal_enabled AND status='aktiv'
    UNION ALL
    SELECT auth_user_id FROM public.client_portal_codes WHERE tenant_id=NEW.tenant_id AND client_id=NEW.client_id AND status='active' AND (expires_at IS NULL OR expires_at>clock_timestamp())
   ) a WHERE a.auth_user_id IS NOT NULL LOOP
   event_key:='proof:'||NEW.id::text||':'||recipient::text;
   INSERT INTO public.office_notifications(tenant_id,recipient_user_id,notification_type,title,body_preview,action_url,metadata)
    VALUES(NEW.tenant_id,recipient,'system','Pflegenachweis zur Unterschrift bereit','Ein Nachweis wartet auf Ihre Prüfung. Öffnen Sie Ihre Leistungsnachweise.','/portal/client/proofs',jsonb_build_object('careEventKey',event_key,'careSourceKind',source_kind,'careSourceId',NEW.id,'careClientId',NEW.client_id)) ON CONFLICT DO NOTHING RETURNING id INTO notice;
   IF notice IS NOT NULL THEN UPDATE public.portal_push_outbox SET route='/portal/client/proofs' WHERE tenant_id=NEW.tenant_id AND source_id=notice AND event_kind='notice'; END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION care_private.care_portal_notification_changed() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS care_tour_portal_notification ON public.care_tours;
CREATE TRIGGER care_tour_portal_notification AFTER INSERT OR UPDATE ON public.care_tours FOR EACH ROW EXECUTE FUNCTION care_private.care_portal_notification_changed();
DROP TRIGGER IF EXISTS care_proof_portal_notification ON public.pfleger_service_proofs;
CREATE TRIGGER care_proof_portal_notification AFTER INSERT OR UPDATE ON public.pfleger_service_proofs FOR EACH ROW EXECUTE FUNCTION care_private.care_portal_notification_changed();
CREATE OR REPLACE FUNCTION public.portal_push_event_visible(d public.portal_push_devices, kind text, source uuid) RETURNS boolean
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
 WHEN 'notice' THEN RETURN EXISTS(SELECT 1 FROM office_notifications n WHERE n.id=source AND n.tenant_id=d.tenant_id AND NOT n.is_read AND n.notification_type IN ('broadcast','system') AND (n.metadata->>'careSourceKind' IS NULL OR (n.metadata->>'careSourceKind'='proof' AND d.portal_type='client' AND n.metadata->>'careClientId'=d.client_id::text) OR (n.metadata->>'careSourceKind'='tour' AND d.portal_type='employee' AND n.recipient_employee_id=d.employee_id)) AND (n.recipient_user_id=d.auth_user_id OR (d.portal_type='employee' AND n.recipient_employee_id=d.employee_id)));
 WHEN 'update' THEN RETURN EXISTS(SELECT 1 FROM portal_app_releases r WHERE r.id=source AND r.platform=d.platform AND r.available_on_play AND d.app_build_version IS NOT NULL AND d.app_build_version<r.version_code);
 ELSE RETURN false;
 END CASE;
END $$;
REVOKE ALL ON FUNCTION public.portal_push_event_visible(public.portal_push_devices,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_push_event_visible(public.portal_push_devices,text,uuid) TO service_role;
COMMIT;
