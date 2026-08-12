-- CareSuite HealthOS · Vitalwerte Live Final
-- Nicht destruktiv: vorhandene Messungen bleiben erhalten und werden, soweit möglich, übernommen.

INSERT INTO public.permission_catalog
  (key,module,category,label,description,risk_level,requires_audit)
VALUES
  ('pflege.vitals.manage','pflege','vitals','Vitalwerte konfigurieren und erfassen',
   'Klientenbezogene Messarten, Grenzbereiche und Vitalwertmessungen verwalten.','high',TRUE)
ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label,description=EXCLUDED.description,
  risk_level=EXCLUDED.risk_level,requires_audit=EXCLUDED.requires_audit,updated_at=NOW();

INSERT INTO public.role_permissions(role_id,permission_key)
SELECT r.id,'pflege.vitals.manage' FROM public.roles r
WHERE r.key IN ('business_admin','business_manager','nurse','pdl','pflegefachkraft')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_template_permissions(role_template_id,permission_key,allowed)
SELECT rt.id,'pflege.vitals.manage',TRUE FROM public.role_templates rt
WHERE rt.tenant_id IS NULL AND rt.role_key IN ('business_admin','business_manager','nurse')
ON CONFLICT (role_template_id,permission_key) DO UPDATE SET allowed=TRUE,updated_at=NOW();

CREATE TABLE IF NOT EXISTS public.vital_sign_catalog (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('basis','koerper','pflege','haemodynamik','beatmung','blutgas')),
  label TEXT NOT NULL,
  short_label TEXT NOT NULL,
  default_unit TEXT NOT NULL DEFAULT '',
  components JSONB NOT NULL DEFAULT '[]'::JSONB,
  default_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.vital_sign_catalog (key,category,label,short_label,default_unit,components,default_enabled,sort_order) VALUES
('blood_pressure','basis','Nichtinvasiver Blutdruck','Blutdruck','mmHg','["systolic","diastolic","map"]',TRUE,10),
('pulse','basis','Puls / Herzfrequenz','Puls','/min','["value"]',TRUE,20),
('respiratory_rate','basis','Atemfrequenz','Atmung','/min','["value"]',TRUE,30),
('oxygen','basis','Sauerstoffsättigung (SpO₂)','SpO₂','%','["value"]',TRUE,40),
('temperature','basis','Körpertemperatur','Temperatur','°C','["value"]',TRUE,50),
('weight','koerper','Körpergewicht','Gewicht','kg','["value"]',TRUE,100),
('height','koerper','Körpergröße','Größe','cm','["value"]',FALSE,110),
('bmi','koerper','Body-Mass-Index','BMI','kg/m²','["value"]',FALSE,120),
('body_surface_area','koerper','Körperoberfläche','KOF','m²','["value"]',FALSE,130),
('head_circumference','koerper','Kopfumfang','Kopfumfang','cm','["value"]',FALSE,140),
('blood_glucose','pflege','Blutzucker','BZ','mg/dl','["value"]',FALSE,200),
('blood_ketones','pflege','Blutketone','Ketone','mmol/l','["value"]',FALSE,210),
('pain_score','pflege','Schmerzskala','Schmerz','0–10','["value"]',FALSE,220),
('capillary_refill','pflege','Kapilläre Rückfüllzeit','Rekap.','s','["value"]',FALSE,230),
('urine_output','pflege','Urinausscheidung','Diurese','ml','["value"]',FALSE,240),
('fluid_balance','pflege','Flüssigkeitsbilanz','Bilanz','ml','["intake","output","balance"]',FALSE,250),
('gcs','pflege','Glasgow Coma Scale','GCS','3–15','["eyes","verbal","motor","total"]',FALSE,260),
('rass','pflege','Richmond Agitation-Sedation Scale','RASS','−5 bis +4','["value"]',FALSE,270),
('pupils','pflege','Pupillenstatus','Pupillen','mm','["leftSize","rightSize"]',FALSE,280),
('arterial_pressure','haemodynamik','Invasiver arterieller Blutdruck','ART','mmHg','["systolic","diastolic","map"]',FALSE,300),
('map','haemodynamik','Mittlerer arterieller Druck','MAP','mmHg','["value"]',FALSE,310),
('cvp','haemodynamik','Zentralvenöser Druck','ZVD','mmHg','["value"]',FALSE,320),
('cardiac_output','haemodynamik','Herzzeitvolumen','HZV','l/min','["value"]',FALSE,330),
('cardiac_index','haemodynamik','Herzindex','HI','l/min/m²','["value"]',FALSE,340),
('svv','haemodynamik','Schlagvolumenvariation','SVV','%','["value"]',FALSE,350),
('icp','haemodynamik','Intrakranieller Druck','ICP','mmHg','["value"]',FALSE,360),
('cpp','haemodynamik','Zerebraler Perfusionsdruck','CPP','mmHg','["value"]',FALSE,370),
('etco2','beatmung','Endtidales CO₂','etCO₂','mmHg','["value"]',FALSE,400),
('oxygen_flow','beatmung','Sauerstofffluss','O₂-Fluss','l/min','["value"]',FALSE,410),
('fio2','beatmung','Inspiratorische Sauerstofffraktion','FiO₂','%','["value"]',FALSE,420),
('peep','beatmung','Positiver endexspiratorischer Druck','PEEP','mbar','["value"]',FALSE,430),
('tidal_volume','beatmung','Atemzugvolumen','Vt','ml','["value"]',FALSE,440),
('minute_ventilation','beatmung','Atemminutenvolumen','AMV','l/min','["value"]',FALSE,450),
('peak_airway_pressure','beatmung','Spitzen-Atemwegsdruck','Ppeak','mbar','["value"]',FALSE,460),
('plateau_pressure','beatmung','Plateaudruck','Pplat','mbar','["value"]',FALSE,470),
('ventilator_rate','beatmung','Beatmungsfrequenz','AF Gerät','/min','["value"]',FALSE,480),
('ph','blutgas','pH-Wert','pH','','["value"]',FALSE,500),
('pco2','blutgas','Kohlendioxidpartialdruck','pCO₂','mmHg','["value"]',FALSE,510),
('po2','blutgas','Sauerstoffpartialdruck','pO₂','mmHg','["value"]',FALSE,520),
('bicarbonate','blutgas','Bicarbonat','HCO₃⁻','mmol/l','["value"]',FALSE,530),
('base_excess','blutgas','Basenüberschuss','BE','mmol/l','["value"]',FALSE,540),
('lactate','blutgas','Laktat','Laktat','mmol/l','["value"]',FALSE,550)
ON CONFLICT (key) DO UPDATE SET
  category=EXCLUDED.category,label=EXCLUDED.label,short_label=EXCLUDED.short_label,
  default_unit=EXCLUDED.default_unit,components=EXCLUDED.components,
  default_enabled=EXCLUDED.default_enabled,sort_order=EXCLUDED.sort_order,is_active=TRUE,updated_at=NOW();

CREATE TABLE IF NOT EXISTS public.client_vital_sign_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vital_key TEXT NOT NULL REFERENCES public.vital_sign_catalog(key),
  enabled BOOLEAN NOT NULL,
  limits JSONB NOT NULL DEFAULT '{}'::JSONB,
  schedule JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  updated_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id,client_id,vital_key)
);

CREATE TABLE IF NOT EXISTS public.vital_sign_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vital_key TEXT NOT NULL REFERENCES public.vital_sign_catalog(key),
  values JSONB NOT NULL CHECK (jsonb_typeof(values)='object' AND values <> '{}'::JSONB),
  display_value TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  context JSONB NOT NULL DEFAULT '{}'::JSONB,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','device','import')),
  flag_status TEXT NOT NULL DEFAULT 'unrated' CHECK (flag_status IN ('unrated','within_configured_range','outside_configured_range')),
  measured_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  recorded_by UUID NOT NULL REFERENCES public.profiles(id),
  recorded_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.vital_sign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  measurement_id UUID NOT NULL REFERENCES public.vital_sign_measurements(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'vital.out_of_range',
  summary TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (measurement_id,event_type)
);

CREATE INDEX IF NOT EXISTS idx_vital_measurements_tenant_client_time ON public.vital_sign_measurements(tenant_id,client_id,measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_vital_measurements_tenant_key_time ON public.vital_sign_measurements(tenant_id,vital_key,measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_vital_settings_client ON public.client_vital_sign_settings(tenant_id,client_id);
CREATE INDEX IF NOT EXISTS idx_vital_events_tenant_time ON public.vital_sign_events(tenant_id,created_at DESC);

CREATE OR REPLACE FUNCTION public.vital_actor_can_record()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=auth.uid()
      AND p.tenant_id=public.current_tenant_id()
      AND p.role_key IN ('business_admin','business_manager','nurse','caregiver')
  ) AND public.has_permission('pflege.vitals.manage')
$$;

CREATE OR REPLACE FUNCTION public.vital_actor_can_configure()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=auth.uid()
      AND p.tenant_id=public.current_tenant_id()
      AND p.role_key IN ('business_admin','business_manager','nurse')
  ) AND public.has_permission('pflege.vitals.manage')
$$;

CREATE OR REPLACE FUNCTION public.get_client_vital_sign_configuration(p_client_id UUID)
RETURNS TABLE(vital_key TEXT,enabled BOOLEAN,limits JSONB,schedule JSONB)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tenant UUID := public.current_tenant_id();
BEGIN
  IF v_tenant IS NULL OR NOT public.has_permission('pflege.vitals.view') THEN RAISE EXCEPTION 'Keine Berechtigung.'; END IF;
  IF NOT public.is_active_pfleger_client(v_tenant,p_client_id) THEN RAISE EXCEPTION 'Kein aktiver Pflegefall.'; END IF;
  RETURN QUERY SELECT catalog.key,COALESCE(settings.enabled,catalog.default_enabled),COALESCE(settings.limits,'{}'::JSONB),COALESCE(settings.schedule,'{}'::JSONB)
  FROM public.vital_sign_catalog catalog LEFT JOIN public.client_vital_sign_settings settings
    ON settings.tenant_id=v_tenant AND settings.client_id=p_client_id AND settings.vital_key=catalog.key
  WHERE catalog.is_active ORDER BY catalog.sort_order;
END $$;

CREATE OR REPLACE FUNCTION public.set_client_vital_sign_configuration(
  p_client_id UUID,p_vital_key TEXT,p_enabled BOOLEAN,p_limits JSONB DEFAULT '{}'::JSONB,p_schedule JSONB DEFAULT '{}'::JSONB
) RETURNS public.client_vital_sign_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tenant UUID := public.current_tenant_id(); v_result public.client_vital_sign_settings;
BEGIN
  IF NOT public.vital_actor_can_configure() THEN RAISE EXCEPTION 'Keine Berechtigung zur Vitalwert-Konfiguration.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=p_client_id AND c.tenant_id=v_tenant) THEN RAISE EXCEPTION 'Klient:in nicht gefunden.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.vital_sign_catalog WHERE key=p_vital_key AND is_active) THEN RAISE EXCEPTION 'Unbekannte Messart.'; END IF;
  INSERT INTO public.client_vital_sign_settings(tenant_id,client_id,vital_key,enabled,limits,schedule,created_by,updated_by)
  VALUES(v_tenant,p_client_id,p_vital_key,p_enabled,COALESCE(p_limits,'{}'),COALESCE(p_schedule,'{}'),auth.uid(),auth.uid())
  ON CONFLICT(tenant_id,client_id,vital_key) DO UPDATE SET enabled=EXCLUDED.enabled,limits=EXCLUDED.limits,schedule=EXCLUDED.schedule,updated_by=auth.uid(),updated_at=clock_timestamp()
  RETURNING * INTO v_result;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.record_vital_sign_measurement(
  p_client_id UUID,p_vital_key TEXT,p_values JSONB,p_context JSONB DEFAULT '{}'::JSONB,p_note TEXT DEFAULT NULL,p_source TEXT DEFAULT 'manual'
) RETURNS public.vital_sign_measurements
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_tenant UUID := public.current_tenant_id(); v_catalog public.vital_sign_catalog;
  v_setting public.client_vital_sign_settings; v_enabled BOOLEAN; v_name TEXT; v_display TEXT;
  v_flag TEXT := 'unrated'; v_item RECORD; v_limit JSONB; v_number NUMERIC;
  v_result public.vital_sign_measurements;
BEGIN
  IF NOT public.vital_actor_can_record() THEN RAISE EXCEPTION 'Keine Berechtigung zur Vitalwerterfassung.'; END IF;
  IF p_source NOT IN ('manual','device','import') THEN RAISE EXCEPTION 'Ungültige Datenquelle.'; END IF;
  IF jsonb_typeof(p_values) <> 'object' OR p_values='{}'::JSONB THEN RAISE EXCEPTION 'Messwert fehlt.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=p_client_id AND c.tenant_id=v_tenant) THEN RAISE EXCEPTION 'Klient:in nicht gefunden.'; END IF;
  SELECT * INTO v_catalog FROM public.vital_sign_catalog WHERE key=p_vital_key AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unbekannte Messart.'; END IF;
  SELECT * INTO v_setting FROM public.client_vital_sign_settings WHERE tenant_id=v_tenant AND client_id=p_client_id AND vital_key=p_vital_key;
  v_enabled := COALESCE(v_setting.enabled,v_catalog.default_enabled);
  IF NOT v_enabled THEN RAISE EXCEPTION 'Dieser Vitalwert ist für die Klient:in deaktiviert.'; END IF;
  SELECT COALESCE(NULLIF(trim(concat_ws(' ',p.first_name,p.last_name)),''),NULLIF(p.display_name,''),p.email,'Unbekannt') INTO v_name
    FROM public.profiles p WHERE p.id=auth.uid() AND p.tenant_id=v_tenant;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Mitarbeiterprofil konnte nicht zugeordnet werden.'; END IF;

  v_display := CASE
    WHEN p_vital_key IN ('blood_pressure','arterial_pressure') THEN concat(COALESCE(p_values->>'systolic','—'),'/',COALESCE(p_values->>'diastolic','—'),CASE WHEN p_values?'map' THEN concat(' (MAP ',p_values->>'map',')') ELSE '' END)
    WHEN p_vital_key='gcs' THEN concat('GCS ',COALESCE(p_values->>'total','—'),' (E',COALESCE(p_values->>'eyes','—'),' V',COALESCE(p_values->>'verbal','—'),' M',COALESCE(p_values->>'motor','—'),')')
    WHEN p_vital_key='fluid_balance' THEN concat(CASE WHEN COALESCE((p_values->>'balance')::NUMERIC,0)>=0 THEN '+' ELSE '' END,COALESCE(p_values->>'balance','—'))
    WHEN p_vital_key='pupils' THEN concat('L ',COALESCE(p_values->>'leftSize','—'),' / R ',COALESCE(p_values->>'rightSize','—'))
    ELSE COALESCE(p_values->>'value',(SELECT value FROM jsonb_each_text(p_values) LIMIT 1),'—') END;

  IF v_setting.id IS NOT NULL AND v_setting.limits <> '{}'::JSONB THEN
    v_flag := 'within_configured_range';
    FOR v_item IN SELECT key,value FROM jsonb_each_text(p_values) LOOP
      BEGIN v_number := v_item.value::NUMERIC; EXCEPTION WHEN invalid_text_representation THEN CONTINUE; END;
      v_limit := v_setting.limits->v_item.key;
      IF v_limit IS NOT NULL AND ((v_limit?'min' AND v_number < (v_limit->>'min')::NUMERIC) OR (v_limit?'max' AND v_number > (v_limit->>'max')::NUMERIC)) THEN
        v_flag := 'outside_configured_range'; EXIT;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.vital_sign_measurements(tenant_id,client_id,vital_key,values,display_value,unit,context,note,source,flag_status,recorded_by,recorded_by_name)
  VALUES(v_tenant,p_client_id,p_vital_key,p_values,v_display,v_catalog.default_unit,COALESCE(p_context,'{}'),NULLIF(trim(p_note),''),p_source,v_flag,auth.uid(),v_name)
  RETURNING * INTO v_result;

  INSERT INTO public.client_timeline_events(tenant_id,client_id,event_type,icon,title,subtitle,status,actor_name,is_internal,metadata)
  VALUES(v_tenant,p_client_id,'pflegeplan','💓',concat(v_catalog.label,' erfasst'),concat(v_display,CASE WHEN v_catalog.default_unit='' THEN '' ELSE concat(' ',v_catalog.default_unit) END),
    CASE WHEN v_flag='outside_configured_range' THEN 'fehlerhaft' ELSE 'aktiv' END,v_name,TRUE,jsonb_build_object('measurementId',v_result.id,'vitalKey',p_vital_key,'flagStatus',v_flag));

  IF v_flag='outside_configured_range' THEN
    INSERT INTO public.vital_sign_events(tenant_id,client_id,measurement_id,summary,payload,created_by)
    VALUES(v_tenant,p_client_id,v_result.id,concat(v_catalog.label,': außerhalb des klientenbezogen konfigurierten Bereichs'),jsonb_build_object('values',p_values,'limits',v_setting.limits,'doctorContactSuggestion',TRUE),auth.uid());
    IF to_regclass('public.internal_tasks') IS NOT NULL THEN
      INSERT INTO public.internal_tasks(tenant_id,task_type,status,priority,title,description,created_by_user_id,linked_entity_type,linked_entity_id,source,is_internal_only,employee_visible)
      VALUES(v_tenant,'vital.out_of_range','open','high',concat('Vitalwert prüfen: ',v_catalog.label),concat(v_display,' ',v_catalog.default_unit,' · Ärztlichen Kontakt nach fachlicher Einschätzung prüfen.'),auth.uid(),'client',p_client_id,'vital_signs',TRUE,FALSE);
    END IF;
  END IF;
  RETURN v_result;
END $$;

CREATE OR REPLACE VIEW public.v_vital_measurement_overview WITH (security_invoker=TRUE) AS
SELECT m.id,m.tenant_id,m.client_id,trim(concat_ws(' ',c.first_name,c.last_name)) AS client_name,
  m.vital_key,catalog.label AS vital_label,m.display_value,m.unit,m.values,m.context,m.note,m.source,m.flag_status,
  m.measured_at,m.recorded_by,m.recorded_by_name,m.created_at
FROM public.vital_sign_measurements m JOIN public.clients c ON c.id=m.client_id AND c.tenant_id=m.tenant_id
JOIN public.vital_sign_catalog catalog ON catalog.key=m.vital_key;

-- Vorhandene Dokumentationswerte übernehmen, ohne die Alt-Tabelle zu verändern.
INSERT INTO public.vital_sign_measurements(id,tenant_id,client_id,vital_key,values,display_value,unit,context,note,source,flag_status,measured_at,recorded_by,recorded_by_name,created_at)
SELECT r.id,r.tenant_id,r.client_id,r.sign_type,jsonb_build_object('legacyText',r.value_text),r.value_text,COALESCE(r.unit,''),'{}',r.documentation_hint,'import','unrated',r.measured_at,r.recorded_by,
  COALESCE(NULLIF(trim(concat_ws(' ',p.first_name,p.last_name)),''),NULLIF(p.display_name,''),p.email,'Historische Erfassung'),r.created_at
FROM public.vital_sign_records r LEFT JOIN public.profiles p ON p.id=r.recorded_by
WHERE r.recorded_by IS NOT NULL AND EXISTS(SELECT 1 FROM public.vital_sign_catalog c WHERE c.key=r.sign_type)
ON CONFLICT(id) DO NOTHING;

ALTER TABLE public.vital_sign_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_vital_sign_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vital_sign_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vital_sign_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vital_catalog_read ON public.vital_sign_catalog;
CREATE POLICY vital_catalog_read ON public.vital_sign_catalog FOR SELECT TO authenticated USING (is_active);
DROP POLICY IF EXISTS vital_settings_read ON public.client_vital_sign_settings;
CREATE POLICY vital_settings_read ON public.client_vital_sign_settings FOR SELECT TO authenticated USING (tenant_id=public.current_tenant_id() AND public.has_permission('pflege.vitals.view'));
DROP POLICY IF EXISTS vital_measurements_read ON public.vital_sign_measurements;
CREATE POLICY vital_measurements_read ON public.vital_sign_measurements FOR SELECT TO authenticated USING (tenant_id=public.current_tenant_id() AND public.has_permission('pflege.vitals.view'));
DROP POLICY IF EXISTS vital_events_read ON public.vital_sign_events;
CREATE POLICY vital_events_read ON public.vital_sign_events FOR SELECT TO authenticated USING (tenant_id=public.current_tenant_id() AND public.has_permission('pflege.vitals.view'));

GRANT SELECT ON public.vital_sign_catalog,public.client_vital_sign_settings,public.vital_sign_measurements,public.vital_sign_events,public.v_vital_measurement_overview TO authenticated;
GRANT EXECUTE ON FUNCTION public.vital_actor_can_record(),public.vital_actor_can_configure(),public.get_client_vital_sign_configuration(UUID),
  public.set_client_vital_sign_configuration(UUID,TEXT,BOOLEAN,JSONB,JSONB),public.record_vital_sign_measurement(UUID,TEXT,JSONB,JSONB,TEXT,TEXT) TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.vital_sign_measurements FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.vital_sign_events FROM authenticated;

COMMENT ON TABLE public.vital_sign_measurements IS 'Append-only Vitalwertdokumentation mit serverseitigem Zeitstempel und authentifizierter Mitarbeiterzuordnung.';
COMMENT ON COLUMN public.vital_sign_measurements.flag_status IS 'Nur Vergleich mit klientenbezogen konfigurierten Grenzen; keine Diagnose oder Therapieentscheidung.';
