-- Stable company classification; no existing tenant records are bulk rewritten.
BEGIN;
CREATE TABLE IF NOT EXISTS public.company_registration_catalog (
  kind text NOT NULL CHECK (kind IN ('legal_form','industry')),
  key text NOT NULL,
  label text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (kind,key)
);
ALTER TABLE public.company_registration_catalog ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_registration_catalog' AND policyname='company_registration_catalog_read') THEN
    CREATE POLICY company_registration_catalog_read ON public.company_registration_catalog FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;
REVOKE ALL ON public.company_registration_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.company_registration_catalog TO anon, authenticated;
GRANT ALL ON public.company_registration_catalog TO service_role;
INSERT INTO public.company_registration_catalog(kind,key,label,aliases,sort_order) VALUES
('industry','alltagsbegleitung','Ambulante Alltagsbegleitung',ARRAY['Alltagsbegleitung','Alltagsbegleiter','ambulante Alltagshilfe']::text[],0),
('industry','betreuungsdienst','Ambulanter Betreuungsdienst',ARRAY['Betreuungsdienst']::text[],1),
('industry','pflegedienst','Ambulanter Pflegedienst',ARRAY['Pflegedienst','ambulante Pflege']::text[],2),
('industry','haushaltsdienst','Haushaltsnahe Dienstleistungen',ARRAY['Haushaltshilfe','haushaltsnahe Unterstützung']::text[],3),
('industry','persoenliche_assistenz','Persönliche Assistenz',ARRAY['persoenliche Assistenz']::text[],4),
('industry','betreutes_wohnen','Betreutes Wohnen / Servicewohnen',ARRAY['Betreutes Wohnen','Servicewohnen']::text[],5),
('industry','ambulante_wg','Ambulant betreute Wohngemeinschaft',ARRAY['ambulant betreute WG']::text[],6),
('industry','tagespflege','Tagespflege',ARRAY[]::text[],7),
('industry','nachtpflege','Nachtpflege',ARRAY[]::text[],8),
('industry','kurzzeitpflege','Kurzzeitpflege',ARRAY[]::text[],9),
('industry','stationaere_pflege','Vollstationäre Pflegeeinrichtung',ARRAY['Pflegeheim','stationäre Pflege','vollstationäre Pflege']::text[],10),
('industry','eingliederungshilfe','Einrichtung der Eingliederungshilfe',ARRAY['Eingliederungshilfe']::text[],11),
('industry','pflegeberatung','Pflegeberatung / Beratungsstelle',ARRAY['Pflegeberatung','Pflegeberatungsstelle']::text[],12),
('industry','bildung','Bildungs- und Schulungsanbieter',ARRAY['Bildungsanbieter','Schulungsanbieter','Akademie']::text[],13),
('industry','pflege_allgemein','Pflegeeinrichtung (allgemein)',ARRAY['Pflege','Pflegeeinrichtung']::text[],14),
('industry','sonstige','Sonstiger Einrichtungstyp',ARRAY[]::text[],15),
('legal_form','einzelunternehmen','Einzelunternehmen',ARRAY['Einzelunternehmer','Einzelunternehmerin']::text[],0),
('legal_form','ek','e. K.',ARRAY['e.K.','e.K','eingetragener Kaufmann','eingetragene Kauffrau']::text[],1),
('legal_form','ug','UG (haftungsbeschränkt)',ARRAY['UG','Unternehmergesellschaft (haftungsbeschränkt)']::text[],2),
('legal_form','gmbh','GmbH',ARRAY['Gesellschaft mit beschränkter Haftung']::text[],3),
('legal_form','gug','gUG (haftungsbeschränkt)',ARRAY['gUG','gemeinnützige UG (haftungsbeschränkt)']::text[],4),
('legal_form','ggmbh','gGmbH',ARRAY['gemeinnützige GmbH']::text[],5),
('legal_form','gbr','GbR',ARRAY['Gesellschaft bürgerlichen Rechts']::text[],6),
('legal_form','egbr','eGbR',ARRAY['eingetragene Gesellschaft bürgerlichen Rechts']::text[],7),
('legal_form','ohg','OHG',ARRAY['offene Handelsgesellschaft']::text[],8),
('legal_form','kg','KG',ARRAY['Kommanditgesellschaft']::text[],9),
('legal_form','gmbh_co_kg','GmbH & Co. KG',ARRAY['GmbH & Co KG']::text[],10),
('legal_form','ag','AG',ARRAY['Aktiengesellschaft']::text[],11),
('legal_form','eg','eG',ARRAY['eingetragene Genossenschaft']::text[],12),
('legal_form','ev','e. V.',ARRAY['e.V.','e.V','eingetragener Verein']::text[],13),
('legal_form','stiftung','Stiftung',ARRAY[]::text[],14),
('legal_form','kdoer','Körperschaft des öffentlichen Rechts',ARRAY['KöR','KdöR']::text[],15),
('legal_form','adoer','Anstalt des öffentlichen Rechts',ARRAY['AöR']::text[],16),
('legal_form','sonstige','Sonstige Rechtsform',ARRAY[]::text[],17)
ON CONFLICT(kind,key) DO UPDATE SET label=EXCLUDED.label,aliases=EXCLUDED.aliases,sort_order=EXCLUDED.sort_order;

CREATE OR REPLACE FUNCTION public.normalize_company_catalog_text(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$ SELECT lower(regexp_replace(btrim(p_value), '\s+', ' ', 'g')); $$;

CREATE OR REPLACE FUNCTION public.resolve_company_registration_key(p_kind text,p_value text)
RETURNS text LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT c.key FROM public.company_registration_catalog c
  WHERE c.kind=p_kind AND (
    (c.key='sonstige' AND btrim(p_value) ~* '^sonstige:\s*\S')
    OR EXISTS (
      SELECT 1 FROM unnest(ARRAY[c.key,c.label] || c.aliases) a(value)
      WHERE public.normalize_company_catalog_text(a.value)=public.normalize_company_catalog_text(p_value)
    )
  )
  ORDER BY c.sort_order,c.key LIMIT 1;
$$;

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS legal_form_key text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS industry_key text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS registration_catalog_version text;
COMMENT ON COLUMN public.tenants.legal_form_key IS 'Stable key in company_registration_catalog (legal_form). NULL requires manual classification.';
COMMENT ON COLUMN public.tenants.industry_key IS 'Stable key in company_registration_catalog (industry). NULL requires manual classification.';
CREATE INDEX IF NOT EXISTS tenants_company_legal_form_key_idx ON public.tenants(legal_form_key) WHERE legal_form_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS tenants_company_industry_key_idx ON public.tenants(industry_key) WHERE industry_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_company_registration_keys()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Always derive keys from actual company fields; never trust separately submitted keys.
  NEW.legal_form_key := public.resolve_company_registration_key('legal_form',NEW.legal_form);
  NEW.industry_key := public.resolve_company_registration_key('industry',NEW.industry);
  IF NEW.legal_form_key IS NOT NULL AND NEW.legal_form_key <> 'sonstige' THEN
    SELECT label INTO NEW.legal_form FROM public.company_registration_catalog WHERE kind='legal_form' AND key=NEW.legal_form_key;
  END IF;
  IF NEW.industry_key IS NOT NULL AND NEW.industry_key <> 'sonstige' THEN
    SELECT label INTO NEW.industry FROM public.company_registration_catalog WHERE kind='industry' AND key=NEW.industry_key;
  END IF;
  NEW.registration_catalog_version := CASE WHEN NEW.legal_form_key IS NOT NULL AND NEW.industry_key IS NOT NULL THEN '2026-09-12' ELSE NULL END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_company_registration_keys() FROM PUBLIC;
CREATE OR REPLACE TRIGGER tenants_company_registration_keys
BEFORE INSERT OR UPDATE OF legal_form,industry,legal_form_key,industry_key,registration_catalog_version ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.assign_company_registration_keys();
COMMIT;
