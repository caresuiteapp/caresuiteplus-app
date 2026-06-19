-- Erweiterter Mandanten-Leistungskatalog: Pflege, Stationär, Beratung
-- Idempotent: seedet pro Modul nur wenn noch keine Einträge existieren.

CREATE OR REPLACE FUNCTION public.seed_tenant_service_catalog(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rate NUMERIC(10, 2);
  v_catalog_id UUID;
BEGIN
  SELECT default_hourly_rate INTO v_rate
  FROM public.tenant_billing_settings
  WHERE tenant_id = p_tenant_id;

  v_rate := COALESCE(v_rate, 38.00);

  -- Assist
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_service_catalog
    WHERE tenant_id = p_tenant_id AND module_key = 'assist'
  ) THEN
    INSERT INTO public.tenant_service_catalog (
      tenant_id, module_key, service_key, name, description, unit, category, sort_order
    ) VALUES
      (p_tenant_id, 'assist', 'assist.alltagsbegleitung', 'Alltagsbegleitung',
       'Individuelle Alltagsbegleitung und Betreuung', 'hour', 'service', 10),
      (p_tenant_id, 'assist', 'assist.entlastung_45b', 'Entlastungsleistung § 45b SGB XI',
       'Entlastungsleistung nach § 45b SGB XI', 'hour', 'service', 20),
      (p_tenant_id, 'assist', 'assist.verhinderungspflege_39', 'Verhinderungspflege § 39 SGB XI',
       'Verhinderungspflege nach § 39 SGB XI', 'hour', 'service', 30),
      (p_tenant_id, 'assist', 'assist.haushaltshilfe_38', 'Haushaltshilfe § 38 SGB V',
       'Haushaltshilfe nach § 38 SGB V', 'hour', 'service', 40),
      (p_tenant_id, 'assist', 'assist.travel.km', 'Fahrtkosten (Kilometer)',
       'Kilometerpauschale für Assist-Fahrten', 'km', 'travel', 100),
      (p_tenant_id, 'assist', 'assist.surcharge.weekend', 'Wochenend-Zuschlag',
       'Zuschlag für Leistungen am Wochenende', 'percent', 'surcharge', 110)
    ON CONFLICT (tenant_id, service_key) DO NOTHING;

    SELECT id INTO v_catalog_id
    FROM public.tenant_service_catalog
    WHERE tenant_id = p_tenant_id AND service_key = 'assist.alltagsbegleitung';

    IF v_catalog_id IS NOT NULL THEN
      INSERT INTO public.tenant_service_prices (
        tenant_id, catalog_id, price_net, tax_rate, tax_mode, valid_from, is_default
      ) VALUES (
        p_tenant_id, v_catalog_id, v_rate, 0, 'exempt_4_16', CURRENT_DATE, TRUE
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Pflege
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_service_catalog
    WHERE tenant_id = p_tenant_id AND module_key = 'pflege'
  ) THEN
    INSERT INTO public.tenant_service_catalog (
      tenant_id, module_key, service_key, name, description, unit, category, sort_order
    ) VALUES
      (p_tenant_id, 'pflege', 'pflege.grundpflege', 'Grundpflege',
       'Körperpflege, Ernährung und Mobilität im häuslichen Umfeld', 'hour', 'service', 10),
      (p_tenant_id, 'pflege', 'pflege.behandlungspflege', 'Behandlungspflege',
       'Medizinische Behandlungspflege durch examinierte Fachkräfte', 'hour', 'service', 20),
      (p_tenant_id, 'pflege', 'pflege.hauswirtschaft', 'Hauswirtschaftliche Versorgung',
       'Unterstützung im Haushalt und bei der Versorgung', 'hour', 'service', 30),
      (p_tenant_id, 'pflege', 'pflege.betreuung', 'Betreuungsleistungen',
       'Anleitung und Beaufsichtigung im Alltag', 'hour', 'service', 40),
      (p_tenant_id, 'pflege', 'pflege.travel.km', 'Fahrtkosten (Kilometer)',
       'Kilometerpauschale für Pflege-Fahrten', 'km', 'travel', 100),
      (p_tenant_id, 'pflege', 'pflege.surcharge.night', 'Nacht-Zuschlag',
       'Zuschlag für Leistungen in der Nacht', 'percent', 'surcharge', 110)
    ON CONFLICT (tenant_id, service_key) DO NOTHING;
  END IF;

  -- Stationär
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_service_catalog
    WHERE tenant_id = p_tenant_id AND module_key = 'stationaer'
  ) THEN
    INSERT INTO public.tenant_service_catalog (
      tenant_id, module_key, service_key, name, description, unit, category, sort_order
    ) VALUES
      (p_tenant_id, 'stationaer', 'stationaer.tagespflege', 'Tagespflege',
       'Teilstationäre Tagespflege in einer Einrichtung', 'day', 'service', 10),
      (p_tenant_id, 'stationaer', 'stationaer.kurzzeitpflege', 'Kurzzeitpflege',
       'Kurzzeitpflege bei vorübergehendem Pflegebedarf', 'day', 'service', 20),
      (p_tenant_id, 'stationaer', 'stationaer.verhinderungspflege', 'Verhinderungspflege stationär',
       'Stationäre Verhinderungspflege nach § 39 SGB XI', 'day', 'service', 30),
      (p_tenant_id, 'stationaer', 'stationaer.vollstationaer', 'Vollstationäre Pflege',
       'Dauerhafte vollstationäre Pflegeleistung', 'day', 'service', 40)
    ON CONFLICT (tenant_id, service_key) DO NOTHING;
  END IF;

  -- Beratung
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_service_catalog
    WHERE tenant_id = p_tenant_id AND module_key = 'beratung'
  ) THEN
    INSERT INTO public.tenant_service_catalog (
      tenant_id, module_key, service_key, name, description, unit, category, sort_order
    ) VALUES
      (p_tenant_id, 'beratung', 'beratung.pflegeberatung_7a', 'Pflegeberatung § 7a SGB XI',
       'Pflichtberatung nach § 7a SGB XI', 'visit', 'service', 10),
      (p_tenant_id, 'beratung', 'beratung.beratungsbesuch', 'Beratungsbesuch',
       'Individueller Beratungsbesuch bei Klienten oder Angehörigen', 'visit', 'service', 20),
      (p_tenant_id, 'beratung', 'beratung.case_management', 'Case Management',
       'Fallsteuerung und Koordination von Hilfeangeboten', 'hour', 'service', 30),
      (p_tenant_id, 'beratung', 'beratung.widerspruch', 'Widerspruchsberatung',
       'Beratung bei Widerspruchsverfahren und Leistungsansprüchen', 'visit', 'service', 40)
    ON CONFLICT (tenant_id, service_key) DO NOTHING;
  END IF;
END;
$$;

-- Bestehende Assist-Seed-Funktion delegiert an die erweiterte Funktion
CREATE OR REPLACE FUNCTION public.seed_tenant_assist_service_catalog(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.seed_tenant_service_catalog(p_tenant_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_tenant_service_catalog(UUID) TO authenticated;

-- Fehlende Modul-Kataloge für bestehende Mandanten nachziehen
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_tenant_service_catalog(r.id);
  END LOOP;
END;
$$;
