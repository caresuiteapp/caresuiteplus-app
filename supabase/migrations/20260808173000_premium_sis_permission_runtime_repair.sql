-- CareSuite HealthOS — Premium-SIS: produktive Rollen- und RPC-Reparatur
-- Behebt die Laufzeitlücke zwischen den statischen Pflege-Rechten der App
-- und den tatsächlich in PostgreSQL ausgewerteten role_permissions.

INSERT INTO public.permission_catalog
  (key, module, category, label, description, risk_level, requires_audit)
VALUES
  ('pflege.plans.view', 'pflege', 'plans',
   'Pflegeplanung und SIS ansehen',
   'Aktive Pflegefälle, Pflegeplanungen und SIS-Dokumentationen mandantenbezogen lesen.',
   'high', TRUE)
ON CONFLICT (key) DO UPDATE SET
  module = EXCLUDED.module,
  category = EXCLUDED.category,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  risk_level = EXCLUDED.risk_level,
  requires_audit = EXCLUDED.requires_audit,
  updated_at = NOW();

-- Kanonische und produktive Legacy-Rollen erhalten ausschließlich das
-- Leserecht. Die fachliche Klient:innenabgrenzung bleibt unverändert in
-- is_active_pfleger_client(): aktive Zuordnung zum Modul "pflege" ist Pflicht.
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, 'pflege.plans.view'
FROM public.roles r
WHERE r.key IN (
  'owner', 'admin', 'management', 'geschaeftsfuehrung',
  'business_admin', 'business_manager',
  'nurse', 'pdl', 'pflege', 'pflegefachkraft'
)
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO public.role_template_permissions
  (role_template_id, permission_key, allowed)
SELECT rt.id, 'pflege.plans.view', TRUE
FROM public.role_templates rt
WHERE rt.tenant_id IS NULL
  AND rt.role_key IN (
    'business_admin', 'business_manager', 'nurse'
  )
ON CONFLICT (role_template_id, permission_key) DO UPDATE SET
  allowed = TRUE,
  updated_at = NOW();

-- Geschäftsführung/Admin sowie ein vorhandenes Bearbeitungsrecht schließen
-- das fachlich zwingende Leserecht ein. Die Mandanten- und Pflegefallgrenzen
-- werden dadurch nicht erweitert.
CREATE OR REPLACE FUNCTION public.can_view_care_assessment(p_subject_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_tenant_admin()
    OR CASE WHEN p_subject_type = 'resident'
      THEN public.has_permission('stationaer.residents.view')
        OR public.has_permission('stationaer.assessments.manage')
      ELSE public.has_permission('pflege.plans.view')
        OR public.has_permission('pflege.assessments.manage')
    END
$$;

CREATE OR REPLACE FUNCTION public.can_manage_care_assessment(p_subject_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_tenant_admin()
    OR CASE WHEN p_subject_type = 'resident'
      THEN public.has_permission('stationaer.assessments.manage')
      ELSE public.has_permission('pflege.assessments.manage')
    END
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
  IF NOT (
    public.is_tenant_admin()
    OR public.has_permission('pflege.plans.view')
    OR public.has_permission('pflege.assessments.manage')
  ) THEN
    RAISE EXCEPTION 'Keine Berechtigung für Pflegeklient:innen.' USING ERRCODE = '42501';
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
    AND c.status = 'active'::public.client_status
  ORDER BY c.last_name, c.first_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_view_care_assessment(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_care_assessment(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_pfleger_clients() TO authenticated;

COMMENT ON FUNCTION public.list_pfleger_clients() IS
  'Aktive Pflegefälle für SIS; Admin/Manage impliziert Lesen, Assist-Zuordnungen bleiben ausgeschlossen.';
