-- CareSuite ambulant: vorübergehende Versorgungsunterbrechung und sichere Rückkehr.
-- Additiv und nicht angewandt. Plantermine, tatsächliche Ereignisse und historische
-- Nachweise bleiben getrennt; abgeschlossene oder begonnene Einsätze werden nie umgeschrieben.

BEGIN;

CREATE SCHEMA IF NOT EXISTS client_continuity_private;
REVOKE ALL ON SCHEMA client_continuity_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA client_continuity_private TO authenticated;

CREATE TABLE IF NOT EXISTS public.client_service_interruptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  actor_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  prepared_session_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('hospital','rehabilitation','vacation','other')),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 2000),
  planned_start_at TIMESTAMPTZ NOT NULL,
  planned_end_at TIMESTAMPTZ,
  actual_start_at TIMESTAMPTZ NOT NULL,
  actual_end_at TIMESTAMPTZ,
  end_reason TEXT,
  end_request_id UUID UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  affected_visit_count INTEGER NOT NULL DEFAULT 0 CHECK (affected_visit_count >= 0),
  affected_tour_stop_count INTEGER NOT NULL DEFAULT 0 CHECK (affected_tour_stop_count >= 0),
  blocked_started_visit_count INTEGER NOT NULL DEFAULT 0 CHECK (blocked_started_visit_count >= 0),
  client_updated_at TIMESTAMPTZ NOT NULL,
  visit_originals JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(visit_originals)='array'),
  visit_results JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(visit_results)='array'),
  tour_stop_originals JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(tour_stop_originals)='array'),
  tour_stop_results JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(tour_stop_results)='array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  ended_at TIMESTAMPTZ,
  CHECK (planned_end_at IS NULL OR planned_end_at > planned_start_at),
  CHECK (actual_end_at IS NULL OR actual_end_at >= actual_start_at),
  CHECK ((status='active' AND actual_end_at IS NULL AND end_reason IS NULL AND end_request_id IS NULL AND ended_at IS NULL)
    OR (status='ended' AND actual_end_at IS NOT NULL AND length(btrim(end_reason)) BETWEEN 10 AND 2000
      AND end_request_id IS NOT NULL AND ended_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_service_interruption_active
  ON public.client_service_interruptions(tenant_id,client_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_client_service_interruption_history
  ON public.client_service_interruptions(tenant_id,client_id,actual_start_at DESC,id DESC);

CREATE TABLE IF NOT EXISTS public.client_service_interruption_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interruption_id UUID NOT NULL REFERENCES public.client_service_interruptions(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  actor_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('interruption_started','interruption_ended')),
  actual_event_at TIMESTAMPTZ NOT NULL,
  detail JSONB NOT NULL CHECK (jsonb_typeof(detail)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_client_service_interruption_events
  ON public.client_service_interruption_events(tenant_id,client_id,created_at,id);

ALTER TABLE public.client_service_interruptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_service_interruption_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.client_service_interruptions, public.client_service_interruption_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION client_continuity_private.authorize(p_tenant_id UUID,p_actor_profile_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session UUID;
BEGIN
  v_session := nullif(auth.jwt()->>'session_id','')::UUID;
  IF auth.uid() IS NULL OR v_session IS NULL
    OR coalesce((auth.jwt()->>'exp')::BIGINT,0) <= extract(epoch FROM clock_timestamp())
    OR NOT EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=v_session AND s.user_id=auth.uid())
    OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR p_actor_profile_id IS DISTINCT FROM auth.uid()
    OR NOT public.has_permission('office.clients.view')
    OR NOT public.has_permission('office.clients.edit')
    OR NOT public.has_permission('office.clients.status_change') THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Die aktuelle Berechtigung für Unterbrechung oder Rückkehr fehlt.';
  END IF;
  RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION client_continuity_private.read_summary(
  p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_client public.clients%ROWTYPE; v_active JSONB; v_history JSONB;
BEGIN
  PERFORM client_continuity_private.authorize(p_tenant_id,p_actor_profile_id);
  SELECT * INTO v_client FROM public.clients WHERE tenant_id=p_tenant_id AND id=p_client_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0C01',MESSAGE='Die Klient:innenakte wurde nicht gefunden.'; END IF;
  SELECT to_jsonb(i) INTO v_active FROM public.client_service_interruptions i
    WHERE i.tenant_id=p_tenant_id AND i.client_id=p_client_id AND i.status='active';
  SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.actual_start_at DESC,i.id DESC),'[]'::JSONB)
    INTO v_history FROM public.client_service_interruptions i WHERE i.tenant_id=p_tenant_id AND i.client_id=p_client_id;
  RETURN jsonb_build_object('client_name',btrim(coalesce(v_client.first_name,'')||' '||coalesce(v_client.last_name,'')),
    'client_updated_at',v_client.updated_at,'active',v_active,'history',v_history);
END;
$$;

CREATE OR REPLACE FUNCTION client_continuity_private.begin_interruption(
  p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID,p_request_id UUID,
  p_expected_client_updated_at TIMESTAMPTZ,p_kind TEXT,p_reason TEXT,
  p_planned_start_at TIMESTAMPTZ,p_planned_end_at TIMESTAMPTZ,p_actual_start_at TIMESTAMPTZ
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE
  v_session UUID; v_client public.clients%ROWTYPE; v_existing public.client_service_interruptions%ROWTYPE;
  v_interruption public.client_service_interruptions%ROWTYPE; v_visit_originals JSONB := '[]'::JSONB;
  v_visit_results JSONB := '[]'::JSONB; v_stop_originals JSONB := '[]'::JSONB; v_stop_results JSONB := '[]'::JSONB;
  v_visit_count INTEGER := 0; v_stop_count INTEGER := 0; v_started_count INTEGER := 0;
BEGIN
  v_session := client_continuity_private.authorize(p_tenant_id,p_actor_profile_id);
  IF p_request_id IS NULL OR p_client_id IS NULL OR p_expected_client_updated_at IS NULL
    OR p_kind NOT IN ('hospital','rehabilitation','vacation','other')
    OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 2000
    OR p_planned_start_at IS NULL OR p_actual_start_at IS NULL
    OR p_planned_end_at IS NOT NULL AND p_planned_end_at <= p_planned_start_at
    OR p_actual_start_at > clock_timestamp()+interval '5 minutes' THEN
    RAISE EXCEPTION USING ERRCODE='P0C02',MESSAGE='Die bestätigten Unterbrechungsangaben sind unvollständig oder widersprüchlich.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('client-continuity:'||p_tenant_id::TEXT||':'||p_client_id::TEXT,0));
  PERFORM client_continuity_private.authorize(p_tenant_id,p_actor_profile_id);
  SELECT * INTO v_existing FROM public.client_service_interruptions WHERE request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.tenant_id IS DISTINCT FROM p_tenant_id OR v_existing.client_id IS DISTINCT FROM p_client_id
      OR v_existing.actor_profile_id IS DISTINCT FROM p_actor_profile_id OR v_existing.prepared_session_id IS DISTINCT FROM v_session
      OR v_existing.client_updated_at IS DISTINCT FROM p_expected_client_updated_at OR v_existing.kind IS DISTINCT FROM p_kind
      OR v_existing.reason IS DISTINCT FROM btrim(p_reason) OR v_existing.planned_start_at IS DISTINCT FROM p_planned_start_at
      OR v_existing.planned_end_at IS DISTINCT FROM p_planned_end_at OR v_existing.actual_start_at IS DISTINCT FROM p_actual_start_at THEN
      RAISE EXCEPTION USING ERRCODE='P0C03',MESSAGE='Die wiederholte Unterbrechungsanfrage weicht vom unveränderten Original ab.';
    END IF;
    RETURN to_jsonb(v_existing);
  END IF;
  IF EXISTS(SELECT 1 FROM public.client_service_interruptions i WHERE i.tenant_id=p_tenant_id AND i.client_id=p_client_id AND i.status='active') THEN
    RAISE EXCEPTION USING ERRCODE='P0C04',MESSAGE='Für diese Akte besteht bereits eine aktive Unterbrechung.';
  END IF;
  SELECT * INTO v_client FROM public.clients WHERE tenant_id=p_tenant_id AND id=p_client_id FOR UPDATE;
  IF NOT FOUND OR v_client.updated_at IS DISTINCT FROM p_expected_client_updated_at
    OR lower(v_client.status::TEXT) IN ('archived','inactive','deceased','deleted') THEN
    RAISE EXCEPTION USING ERRCODE='P0C03',MESSAGE='Die Klient:innenakte ist nicht im bestätigten aktiven Originalstand.';
  END IF;

  IF to_regclass('public.assist_visits') IS NOT NULL THEN
    SELECT count(*) INTO v_started_count FROM public.assist_visits v
      WHERE v.tenant_id=p_tenant_id AND v.client_id=p_client_id AND v.planned_start_at>=p_planned_start_at
        AND (p_planned_end_at IS NULL OR v.planned_start_at<p_planned_end_at)
        AND v.actual_start_at IS NOT NULL AND v.actual_end_at IS NULL;
    SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.planned_start_at,v.id),'[]'::JSONB) INTO v_visit_originals
      FROM public.assist_visits v WHERE v.tenant_id=p_tenant_id AND v.client_id=p_client_id
        AND v.planned_start_at>=p_planned_start_at AND (p_planned_end_at IS NULL OR v.planned_start_at<p_planned_end_at)
        AND v.actual_start_at IS NULL AND lower(v.execution_status) NOT IN ('completed','finished','closed','ended','cancelled','canceled','rejected');
    v_visit_count := jsonb_array_length(v_visit_originals);
    UPDATE public.assist_visits v SET execution_status='cancelled',canonical_status='cancelled',
      employee_portal_visible=FALSE,portal_status='hidden',updated_by=p_actor_profile_id,updated_at=clock_timestamp()
      WHERE v.tenant_id=p_tenant_id AND v.client_id=p_client_id AND v.planned_start_at>=p_planned_start_at
        AND (p_planned_end_at IS NULL OR v.planned_start_at<p_planned_end_at) AND v.actual_start_at IS NULL
        AND lower(v.execution_status) NOT IN ('completed','finished','closed','ended','cancelled','canceled','rejected');
    SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.planned_start_at,v.id),'[]'::JSONB) INTO v_visit_results
      FROM public.assist_visits v JOIN jsonb_array_elements(v_visit_originals) o ON v.id=(o->>'id')::UUID;
    INSERT INTO public.assist_visit_status_history(tenant_id,visit_id,dimension,from_status,to_status,note,changed_by,changed_at)
      SELECT p_tenant_id,(o->>'id')::UUID,'execution_status',o->>'execution_status','cancelled',
        'Versorgungsunterbrechung '||p_request_id::TEXT,p_actor_profile_id,clock_timestamp()
      FROM jsonb_array_elements(v_visit_originals) o;
  END IF;

  IF to_regclass('public.care_tour_stops') IS NOT NULL AND to_regclass('public.care_tours') IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY t.tour_date,s.sequence_no,s.id),'[]'::JSONB) INTO v_stop_originals
      FROM public.care_tour_stops s JOIN public.care_tours t ON t.id=s.tour_id AND t.tenant_id=s.tenant_id
      WHERE s.tenant_id=p_tenant_id AND s.client_id=p_client_id AND s.status='planned'
        AND t.tour_date>=p_planned_start_at::DATE AND (p_planned_end_at IS NULL OR t.tour_date<p_planned_end_at::DATE);
    v_stop_count := jsonb_array_length(v_stop_originals);
    UPDATE public.care_tour_stops s SET status='cancelled',updated_at=clock_timestamp()
      WHERE s.tenant_id=p_tenant_id AND s.client_id=p_client_id AND s.status='planned'
        AND EXISTS(SELECT 1 FROM public.care_tours t WHERE t.id=s.tour_id AND t.tenant_id=p_tenant_id
          AND t.tour_date>=p_planned_start_at::DATE AND (p_planned_end_at IS NULL OR t.tour_date<p_planned_end_at::DATE));
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]'::JSONB) INTO v_stop_results
      FROM public.care_tour_stops s JOIN jsonb_array_elements(v_stop_originals) o ON s.id=(o->>'id')::UUID;
  END IF;

  INSERT INTO public.client_service_interruptions(request_id,tenant_id,client_id,actor_profile_id,prepared_session_id,
    kind,reason,planned_start_at,planned_end_at,actual_start_at,status,affected_visit_count,affected_tour_stop_count,
    blocked_started_visit_count,client_updated_at,visit_originals,visit_results,tour_stop_originals,tour_stop_results)
  VALUES(p_request_id,p_tenant_id,p_client_id,p_actor_profile_id,v_session,p_kind,btrim(p_reason),p_planned_start_at,
    p_planned_end_at,p_actual_start_at,'active',v_visit_count,v_stop_count,v_started_count,p_expected_client_updated_at,
    v_visit_originals,v_visit_results,v_stop_originals,v_stop_results) RETURNING * INTO v_interruption;
  INSERT INTO public.client_service_interruption_events(interruption_id,tenant_id,client_id,actor_profile_id,event_type,actual_event_at,detail)
  VALUES(v_interruption.id,p_tenant_id,p_client_id,p_actor_profile_id,'interruption_started',p_actual_start_at,
    jsonb_build_object('request_id',p_request_id,'kind',p_kind,'reason',btrim(p_reason),'planned_start_at',p_planned_start_at,
      'planned_end_at',p_planned_end_at,'affected_visit_count',v_visit_count,'affected_tour_stop_count',v_stop_count,
      'blocked_started_visit_count',v_started_count));
  RETURN to_jsonb(v_interruption);
END;
$$;

CREATE OR REPLACE FUNCTION client_continuity_private.confirm_interruption(
  p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID,p_request_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_interruption public.client_service_interruptions%ROWTYPE;
BEGIN
  PERFORM client_continuity_private.authorize(p_tenant_id,p_actor_profile_id);
  SELECT * INTO v_interruption FROM public.client_service_interruptions WHERE request_id=p_request_id;
  IF NOT FOUND OR v_interruption.tenant_id IS DISTINCT FROM p_tenant_id OR v_interruption.client_id IS DISTINCT FROM p_client_id
    OR v_interruption.actor_profile_id IS DISTINCT FROM p_actor_profile_id THEN
    RAISE EXCEPTION USING ERRCODE='P0C05',MESSAGE='Für diesen Vorgang liegt keine eigene vollständige Unterbrechungsquittung vor.';
  END IF;
  IF jsonb_array_length(v_interruption.visit_originals) IS DISTINCT FROM v_interruption.affected_visit_count
    OR jsonb_array_length(v_interruption.visit_results) IS DISTINCT FROM v_interruption.affected_visit_count
    OR jsonb_array_length(v_interruption.tour_stop_originals) IS DISTINCT FROM v_interruption.affected_tour_stop_count
    OR jsonb_array_length(v_interruption.tour_stop_results) IS DISTINCT FROM v_interruption.affected_tour_stop_count THEN
    RAISE EXCEPTION USING ERRCODE='P0C05',MESSAGE='Die gespeicherten Original- und Ergebnisbelege sind nicht vollständig.';
  END IF;
  RETURN to_jsonb(v_interruption);
END;
$$;

CREATE OR REPLACE FUNCTION client_continuity_private.end_interruption(
  p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID,p_interruption_id UUID,p_end_request_id UUID,
  p_expected_updated_at TIMESTAMPTZ,p_actual_end_at TIMESTAMPTZ,p_end_reason TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_interruption public.client_service_interruptions%ROWTYPE;
BEGIN
  PERFORM client_continuity_private.authorize(p_tenant_id,p_actor_profile_id);
  IF p_end_request_id IS NULL OR p_actual_end_at IS NULL OR length(btrim(coalesce(p_end_reason,''))) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE='P0C06',MESSAGE='Die tatsächliche Rückkehr ist nicht vollständig bestätigt.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('client-continuity:'||p_tenant_id::TEXT||':'||p_client_id::TEXT,0));
  PERFORM client_continuity_private.authorize(p_tenant_id,p_actor_profile_id);
  SELECT * INTO v_interruption FROM public.client_service_interruptions WHERE id=p_interruption_id FOR UPDATE;
  IF NOT FOUND OR v_interruption.tenant_id IS DISTINCT FROM p_tenant_id OR v_interruption.client_id IS DISTINCT FROM p_client_id THEN
    RAISE EXCEPTION USING ERRCODE='P0C07',MESSAGE='Die aktive Unterbrechung gehört nicht zur bestätigten Akte.';
  END IF;
  IF v_interruption.status='ended' THEN
    IF v_interruption.end_request_id IS DISTINCT FROM p_end_request_id OR v_interruption.actual_end_at IS DISTINCT FROM p_actual_end_at
      OR v_interruption.end_reason IS DISTINCT FROM btrim(p_end_reason) THEN
      RAISE EXCEPTION USING ERRCODE='P0C07',MESSAGE='Die wiederholte Rückkehr weicht vom unveränderten Original ab.';
    END IF;
    RETURN to_jsonb(v_interruption);
  END IF;
  IF v_interruption.updated_at IS DISTINCT FROM p_expected_updated_at OR p_actual_end_at<v_interruption.actual_start_at
    OR p_actual_end_at>clock_timestamp()+interval '5 minutes' THEN
    RAISE EXCEPTION USING ERRCODE='P0C07',MESSAGE='Unterbrechungsstand oder tatsächliche Rückkehrzeit ist nicht bestätigt.';
  END IF;
  UPDATE public.client_service_interruptions SET status='ended',actual_end_at=p_actual_end_at,end_reason=btrim(p_end_reason),
    end_request_id=p_end_request_id,ended_at=clock_timestamp(),updated_at=clock_timestamp()
    WHERE id=p_interruption_id AND status='active' AND updated_at=p_expected_updated_at RETURNING * INTO v_interruption;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0C07',MESSAGE='Die Rückkehr konnte nicht aus dem bestätigten Originalstand gespeichert werden.'; END IF;
  INSERT INTO public.client_service_interruption_events(interruption_id,tenant_id,client_id,actor_profile_id,event_type,actual_event_at,detail)
  VALUES(v_interruption.id,p_tenant_id,p_client_id,p_actor_profile_id,'interruption_ended',p_actual_end_at,
    jsonb_build_object('end_request_id',p_end_request_id,'end_reason',btrim(p_end_reason),
      'automatic_replanning',FALSE,'historical_visits_changed',FALSE));
  RETURN to_jsonb(v_interruption);
END;
$$;

CREATE OR REPLACE FUNCTION public.web_read_client_service_continuity(UUID,UUID,UUID)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT client_continuity_private.read_summary($1,$2,$3); $$;
CREATE OR REPLACE FUNCTION public.web_begin_client_service_interruption(UUID,UUID,UUID,UUID,TIMESTAMPTZ,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT client_continuity_private.begin_interruption($1,$2,$3,$4,$5,$6,$7,$8,$9,$10); $$;
CREATE OR REPLACE FUNCTION public.web_confirm_client_service_interruption(UUID,UUID,UUID,UUID)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT client_continuity_private.confirm_interruption($1,$2,$3,$4); $$;
CREATE OR REPLACE FUNCTION public.web_end_client_service_interruption(UUID,UUID,UUID,UUID,UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT client_continuity_private.end_interruption($1,$2,$3,$4,$5,$6,$7,$8); $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA client_continuity_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION client_continuity_private.read_summary(UUID,UUID,UUID),
  client_continuity_private.begin_interruption(UUID,UUID,UUID,UUID,TIMESTAMPTZ,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ),
  client_continuity_private.confirm_interruption(UUID,UUID,UUID,UUID),
  client_continuity_private.end_interruption(UUID,UUID,UUID,UUID,UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.web_read_client_service_continuity(UUID,UUID,UUID),
  public.web_begin_client_service_interruption(UUID,UUID,UUID,UUID,TIMESTAMPTZ,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ),
  public.web_confirm_client_service_interruption(UUID,UUID,UUID,UUID),
  public.web_end_client_service_interruption(UUID,UUID,UUID,UUID,UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.web_read_client_service_continuity(UUID,UUID,UUID),
  public.web_begin_client_service_interruption(UUID,UUID,UUID,UUID,TIMESTAMPTZ,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ),
  public.web_confirm_client_service_interruption(UUID,UUID,UUID,UUID),
  public.web_end_client_service_interruption(UUID,UUID,UUID,UUID,UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT) TO authenticated;

COMMIT;
