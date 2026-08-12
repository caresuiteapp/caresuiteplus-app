-- CareSuite HealthOS — PFLEGE CLINICAL DOCUMENTATION R2
-- Live-Kern: Medikation, Behandlungspflege, Wunden, Berichte und Übergaben.

INSERT INTO public.permission_catalog(key,module,category,label,description,risk_level,requires_audit)
VALUES
 ('pflege.medications.view','pflege','medication','Medikationsplan ansehen','Verordnete Medikamente und Gaben einsehen.','high',TRUE),
 ('pflege.medications.manage','pflege','medication','Medikationsplan verwalten','Verordnungen anlegen und fortschreiben.','critical',TRUE),
 ('pflege.medications.administer','pflege','medication','Medikamentengaben dokumentieren','Gabe, Auslassung, Ablehnung und Bedarfsmedikation dokumentieren.','critical',TRUE),
 ('pflege.wounds.view','pflege','wounds','Wunddokumentation ansehen','Wundfälle und Verläufe einsehen.','high',TRUE),
 ('pflege.wounds.manage','pflege','wounds','Wunddokumentation verwalten','Wundfälle, Assessments und Verlauf dokumentieren.','high',TRUE),
 ('pflege.documentation.view','pflege','documentation','Pflegedokumentation ansehen','Berichte, Beobachtungen und Signaturen einsehen.','high',TRUE),
 ('pflege.documentation.create','pflege','documentation','Pflegedokumentation erstellen','Berichte und Beobachtungen append-only erfassen.','high',TRUE),
 ('pflege.documentation.sign','pflege','documentation','Pflegedokumentation signieren','Pflegefachliche Signatur und Sperrung ausführen.','critical',TRUE),
 ('pflege.treatment.view','pflege','treatment','Behandlungspflege ansehen','Verordnete Behandlungspflege einsehen.','high',TRUE),
 ('pflege.treatment.manage','pflege','treatment','Behandlungspflege dokumentieren','Durchführung, Abweichung und Eskalation dokumentieren.','critical',TRUE),
 ('pflege.handovers.view','pflege','handover','Übergaben ansehen','Schicht- und Fallübergaben einsehen.','high',TRUE),
 ('pflege.handovers.manage','pflege','handover','Übergaben verwalten','Übergaben erstellen, quittieren und schließen.','high',TRUE)
ON CONFLICT(key) DO UPDATE SET label=EXCLUDED.label,description=EXCLUDED.description,
 risk_level=EXCLUDED.risk_level,requires_audit=EXCLUDED.requires_audit,updated_at=NOW();

INSERT INTO public.role_permissions(role_id,permission_key)
SELECT r.id,p.key FROM public.roles r CROSS JOIN (VALUES
 ('pflege.medications.view'),('pflege.medications.manage'),('pflege.medications.administer'),
 ('pflege.wounds.view'),('pflege.wounds.manage'),('pflege.documentation.view'),
 ('pflege.documentation.create'),('pflege.documentation.sign'),('pflege.treatment.view'),
 ('pflege.treatment.manage'),('pflege.handovers.view'),('pflege.handovers.manage')) p(key)
WHERE r.key IN ('business_admin','business_manager','nurse','pdl','pflege','pflegefachkraft')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_template_permissions(role_template_id,permission_key,allowed)
SELECT rt.id,p.key,TRUE FROM public.role_templates rt CROSS JOIN (VALUES
 ('pflege.medications.view'),('pflege.medications.manage'),('pflege.medications.administer'),
 ('pflege.wounds.view'),('pflege.wounds.manage'),('pflege.documentation.view'),
 ('pflege.documentation.create'),('pflege.documentation.sign'),('pflege.treatment.view'),
 ('pflege.treatment.manage'),('pflege.handovers.view'),('pflege.handovers.manage')) p(key)
WHERE rt.tenant_id IS NULL AND rt.role_key IN ('business_admin','business_manager','nurse')
ON CONFLICT(role_template_id,permission_key) DO UPDATE SET allowed=TRUE,updated_at=NOW();

-- Kompatibilitäts-Overload: ältere Pflege-RPCs übergeben nur die Klienten-ID.
-- Die Mandanten-ID bleibt serverautoritativ und wird nie vom Client übernommen.
CREATE OR REPLACE FUNCTION public.is_active_pfleger_client(p_client_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.is_active_pfleger_client(public.current_tenant_id(),p_client_id)
$$;

CREATE TABLE IF NOT EXISTS public.clinical_medication_orders(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
 medical_order_id UUID REFERENCES public.care_medical_orders(id) ON DELETE SET NULL,
 medication_name TEXT NOT NULL, active_ingredient TEXT NOT NULL DEFAULT '', dosage TEXT NOT NULL,
 pharmaceutical_form TEXT NOT NULL DEFAULT '', route TEXT NOT NULL, schedule JSONB NOT NULL DEFAULT '{}'::JSONB,
 indication TEXT NOT NULL DEFAULT '', instructions TEXT NOT NULL DEFAULT '', prescribing_physician TEXT NOT NULL,
 prescribed_at DATE NOT NULL, valid_from DATE NOT NULL, valid_until DATE, is_prn BOOLEAN NOT NULL DEFAULT FALSE,
 prn_reason TEXT NOT NULL DEFAULT '', prn_max_dose TEXT NOT NULL DEFAULT '', interaction_notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('draft','active','paused','completed','cancelled','archived')),
 recorded_by UUID NOT NULL, recorded_by_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), CHECK(valid_until IS NULL OR valid_until>=valid_from)
);

CREATE TABLE IF NOT EXISTS public.clinical_medication_administrations(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
 medication_order_id UUID NOT NULL REFERENCES public.clinical_medication_orders(id) ON DELETE RESTRICT,
 outcome TEXT NOT NULL CHECK(outcome IN('administered','omitted','refused','not_available','held','prn_administered')),
 scheduled_at TIMESTAMPTZ, administered_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 dose_given TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL DEFAULT '', effect_observation TEXT NOT NULL DEFAULT '',
 anomaly BOOLEAN NOT NULL DEFAULT FALSE, escalation TEXT NOT NULL DEFAULT '', recorded_by UUID NOT NULL,
 recorded_by_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.clinical_wound_cases(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE, body_location TEXT NOT NULL,
 wound_type TEXT NOT NULL, etiology TEXT NOT NULL DEFAULT '', onset_date DATE, acquired_where TEXT NOT NULL DEFAULT '',
 treatment_plan TEXT NOT NULL DEFAULT '', physician_involved BOOLEAN NOT NULL DEFAULT FALSE,
 ordering_physician TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active'
 CHECK(status IN('draft','active','healing','healed','deteriorated','archived')),
 next_review_at TIMESTAMPTZ, recorded_by UUID NOT NULL, recorded_by_name TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.clinical_wound_assessments(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
 wound_case_id UUID NOT NULL REFERENCES public.clinical_wound_cases(id) ON DELETE CASCADE,
 assessed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), length_cm NUMERIC, width_cm NUMERIC, depth_cm NUMERIC,
 wound_bed TEXT NOT NULL DEFAULT '', exudate TEXT NOT NULL DEFAULT '', odor TEXT NOT NULL DEFAULT '',
 wound_edge TEXT NOT NULL DEFAULT '', surrounding_skin TEXT NOT NULL DEFAULT '', pain_score INTEGER CHECK(pain_score BETWEEN 0 AND 10),
 infection_signs TEXT NOT NULL DEFAULT '', intervention TEXT NOT NULL DEFAULT '', response TEXT NOT NULL DEFAULT '',
 photo_refs JSONB NOT NULL DEFAULT '[]'::JSONB, recorded_by UUID NOT NULL, recorded_by_name TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.clinical_documentation_entries(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
 entry_type TEXT NOT NULL CHECK(entry_type IN('care_report','observation','evaluation','visit','handover_note','incident','consultation')),
 title TEXT NOT NULL, content TEXT NOT NULL, observations TEXT NOT NULL DEFAULT '', interventions TEXT NOT NULL DEFAULT '',
 result TEXT NOT NULL DEFAULT '', deviation TEXT NOT NULL DEFAULT '', escalation TEXT NOT NULL DEFAULT '',
 recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), recorded_by UUID NOT NULL, recorded_by_name TEXT NOT NULL,
 signature_status TEXT NOT NULL DEFAULT 'unsigned' CHECK(signature_status IN('unsigned','signed','superseded')),
 signed_at TIMESTAMPTZ, signed_by UUID, signed_by_name TEXT NOT NULL DEFAULT '',
 correction_of_id UUID REFERENCES public.clinical_documentation_entries(id), correction_reason TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.clinical_treatment_executions(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
 medical_order_id UUID REFERENCES public.care_medical_orders(id) ON DELETE SET NULL,
 treatment_type TEXT NOT NULL, title TEXT NOT NULL, performed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 outcome TEXT NOT NULL CHECK(outcome IN('performed','partial','omitted','refused','failed')),
 details TEXT NOT NULL, deviation_reason TEXT NOT NULL DEFAULT '', escalation TEXT NOT NULL DEFAULT '',
 qualification_snapshot TEXT NOT NULL DEFAULT '', recorded_by UUID NOT NULL, recorded_by_name TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.clinical_handovers(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
 priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN('normal','important','urgent','critical')),
 title TEXT NOT NULL, situation TEXT NOT NULL, background TEXT NOT NULL DEFAULT '', assessment TEXT NOT NULL DEFAULT '',
 recommendation TEXT NOT NULL, due_at TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'open'
 CHECK(status IN('open','acknowledged','closed','archived')),
 created_by UUID NOT NULL, created_by_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 acknowledged_at TIMESTAMPTZ, acknowledged_by UUID, acknowledged_by_name TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_clinical_medication_client ON public.clinical_medication_orders(tenant_id,client_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_wound_client ON public.clinical_wound_cases(tenant_id,client_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_doc_client ON public.clinical_documentation_entries(tenant_id,client_id,recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_treatment_client ON public.clinical_treatment_executions(tenant_id,client_id,performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_handover_client ON public.clinical_handovers(tenant_id,client_id,status,created_at DESC);

CREATE OR REPLACE FUNCTION public.clinical_actor_name() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(NULLIF(trim(concat_ws(' ',p.first_name,p.last_name)),''),NULLIF(p.display_name,''),p.email,'Unbekannt')
 FROM public.profiles p WHERE p.id=auth.uid() AND p.tenant_id=public.current_tenant_id()
$$;

CREATE OR REPLACE FUNCTION public.create_clinical_medication_order(p_client_id UUID,p_payload JSONB)
RETURNS public.clinical_medication_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.clinical_medication_orders; t UUID:=public.current_tenant_id(); n TEXT:=public.clinical_actor_name();
BEGIN
 IF NOT public.has_permission('pflege.medications.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.'; END IF;
 IF NOT public.is_active_pfleger_client(p_client_id) THEN RAISE EXCEPTION 'Kein aktiver Pflegefall.'; END IF;
 INSERT INTO public.clinical_medication_orders(tenant_id,client_id,medication_name,active_ingredient,dosage,pharmaceutical_form,route,schedule,indication,instructions,prescribing_physician,prescribed_at,valid_from,valid_until,is_prn,prn_reason,prn_max_dose,interaction_notes,recorded_by,recorded_by_name)
 VALUES(t,p_client_id,trim(p_payload->>'medicationName'),COALESCE(p_payload->>'activeIngredient',''),trim(p_payload->>'dosage'),COALESCE(p_payload->>'form',''),trim(p_payload->>'route'),COALESCE(p_payload->'schedule','{}'),COALESCE(p_payload->>'indication',''),COALESCE(p_payload->>'instructions',''),trim(p_payload->>'physician'),COALESCE((p_payload->>'prescribedAt')::DATE,CURRENT_DATE),COALESCE((p_payload->>'validFrom')::DATE,CURRENT_DATE),NULLIF(p_payload->>'validUntil','')::DATE,COALESCE((p_payload->>'isPrn')::BOOLEAN,FALSE),COALESCE(p_payload->>'prnReason',''),COALESCE(p_payload->>'prnMaxDose',''),COALESCE(p_payload->>'interactionNotes',''),auth.uid(),n) RETURNING * INTO r;
 INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name) VALUES(t,p_client_id,'medication_order',r.id,'created','Medikationsverordnung angelegt',to_jsonb(r),auth.uid(),n);
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.create_clinical_wound_case(p_client_id UUID,p_payload JSONB)
RETURNS public.clinical_wound_cases LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.clinical_wound_cases; t UUID:=public.current_tenant_id(); n TEXT:=public.clinical_actor_name();
BEGIN
 IF NOT public.has_permission('pflege.wounds.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.'; END IF;
 IF NOT public.is_active_pfleger_client(p_client_id) THEN RAISE EXCEPTION 'Kein aktiver Pflegefall.'; END IF;
 INSERT INTO public.clinical_wound_cases(tenant_id,client_id,body_location,wound_type,etiology,onset_date,treatment_plan,physician_involved,ordering_physician,next_review_at,recorded_by,recorded_by_name)
 VALUES(t,p_client_id,trim(p_payload->>'bodyLocation'),trim(p_payload->>'woundType'),COALESCE(p_payload->>'etiology',''),NULLIF(p_payload->>'onsetDate','')::DATE,COALESCE(p_payload->>'treatmentPlan',''),COALESCE((p_payload->>'physicianInvolved')::BOOLEAN,FALSE),COALESCE(p_payload->>'physician',''),NULLIF(p_payload->>'nextReviewAt','')::TIMESTAMPTZ,auth.uid(),n) RETURNING * INTO r;
 INSERT INTO public.clinical_wound_assessments(tenant_id,client_id,wound_case_id,wound_bed,intervention,response,recorded_by,recorded_by_name)
 VALUES(t,p_client_id,r.id,COALESCE(p_payload->>'description',''),COALESCE(p_payload->>'treatmentPlan',''),'Erstassessment',auth.uid(),n);
 INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name) VALUES(t,p_client_id,'wound_case',r.id,'created','Wundfall angelegt',to_jsonb(r),auth.uid(),n);
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.create_clinical_documentation(p_client_id UUID,p_entry_type TEXT,p_title TEXT,p_content TEXT,p_payload JSONB DEFAULT '{}'::JSONB)
RETURNS public.clinical_documentation_entries LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.clinical_documentation_entries; t UUID:=public.current_tenant_id(); n TEXT:=public.clinical_actor_name();
BEGIN
 IF NOT public.has_permission('pflege.documentation.create') THEN RAISE EXCEPTION 'Keine Berechtigung.'; END IF;
 IF NOT public.is_active_pfleger_client(p_client_id) THEN RAISE EXCEPTION 'Kein aktiver Pflegefall.'; END IF;
 INSERT INTO public.clinical_documentation_entries(tenant_id,client_id,entry_type,title,content,observations,interventions,result,deviation,escalation,recorded_by,recorded_by_name)
 VALUES(t,p_client_id,p_entry_type,trim(p_title),trim(p_content),COALESCE(p_payload->>'observations',''),COALESCE(p_payload->>'interventions',''),COALESCE(p_payload->>'result',''),COALESCE(p_payload->>'deviation',''),COALESCE(p_payload->>'escalation',''),auth.uid(),n) RETURNING * INTO r;
 INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name) VALUES(t,p_client_id,'clinical_documentation',r.id,'created','Pflegedokumentation angelegt',to_jsonb(r),auth.uid(),n);
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.sign_clinical_documentation(p_entry_id UUID)
RETURNS public.clinical_documentation_entries LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.clinical_documentation_entries; t UUID:=public.current_tenant_id(); n TEXT:=public.clinical_actor_name();
BEGIN
 IF NOT public.has_permission('pflege.documentation.sign') THEN RAISE EXCEPTION 'Keine Signaturberechtigung.'; END IF;
 UPDATE public.clinical_documentation_entries SET signature_status='signed',signed_at=clock_timestamp(),signed_by=auth.uid(),signed_by_name=n
 WHERE id=p_entry_id AND tenant_id=t AND signature_status='unsigned' RETURNING * INTO r;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Dokumentation nicht gefunden oder bereits signiert.'; END IF;
 INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name) VALUES(t,r.client_id,'clinical_documentation',r.id,'signed','Pflegedokumentation fachlich signiert',to_jsonb(r),auth.uid(),n);
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.create_clinical_handover(p_client_id UUID,p_payload JSONB)
RETURNS public.clinical_handovers LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.clinical_handovers; t UUID:=public.current_tenant_id(); n TEXT:=public.clinical_actor_name();
BEGIN
 IF NOT public.has_permission('pflege.handovers.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.'; END IF;
 IF NOT public.is_active_pfleger_client(p_client_id) THEN RAISE EXCEPTION 'Kein aktiver Pflegefall.'; END IF;
 INSERT INTO public.clinical_handovers(tenant_id,client_id,priority,title,situation,background,assessment,recommendation,due_at,created_by,created_by_name)
 VALUES(t,p_client_id,COALESCE(p_payload->>'priority','normal'),trim(p_payload->>'title'),trim(p_payload->>'situation'),COALESCE(p_payload->>'background',''),COALESCE(p_payload->>'assessment',''),trim(p_payload->>'recommendation'),NULLIF(p_payload->>'dueAt','')::TIMESTAMPTZ,auth.uid(),n) RETURNING * INTO r;
 INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name) VALUES(t,p_client_id,'handover',r.id,'created','Pflegeübergabe angelegt',to_jsonb(r),auth.uid(),n);
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.record_clinical_medication_administration(p_medication_order_id UUID,p_payload JSONB)
RETURNS public.clinical_medication_administrations LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.clinical_medication_administrations; o public.clinical_medication_orders; t UUID:=public.current_tenant_id(); n TEXT:=public.clinical_actor_name();
BEGIN
 IF NOT public.has_permission('pflege.medications.administer') THEN RAISE EXCEPTION 'Keine Berechtigung zur Medikamentengabe.'; END IF;
 SELECT * INTO o FROM public.clinical_medication_orders WHERE id=p_medication_order_id AND tenant_id=t AND status='active';
 IF o.id IS NULL THEN RAISE EXCEPTION 'Aktive Medikationsverordnung nicht gefunden.'; END IF;
 IF COALESCE(p_payload->>'outcome','') NOT IN ('administered','omitted','refused','not_available','held','prn_administered') THEN RAISE EXCEPTION 'Ungültiges Ergebnis.'; END IF;
 INSERT INTO public.clinical_medication_administrations(tenant_id,client_id,medication_order_id,outcome,scheduled_at,dose_given,reason,effect_observation,anomaly,escalation,recorded_by,recorded_by_name)
 VALUES(t,o.client_id,o.id,p_payload->>'outcome',NULLIF(p_payload->>'scheduledAt','')::TIMESTAMPTZ,COALESCE(p_payload->>'doseGiven',o.dosage),COALESCE(p_payload->>'reason',''),COALESCE(p_payload->>'effectObservation',''),COALESCE((p_payload->>'anomaly')::BOOLEAN,FALSE),COALESCE(p_payload->>'escalation',''),auth.uid(),n) RETURNING * INTO r;
 INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
 VALUES(t,o.client_id,'medication_administration',r.id,'created','Medikamentengabe dokumentiert',to_jsonb(r),auth.uid(),n);
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.create_clinical_wound_assessment(p_wound_case_id UUID,p_payload JSONB)
RETURNS public.clinical_wound_assessments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.clinical_wound_assessments; w public.clinical_wound_cases; t UUID:=public.current_tenant_id(); n TEXT:=public.clinical_actor_name();
BEGIN
 IF NOT public.has_permission('pflege.wounds.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.'; END IF;
 SELECT * INTO w FROM public.clinical_wound_cases WHERE id=p_wound_case_id AND tenant_id=t AND status<>'archived';
 IF w.id IS NULL THEN RAISE EXCEPTION 'Wundfall nicht gefunden.'; END IF;
 INSERT INTO public.clinical_wound_assessments(tenant_id,client_id,wound_case_id,length_cm,width_cm,depth_cm,wound_bed,exudate,odor,wound_edge,surrounding_skin,pain_score,infection_signs,intervention,response,photo_refs,recorded_by,recorded_by_name)
 VALUES(t,w.client_id,w.id,NULLIF(p_payload->>'lengthCm','')::NUMERIC,NULLIF(p_payload->>'widthCm','')::NUMERIC,NULLIF(p_payload->>'depthCm','')::NUMERIC,COALESCE(p_payload->>'woundBed',''),COALESCE(p_payload->>'exudate',''),COALESCE(p_payload->>'odor',''),COALESCE(p_payload->>'woundEdge',''),COALESCE(p_payload->>'surroundingSkin',''),NULLIF(p_payload->>'painScore','')::INTEGER,COALESCE(p_payload->>'infectionSigns',''),COALESCE(p_payload->>'intervention',''),COALESCE(p_payload->>'response',''),COALESCE(p_payload->'photoRefs','[]'::JSONB),auth.uid(),n) RETURNING * INTO r;
 UPDATE public.clinical_wound_cases SET updated_at=clock_timestamp(),status=COALESCE(NULLIF(p_payload->>'caseStatus',''),status),next_review_at=NULLIF(p_payload->>'nextReviewAt','')::TIMESTAMPTZ WHERE id=w.id;
 INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
 VALUES(t,w.client_id,'wound_assessment',r.id,'created','Wundassessment dokumentiert',to_jsonb(r),auth.uid(),n);
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.record_clinical_treatment_execution(p_client_id UUID,p_payload JSONB)
RETURNS public.clinical_treatment_executions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.clinical_treatment_executions; t UUID:=public.current_tenant_id(); n TEXT:=public.clinical_actor_name();
BEGIN
 IF NOT public.has_permission('pflege.treatment.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.'; END IF;
 IF NOT public.is_active_pfleger_client(p_client_id) THEN RAISE EXCEPTION 'Kein aktiver Pflegefall.'; END IF;
 IF COALESCE(p_payload->>'outcome','') NOT IN ('performed','partial','omitted','refused','failed') THEN RAISE EXCEPTION 'Ungültiges Ergebnis.'; END IF;
 INSERT INTO public.clinical_treatment_executions(tenant_id,client_id,medical_order_id,treatment_type,title,outcome,details,deviation_reason,escalation,qualification_snapshot,recorded_by,recorded_by_name)
 VALUES(t,p_client_id,NULLIF(p_payload->>'medicalOrderId','')::UUID,trim(p_payload->>'treatmentType'),trim(p_payload->>'title'),p_payload->>'outcome',trim(p_payload->>'details'),COALESCE(p_payload->>'deviationReason',''),COALESCE(p_payload->>'escalation',''),COALESCE(p_payload->>'qualificationSnapshot',''),auth.uid(),n) RETURNING * INTO r;
 INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
 VALUES(t,p_client_id,'treatment_execution',r.id,'created','Behandlungspflege dokumentiert',to_jsonb(r),auth.uid(),n);
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.acknowledge_clinical_handover(p_handover_id UUID,p_close BOOLEAN DEFAULT FALSE)
RETURNS public.clinical_handovers LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.clinical_handovers; t UUID:=public.current_tenant_id(); n TEXT:=public.clinical_actor_name();
BEGIN
 IF NOT public.has_permission('pflege.handovers.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.'; END IF;
 UPDATE public.clinical_handovers SET status=CASE WHEN p_close THEN 'closed' ELSE 'acknowledged' END,acknowledged_at=clock_timestamp(),acknowledged_by=auth.uid(),acknowledged_by_name=n
 WHERE id=p_handover_id AND tenant_id=t AND status IN('open','acknowledged') RETURNING * INTO r;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Offene Übergabe nicht gefunden.'; END IF;
 INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
 VALUES(t,r.client_id,'handover',r.id,CASE WHEN p_close THEN 'closed' ELSE 'acknowledged' END,'Übergabe quittiert',to_jsonb(r),auth.uid(),n);
 RETURN r;
END $$;

ALTER TABLE public.clinical_medication_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_medication_administrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_wound_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_wound_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_documentation_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_treatment_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinical_medication_orders_read ON public.clinical_medication_orders FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.medications.view'));
CREATE POLICY clinical_medication_administrations_read ON public.clinical_medication_administrations FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.medications.view'));
CREATE POLICY clinical_wound_cases_read ON public.clinical_wound_cases FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.wounds.view'));
CREATE POLICY clinical_wound_assessments_read ON public.clinical_wound_assessments FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.wounds.view'));
CREATE POLICY clinical_documentation_entries_read ON public.clinical_documentation_entries FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.documentation.view'));
CREATE POLICY clinical_treatment_executions_read ON public.clinical_treatment_executions FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.treatment.view'));
CREATE POLICY clinical_handovers_read ON public.clinical_handovers FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.handovers.view'));

GRANT SELECT ON public.clinical_medication_orders,public.clinical_medication_administrations,public.clinical_wound_cases,public.clinical_wound_assessments,public.clinical_documentation_entries,public.clinical_treatment_executions,public.clinical_handovers TO authenticated;
GRANT EXECUTE ON FUNCTION public.clinical_actor_name(),public.create_clinical_medication_order(UUID,JSONB),public.create_clinical_wound_case(UUID,JSONB),public.create_clinical_documentation(UUID,TEXT,TEXT,TEXT,JSONB),public.sign_clinical_documentation(UUID),public.create_clinical_handover(UUID,JSONB),public.record_clinical_medication_administration(UUID,JSONB),public.create_clinical_wound_assessment(UUID,JSONB),public.record_clinical_treatment_execution(UUID,JSONB),public.acknowledge_clinical_handover(UUID,BOOLEAN) TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.clinical_medication_administrations,public.clinical_wound_assessments,public.clinical_documentation_entries,public.clinical_treatment_executions,public.clinical_handovers FROM authenticated;

COMMENT ON TABLE public.clinical_documentation_entries IS 'Append-only Pflegeberichte mit separater fachlicher Signatur und Korrekturbezug.';
COMMENT ON TABLE public.clinical_medication_administrations IS 'Append-only Medikamentengaben mit Ergebnis, Abweichung und Eskalation.';
