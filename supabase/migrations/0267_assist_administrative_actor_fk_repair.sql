-- CareSuite+ 0267 — administrative Nachbearbeitung: Actor-FK live reparieren.
--
-- Ursache:
-- Die RPCs aus 0255 verwenden auth.uid() als updated_by/recorded_by. In neueren
-- Profilgenerationen ist auth.uid() jedoch profiles.auth_user_id, während die
-- Fremdschlüssel weiterhin profiles.id erwarten. Das führte nach erfolgreicher
-- Schema-Reparatur weiterhin zu 23503 und damit zur generischen Fehleranzeige.

CREATE OR REPLACE FUNCTION public.resolve_current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.id = auth.uid()
     OR p.auth_user_id = auth.uid()
  ORDER BY CASE WHEN p.id = auth.uid() THEN 0 ELSE 1 END
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_current_profile_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_current_profile_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.normalize_assist_visit_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  IF NEW.updated_by IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.id
  INTO v_profile_id
  FROM public.profiles p
  WHERE p.id = NEW.updated_by
     OR p.auth_user_id = NEW.updated_by
  ORDER BY CASE WHEN p.id = NEW.updated_by THEN 0 ELSE 1 END
  LIMIT 1;

  -- Audit-Tabellen erfassen auth.uid() weiterhin separat. Wenn für einen
  -- technischen Benutzer kein Profil existiert, darf die Fachmutation nicht
  -- an einem optionalen Actor-Fremdschlüssel scheitern.
  NEW.updated_by := v_profile_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_assist_visit_updated_by_trigger
  ON public.assist_visits;
CREATE TRIGGER normalize_assist_visit_updated_by_trigger
BEFORE INSERT OR UPDATE OF updated_by ON public.assist_visits
FOR EACH ROW
EXECUTE FUNCTION public.normalize_assist_visit_updated_by();

CREATE OR REPLACE FUNCTION public.normalize_assist_time_event_recorded_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  IF NEW.recorded_by IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.id
  INTO v_profile_id
  FROM public.profiles p
  WHERE p.id = NEW.recorded_by
     OR p.auth_user_id = NEW.recorded_by
  ORDER BY CASE WHEN p.id = NEW.recorded_by THEN 0 ELSE 1 END
  LIMIT 1;

  NEW.recorded_by := v_profile_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_assist_time_event_recorded_by_trigger
  ON public.assist_time_events;
CREATE TRIGGER normalize_assist_time_event_recorded_by_trigger
BEFORE INSERT OR UPDATE OF recorded_by ON public.assist_time_events
FOR EACH ROW
EXECUTE FUNCTION public.normalize_assist_time_event_recorded_by();

COMMENT ON FUNCTION public.resolve_current_profile_id() IS
  'Löst auth.uid() kompatibel auf profiles.id oder profiles.auth_user_id auf.';
COMMENT ON FUNCTION public.normalize_assist_visit_updated_by() IS
  'Verhindert Actor-FK-Fehler bei administrativen Assist-Mutationen.';
COMMENT ON FUNCTION public.normalize_assist_time_event_recorded_by() IS
  'Verhindert Actor-FK-Fehler bei administrativ erzeugten Assist-Zeitereignissen.';

NOTIFY pgrst, 'reload schema';
