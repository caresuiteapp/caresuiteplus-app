-- CareSuite HealthOS — Pflege-SIS: harte Fachbereichsgrenze
-- Eine ambulante SIS darf ausschließlich für einen aktiv dem Modul Pflege
-- zugeordneten Pflegefall angelegt, gelesen und bearbeitet werden.

CREATE OR REPLACE FUNCTION public.is_active_pfleger_client(
  p_tenant_id UUID,
  p_client_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    JOIN public.client_module_assignments a
      ON a.tenant_id = c.tenant_id
     AND a.client_id = c.id
     AND a.module_key = 'pflege'
     AND a.is_active = TRUE
     AND a.status NOT IN ('inactive', 'deactivated', 'archiviert')
    WHERE c.tenant_id = p_tenant_id
      AND c.id = p_client_id
      AND c.status IN ('aktiv', 'in_bearbeitung')
  )
$$;

CREATE OR REPLACE FUNCTION public.list_pfleger_clients()
RETURNS TABLE (
  tenant_id UUID,
  id UUID,
  first_name TEXT,
  last_name TEXT,
  date_of_birth DATE,
  care_level TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission('pflege.plans.view') THEN
    RAISE EXCEPTION 'Keine Berechtigung für Pflegeklient:innen.';
  END IF;

  RETURN QUERY
  SELECT c.tenant_id, c.id, c.first_name, c.last_name, c.date_of_birth, c.care_level::TEXT
  FROM public.clients c
  JOIN public.client_module_assignments a
    ON a.tenant_id = c.tenant_id
   AND a.client_id = c.id
   AND a.module_key = 'pflege'
   AND a.is_active = TRUE
   AND a.status NOT IN ('inactive', 'deactivated', 'archiviert')
  WHERE c.tenant_id = public.current_tenant_id()
    AND c.status IN ('aktiv', 'in_bearbeitung')
  ORDER BY c.last_name, c.first_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_care_assessment_subject()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.subject_type = 'client'
     AND NOT public.is_active_pfleger_client(NEW.tenant_id, NEW.subject_id) THEN
    RAISE EXCEPTION 'SIS gesperrt: Die Person besitzt keinen aktiven Pflegefall. Assist-Klient:innen werden nicht übernommen.';
  END IF;

  IF NEW.subject_type = 'resident' AND NOT EXISTS (
    SELECT 1 FROM public.care_records
    WHERE id = NEW.subject_id
      AND tenant_id = NEW.tenant_id
      AND record_type = 'resident'
  ) THEN
    RAISE EXCEPTION 'Bewohner:in gehört nicht zum Mandanten oder existiert nicht.';
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS care_assessments_select ON public.care_assessments;
CREATE POLICY care_assessments_select ON public.care_assessments
FOR SELECT USING (
  tenant_id = public.current_tenant_id()
  AND public.can_view_care_assessment(subject_type)
  AND (
    subject_type <> 'client'
    OR public.is_active_pfleger_client(tenant_id, subject_id)
  )
);

DROP POLICY IF EXISTS care_assessments_write ON public.care_assessments;
CREATE POLICY care_assessments_write ON public.care_assessments
FOR ALL USING (
  tenant_id = public.current_tenant_id()
  AND public.can_manage_care_assessment(subject_type)
  AND (
    subject_type <> 'client'
    OR public.is_active_pfleger_client(tenant_id, subject_id)
  )
) WITH CHECK (
  tenant_id = public.current_tenant_id()
  AND public.can_manage_care_assessment(subject_type)
  AND (
    subject_type <> 'client'
    OR public.is_active_pfleger_client(tenant_id, subject_id)
  )
);

DO $$
DECLARE tab TEXT;
BEGIN
  FOREACH tab IN ARRAY ARRAY[
    'care_assessment_topics','care_assessment_risks','care_assessment_measures',
    'care_assessment_evaluations','care_assessment_events','care_assessment_links','care_assessment_versions'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant ON public.%I', tab, tab);
    EXECUTE format(
      'CREATE POLICY %I_tenant ON public.%I FOR ALL USING (
        tenant_id = public.current_tenant_id() AND EXISTS (
          SELECT 1 FROM public.care_assessments a
          WHERE a.id = %I.assessment_id
            AND a.tenant_id = %I.tenant_id
            AND public.can_view_care_assessment(a.subject_type)
            AND (a.subject_type <> ''client'' OR public.is_active_pfleger_client(a.tenant_id, a.subject_id))
        )
      ) WITH CHECK (
        tenant_id = public.current_tenant_id() AND EXISTS (
          SELECT 1 FROM public.care_assessments a
          WHERE a.id = %I.assessment_id
            AND a.tenant_id = %I.tenant_id
            AND public.can_manage_care_assessment(a.subject_type)
            AND (a.subject_type <> ''client'' OR public.is_active_pfleger_client(a.tenant_id, a.subject_id))
        )
      )', tab, tab, tab, tab, tab, tab
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_active_pfleger_client(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_pfleger_clients() TO authenticated;

COMMENT ON FUNCTION public.list_pfleger_clients() IS
  'Liefert ausschließlich aktive Pflegefälle; Assist-Zuordnungen sind ausgeschlossen.';
