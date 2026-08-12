-- CareSuite HealthOS — PFLEGE TEIL 4 · LEISTUNGSNACHWEIS, ABRECHNUNG & ABNAHME LIVE R1
-- Produktive Ende-zu-Ende-Kette; keine Demo-, Mock- oder automatische Kassenversandlogik.

INSERT INTO public.permission_catalog(key,module,category,label,description,risk_level,requires_audit) VALUES
 ('pflege.proofs.view','pflege','billing','Pflege-Leistungsnachweise ansehen','Erbrachte und signierte Pflegeleistungen einsehen.','high',TRUE),
 ('pflege.proofs.create','pflege','billing','Pflege-Leistungsnachweise erfassen','Leistungsnachweise aus der realen Versorgung erfassen und einreichen.','critical',TRUE),
 ('pflege.proofs.sign','pflege','billing','Pflege-Leistungsnachweise signieren','Leistungsnachweise als leistungserbringende Person verbindlich signieren.','critical',TRUE),
 ('pflege.proofs.review','pflege','billing','Pflege-Leistungsnachweise prüfen','Nachweise fachlich und abrechnungsbezogen freigeben oder zurückweisen.','critical',TRUE),
 ('pflege.billing.view','pflege','billing','Pflege-Abrechnung ansehen','Abrechnungsfälle, Sperren und Rechnungsgrundlagen einsehen.','high',TRUE),
 ('pflege.billing.release','pflege','billing','Pflege-Abrechnung freigeben','Validierte Abrechnungsfälle verbindlich freigeben.','critical',TRUE),
 ('pflege.invoices.manage','pflege','billing','Pflege-Rechnungsgrundlagen erstellen','Rechnungsgrundlagen aus freigegebenen Nachweisen erzeugen.','critical',TRUE),
 ('pflege.acceptance.manage','pflege','billing','Pflege-Gesamtabnahme durchführen','Abrechnungsperioden nach Vollständigkeitsprüfung abnehmen.','critical',TRUE)
ON CONFLICT(key) DO UPDATE SET module=EXCLUDED.module,category=EXCLUDED.category,label=EXCLUDED.label,
 description=EXCLUDED.description,risk_level=EXCLUDED.risk_level,requires_audit=EXCLUDED.requires_audit,updated_at=NOW();

INSERT INTO public.role_permissions(role_id,permission_key)
SELECT r.id,p.key FROM public.roles r CROSS JOIN (VALUES
 ('pflege.proofs.view'),('pflege.proofs.create'),('pflege.proofs.sign'),('pflege.proofs.review'),
 ('pflege.billing.view'),('pflege.billing.release'),('pflege.invoices.manage'),('pflege.acceptance.manage')) p(key)
WHERE (p.key IN('pflege.proofs.view','pflege.proofs.create','pflege.proofs.sign') AND r.key IN('owner','admin','management','geschaeftsfuehrung','business_admin','business_manager','nurse','pdl','pflege','pflegefachkraft'))
   OR (p.key IN('pflege.proofs.view','pflege.proofs.review','pflege.billing.view','pflege.billing.release','pflege.invoices.manage','pflege.acceptance.manage') AND r.key IN('owner','admin','management','geschaeftsfuehrung','business_admin','business_manager','billing','pdl'))
ON CONFLICT DO NOTHING;

INSERT INTO public.role_template_permissions(role_template_id,permission_key,allowed)
SELECT rt.id,p.key,TRUE FROM public.role_templates rt CROSS JOIN (VALUES
 ('pflege.proofs.view'),('pflege.proofs.create'),('pflege.proofs.sign'),('pflege.proofs.review'),
 ('pflege.billing.view'),('pflege.billing.release'),('pflege.invoices.manage'),('pflege.acceptance.manage')) p(key)
WHERE rt.tenant_id IS NULL AND (
 (p.key IN('pflege.proofs.view','pflege.proofs.create','pflege.proofs.sign') AND rt.role_key IN('business_admin','business_manager','nurse'))
 OR (p.key IN('pflege.proofs.view','pflege.proofs.review','pflege.billing.view','pflege.billing.release','pflege.invoices.manage','pflege.acceptance.manage') AND rt.role_key IN('business_admin','business_manager','billing')))
ON CONFLICT(role_template_id,permission_key) DO UPDATE SET allowed=TRUE,updated_at=NOW();

CREATE TABLE IF NOT EXISTS public.pfleger_service_proofs(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE, documentation_entry_id UUID,
 service_date DATE NOT NULL, started_at TIMESTAMPTZ NOT NULL, ended_at TIMESTAMPTZ NOT NULL, duration_minutes INTEGER NOT NULL CHECK(duration_minutes>0 AND duration_minutes<=1440),
 service_code TEXT NOT NULL, service_label TEXT NOT NULL, legal_basis TEXT NOT NULL CHECK(legal_basis IN('sgb_v','sgb_xi','private','mixed')),
 prescription_reference TEXT NOT NULL DEFAULT '', cost_carrier_name TEXT NOT NULL DEFAULT '', cost_carrier_ik TEXT NOT NULL DEFAULT '',
 billing_unit TEXT NOT NULL DEFAULT 'minute' CHECK(billing_unit IN('minute','hour','visit','flat')), quantity NUMERIC(12,4) NOT NULL CHECK(quantity>0),
 unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents>=0), gross_amount_cents INTEGER NOT NULL CHECK(gross_amount_cents>=0),
 performance_note TEXT NOT NULL, deviations TEXT NOT NULL DEFAULT '', employee_profile_id UUID, employee_name_snapshot TEXT NOT NULL,
 client_signature_name TEXT NOT NULL DEFAULT '', client_signed_at TIMESTAMPTZ, signature_ref TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','submitted','signed','approved','rejected','cancelled')),
 rejection_reason TEXT NOT NULL DEFAULT '', reviewed_by UUID, reviewed_by_name TEXT NOT NULL DEFAULT '', reviewed_at TIMESTAMPTZ,
 evidence_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 CHECK(ended_at>started_at), CHECK(status NOT IN('signed','approved') OR (client_signed_at IS NOT NULL AND trim(client_signature_name)<>'' AND trim(signature_ref)<>'')),
 CHECK(legal_basis NOT IN('sgb_v','mixed') OR trim(prescription_reference)<>''), CHECK(legal_basis NOT IN('sgb_v','sgb_xi','mixed') OR trim(cost_carrier_name)<>'')
);

CREATE TABLE IF NOT EXISTS public.pfleger_billing_cases(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE, service_proof_id UUID NOT NULL UNIQUE REFERENCES public.pfleger_service_proofs(id) ON DELETE RESTRICT,
 legal_basis TEXT NOT NULL, payer_type TEXT NOT NULL CHECK(payer_type IN('krankenkasse','pflegekasse','self_payer','mixed')),
 cost_carrier_name TEXT NOT NULL DEFAULT '', cost_carrier_ik TEXT NOT NULL DEFAULT '', service_code TEXT NOT NULL,
 service_date DATE NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents>=0), validation_checks JSONB NOT NULL DEFAULT '{}'::jsonb,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','blocked','ready','released','invoiced','cancelled')),
 blocker_reason TEXT NOT NULL DEFAULT '', released_by UUID, released_by_name TEXT NOT NULL DEFAULT '', released_at TIMESTAMPTZ,
 invoice_foundation_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.pfleger_invoice_foundations(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE, foundation_number TEXT NOT NULL,
 period_from DATE NOT NULL, period_to DATE NOT NULL, payer_type TEXT NOT NULL, recipient_name TEXT NOT NULL, recipient_ik TEXT NOT NULL DEFAULT '',
 proof_count INTEGER NOT NULL CHECK(proof_count>0), total_amount_cents INTEGER NOT NULL CHECK(total_amount_cents>=0), billing_case_ids UUID[] NOT NULL,
 status TEXT NOT NULL DEFAULT 'validated' CHECK(status IN('validated','released','transferred','cancelled')),
 validation_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, created_by UUID, created_by_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,foundation_number), CHECK(period_to>=period_from)
);

CREATE TABLE IF NOT EXISTS public.pfleger_period_acceptances(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 period_from DATE NOT NULL, period_to DATE NOT NULL, proof_count INTEGER NOT NULL, approved_proof_count INTEGER NOT NULL,
 released_case_count INTEGER NOT NULL, blocked_case_count INTEGER NOT NULL, invoice_foundation_count INTEGER NOT NULL,
 total_amount_cents INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN('accepted','rejected')),
 exception_note TEXT NOT NULL DEFAULT '', accepted_by UUID, accepted_by_name TEXT NOT NULL, accepted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 evidence_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, UNIQUE(tenant_id,period_from,period_to), CHECK(period_to>=period_from)
);

CREATE INDEX IF NOT EXISTS idx_pfleger_proofs_queue ON public.pfleger_service_proofs(tenant_id,status,service_date DESC);
CREATE INDEX IF NOT EXISTS idx_pfleger_billing_queue ON public.pfleger_billing_cases(tenant_id,status,service_date DESC);
CREATE INDEX IF NOT EXISTS idx_pfleger_foundations_period ON public.pfleger_invoice_foundations(tenant_id,period_from,period_to);

ALTER TABLE public.pfleger_service_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfleger_billing_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfleger_invoice_foundations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfleger_period_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY pfleger_proofs_read ON public.pfleger_service_proofs FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.proofs.view'));
CREATE POLICY pfleger_billing_read ON public.pfleger_billing_cases FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.billing.view'));
CREATE POLICY pfleger_foundations_read ON public.pfleger_invoice_foundations FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.billing.view'));
CREATE POLICY pfleger_acceptances_read ON public.pfleger_period_acceptances FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.billing.view'));
REVOKE INSERT,UPDATE,DELETE ON public.pfleger_service_proofs,public.pfleger_billing_cases,public.pfleger_invoice_foundations,public.pfleger_period_acceptances FROM authenticated;
GRANT SELECT ON public.pfleger_service_proofs,public.pfleger_billing_cases,public.pfleger_invoice_foundations,public.pfleger_period_acceptances TO authenticated;

CREATE OR REPLACE FUNCTION public.create_pfleger_service_proof(p_client_id UUID,p_payload JSONB)
RETURNS public.pfleger_service_proofs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.pfleger_service_proofs; t UUID:=public.current_tenant_id(); start_value TIMESTAMPTZ:=(p_payload->>'startedAt')::TIMESTAMPTZ; end_value TIMESTAMPTZ:=(p_payload->>'endedAt')::TIMESTAMPTZ;
 basis TEXT:=p_payload->>'legalBasis'; amount_value INTEGER:=COALESCE((p_payload->>'grossAmountCents')::INTEGER,0);
BEGIN
 IF NOT public.has_permission('pflege.proofs.create') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 IF NOT public.is_active_pfleger_client(p_client_id) THEN RAISE EXCEPTION 'Kein aktiver Pflegefall.' USING ERRCODE='23514'; END IF;
 IF end_value<=start_value OR start_value::DATE<>(p_payload->>'serviceDate')::DATE THEN RAISE EXCEPTION 'Leistungszeit ist ungültig.' USING ERRCODE='23514'; END IF;
 IF basis NOT IN('sgb_v','sgb_xi','private','mixed') OR trim(COALESCE(p_payload->>'serviceCode',''))='' OR trim(COALESCE(p_payload->>'performanceNote',''))='' THEN RAISE EXCEPTION 'Leistungsart, Rechtsgrundlage und Durchführungsnachweis sind erforderlich.' USING ERRCODE='23514'; END IF;
 IF basis IN('sgb_v','mixed') AND trim(COALESCE(p_payload->>'prescriptionReference',''))='' THEN RAISE EXCEPTION 'SGB-V-Anteile benötigen einen Verordnungsbezug.' USING ERRCODE='23514'; END IF;
 INSERT INTO public.pfleger_service_proofs(tenant_id,client_id,documentation_entry_id,service_date,started_at,ended_at,duration_minutes,service_code,service_label,legal_basis,prescription_reference,cost_carrier_name,cost_carrier_ik,billing_unit,quantity,unit_price_cents,gross_amount_cents,performance_note,deviations,employee_profile_id,employee_name_snapshot,evidence_snapshot)
 VALUES(t,p_client_id,NULLIF(p_payload->>'documentationEntryId','')::UUID,(p_payload->>'serviceDate')::DATE,start_value,end_value,GREATEST(1,round(EXTRACT(EPOCH FROM(end_value-start_value))/60)),trim(p_payload->>'serviceCode'),trim(p_payload->>'serviceLabel'),basis,COALESCE(p_payload->>'prescriptionReference',''),COALESCE(p_payload->>'costCarrierName',''),COALESCE(p_payload->>'costCarrierIk',''),COALESCE(NULLIF(p_payload->>'billingUnit',''),'minute'),COALESCE((p_payload->>'quantity')::NUMERIC,1),COALESCE((p_payload->>'unitPriceCents')::INTEGER,0),amount_value,trim(p_payload->>'performanceNote'),COALESCE(p_payload->>'deviations',''),public.clinical_actor_id(),public.clinical_actor_name(),jsonb_build_object('createdPayload',p_payload,'serverCreatedAt',clock_timestamp())) RETURNING * INTO r;
 INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name) VALUES(t,p_client_id,'pflege_service_proof',r.id,'created','Pflege-Leistungsnachweis live erfasst.',to_jsonb(r),public.clinical_actor_id(),public.clinical_actor_name());
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.advance_pfleger_service_proof(p_proof_id UUID,p_action TEXT,p_payload JSONB DEFAULT '{}'::jsonb)
RETURNS public.pfleger_service_proofs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.pfleger_service_proofs; old JSONB; t UUID:=public.current_tenant_id(); current_status TEXT; next_status TEXT;
BEGIN
 SELECT to_jsonb(p),p.status INTO old,current_status FROM public.pfleger_service_proofs p WHERE p.id=p_proof_id AND p.tenant_id=t FOR UPDATE;
 IF old IS NULL THEN RAISE EXCEPTION 'Leistungsnachweis nicht gefunden.'; END IF;
 IF p_action='submit' THEN
  IF NOT public.has_permission('pflege.proofs.create') OR current_status<>'draft' THEN RAISE EXCEPTION 'Einreichung nicht zulässig.' USING ERRCODE='42501'; END IF; next_status:='submitted';
 ELSIF p_action='sign' THEN
  IF NOT public.has_permission('pflege.proofs.sign') OR current_status NOT IN('draft','submitted') OR trim(COALESCE(p_payload->>'signatureName',''))='' OR trim(COALESCE(p_payload->>'signatureRef',''))='' THEN RAISE EXCEPTION 'Signatur nicht zulässig oder unvollständig.' USING ERRCODE='42501'; END IF; next_status:='signed';
 ELSIF p_action IN('approve','reject') THEN
  IF NOT public.has_permission('pflege.proofs.review') OR current_status<>'signed' THEN RAISE EXCEPTION 'Prüfentscheidung nicht zulässig.' USING ERRCODE='42501'; END IF; next_status:=CASE WHEN p_action='approve' THEN 'approved' ELSE 'rejected' END;
  IF p_action='reject' AND trim(COALESCE(p_payload->>'reason',''))='' THEN RAISE EXCEPTION 'Zurückweisung benötigt eine Begründung.' USING ERRCODE='23514'; END IF;
 ELSE RAISE EXCEPTION 'Unbekannte Aktion.' USING ERRCODE='23514'; END IF;
 UPDATE public.pfleger_service_proofs SET status=next_status,
  client_signature_name=CASE WHEN p_action='sign' THEN trim(p_payload->>'signatureName') ELSE client_signature_name END,
  client_signed_at=CASE WHEN p_action='sign' THEN clock_timestamp() ELSE client_signed_at END,
  signature_ref=CASE WHEN p_action='sign' THEN COALESCE(p_payload->>'signatureRef','') ELSE signature_ref END,
  rejection_reason=CASE WHEN p_action='reject' THEN trim(p_payload->>'reason') ELSE rejection_reason END,
  reviewed_by=CASE WHEN p_action IN('approve','reject') THEN public.clinical_actor_id() ELSE reviewed_by END,
  reviewed_by_name=CASE WHEN p_action IN('approve','reject') THEN public.clinical_actor_name() ELSE reviewed_by_name END,
  reviewed_at=CASE WHEN p_action IN('approve','reject') THEN clock_timestamp() ELSE reviewed_at END,updated_at=clock_timestamp()
 WHERE id=p_proof_id AND tenant_id=t RETURNING * INTO r;
 IF p_action='approve' THEN
  INSERT INTO public.pfleger_billing_cases(tenant_id,client_id,service_proof_id,legal_basis,payer_type,cost_carrier_name,cost_carrier_ik,service_code,service_date,amount_cents,validation_checks,status,blocker_reason)
  VALUES(t,r.client_id,r.id,r.legal_basis,CASE r.legal_basis WHEN 'sgb_v' THEN 'krankenkasse' WHEN 'sgb_xi' THEN 'pflegekasse' WHEN 'private' THEN 'self_payer' ELSE 'mixed' END,r.cost_carrier_name,r.cost_carrier_ik,r.service_code,r.service_date,r.gross_amount_cents,
   jsonb_build_object('signed',r.client_signed_at IS NOT NULL,'amountPositive',r.gross_amount_cents>0,'serviceCode',trim(r.service_code)<>'','payerPresent',r.legal_basis='private' OR trim(r.cost_carrier_name)<>''),
   CASE WHEN r.gross_amount_cents>0 AND trim(r.service_code)<>'' AND (r.legal_basis='private' OR trim(r.cost_carrier_name)<>'') THEN 'ready' ELSE 'blocked' END,
   CASE WHEN r.gross_amount_cents<=0 THEN 'Betrag fehlt.' WHEN trim(r.service_code)='' THEN 'Leistungscode fehlt.' WHEN r.legal_basis<>'private' AND trim(r.cost_carrier_name)='' THEN 'Kostenträger fehlt.' ELSE '' END)
  ON CONFLICT(service_proof_id) DO UPDATE SET validation_checks=EXCLUDED.validation_checks,status=EXCLUDED.status,blocker_reason=EXCLUDED.blocker_reason,updated_at=clock_timestamp();
 END IF;
 INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,before_data,after_data,actor_id,actor_name) VALUES(t,r.client_id,'pflege_service_proof',r.id,p_action,'Pflege-Leistungsnachweis fortgeschrieben.',old,to_jsonb(r),public.clinical_actor_id(),public.clinical_actor_name());
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.release_pfleger_billing_case(p_case_id UUID)
RETURNS public.pfleger_billing_cases LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.pfleger_billing_cases; t UUID:=public.current_tenant_id();
BEGIN
 IF NOT public.has_permission('pflege.billing.release') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 UPDATE public.pfleger_billing_cases SET status='released',released_by=public.clinical_actor_id(),released_by_name=public.clinical_actor_name(),released_at=clock_timestamp(),updated_at=clock_timestamp()
 WHERE id=p_case_id AND tenant_id=t AND status='ready' RETURNING * INTO r;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Abrechnungsfall ist nicht freigabefähig.' USING ERRCODE='23514'; END IF;
 INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name) VALUES(t,r.client_id,'pflege_billing_case',r.id,'released','Pflege-Abrechnungsfall verbindlich freigegeben.',to_jsonb(r),public.clinical_actor_id(),public.clinical_actor_name());
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.create_pfleger_invoice_foundation(p_client_id UUID,p_period_from DATE,p_period_to DATE)
RETURNS public.pfleger_invoice_foundations LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.pfleger_invoice_foundations; t UUID:=public.current_tenant_id(); ids UUID[]; count_value INTEGER; total_value INTEGER; payer_value TEXT; recipient_value TEXT; ik_value TEXT;
BEGIN
 IF NOT public.has_permission('pflege.invoices.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT array_agg(id ORDER BY service_date),count(*),sum(amount_cents),min(payer_type),min(cost_carrier_name),min(cost_carrier_ik)
 INTO ids,count_value,total_value,payer_value,recipient_value,ik_value FROM public.pfleger_billing_cases
 WHERE tenant_id=t AND client_id=p_client_id AND status='released' AND service_date BETWEEN p_period_from AND p_period_to AND invoice_foundation_id IS NULL;
 IF COALESCE(count_value,0)=0 THEN RAISE EXCEPTION 'Keine freigegebenen Abrechnungsfälle im Zeitraum.' USING ERRCODE='23514'; END IF;
 IF (SELECT count(DISTINCT payer_type) FROM public.pfleger_billing_cases WHERE id=ANY(ids))<>1 THEN RAISE EXCEPTION 'Unterschiedliche Kostenträgerarten müssen getrennt abgerechnet werden.' USING ERRCODE='23514'; END IF;
 INSERT INTO public.pfleger_invoice_foundations(tenant_id,client_id,foundation_number,period_from,period_to,payer_type,recipient_name,recipient_ik,proof_count,total_amount_cents,billing_case_ids,validation_snapshot,created_by,created_by_name)
 VALUES(t,p_client_id,'PF-'||to_char(p_period_to,'YYYYMM')||'-'||upper(substr(replace(gen_random_uuid()::TEXT,'-',''),1,8)),p_period_from,p_period_to,payer_value,CASE WHEN payer_value='self_payer' THEN 'Selbstzahler:in' ELSE recipient_value END,ik_value,count_value,total_value,ids,jsonb_build_object('allReleased',TRUE,'singlePayerType',TRUE,'generatedAt',clock_timestamp()),public.clinical_actor_id(),public.clinical_actor_name()) RETURNING * INTO r;
 UPDATE public.pfleger_billing_cases SET status='invoiced',invoice_foundation_id=r.id,updated_at=clock_timestamp() WHERE id=ANY(ids) AND tenant_id=t;
 INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name) VALUES(t,p_client_id,'pflege_invoice_foundation',r.id,'created','Rechnungsgrundlage aus freigegebenen Pflegeleistungen erzeugt.',to_jsonb(r),public.clinical_actor_id(),public.clinical_actor_name());
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.accept_pfleger_billing_period(p_period_from DATE,p_period_to DATE,p_exception_note TEXT DEFAULT '')
RETURNS public.pfleger_period_acceptances LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.pfleger_period_acceptances; t UUID:=public.current_tenant_id(); proofs INTEGER; approved INTEGER; released INTEGER; blocked INTEGER; foundations INTEGER; total_value INTEGER;
BEGIN
 IF NOT public.has_permission('pflege.acceptance.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT count(*),count(*) FILTER(WHERE status='approved') INTO proofs,approved FROM public.pfleger_service_proofs WHERE tenant_id=t AND service_date BETWEEN p_period_from AND p_period_to AND status<>'cancelled';
 SELECT count(*) FILTER(WHERE status IN('released','invoiced')),count(*) FILTER(WHERE status IN('pending','blocked','ready')),COALESCE(sum(amount_cents) FILTER(WHERE status IN('released','invoiced')),0) INTO released,blocked,total_value FROM public.pfleger_billing_cases WHERE tenant_id=t AND service_date BETWEEN p_period_from AND p_period_to AND status<>'cancelled';
 SELECT count(*) INTO foundations FROM public.pfleger_invoice_foundations WHERE tenant_id=t AND period_from>=p_period_from AND period_to<=p_period_to AND status<>'cancelled';
 IF proofs=0 OR approved<>proofs OR blocked>0 OR foundations=0 THEN RAISE EXCEPTION 'Gesamtabnahme blockiert: Nachweise, Abrechnungsfälle oder Rechnungsgrundlagen sind unvollständig.' USING ERRCODE='23514'; END IF;
 INSERT INTO public.pfleger_period_acceptances(tenant_id,period_from,period_to,proof_count,approved_proof_count,released_case_count,blocked_case_count,invoice_foundation_count,total_amount_cents,status,exception_note,accepted_by,accepted_by_name,evidence_snapshot)
 VALUES(t,p_period_from,p_period_to,proofs,approved,released,blocked,foundations,total_value,'accepted',COALESCE(p_exception_note,''),public.clinical_actor_id(),public.clinical_actor_name(),jsonb_build_object('allProofsApproved',TRUE,'noBlockedCases',TRUE,'invoiceFoundationsPresent',TRUE,'acceptedAt',clock_timestamp()))
 ON CONFLICT(tenant_id,period_from,period_to) DO UPDATE SET proof_count=EXCLUDED.proof_count,approved_proof_count=EXCLUDED.approved_proof_count,released_case_count=EXCLUDED.released_case_count,blocked_case_count=EXCLUDED.blocked_case_count,invoice_foundation_count=EXCLUDED.invoice_foundation_count,total_amount_cents=EXCLUDED.total_amount_cents,status='accepted',exception_note=EXCLUDED.exception_note,accepted_by=EXCLUDED.accepted_by,accepted_by_name=EXCLUDED.accepted_by_name,accepted_at=clock_timestamp(),evidence_snapshot=EXCLUDED.evidence_snapshot RETURNING * INTO r;
 INSERT INTO public.care_audit_events(tenant_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name) VALUES(t,'pflege_period_acceptance',r.id,'accepted','Pflege-Abrechnungsperiode vollständig abgenommen.',to_jsonb(r),public.clinical_actor_id(),public.clinical_actor_name());
 RETURN r;
END $$;

GRANT EXECUTE ON FUNCTION public.create_pfleger_service_proof(UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_pfleger_service_proof(UUID,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_pfleger_billing_case(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_pfleger_invoice_foundation(UUID,DATE,DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_pfleger_billing_period(DATE,DATE,TEXT) TO authenticated;

COMMENT ON TABLE public.pfleger_invoice_foundations IS 'Validierte Rechnungsgrundlage; kein automatischer DTA-, Kassen- oder Rechnungsversand.';
