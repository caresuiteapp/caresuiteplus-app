-- REVIEW ONLY. Sixth monthly draft, after authorities. No production migration,
-- provisioning, historical backfill or claim of authenticated GKV-number capture.
-- The private mappings below are an integration boundary for a future reviewed
-- upstream writer. Never populate them from a browser's employee-number fields.
BEGIN;
CREATE TABLE care_security.gkv_monthly_fact_profiles (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),actor_id uuid NOT NULL,
 provider_ik text NOT NULL CHECK(provider_ik ~ '^[1-9][0-9]{8}$'),
 responsible_employee_number text NOT NULL CHECK(responsible_employee_number ~ '^[0-9]{9}$'),
 provider_reference text NOT NULL CHECK(length(btrim(provider_reference)) BETWEEN 3 AND 500 AND provider_reference=btrim(provider_reference)),
 responsible_reference text NOT NULL CHECK(length(btrim(responsible_reference)) BETWEEN 3 AND 500 AND responsible_reference=btrim(responsible_reference)),
 valid_until timestamptz NOT NULL CHECK(isfinite(valid_until)),revoked_at timestamptz,
 PRIMARY KEY(tenant_id,actor_id)
);
CREATE TABLE care_security.gkv_monthly_fact_sources (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),record_id uuid NOT NULL REFERENCES public.service_records(id),
 source_updated_at timestamptz NOT NULL CHECK(isfinite(source_updated_at)),
 source_receipt_sha256 text NOT NULL CHECK(source_receipt_sha256 ~ '^[a-f0-9]{64}$'),
 employee_number text NOT NULL CHECK(employee_number ~ '^[0-9]{9}$'),
 lines jsonb NOT NULL CHECK(jsonb_typeof(lines)='array' AND jsonb_array_length(lines) BETWEEN 1 AND 99),
 mapping_reference text NOT NULL CHECK(length(btrim(mapping_reference)) BETWEEN 3 AND 500 AND mapping_reference=btrim(mapping_reference)),
 PRIMARY KEY(tenant_id,record_id)
);
-- Survives source replacement and correction; a carried source cannot silently
-- acquire another GKV number after its first frozen version.
CREATE TABLE care_security.gkv_monthly_fact_employee_locks (
 tenant_id uuid NOT NULL,series_id uuid NOT NULL,record_id uuid NOT NULL,
 employee_id uuid NOT NULL,employee_number text NOT NULL CHECK(employee_number ~ '^[0-9]{9}$'),
 PRIMARY KEY(tenant_id,series_id,record_id),
 FOREIGN KEY(tenant_id,series_id) REFERENCES public.gkv_monthly_proof_series(tenant_id,id)
);
CREATE FUNCTION care_security.gkv_monthly_fact_text(v text,n integer) RETURNS boolean
 LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT coalesce(length(v) BETWEEN 1 AND n AND v=btrim(v) AND v !~ '[[:cntrl:]]',false)
$$;
CREATE FUNCTION care_security.gkv_monthly_build_facts(p public.gkv_monthly_proofs,p_responsible uuid,p_bound_at timestamptz) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE profile care_security.gkv_monthly_fact_profiles; mapping care_security.gkv_monthly_fact_sources; c public.clients;
 r jsonb; line jsonb; lines jsonb; days jsonb:='[]'; visits jsonb:='[]'; sources jsonb:='[]';
 day text; previous_day text; seq integer:=0; total_lines integer:=0; minutes integer;
 started timestamptz; ended timestamptz; stamp text; personal jsonb; bound_employee_number text; personal_count integer:=0;
BEGIN
 IF auth.uid() IS NULL OR care_security.gkv_monthly_writer(p.tenant_id) IS NOT TRUE THEN
  RAISE EXCEPTION 'Aktive persönliche Beauftragung erforderlich' USING ERRCODE='42501'; END IF;
 IF p.status<>'open' OR p.payload->>'serviceType' NOT IN ('01','07','10')
  OR p_bound_at IS NULL OR NOT isfinite(p_bound_at) OR p_bound_at>clock_timestamp()
  OR (p_bound_at AT TIME ZONE 'Europe/Berlin')::date NOT BETWEEN date '2026-05-01' AND date '2027-01-31' THEN
  RAISE EXCEPTION 'Fachprofil für diese Fassung nicht verfügbar' USING ERRCODE='22023'; END IF;
 IF (SELECT count(DISTINCT a.source->'sourceReceipt'->>'visit_id') FROM jsonb_array_elements(p.payload->'records') a(source))
   <>jsonb_array_length(p.payload->'records') THEN
  RAISE EXCEPTION 'Mehrere Quellen desselben Einsatzes benötigen eine gesonderte Zuordnung' USING ERRCODE='22023'; END IF;
 SELECT * INTO profile FROM care_security.gkv_monthly_fact_profiles
  WHERE tenant_id=p.tenant_id AND actor_id=p_responsible AND revoked_at IS NULL AND valid_until>now() FOR SHARE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM care_security.gkv_monthly_responsibilities
   WHERE tenant_id=p.tenant_id AND actor_id=p_responsible AND revoked_at IS NULL AND valid_until>now()) THEN
  RAISE EXCEPTION 'Geprüfte Fachzuordnung fehlt oder ist abgelaufen' USING ERRCODE='22023'; END IF;
 SELECT * INTO c FROM public.clients WHERE tenant_id=p.tenant_id AND id=(p.payload->>'clientId')::uuid FOR SHARE;
 IF NOT FOUND OR NOT care_security.gkv_monthly_fact_text(c.first_name,45) OR NOT care_security.gkv_monthly_fact_text(c.last_name,45)
  OR coalesce(c.insurance_number,'') !~ '^([A-Z][0-9]{9}|[0-9]{12})$'
  OR c.first_name||' '||c.last_name IS DISTINCT FROM p.payload->>'clientName'
  OR NOT care_security.gkv_monthly_fact_text(profile.provider_reference,500)
  OR NOT care_security.gkv_monthly_fact_text(profile.responsible_reference,500) THEN
  RAISE EXCEPTION 'Vollständige Stammdaten für die Fachzuordnung erforderlich' USING ERRCODE='22023'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p.payload->'records')
   ORDER BY value->>'serviceDate',(value->'sourceReceipt'->>'service_started_at')::timestamptz,value->>'recordId' LOOP
  day:=r->>'serviceDate';
  SELECT * INTO mapping FROM care_security.gkv_monthly_fact_sources
   WHERE tenant_id=p.tenant_id AND record_id=(r->>'recordId')::uuid FOR SHARE;
  IF NOT FOUND OR mapping.source_updated_at IS DISTINCT FROM (r->>'updatedAt')::timestamptz
   OR mapping.source_receipt_sha256 IS DISTINCT FROM encode(sha256(convert_to((r->'sourceReceipt')::text,'UTF8')),'hex')
   OR NOT care_security.gkv_monthly_fact_text(mapping.mapping_reference,500) THEN
   RAISE EXCEPTION 'Aktuelle Fachzuordnung zur Originalleistung fehlt' USING ERRCODE='22023'; END IF;
  personal:=NULL;
  IF to_regprocedure('care_security.gkv_employee_source(uuid,jsonb)') IS NOT NULL THEN
   personal:=care_security.gkv_employee_source(p.tenant_id,r);
  END IF;
  bound_employee_number:=coalesce(personal->>'employeeNumber',mapping.employee_number);
  IF personal IS NOT NULL THEN personal_count:=personal_count+1; END IF;
  IF EXISTS(SELECT 1 FROM care_security.gkv_monthly_fact_employee_locks l
    WHERE l.tenant_id=p.tenant_id AND l.series_id=p.series_id AND l.record_id=mapping.record_id
     AND (l.employee_id IS DISTINCT FROM (r->>'employeeId')::uuid OR l.employee_number IS DISTINCT FROM bound_employee_number)) THEN
   RAISE EXCEPTION 'Ursprüngliche Beschäftigtenzuordnung ist gesperrt' USING ERRCODE='40001'; END IF;
  stamp:=r->'sourceReceipt'->>'service_started_at';
  IF coalesce(stamp,'') !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$' THEN
   RAISE EXCEPTION 'Originaler Leistungsbeginn fehlt' USING ERRCODE='22023'; END IF;
  started:=stamp::timestamptz; stamp:=r->'sourceReceipt'->>'service_ended_at';
  IF coalesce(stamp,'') !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$' THEN
   RAISE EXCEPTION 'Originales Leistungsende fehlt' USING ERRCODE='22023'; END IF;
  ended:=stamp::timestamptz;
  IF NOT isfinite(started) OR NOT isfinite(ended) OR ended<started OR ended>p_bound_at
   OR to_char(started AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') IS DISTINCT FROM day
   OR left(day,7) IS DISTINCT FROM p.payload->>'month' THEN
   RAISE EXCEPTION 'Originale Leistungszeiten passen nicht zur Fassung' USING ERRCODE='22023'; END IF;
  IF previous_day IS DISTINCT FROM day THEN
   IF previous_day IS NOT NULL THEN days:=days||jsonb_build_array(jsonb_build_object('date',previous_day,'visits',visits)); END IF;
   previous_day:=day; visits:='[]'; seq:=0;
  END IF;
  seq:=seq+1; lines:='[]'; minutes:=0;
  IF seq>99 THEN RAISE EXCEPTION 'Zu viele Einsätze pro Tag' USING ERRCODE='22023'; END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(mapping.lines) LOOP
   total_lines:=total_lines+1;
   IF jsonb_typeof(line) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Leistungszuordnung ungültig' USING ERRCODE='22023'; END IF;
   IF (SELECT count(*) FROM jsonb_object_keys(line))<>3 OR NOT line?'code' OR NOT line?'description'
    OR (line?'quantity')=(line?'minutes') OR total_lines>10000
    OR jsonb_typeof(line->'code') IS DISTINCT FROM 'string' OR jsonb_typeof(line->'description') IS DISTINCT FROM 'string'
    OR coalesce(line->>'code','') !~ '^(01|07|10)(01|02|06|07|99)[0-8][0-9a-zA-Z]{1,10}$'
    OR left(line->>'code',2) IS DISTINCT FROM p.payload->>'serviceType'
    OR NOT care_security.gkv_monthly_fact_text(line->>'description',150)
    OR (substring(line->>'code',3,2) IN ('01','06') AND NOT line?'quantity')
    OR (substring(line->>'code',3,2)='02' AND NOT line?'minutes') THEN
    RAISE EXCEPTION 'Leistungszuordnung ungültig' USING ERRCODE='22023'; END IF;
   IF line?'quantity' THEN
    IF jsonb_typeof(line->'quantity') IS DISTINCT FROM 'string' OR coalesce(line->>'quantity','') !~ '^(0|[1-9][0-9]{0,3})\.[0-9]{2}$'
     OR line->>'quantity'='0.00' THEN RAISE EXCEPTION 'Leistungsmenge ungültig' USING ERRCODE='22023'; END IF;
   ELSE
    IF jsonb_typeof(line->'minutes') IS DISTINCT FROM 'number' OR coalesce(line->>'minutes','') !~ '^[0-9]{1,4}$'
     THEN RAISE EXCEPTION 'Leistungsminuten ungültig' USING ERRCODE='22023'; END IF;
    IF (line->>'minutes')::integer NOT BETWEEN 1 AND 1440 THEN RAISE EXCEPTION 'Leistungsminuten ungültig' USING ERRCODE='22023'; END IF;
    minutes:=minutes+(line->>'minutes')::integer;
   END IF;
   lines:=lines||jsonb_build_array(line||jsonb_build_object('employeeNumbers',jsonb_build_array(bound_employee_number)));
  END LOOP;
  IF minutes>(r->>'actualMinutes')::integer THEN RAISE EXCEPTION 'Minuten überschreiten die Originalleistung' USING ERRCODE='22023'; END IF;
  visits:=visits||jsonb_build_array(jsonb_build_object('sequence',seq,'startTime',to_char(started AT TIME ZONE 'Europe/Berlin','HH24MI'),'lines',lines));
  sources:=sources||jsonb_build_array(jsonb_build_object('recordId',r->>'recordId','recordUpdatedAt',r->>'updatedAt',
   'employeeId',r->>'employeeId','employeeNumber',bound_employee_number,'sourceReceiptSha256',mapping.source_receipt_sha256,
   'mappingReference',mapping.mapping_reference,'date',day,'sequence',seq)||CASE WHEN personal IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('personalCapture',personal) END);
 END LOOP;
 IF previous_day IS NULL THEN RAISE EXCEPTION 'Leistungen fehlen' USING ERRCODE='22023'; END IF;
 days:=days||jsonb_build_array(jsonb_build_object('date',previous_day,'visits',visits));
 RETURN jsonb_build_object('schema','gkv-monthly-facts-v1','boundAt',to_char(p_bound_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'responsibleActorId',p_responsible,'providerReference',profile.provider_reference,'responsibleReference',profile.responsible_reference,
  'captureProvenance',CASE WHEN personal_count=0 THEN 'not-attested' WHEN personal_count=jsonb_array_length(sources) THEN 'personally-bound' ELSE 'partially-bound' END,
  'content',jsonb_build_object('providerIk',profile.provider_ik,'month',p.payload->>'month',
   'insuranceNumber',c.insurance_number,'lastName',c.last_name,'firstName',c.first_name,'serviceType',p.payload->>'serviceType',
   'responsibleEmployeeNumber',profile.responsible_employee_number,'days',days),'sources',sources);
END $$;
CREATE FUNCTION care_security.gkv_monthly_freeze_facts(p public.gkv_monthly_proofs) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE facts jsonb; source jsonb;
BEGIN
 facts:=care_security.gkv_monthly_build_facts(p,auth.uid(),date_trunc('milliseconds',clock_timestamp()));
 FOR source IN SELECT value FROM jsonb_array_elements(facts->'sources') LOOP
  INSERT INTO care_security.gkv_monthly_fact_employee_locks VALUES(p.tenant_id,p.series_id,(source->>'recordId')::uuid,
   (source->>'employeeId')::uuid,source->>'employeeNumber') ON CONFLICT DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM care_security.gkv_monthly_fact_employee_locks l WHERE l.tenant_id=p.tenant_id AND l.series_id=p.series_id
    AND l.record_id=(source->>'recordId')::uuid AND l.employee_id=(source->>'employeeId')::uuid AND l.employee_number=source->>'employeeNumber') THEN
   RAISE EXCEPTION 'Ursprüngliche Beschäftigtenzuordnung ist gesperrt' USING ERRCODE='40001'; END IF;
 END LOOP;
 RETURN facts;
END $$;
DO $$ DECLARE name text; f regprocedure; BEGIN
 FOREACH name IN ARRAY ARRAY['gkv_monthly_fact_profiles','gkv_monthly_fact_sources','gkv_monthly_fact_employee_locks'] LOOP
  EXECUTE format('ALTER TABLE care_security.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('REVOKE ALL ON care_security.%I FROM PUBLIC,anon,authenticated,service_role',name);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='care_security'
   AND p.proname IN ('gkv_monthly_fact_text','gkv_monthly_build_facts','gkv_monthly_freeze_facts') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f);
 END LOOP;
END $$;
COMMIT;
