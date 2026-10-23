-- REVIEW DRAFT, not applied. Requires monthly-proofs-draft.sql.
-- Read-only UI RPCs; no signature verifier, delegation, export, or live release.
BEGIN;
CREATE INDEX gkv_monthly_series_month ON public.gkv_monthly_proof_series(tenant_id,month,client_id);
CREATE FUNCTION care_security.gkv_monthly_clients(p_tenant_id uuid,p_month text,p_search text DEFAULT '',p_after uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_month date; rows jsonb; next_id uuid;
BEGIN
 IF care_security.gkv_exchange_actor(p_tenant_id,'office.invoices.view') IS NOT TRUE THEN RAISE EXCEPTION 'Abrechnungszugriff erforderlich' USING ERRCODE='42501'; END IF;
 IF p_month IS NULL OR p_month !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' OR p_search IS NULL OR length(p_search)>100 THEN RAISE EXCEPTION 'Ungültige Monatsabfrage'; END IF;
 v_month:=(p_month||'-01')::date;
 WITH candidates AS (
  SELECT c.id,btrim(c.first_name||' '||c.last_name) name FROM public.clients c WHERE c.tenant_id=p_tenant_id
   AND (p_after IS NULL OR c.id>p_after)
   AND strpos(lower(btrim(c.first_name||' '||c.last_name)),lower(btrim(p_search)))>0
   AND (EXISTS(SELECT 1 FROM public.gkv_monthly_proof_series s WHERE s.tenant_id=p_tenant_id AND s.client_id=c.id AND s.month=v_month)
    OR EXISTS(SELECT 1 FROM public.service_records r WHERE r.tenant_id=p_tenant_id AND r.client_id=c.id
     AND r.service_date>=v_month AND r.service_date<(v_month+interval '1 month')::date AND r.status::text IN ('approved','billable','billed')))
  ORDER BY c.id LIMIT 51
 ), numbered AS (SELECT *,row_number() OVER(ORDER BY id) n FROM candidates)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY id) FILTER(WHERE n<=50),'[]'),
  CASE WHEN count(*)>50 THEN (array_agg(id ORDER BY id))[50] ELSE NULL END INTO rows,next_id FROM numbered;
 RETURN jsonb_build_object('contract','gkv-monthly-clients-v1','tenantId',p_tenant_id,'month',p_month,
  'search',p_search,'after',p_after,'nextCursor',next_id,'clients',rows);
END $$;

CREATE FUNCTION care_security.gkv_monthly_workspace(p_tenant_id uuid,p_client_id uuid,p_month text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.clients; rows jsonb;
BEGIN
 IF care_security.gkv_exchange_actor(p_tenant_id,'office.invoices.view') IS NOT TRUE THEN RAISE EXCEPTION 'Abrechnungszugriff erforderlich' USING ERRCODE='42501'; END IF;
 IF p_month IS NULL OR p_month !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Ungültiger Monat'; END IF;
 SELECT * INTO c FROM public.clients WHERE tenant_id=p_tenant_id AND id=p_client_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Klient nicht verfügbar' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'seriesId',p.series_id,'serviceType',s.service_type,
  'version',p.version,'revision',p.revision,'status',p.status,'recordCount',jsonb_array_length(p.payload->'records'),
  'updatedAt',p.updated_at,'confirmationKind',p.confirmation->>'kind') ORDER BY s.service_type),'[]') INTO rows
 FROM public.gkv_monthly_proof_series s JOIN public.gkv_monthly_proofs p ON p.tenant_id=s.tenant_id AND p.series_id=s.id
 WHERE s.tenant_id=p_tenant_id AND s.client_id=p_client_id AND s.month=(p_month||'-01')::date AND p.status<>'invalidated';
 RETURN jsonb_build_object('contract','gkv-monthly-workspace-v1','tenantId',p_tenant_id,'clientId',p_client_id,
  'clientName',btrim(c.first_name||' '||c.last_name),'month',p_month,'canWrite',care_security.gkv_monthly_writer(p_tenant_id),'proofs',rows);
END $$;

CREATE FUNCTION care_security.gkv_monthly_sources(p_tenant_id uuid,p_client_id uuid,p_month text,p_after uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_month date; rows jsonb; next_id uuid;
BEGIN
 IF care_security.gkv_exchange_actor(p_tenant_id,'office.invoices.view') IS NOT TRUE THEN RAISE EXCEPTION 'Abrechnungszugriff erforderlich' USING ERRCODE='42501'; END IF;
 IF p_month IS NULL OR p_month !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Ungültiger Monat'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.clients WHERE tenant_id=p_tenant_id AND id=p_client_id) THEN RAISE EXCEPTION 'Klient nicht verfügbar' USING ERRCODE='42501'; END IF;
 v_month:=(p_month||'-01')::date;
 -- Candidate list only. The mutation re-reads and verifies every selected source.
 WITH candidates AS (
  SELECT r.id,r.updated_at,r.service_date,r.employee_id,btrim(e.first_name||' '||e.last_name) employee_name,
   r.actual_minutes,btrim(coalesce(p.payload_snapshot->>'documentationNote',p.payload_snapshot->>'documentation','')) description,
   claim.series_id FROM public.service_records r
  JOIN public.employees e ON e.tenant_id=r.tenant_id AND e.id=r.employee_id
  JOIN public.assist_visit_proofs p ON p.tenant_id=r.tenant_id AND p.id::text=r.source_receipt->>'proof_id'
  LEFT JOIN care_security.gkv_monthly_source_claims claim ON claim.tenant_id=r.tenant_id AND claim.record_id=r.id
  WHERE r.tenant_id=p_tenant_id AND r.client_id=p_client_id AND r.service_date>=v_month AND r.service_date<(v_month+interval '1 month')::date
   AND r.status::text IN ('approved','billable','billed') AND r.actual_minutes>0 AND r.updated_at IS NOT NULL
   AND r.source_receipt->>'tenant_id'=r.tenant_id::text AND r.source_receipt->>'client_id'=r.client_id::text
   AND r.source_receipt->>'employee_id'=r.employee_id::text AND p.payload_hash=r.source_receipt->>'proof_payload_hash'
   AND p.visit_id::text=r.source_receipt->>'visit_id'
   AND (p_after IS NULL OR r.id>p_after) ORDER BY r.id LIMIT 51
 ), numbered AS (SELECT *,row_number() OVER(ORDER BY id) n FROM candidates)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'updatedAt',updated_at,'serviceDate',service_date,'employeeId',employee_id,
  'employeeName',employee_name,'actualMinutes',actual_minutes,'description',description,'assignedSeriesId',series_id) ORDER BY id) FILTER(WHERE n<=50),'[]'),
  CASE WHEN count(*)>50 THEN (array_agg(id ORDER BY id))[50] ELSE NULL END INTO rows,next_id FROM numbered;
 RETURN jsonb_build_object('contract','gkv-monthly-sources-v1','tenantId',p_tenant_id,'clientId',p_client_id,'month',p_month,
  'after',p_after,'nextCursor',next_id,'sources',rows);
END $$;

CREATE FUNCTION care_security.gkv_monthly_request_status(p_tenant_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r care_security.gkv_monthly_requests; p public.gkv_monthly_proofs;
BEGIN
 IF care_security.gkv_exchange_actor(p_tenant_id,'office.invoices.view') IS NOT TRUE THEN RAISE EXCEPTION 'Abrechnungszugriff erforderlich' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'Auftragskennung erforderlich'; END IF;
 -- Wait for an already-running command with this key; never mutate or retry it.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':monthly-request:'||p_request_id,0));
 SELECT * INTO r FROM care_security.gkv_monthly_requests WHERE tenant_id=p_tenant_id AND request_id=p_request_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('contract','gkv-monthly-request-v1','tenantId',p_tenant_id,'requestId',p_request_id,'state','not_found','proof',NULL); END IF;
 IF r.actor_id<>auth.uid() THEN RAISE EXCEPTION 'Fremder Auftrag' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM public.gkv_monthly_proofs WHERE tenant_id=p_tenant_id AND id=r.proof_id;
 RETURN jsonb_build_object('contract','gkv-monthly-request-v1','tenantId',p_tenant_id,'requestId',p_request_id,'state','applied','proof',to_jsonb(p));
END $$;

CREATE FUNCTION public.gkv_monthly_clients(p_tenant_id uuid,p_month text,p_search text DEFAULT '',p_after uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT care_security.gkv_monthly_clients(p_tenant_id,p_month,p_search,p_after) $$;
CREATE FUNCTION public.gkv_monthly_workspace(p_tenant_id uuid,p_client_id uuid,p_month text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT care_security.gkv_monthly_workspace(p_tenant_id,p_client_id,p_month) $$;
CREATE FUNCTION public.gkv_monthly_sources(p_tenant_id uuid,p_client_id uuid,p_month text,p_after uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT care_security.gkv_monthly_sources(p_tenant_id,p_client_id,p_month,p_after) $$;
CREATE FUNCTION public.gkv_monthly_request_status(p_tenant_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT care_security.gkv_monthly_request_status(p_tenant_id,p_request_id) $$;
DO $$ DECLARE f regprocedure; BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','care_security') AND p.proname IN ('gkv_monthly_clients','gkv_monthly_workspace','gkv_monthly_sources','gkv_monthly_request_status') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f);
 END LOOP;
END $$;
COMMIT;
