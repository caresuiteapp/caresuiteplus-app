-- A portal request is acknowledged only after its Office conversation,
-- notification, activity and audit have committed in the same transaction.
-- Also covers INSERTs from older Web/native clients during rollout.
ALTER TYPE public.portal_request_type ADD VALUE IF NOT EXISTS 'stammdaten';
ALTER TYPE public.portal_request_type ADD VALUE IF NOT EXISTS 'beschwerde';
ALTER TYPE public.portal_request_type ADD VALUE IF NOT EXISTS 'lob';

ALTER TABLE public.portal_requests
  ADD COLUMN IF NOT EXISTS office_thread_id uuid REFERENCES public.message_threads(id),
  ADD COLUMN IF NOT EXISTS office_message_id uuid REFERENCES public.messages(id),
  ADD COLUMN IF NOT EXISTS office_delivered_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS portal_requests_office_thread_unique
  ON public.portal_requests (office_thread_id) WHERE office_thread_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS portal_requests_office_message_unique
  ON public.portal_requests (office_message_id) WHERE office_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS portal_requests_tenant_client_created
  ON public.portal_requests (tenant_id, client_id, created_at DESC, id DESC);

CREATE SCHEMA IF NOT EXISTS portal_request_private;
REVOKE ALL ON SCHEMA portal_request_private FROM PUBLIC, anon, authenticated, service_role;
-- Hardened installations may have revoked the canonical self-profile lookup.
-- It resolves only auth.uid(); clients still cannot choose a different author.
GRANT EXECUTE ON FUNCTION public.resolve_current_profile_id() TO authenticated;

-- Delivery fields are server receipts, never claims made by a portal client.
CREATE OR REPLACE FUNCTION portal_request_private.guard_request()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.office_thread_id IS NOT NULL OR NEW.office_message_id IS NOT NULL
         OR NEW.office_delivered_at IS NOT NULL THEN
        RAISE EXCEPTION 'Die Empfangsbestätigung wird ausschließlich vom Server erstellt.' USING ERRCODE='42501';
      END IF;
      IF auth.uid() IS NULL OR NEW.tenant_id IS DISTINCT FROM public.current_tenant_id()
         OR NEW.client_id IS DISTINCT FROM public.current_client_id()
         OR NEW.portal_user_id IS DISTINCT FROM public.resolve_current_profile_id() THEN
        RAISE EXCEPTION 'Anfrage und angemeldetes Klientenprofil stimmen nicht überein.' USING ERRCODE='42501';
      END IF;
    ELSIF ROW(NEW.tenant_id, NEW.client_id, NEW.portal_user_id,
              NEW.office_thread_id, NEW.office_message_id, NEW.office_delivered_at)
      IS DISTINCT FROM ROW(OLD.tenant_id, OLD.client_id, OLD.portal_user_id,
              OLD.office_thread_id, OLD.office_message_id, OLD.office_delivered_at) THEN
      RAISE EXCEPTION 'Absender und Empfangsbestätigung dürfen nicht geändert werden.' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION portal_request_private.guard_request() FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE TRIGGER portal_request_origin_guard BEFORE INSERT OR UPDATE ON public.portal_requests
  FOR EACH ROW EXECUTE FUNCTION portal_request_private.guard_request();

-- This elevated function is private and has no API EXECUTE grants. Only the
-- validated INSERT trigger and the database owner performing the backfill use it.
CREATE OR REPLACE FUNCTION portal_request_private.deliver_request(p_request_id uuid, p_restore boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.portal_requests%ROWTYPE;
  v_thread uuid;
  v_message uuid;
  v_body text;
  v_now timestamptz := clock_timestamp();
BEGIN
  SELECT * INTO r FROM public.portal_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Portal-Anfrage nicht gefunden.' USING ERRCODE='P0002'; END IF;
  -- A retry must neither duplicate an incoming item nor revive a conversation
  -- that was deliberately archived/deleted after its original delivery.
  IF r.office_delivered_at IS NOT NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id=r.client_id AND c.tenant_id=r.tenant_id) THEN
    RAISE EXCEPTION 'Klient und Mandant der Anfrage stimmen nicht überein.' USING ERRCODE='23514';
  END IF;
  IF r.portal_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=r.portal_user_id AND p.tenant_id=r.tenant_id
  ) THEN
    RAISE EXCEPTION 'Absender und Mandant der Anfrage stimmen nicht überein.' USING ERRCODE='23514';
  END IF;
  v_body := coalesce(nullif(btrim(r.description), ''), nullif(btrim(r.payload->>'nachricht'), ''), r.title);

  INSERT INTO public.message_threads
    (tenant_id, thread_type, status, priority, subject, client_id, created_by_client_id,
     last_message_at, last_message_preview, created_at, updated_at)
  VALUES (r.tenant_id, 'client', 'new',
    CASE WHEN r.request_type::text='beschwerde' OR r.payload->>'dringlichkeit'='dringend'
      THEN 'high'::public.message_priority ELSE 'normal'::public.message_priority END,
    'Portal-Anfrage: '||r.title, r.client_id, r.client_id,
    r.created_at, left(v_body,120), r.created_at, v_now)
  RETURNING id INTO v_thread;

  -- Keep the real original send time and sender. The existing unread trigger
  -- counts this exactly once for Office; it is not an outgoing Office message.
  INSERT INTO public.messages
    (tenant_id, thread_id, body, sender_client_id, status, sent_at,
     is_internal_note, is_system_message, created_at, updated_at)
  VALUES (r.tenant_id, v_thread, v_body, r.client_id, 'sent', r.created_at,
    false, false, r.created_at, v_now)
  RETURNING id INTO v_message;
  UPDATE public.message_threads SET office_unread_count=1, portal_unread_count=0
    WHERE id=v_thread AND tenant_id=r.tenant_id;

  INSERT INTO public.communication_notifications
    (tenant_id, type, office_thread_id, title, body, action_route)
  VALUES (r.tenant_id, 'office_message_new', v_thread, 'Neue Portal-Anfrage',
    'Eine Anfrage ist im Klienten-Posteingang eingegangen.',
    '/office/messages?audience=clients&thread='||v_thread::text);

  IF NOT EXISTS (SELECT 1 FROM public.portal_request_status_history h
    WHERE h.request_id=r.id AND h.tenant_id=r.tenant_id) THEN
    INSERT INTO public.portal_request_status_history
      (tenant_id, request_id, from_status, to_status, changed_by, note, created_at)
    VALUES (r.tenant_id, r.id, null, r.status,
      CASE WHEN p_restore THEN null ELSE r.portal_user_id END,
      CASE WHEN p_restore THEN 'Historie zur bestehenden Anfrage wiederhergestellt; ursprüngliche Erstellung: '||r.created_at::text
        ELSE 'Anfrage erstellt und an Office zugestellt' END, v_now);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.portal_activities a WHERE a.tenant_id=r.tenant_id
    AND a.client_id=r.client_id AND a.activity_type::text='request_created'
    AND a.metadata->>'requestId'=r.id::text) THEN
    INSERT INTO public.portal_activities
      (tenant_id, client_id, portal_user_id, module_key, activity_type, title, description, metadata, created_at)
    VALUES (r.tenant_id, r.client_id, r.portal_user_id, r.module_key, 'request_created',
      'Anfrage: '||r.title, r.description,
      jsonb_build_object('requestId',r.id,'requestType',r.request_type,'restored',p_restore,
        'sourceCreatedAt',r.created_at), v_now);
  END IF;
  INSERT INTO public.audit_logs
    (tenant_id, profile_id, action, table_name, record_id, title, description, new_data, created_at)
  VALUES (r.tenant_id, CASE WHEN p_restore THEN null ELSE r.portal_user_id END,
    'system', 'portal_requests', r.id,
    CASE WHEN p_restore THEN 'Portal-Anfrage wiederhergestellt' ELSE 'Portal-Anfrage zugestellt' END,
    'Empfang im Office-Nachrichtenposteingang bestätigt.',
    jsonb_build_object('requestId',r.id,'sourceCreatedAt',r.created_at,'restored',p_restore,
      'threadId',v_thread,'messageId',v_message,'senderProfileId',r.portal_user_id), v_now);

  UPDATE public.portal_requests SET office_thread_id=v_thread, office_message_id=v_message,
    office_delivered_at=v_now WHERE id=r.id AND tenant_id=r.tenant_id;
END $$;
REVOKE ALL ON FUNCTION portal_request_private.deliver_request(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION portal_request_private.on_request_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM portal_request_private.deliver_request(NEW.id, false);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION portal_request_private.on_request_created() FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE TRIGGER portal_request_deliver_to_office AFTER INSERT ON public.portal_requests
  FOR EACH ROW EXECUTE FUNCTION portal_request_private.on_request_created();

-- Invoker: the existing request INSERT/SELECT policies still apply. No caller
-- can select another client or choose a sender profile, tenant or delivery ID.
CREATE OR REPLACE FUNCTION public.portal_submit_request(
  p_tenant_id uuid, p_client_id uuid, p_request_type text, p_title text,
  p_description text DEFAULT null, p_payload jsonb DEFAULT '{}'::jsonb,
  p_module_key text DEFAULT 'assist', p_request_id uuid DEFAULT gen_random_uuid()
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  r public.portal_requests%ROWTYPE;
  v_profile uuid := public.resolve_current_profile_id();
  v_title text := btrim(coalesce(p_title,''));
  v_description text := nullif(btrim(p_description),'');
  v_module text := coalesce(nullif(btrim(p_module_key),''),'assist');
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR p_client_id IS DISTINCT FROM public.current_client_id() OR v_profile IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=v_profile AND p.tenant_id=p_tenant_id
      AND (p.auth_user_id=auth.uid() OR p.id=auth.uid())) THEN
    RAISE EXCEPTION 'Anfrage und angemeldetes Klientenprofil stimmen nicht überein.' USING ERRCODE='42501';
  END IF;
  IF v_title='' OR p_request_id IS NULL OR jsonb_typeof(coalesce(p_payload,'{}'::jsonb))<>'object' THEN
    RAISE EXCEPTION 'Betreff oder Anfragedaten sind unvollständig.' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.portal_requests
    (id, tenant_id, client_id, portal_user_id, module_key, request_type, status, title, description, payload)
  VALUES (p_request_id, p_tenant_id, p_client_id, v_profile, v_module,
    p_request_type::public.portal_request_type, 'offen', v_title, v_description, coalesce(p_payload,'{}'::jsonb))
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO r FROM public.portal_requests WHERE id=p_request_id AND tenant_id=p_tenant_id
    AND client_id=p_client_id AND portal_user_id=v_profile;
  IF NOT FOUND OR r.title IS DISTINCT FROM v_title OR r.description IS DISTINCT FROM v_description
    OR r.request_type::text IS DISTINCT FROM p_request_type OR r.module_key IS DISTINCT FROM v_module
    OR r.payload IS DISTINCT FROM coalesce(p_payload,'{}'::jsonb) THEN
    RAISE EXCEPTION 'Diese Versandkennung gehört nicht zu dieser Anfrage.' USING ERRCODE='22023';
  END IF;
  IF r.office_thread_id IS NULL OR r.office_message_id IS NULL OR r.office_delivered_at IS NULL THEN
    RAISE EXCEPTION 'Der Eingang im Office konnte nicht bestätigt werden. Bitte erneut versuchen.' USING ERRCODE='P0001';
  END IF;
  RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.portal_submit_request(uuid,uuid,text,text,text,jsonb,text,uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.portal_submit_request(uuid,uuid,text,text,text,jsonb,text,uuid) TO authenticated;

-- Restrict historical broad policies in place. Preserve the policy objects
-- while closing their permissive-policy OR around the participant policies.
-- Some installations already removed these redundant policies.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_threads'
    AND policyname='message_threads_select_own_tenant') THEN
    ALTER POLICY message_threads_select_own_tenant ON public.message_threads TO authenticated
      USING (tenant_id=public.current_tenant_id() AND public.has_permission('office.access'));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages'
    AND policyname='messages_select_own_tenant') THEN
    ALTER POLICY messages_select_own_tenant ON public.messages TO authenticated
      USING (tenant_id=public.current_tenant_id() AND public.has_permission('office.access'));
  END IF;
END $$;

-- Restore every still-undelivered request, across tenants, with the same
-- idempotent transactional projector. Nothing is deleted or marked as read.
DO $$ DECLARE v_id uuid; BEGIN
  FOR v_id IN SELECT id FROM public.portal_requests WHERE office_delivered_at IS NULL ORDER BY created_at,id LOOP
    PERFORM portal_request_private.deliver_request(v_id,true);
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
