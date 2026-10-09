-- Apply after ambulatory_care_tour_workflow.sql through the established migration pipeline.
-- No seed data. care_private must remain outside the exposed Data API schemas.
BEGIN;
CREATE TABLE IF NOT EXISTS public.care_admissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 client_id uuid NOT NULL REFERENCES public.clients(id), status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','paused','closed')),
 starts_on date NOT NULL, ends_on date, legal_basis text NOT NULL CHECK(legal_basis IN('sgb_xi','sgb_v','private')),
 payer_name text NOT NULL DEFAULT '', payer_ik text NOT NULL DEFAULT '',
 contract_reference text NOT NULL DEFAULT '', cost_information_reference text NOT NULL DEFAULT '', consent_reference text NOT NULL DEFAULT '',
 emergency_contact text NOT NULL DEFAULT '', access_notes text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
 created_by uuid NOT NULL REFERENCES auth.users(id), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(ends_on IS NULL OR ends_on>=starts_on)
);
CREATE UNIQUE INDEX IF NOT EXISTS care_admissions_open_client_idx ON public.care_admissions(tenant_id,client_id) WHERE status<>'closed';
CREATE TABLE IF NOT EXISTS public.care_tariffs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 service_code text NOT NULL CHECK(btrim(service_code)<>''), service_label text NOT NULL CHECK(btrim(service_label)<>''),
 legal_basis text NOT NULL CHECK(legal_basis IN('sgb_xi','sgb_v','private')),
 billing_unit text NOT NULL CHECK(billing_unit IN('visit','minute','hour','unit')),
 unit_price_cents integer NOT NULL CHECK(unit_price_cents>0 AND unit_price_cents<=999999999),
 valid_from date NOT NULL, valid_until date, payer_ik text NOT NULL DEFAULT '', agreement_reference text NOT NULL CHECK(btrim(agreement_reference)<>''),
 created_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(valid_until IS NULL OR valid_until>=valid_from), CHECK(payer_ik='' OR payer_ik~'^\d{9}$')
);
CREATE INDEX IF NOT EXISTS care_tariffs_lookup_idx ON public.care_tariffs(tenant_id,legal_basis,service_code,valid_from);
CREATE TABLE IF NOT EXISTS public.care_operations_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id), client_id uuid REFERENCES public.clients(id),
 title text NOT NULL CHECK(btrim(title)<>''), description text NOT NULL DEFAULT '', due_on date NOT NULL,
 priority text NOT NULL DEFAULT 'normal' CHECK(priority IN('normal','urgent')), status text NOT NULL DEFAULT 'open' CHECK(status IN('open','done','cancelled')),
 assigned_employee_id uuid REFERENCES public.employees(id), resolution text NOT NULL DEFAULT '',
 created_by uuid NOT NULL REFERENCES auth.users(id), updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS care_tasks_due_idx ON public.care_operations_tasks(tenant_id,status,due_on);
CREATE TABLE IF NOT EXISTS public.care_operations_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 entity_type text NOT NULL, entity_id uuid NOT NULL, action text NOT NULL, note text NOT NULL DEFAULT '',
 actor_id uuid NOT NULL REFERENCES auth.users(id), actor_name text NOT NULL DEFAULT public.clinical_actor_name(),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS care_operations_events_entity_idx ON public.care_operations_events(tenant_id,entity_type,entity_id,occurred_at);
ALTER TABLE public.care_staff_shifts ADD COLUMN IF NOT EXISTS break_minutes integer NOT NULL DEFAULT 0;
ALTER TABLE public.care_staff_shifts ADD COLUMN IF NOT EXISTS break_start time;
ALTER TABLE public.care_staff_shifts ADD COLUMN IF NOT EXISTS cancellation_reason text NOT NULL DEFAULT '';
ALTER TABLE public.care_tour_stops ADD COLUMN IF NOT EXISTS admission_id uuid REFERENCES public.care_admissions(id);
ALTER TABLE public.pfleger_service_proofs ADD COLUMN IF NOT EXISTS tariff_id uuid REFERENCES public.care_tariffs(id);
ALTER TABLE public.pfleger_service_proofs ADD COLUMN IF NOT EXISTS admission_id uuid REFERENCES public.care_admissions(id);

DO $$ DECLARE tbl text; perm text; BEGIN
 FOR tbl,perm IN VALUES('care_admissions','pflege.plans.view'),('care_tariffs','pflege.proofs.view'),('care_operations_tasks','pflege.plans.view'),('care_operations_events','pflege.audit.view') LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('DROP POLICY IF EXISTS care_operations_read ON public.%I',tbl);
  EXECUTE format('CREATE POLICY care_operations_read ON public.%I FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.has_permission(%L))',tbl,perm);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',tbl);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',tbl);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION care_private.assert_operations_actor(p_permission text) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id();
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR NOT public.has_permission(p_permission) THEN RAISE EXCEPTION 'Keine Berechtigung für diese Pflegeaktion.' USING ERRCODE='42501'; END IF;
 RETURN t;
END $$;
CREATE OR REPLACE FUNCTION care_private.record_operations_event(t uuid,kind text,entity uuid,action text,note text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.care_operations_events(tenant_id,entity_type,entity_id,action,note,actor_id) VALUES(t,kind,entity,action,COALESCE(note,''),auth.uid());
END $$;

CREATE OR REPLACE FUNCTION care_private.save_admission(p_id uuid,p_expected_at timestamptz,p_payload jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=care_private.assert_operations_actor('pflege.plans.manage'); r public.care_admissions; c uuid; begin_date date; end_date date;
BEGIN
 c:=(p_payload->>'clientId')::uuid;
 PERFORM 1 FROM public.clients WHERE id=c AND tenant_id=t AND public.is_active_pfleger_client(id) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Bitte einen aktiven Pflegefall dieses Mandanten auswählen.'; END IF;
 begin_date:=(p_payload->>'startsOn')::date; end_date:=NULLIF(p_payload->>'endsOn','')::date;
 IF begin_date IS NULL OR (end_date IS NOT NULL AND end_date<begin_date) THEN RAISE EXCEPTION 'Versorgungszeitraum ist ungültig.'; END IF;
 IF COALESCE(p_payload->>'basis','') NOT IN('sgb_xi','sgb_v','private') THEN RAISE EXCEPTION 'Finanzierungsart fehlt.'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.care_admissions(tenant_id,client_id,starts_on,ends_on,legal_basis,created_by) VALUES(t,c,begin_date,end_date,p_payload->>'basis',auth.uid()) RETURNING * INTO r;
 ELSE
  SELECT * INTO r FROM public.care_admissions WHERE id=p_id AND tenant_id=t FOR UPDATE;
  IF NOT FOUND OR r.client_id<>c THEN RAISE EXCEPTION 'Aufnahme nicht gefunden.' USING ERRCODE='42501'; END IF;
  IF r.updated_at IS DISTINCT FROM p_expected_at THEN RAISE EXCEPTION 'Aufnahme wurde geändert. Bitte aktualisieren.' USING ERRCODE='40001'; END IF;
  IF r.status<>'draft' THEN RAISE EXCEPTION 'Vertragsangaben sind nach Freigabe geschützt. Versorgung beenden und einen neuen Aufnahmevorgang anlegen.'; END IF;
 END IF;
 UPDATE public.care_admissions SET starts_on=begin_date,ends_on=end_date,legal_basis=p_payload->>'basis',payer_name=COALESCE(btrim(p_payload->>'payerName'),''),payer_ik=COALESCE(btrim(p_payload->>'payerIk'),''),
 contract_reference=COALESCE(btrim(p_payload->>'contractReference'),''),cost_information_reference=COALESCE(btrim(p_payload->>'costInformationReference'),''),consent_reference=COALESCE(btrim(p_payload->>'consentReference'),''),
 emergency_contact=COALESCE(btrim(p_payload->>'emergencyContact'),''),access_notes=COALESCE(btrim(p_payload->>'accessNotes'),''),notes=COALESCE(btrim(p_payload->>'notes'),''),updated_at=clock_timestamp() WHERE id=r.id;
 PERFORM care_private.record_operations_event(t,'admission',r.id,'saved','Aufnahmeangaben gespeichert');
 RETURN jsonb_build_object('id',r.id);
END $$;
CREATE OR REPLACE FUNCTION care_private.advance_admission(p_id uuid,p_expected_at timestamptz,p_status text,p_reason text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=care_private.assert_operations_actor('pflege.plans.manage'); r public.care_admissions;
BEGIN
 SELECT * INTO r FROM public.care_admissions WHERE id=p_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Aufnahme nicht gefunden.' USING ERRCODE='42501'; END IF;
 IF r.updated_at IS DISTINCT FROM p_expected_at THEN RAISE EXCEPTION 'Aufnahme wurde geändert. Bitte aktualisieren.' USING ERRCODE='40001'; END IF;
 IF NOT((r.status='draft' AND p_status='active') OR (r.status='active' AND p_status='paused') OR (r.status='paused' AND p_status='active') OR (r.status<>'closed' AND p_status='closed')) THEN RAISE EXCEPTION 'Dieser Versorgungswechsel ist nicht zulässig.'; END IF;
 IF p_status='active' AND (btrim(r.contract_reference)='' OR btrim(r.cost_information_reference)='' OR (r.legal_basis<>'private' AND (btrim(r.payer_name)='' OR r.payer_ik!~'^\d{9}$'))) THEN RAISE EXCEPTION 'Pflegevertrag, Kosteninformation und gültiger Kostenträger müssen vor Freigabe hinterlegt sein.'; END IF;
 IF p_status IN('paused','closed') AND COALESCE(btrim(p_reason),'')='' THEN RAISE EXCEPTION 'Begründung für Pause oder Ende ist erforderlich.'; END IF;
 UPDATE public.care_admissions SET status=p_status,ends_on=CASE WHEN p_status='closed' THEN GREATEST(starts_on,(clock_timestamp() AT TIME ZONE 'Europe/Berlin')::date) ELSE ends_on END,updated_at=clock_timestamp() WHERE id=r.id;
 PERFORM care_private.record_operations_event(t,'admission',r.id,r.status||'→'||p_status,p_reason);
 RETURN jsonb_build_object('id',r.id);
END $$;
CREATE OR REPLACE FUNCTION care_private.create_tariff(p_payload jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=care_private.assert_operations_actor('pflege.invoices.manage'); id_value uuid; start_date date:=(p_payload->>'validFrom')::date; end_date date:=NULLIF(p_payload->>'validUntil','')::date;
BEGIN
 IF COALESCE(btrim(p_payload->>'agreementReference'),'')='' THEN RAISE EXCEPTION 'Vergütungsvereinbarung bzw. Preisgrundlage ist erforderlich.'; END IF;
 -- Tenant lock serializes overlapping tariff version checks.
 PERFORM 1 FROM public.tenants WHERE id=t FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.care_tariffs WHERE tenant_id=t AND service_code=btrim(p_payload->>'code') AND legal_basis=p_payload->>'basis' AND payer_ik=COALESCE(p_payload->>'payerIk','') AND daterange(valid_from,valid_until,'[]')&&daterange(start_date,end_date,'[]')) THEN RAISE EXCEPTION 'Für diesen Leistungscode und Kostenträger besteht bereits ein Tarif im Zeitraum.'; END IF;
 INSERT INTO public.care_tariffs(tenant_id,service_code,service_label,legal_basis,billing_unit,unit_price_cents,valid_from,valid_until,payer_ik,agreement_reference,created_by)
 VALUES(t,btrim(p_payload->>'code'),btrim(p_payload->>'label'),p_payload->>'basis',p_payload->>'unit',(p_payload->>'unitPriceCents')::integer,start_date,end_date,COALESCE(p_payload->>'payerIk',''),btrim(p_payload->>'agreementReference'),auth.uid()) RETURNING id INTO id_value;
 PERFORM care_private.record_operations_event(t,'tariff',id_value,'created','Tarifversion angelegt');
 RETURN jsonb_build_object('id',id_value);
END $$;
CREATE OR REPLACE FUNCTION care_private.save_task(p_id uuid,p_expected_at timestamptz,p_payload jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=care_private.assert_operations_actor('pflege.plans.manage'); r public.care_operations_tasks; c uuid:=NULLIF(p_payload->>'clientId','')::uuid; e uuid:=NULLIF(p_payload->>'assignedEmployeeId','')::uuid;
BEGIN
 IF c IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients WHERE id=c AND tenant_id=t AND public.is_active_pfleger_client(id)) THEN RAISE EXCEPTION 'Pflegefall ist nicht verfügbar.'; END IF;
 IF e IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.employees WHERE id=e AND tenant_id=t AND deleted_at IS NULL AND status::text='active' AND 'pfleger'=ANY(allowed_products::text[])) THEN RAISE EXCEPTION 'Pflegekraft ist nicht verfügbar.'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.care_operations_tasks(tenant_id,client_id,title,description,due_on,priority,assigned_employee_id,created_by)
  VALUES(t,c,btrim(p_payload->>'title'),COALESCE(p_payload->>'description',''),(p_payload->>'dueOn')::date,COALESCE(p_payload->>'priority','normal'),e,auth.uid()) RETURNING * INTO r;
 ELSE
  SELECT * INTO r FROM public.care_operations_tasks WHERE id=p_id AND tenant_id=t FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aufgabe nicht gefunden.' USING ERRCODE='42501'; END IF;
  IF r.updated_at IS DISTINCT FROM p_expected_at THEN RAISE EXCEPTION 'Aufgabe wurde geändert. Bitte aktualisieren.' USING ERRCODE='40001'; END IF;
  IF r.status<>'open' OR COALESCE(p_payload->>'status','') NOT IN('done','cancelled') OR COALESCE(btrim(p_payload->>'resolution'),'')='' THEN RAISE EXCEPTION 'Offene Aufgabe mit dokumentiertem Ergebnis oder Ausfallgrund abschließen.'; END IF;
  UPDATE public.care_operations_tasks SET status=p_payload->>'status',resolution=btrim(p_payload->>'resolution'),updated_at=clock_timestamp() WHERE id=r.id;
 END IF;
 PERFORM care_private.record_operations_event(t,'task',r.id,COALESCE(p_payload->>'status','created'),COALESCE(p_payload->>'resolution',''));
 RETURN jsonb_build_object('id',r.id);
END $$;

-- Protect legacy shift writes and introduce a controlled plan/release/cancellation workflow.
CREATE OR REPLACE FUNCTION care_private.check_staff_planning(t uuid,e uuid,day date,st time,en time) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE slots jsonb; starts timestamptz:=(day+st) AT TIME ZONE 'Europe/Berlin'; ends timestamptz:=(day+en) AT TIME ZONE 'Europe/Berlin'; s jsonb;
BEGIN
 SELECT p.slots INTO slots FROM public.calendar_employee_month_plans p WHERE p.tenant_id=t AND p.employee_id=e AND p.month=date_trunc('month',day)::date FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Verfügbarkeit der Pflegekraft für diesen Monat muss vor Schichtfreigabe erfasst werden.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(slots) v WHERE v->>'kind'='available' AND (v->>'date')::date=day AND (v->>'startTime')::time<=st AND ((v->>'endTime')='24:00' OR (v->>'endTime')::time>=en)) THEN RAISE EXCEPTION 'Schicht liegt außerhalb der erklärten Verfügbarkeit.'; END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(slots) LOOP
  IF s->>'kind'='blocked' AND (s->>'date')::date=day AND (s->>'startTime')::time<en AND ((s->>'endTime')='24:00' OR (s->>'endTime')::time>st) THEN RAISE EXCEPTION 'Schicht überschneidet eine erklärte Abwesenheit.'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.workforce_absences a WHERE a.tenant_id=t AND a.employee_id=e AND a.status IN('requested','approved','active','completed') AND a.starts_at<ends AND a.ends_at>starts) THEN RAISE EXCEPTION 'Schicht überschneidet eine Abwesenheit in der Personalplanung.'; END IF;
END $$;
REVOKE ALL ON FUNCTION care_private.check_staff_planning(uuid,uuid,date,time,time) FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS care_staff_shifts_tenant_select ON public.care_staff_shifts;
DROP POLICY IF EXISTS care_staff_shifts_tenant_insert ON public.care_staff_shifts;
DROP POLICY IF EXISTS care_staff_shifts_tenant_update ON public.care_staff_shifts;
CREATE POLICY care_staff_shifts_tenant_select ON public.care_staff_shifts FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.plans.view'));
REVOKE ALL ON public.care_staff_shifts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.care_staff_shifts TO authenticated;
CREATE OR REPLACE FUNCTION care_private.create_shift(p_payload jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=care_private.assert_operations_actor('pflege.plans.manage'); e public.employees; r public.care_staff_shifts; st time:=(p_payload->>'startTime')::time; en time:=(p_payload->>'endTime')::time;
 pause integer:=COALESCE((p_payload->>'breakMinutes')::integer,0); pause_at time:=NULLIF(p_payload->>'breakStart','')::time; work integer;
BEGIN
 SELECT * INTO e FROM public.employees WHERE id=(p_payload->>'employeeId')::uuid AND tenant_id=t AND deleted_at IS NULL AND status::text='active' AND 'pfleger'=ANY(allowed_products::text[]) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Keine aktive Pflegekraft ausgewählt.'; END IF;
 work:=EXTRACT(EPOCH FROM(en-st))/60-pause;
 IF st IS NULL OR en IS NULL OR en<=st OR pause<0 OR (pause>0 AND pause<15) OR work<=0 OR work>600 OR pause<(CASE WHEN work>540 THEN 45 WHEN work>360 THEN 30 ELSE 0 END) THEN RAISE EXCEPTION 'Schichtzeiten oder geplante Pause sind ungültig.'; END IF;
 IF pause>0 AND (pause_at IS NULL OR pause_at<st OR pause_at+make_interval(mins=>pause)>en OR EXTRACT(EPOCH FROM(pause_at-st))/60>360 OR EXTRACT(EPOCH FROM(en-(pause_at+make_interval(mins=>pause))))/60>360) THEN RAISE EXCEPTION 'Pause innerhalb der Schicht so einplanen, dass kein Arbeitsabschnitt länger als sechs Stunden dauert.'; END IF;
 INSERT INTO public.care_staff_shifts(tenant_id,employee_id,employee_name_snapshot,role_label_snapshot,shift_date,start_time,end_time,break_minutes,break_start,location,created_by)
 VALUES(t,e.id,concat_ws(' ',e.first_name,e.last_name),COALESCE(e.qualification,''),(p_payload->>'shiftDate')::date,st,en,pause,CASE WHEN pause>0 THEN pause_at ELSE NULL END,COALESCE(btrim(p_payload->>'location'),''),auth.uid()) RETURNING * INTO r;
 PERFORM care_private.record_operations_event(t,'shift',r.id,'created','Dienstplanentwurf angelegt'); RETURN jsonb_build_object('id',r.id);
END $$;
CREATE OR REPLACE FUNCTION care_private.advance_shift(p_id uuid,p_expected_at timestamptz,p_status text,p_reason text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=care_private.assert_operations_actor('pflege.plans.manage'); r public.care_staff_shifts; starts timestamptz; ends timestamptz;
BEGIN
 PERFORM 1 FROM public.employees WHERE id=(SELECT employee_id FROM public.care_staff_shifts WHERE id=p_id AND tenant_id=t) FOR UPDATE;
 SELECT * INTO r FROM public.care_staff_shifts WHERE id=p_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Schicht nicht gefunden.' USING ERRCODE='42501'; END IF;
 IF r.updated_at IS DISTINCT FROM p_expected_at THEN RAISE EXCEPTION 'Schicht wurde geändert. Bitte aktualisieren.' USING ERRCODE='40001'; END IF;
 IF NOT((r.status='draft' AND p_status='published') OR (r.status='published' AND p_status='confirmed') OR (r.status IN('draft','published','confirmed') AND p_status='cancelled')) THEN RAISE EXCEPTION 'Dieser Schichtwechsel ist nicht zulässig.'; END IF;
 IF p_status='published' THEN
  IF r.employee_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.employees WHERE id=r.employee_id AND tenant_id=t AND deleted_at IS NULL AND status::text='active' AND 'pfleger'=ANY(allowed_products::text[])) THEN RAISE EXCEPTION 'Schicht benötigt eine aktive Pflegekraft.'; END IF;
  starts:=(r.shift_date+r.start_time) AT TIME ZONE 'Europe/Berlin'; ends:=(r.shift_date+r.end_time) AT TIME ZONE 'Europe/Berlin';
  PERFORM care_private.check_staff_planning(t,r.employee_id,r.shift_date,r.start_time,r.end_time);
  IF EXISTS(SELECT 1 FROM public.care_staff_shifts s WHERE s.tenant_id=t AND s.id<>r.id AND s.employee_id=r.employee_id AND s.status IN('published','confirmed','in_progress','completed') AND
   ((s.shift_date+s.start_time) AT TIME ZONE 'Europe/Berlin')<ends+interval '11 hours' AND ((s.shift_date+s.end_time) AT TIME ZONE 'Europe/Berlin')>starts-interval '11 hours') THEN RAISE EXCEPTION 'Schicht überschneidet sich oder die Standardruhezeit von elf Stunden wird unterschritten.'; END IF;
 END IF;
 IF p_status='cancelled' AND COALESCE(btrim(p_reason),'')='' THEN RAISE EXCEPTION 'Absagegrund ist erforderlich.'; END IF;
 IF p_status='cancelled' AND EXISTS(SELECT 1 FROM public.care_tours tr JOIN public.care_tour_stops s ON s.tour_id=tr.id WHERE tr.tenant_id=t AND tr.employee_id=r.employee_id AND tr.tour_date=r.shift_date AND tr.status IN('published','in_progress') AND s.planned_start>=r.start_time AND s.planned_end<=r.end_time) THEN RAISE EXCEPTION 'Zugeordnete freigegebene Tour zuerst umplanen oder absagen.'; END IF;
 UPDATE public.care_staff_shifts SET status=p_status,cancellation_reason=CASE WHEN p_status='cancelled' THEN p_reason ELSE '' END,updated_by=auth.uid(),updated_at=clock_timestamp() WHERE id=r.id;
 PERFORM care_private.record_operations_event(t,'shift',r.id,r.status||'→'||p_status,p_reason); RETURN jsonb_build_object('id',r.id);
END $$;

-- No direct approval updates through broad legacy policies.
CREATE OR REPLACE FUNCTION care_private.manage_medical_order(p_id uuid,p_expected_at timestamptz,p_payload jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=care_private.assert_operations_actor('pflege.orders.manage'); r public.care_medical_orders; c uuid; approval text;
BEGIN
 IF p_id IS NULL THEN
  c:=(p_payload->>'clientId')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.clients WHERE id=c AND tenant_id=t AND public.is_active_pfleger_client(id)) THEN RAISE EXCEPTION 'Kein aktiver Pflegefall.'; END IF;
  IF COALESCE(btrim(p_payload->>'title'),'')='' OR COALESCE(btrim(p_payload->>'description'),'')='' OR COALESCE(btrim(p_payload->>'orderingPhysician'),'')='' THEN RAISE EXCEPTION 'Verordnung, Inhalt und verordnende Person sind erforderlich.'; END IF;
  INSERT INTO public.care_medical_orders(tenant_id,client_id,order_type,title,description,ordering_physician,ordered_at,valid_from,valid_until,insurer_approval_required,insurer_approval_status,frequency,execution_instructions,qualification_requirement,recorded_by,recorded_by_name,physician_bsnr,physician_lanr,source_document)
  VALUES(t,c,p_payload->>'orderType',btrim(p_payload->>'title'),btrim(p_payload->>'description'),btrim(p_payload->>'orderingPhysician'),(p_payload->>'orderedAt')::date,(p_payload->>'validFrom')::date,NULLIF(p_payload->>'validUntil','')::date,COALESCE((p_payload->>'approvalRequired')::boolean,false),CASE WHEN COALESCE((p_payload->>'approvalRequired')::boolean,false) THEN 'pending' ELSE 'not_required' END,COALESCE(p_payload->>'frequency',''),COALESCE(p_payload->>'executionInstructions',''),COALESCE(p_payload->>'qualificationRequirement',''),auth.uid(),public.clinical_actor_name(),COALESCE(p_payload->>'physicianBsnr',''),COALESCE(p_payload->>'physicianLanr',''),COALESCE(p_payload->>'sourceDocument','')) RETURNING * INTO r;
 ELSE
  SELECT * INTO r FROM public.care_medical_orders WHERE id=p_id AND tenant_id=t FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verordnung nicht gefunden.' USING ERRCODE='42501'; END IF;
  IF r.updated_at IS DISTINCT FROM p_expected_at THEN RAISE EXCEPTION 'Verordnung wurde geändert. Bitte aktualisieren.' USING ERRCODE='40001'; END IF;
  IF COALESCE(btrim(p_payload->>'reason'),'')='' THEN RAISE EXCEPTION 'Begründung oder Bescheidreferenz dokumentieren.'; END IF;
  IF p_payload->>'action'='approval' THEN
   approval:=p_payload->>'approvalStatus';
   IF NOT r.insurer_approval_required OR approval NOT IN('pending','approved','rejected','expired') OR r.status IN('completed','cancelled','archived') THEN RAISE EXCEPTION 'Genehmigungswechsel ist nicht zulässig.'; END IF;
   IF approval='approved' AND COALESCE(btrim(p_payload->>'approvalReference'),'')='' THEN RAISE EXCEPTION 'Genehmigungsreferenz ist erforderlich.'; END IF;
   UPDATE public.care_medical_orders SET insurer_approval_status=approval,insurer_approval_reference=COALESCE(p_payload->>'approvalReference',''),updated_at=clock_timestamp() WHERE id=r.id;
  ELSIF p_payload->>'action'='status' THEN
   IF NOT((r.status='active' AND p_payload->>'status' IN('paused','completed','cancelled')) OR (r.status='paused' AND p_payload->>'status' IN('active','completed','cancelled'))) THEN RAISE EXCEPTION 'Verordnungsstatuswechsel ist nicht zulässig.'; END IF;
   UPDATE public.care_medical_orders SET status=p_payload->>'status',updated_at=clock_timestamp() WHERE id=r.id;
  ELSE RAISE EXCEPTION 'Unbekannte Verordnungsaktion.'; END IF;
 END IF;
 PERFORM care_private.record_operations_event(t,'order',r.id,COALESCE(p_payload->>'action','created'),COALESCE(p_payload->>'reason','')); RETURN jsonb_build_object('id',r.id);
END $$;
REVOKE INSERT,UPDATE,DELETE ON public.care_medical_orders FROM authenticated,anon;
ALTER TABLE public.care_medical_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS care_medical_orders_pflege_live_read ON public.care_medical_orders;
DROP POLICY IF EXISTS care_medical_orders_pflege_live_write ON public.care_medical_orders;
DROP POLICY IF EXISTS care_medical_orders_operations_read ON public.care_medical_orders;
CREATE POLICY care_medical_orders_operations_read ON public.care_medical_orders FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.orders.view'));
GRANT SELECT ON public.care_medical_orders TO authenticated;

-- Central guard: new tours need released admission and shift coverage; no silent bypass via old RPCs.
CREATE OR REPLACE FUNCTION care_private.guard_tour_operations() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE stop_row public.care_tour_stops;
BEGIN
 IF NEW.status IN('published','in_progress') AND NEW.status IS DISTINCT FROM OLD.status THEN
  IF NEW.status='in_progress' AND NEW.tour_date<>(clock_timestamp() AT TIME ZONE 'Europe/Berlin')::date THEN RAISE EXCEPTION 'Tour kann nur am geplanten Versorgungstag gestartet werden.'; END IF;
  FOR stop_row IN SELECT * FROM public.care_tour_stops WHERE tour_id=NEW.id AND status<>'cancelled' LOOP
   PERFORM care_private.check_staff_planning(NEW.tenant_id,NEW.employee_id,NEW.tour_date,stop_row.planned_start,stop_row.planned_end);
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.care_tour_stops s WHERE s.tour_id=NEW.id AND s.status<>'cancelled' AND NOT EXISTS(SELECT 1 FROM public.care_admissions a WHERE a.tenant_id=NEW.tenant_id AND a.client_id=s.client_id AND a.status='active' AND a.starts_on<=NEW.tour_date AND (a.ends_on IS NULL OR a.ends_on>=NEW.tour_date))) THEN RAISE EXCEPTION 'Für jeden Einsatz eine freigegebene Aufnahme im Versorgungszeitraum hinterlegen.'; END IF;
  IF EXISTS(SELECT 1 FROM public.care_tour_stops s WHERE s.tour_id=NEW.id AND s.status<>'cancelled' AND NOT EXISTS(SELECT 1 FROM public.care_staff_shifts sh WHERE sh.tenant_id=NEW.tenant_id AND sh.employee_id=NEW.employee_id AND sh.shift_date=NEW.tour_date AND sh.status IN('published','confirmed') AND sh.start_time<=s.planned_start AND sh.end_time>=s.planned_end AND (sh.break_minutes=0 OR s.planned_end<=sh.break_start OR s.planned_start>=sh.break_start+make_interval(mins=>sh.break_minutes)))) THEN RAISE EXCEPTION 'Einsätze müssen innerhalb freigegebener Schichten und außerhalb geplanter Pausen liegen.'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS care_tour_operations_guard ON public.care_tours;
CREATE TRIGGER care_tour_operations_guard BEFORE UPDATE ON public.care_tours FOR EACH ROW EXECUTE FUNCTION care_private.guard_tour_operations();
CREATE OR REPLACE FUNCTION care_private.guard_stop_operations() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tr public.care_tours;
BEGIN
 IF NEW.status='in_progress' AND NEW.status IS DISTINCT FROM OLD.status THEN
  SELECT * INTO tr FROM public.care_tours WHERE id=NEW.tour_id AND tenant_id=NEW.tenant_id;
  IF NOT EXISTS(SELECT 1 FROM public.care_admissions a WHERE a.tenant_id=NEW.tenant_id AND a.client_id=NEW.client_id AND a.status='active' AND a.starts_on<=tr.tour_date AND (a.ends_on IS NULL OR a.ends_on>=tr.tour_date)) THEN RAISE EXCEPTION 'Versorgung ist pausiert, beendet oder noch nicht freigegeben.'; END IF;
  PERFORM care_private.check_staff_planning(NEW.tenant_id,tr.employee_id,tr.tour_date,NEW.planned_start,NEW.planned_end);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION care_private.guard_stop_operations() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS care_stop_operations_guard ON public.care_tour_stops;
CREATE TRIGGER care_stop_operations_guard BEFORE UPDATE ON public.care_tour_stops FOR EACH ROW EXECUTE FUNCTION care_private.guard_stop_operations();

-- Keep the established append-only evidence factory private. Every public creation path
-- now checks the selected tariff, admission and order; free amounts cannot bypass it.
DO $$ BEGIN
 IF to_regprocedure('care_private.create_pfleger_service_proof(uuid,jsonb)') IS NULL THEN
  ALTER FUNCTION public.create_pfleger_service_proof(uuid,jsonb) SET SCHEMA care_private;
 END IF;
END $$;
REVOKE ALL ON FUNCTION care_private.create_pfleger_service_proof(uuid,jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION care_private.create_priced_proof(p_client_id uuid,p_payload jsonb) RETURNS public.pfleger_service_proofs
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='Europe/Berlin' AS $$
DECLARE t uuid:=care_private.assert_operations_actor('pflege.proofs.create'); a public.care_admissions; price public.care_tariffs; ord public.care_medical_orders; proof public.pfleger_service_proofs;
 day date:=(p_payload->>'serviceDate')::date; quantity numeric:=(p_payload->>'quantity')::numeric; amount integer;
BEGIN
 IF NOT public.is_active_pfleger_client(p_client_id) THEN RAISE EXCEPTION 'Kein aktiver Pflegefall.'; END IF;
 SELECT * INTO a FROM public.care_admissions WHERE tenant_id=t AND client_id=p_client_id AND status IN('active','closed') AND starts_on<=day AND (ends_on IS NULL OR ends_on>=day) ORDER BY starts_on DESC LIMIT 1 FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Freigegebene Aufnahme für den Leistungstag fehlt.'; END IF;
 SELECT * INTO price FROM public.care_tariffs WHERE id=NULLIF(p_payload->>'tariffId','')::uuid AND tenant_id=t AND legal_basis=a.legal_basis AND valid_from<=day AND (valid_until IS NULL OR valid_until>=day) AND (payer_ik='' OR payer_ik=a.payer_ik) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Gültigen Leistungstarif auswählen. Freie Preisangaben sind nicht zulässig.'; END IF;
 IF quantity IS NULL OR quantity<=0 OR quantity>99999 OR scale(quantity)>3 OR round(price.unit_price_cents*quantity)>999999999 THEN RAISE EXCEPTION 'Abrechnungsmenge oder Betrag ist ungültig.'; END IF;
 amount:=round(price.unit_price_cents*quantity);
 IF a.legal_basis='sgb_v' THEN
  SELECT * INTO ord FROM public.care_medical_orders WHERE id=NULLIF(p_payload->>'prescriptionReference','')::uuid AND tenant_id=t AND client_id=p_client_id AND status IN('active','completed') AND valid_from<=day AND (valid_until IS NULL OR valid_until>=day) AND (NOT insurer_approval_required OR insurer_approval_status='approved') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gültige Verordnung mit erforderlicher Kostenträgergenehmigung auswählen.'; END IF;
 END IF;
 IF NULLIF(p_payload->>'documentationEntryId','') IS NULL OR NOT EXISTS(SELECT 1 FROM public.clinical_documentation_entries WHERE id=(p_payload->>'documentationEntryId')::uuid AND tenant_id=t AND client_id=p_client_id) THEN RAISE EXCEPTION 'Pflegedokumentation dieses Pflegefalls muss verknüpft sein.'; END IF;
 SELECT * INTO proof FROM care_private.create_pfleger_service_proof(p_client_id,p_payload||jsonb_build_object('legalBasis',a.legal_basis,'serviceCode',price.service_code,'serviceLabel',price.service_label,'costCarrierName',a.payer_name,'costCarrierIk',a.payer_ik,'grossAmountCents',amount,'unitPriceCents',price.unit_price_cents,'quantity',quantity,'billingUnit',price.billing_unit));
 UPDATE public.pfleger_service_proofs SET tariff_id=price.id,admission_id=a.id WHERE id=proof.id RETURNING * INTO proof;
 RETURN proof;
END $$;
CREATE OR REPLACE FUNCTION public.create_pfleger_service_proof(p_client_id uuid,p_payload jsonb) RETURNS public.pfleger_service_proofs LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.create_priced_proof(p_client_id,p_payload)$$;
REVOKE ALL ON FUNCTION care_private.create_priced_proof(uuid,jsonb),public.create_pfleger_service_proof(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION care_private.create_priced_proof(uuid,jsonb),public.create_pfleger_service_proof(uuid,jsonb) TO authenticated;

-- Invoice foundations must contain one actual recipient, rather than selecting
-- a random minimum IK from multiple payers of the same type. Serialize per client.
DO $$ BEGIN
 IF to_regprocedure('care_private.create_pfleger_invoice_foundation(uuid,date,date)') IS NULL THEN
  ALTER FUNCTION public.create_pfleger_invoice_foundation(uuid,date,date) SET SCHEMA care_private;
 END IF;
END $$;
REVOKE ALL ON FUNCTION care_private.create_pfleger_invoice_foundation(uuid,date,date) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION care_private.create_checked_foundation(p_client_id uuid,p_period_from date,p_period_to date) RETURNS public.pfleger_invoice_foundations
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=care_private.assert_operations_actor('pflege.invoices.manage'); r public.pfleger_invoice_foundations;
BEGIN
 IF p_period_from IS NULL OR p_period_to IS NULL OR p_period_to<p_period_from THEN RAISE EXCEPTION 'Abrechnungszeitraum ist ungültig.'; END IF;
 PERFORM 1 FROM public.clients WHERE id=p_client_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pflegefall nicht gefunden.' USING ERRCODE='42501'; END IF;
 IF (SELECT count(DISTINCT (payer_type,cost_carrier_name,cost_carrier_ik)) FROM public.pfleger_billing_cases WHERE tenant_id=t AND client_id=p_client_id AND status='released' AND invoice_foundation_id IS NULL AND service_date BETWEEN p_period_from AND p_period_to)>1 THEN RAISE EXCEPTION 'Unterschiedliche Rechnungsempfänger müssen getrennt abgerechnet werden. Zeitraum eingrenzen.'; END IF;
 SELECT * INTO r FROM care_private.create_pfleger_invoice_foundation(p_client_id,p_period_from,p_period_to);
 RETURN r;
END $$;
CREATE OR REPLACE FUNCTION public.create_pfleger_invoice_foundation(p_client_id uuid,p_period_from date,p_period_to date) RETURNS public.pfleger_invoice_foundations LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.create_checked_foundation(p_client_id,p_period_from,p_period_to)$$;
REVOKE ALL ON FUNCTION care_private.create_checked_foundation(uuid,date,date),public.create_pfleger_invoice_foundation(uuid,date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION care_private.create_checked_foundation(uuid,date,date),public.create_pfleger_invoice_foundation(uuid,date,date) TO authenticated;

CREATE OR REPLACE FUNCTION care_private.create_catalog_stop_proof(p_stop_id uuid,p_tariff_id uuid,p_quantity numeric,p_order_id uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=care_private.assert_operations_actor('pflege.proofs.create'); s public.care_tour_stops; tr public.care_tours; a public.care_admissions; price public.care_tariffs; ord public.care_medical_orders; result jsonb; day date; amount integer;
BEGIN
 SELECT * INTO s FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND OR s.status<>'completed' THEN RAISE EXCEPTION 'Abgeschlossenen Einsatz auswählen.'; END IF;
 IF s.service_proof_id IS NOT NULL THEN RETURN jsonb_build_object('id',s.service_proof_id); END IF;
 SELECT * INTO tr FROM public.care_tours WHERE id=s.tour_id AND tenant_id=t;
 day:=(s.actual_started_at AT TIME ZONE 'Europe/Berlin')::date;
 -- Capture historical admission by date, even if it has since ended; paused admissions remain blocked.
 SELECT * INTO a FROM public.care_admissions WHERE tenant_id=t AND client_id=s.client_id AND status IN('active','closed') AND starts_on<=day AND (ends_on IS NULL OR ends_on>=day) ORDER BY starts_on DESC LIMIT 1 FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Freigegebene Aufnahme für den Leistungstag fehlt.'; END IF;
 SELECT * INTO price FROM public.care_tariffs WHERE id=p_tariff_id AND tenant_id=t AND legal_basis=a.legal_basis AND valid_from<=day AND (valid_until IS NULL OR valid_until>=day) AND (payer_ik='' OR payer_ik=a.payer_ik) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Kein gültiger Tarif für Leistungstag und Kostenträger.'; END IF;
 IF p_quantity IS NULL OR p_quantity<=0 OR p_quantity>99999 OR scale(p_quantity)>3 THEN RAISE EXCEPTION 'Menge muss positiv sein und darf höchstens drei Nachkommastellen enthalten.'; END IF;
 IF round(price.unit_price_cents*p_quantity)>999999999 THEN RAISE EXCEPTION 'Abrechnungsbetrag überschreitet den erlaubten Bereich.'; END IF;
 amount:=round(price.unit_price_cents*p_quantity);
 IF a.legal_basis='sgb_v' THEN
  SELECT * INTO ord FROM public.care_medical_orders WHERE id=p_order_id AND tenant_id=t AND client_id=s.client_id AND status IN('active','completed') AND valid_from<=day AND (valid_until IS NULL OR valid_until>=day) AND (NOT insurer_approval_required OR insurer_approval_status='approved') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gültige Verordnung mit erforderlicher Kostenträgergenehmigung auswählen.'; END IF;
 END IF;
 result:=care_private.create_stop_proof(p_stop_id,jsonb_build_object('tariffId',price.id,'legalBasis',a.legal_basis,'serviceCode',price.service_code,'serviceLabel',price.service_label,'costCarrierName',a.payer_name,'costCarrierIk',a.payer_ik,'prescriptionReference',CASE WHEN a.legal_basis='sgb_v' THEN ord.id::text ELSE '' END,'grossAmountCents',amount,'unitPriceCents',price.unit_price_cents,'quantity',p_quantity,'billingUnit',price.billing_unit));
 UPDATE public.pfleger_service_proofs SET tariff_id=price.id,admission_id=a.id WHERE id=(result->>'id')::uuid AND tenant_id=t;
 UPDATE public.care_tour_stops SET admission_id=a.id WHERE id=s.id;
 PERFORM care_private.record_operations_event(t,'proof',(result->>'id')::uuid,'priced','Tarif und Aufnahme serverseitig übernommen');
 RETURN result;
END $$;

-- Exposed invoker wrappers; privileged helpers have no public/default execute grant.
CREATE OR REPLACE FUNCTION public.save_ambulatory_care_admission(p_id uuid,p_expected_at timestamptz,p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.save_admission(p_id,p_expected_at,p_payload)$$;
CREATE OR REPLACE FUNCTION public.advance_ambulatory_care_admission(p_id uuid,p_expected_at timestamptz,p_status text,p_reason text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.advance_admission(p_id,p_expected_at,p_status,p_reason)$$;
CREATE OR REPLACE FUNCTION public.create_ambulatory_care_tariff(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.create_tariff(p_payload)$$;
CREATE OR REPLACE FUNCTION public.save_ambulatory_care_task(p_id uuid,p_expected_at timestamptz,p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.save_task(p_id,p_expected_at,p_payload)$$;
CREATE OR REPLACE FUNCTION public.create_ambulatory_care_shift(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.create_shift(p_payload)$$;
CREATE OR REPLACE FUNCTION public.advance_ambulatory_care_shift(p_id uuid,p_expected_at timestamptz,p_status text,p_reason text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.advance_shift(p_id,p_expected_at,p_status,p_reason)$$;
CREATE OR REPLACE FUNCTION public.manage_ambulatory_care_order(p_id uuid,p_expected_at timestamptz,p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.manage_medical_order(p_id,p_expected_at,p_payload)$$;
CREATE OR REPLACE FUNCTION public.create_catalog_care_stop_proof(p_stop_id uuid,p_tariff_id uuid,p_quantity numeric,p_order_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.create_catalog_stop_proof(p_stop_id,p_tariff_id,p_quantity,p_order_id)$$;
DO $$ DECLARE fn record; BEGIN
 FOR fn IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='care_private' AND p.proname IN('assert_operations_actor','record_operations_event','save_admission','advance_admission','create_tariff','save_task','create_shift','advance_shift','manage_medical_order','guard_tour_operations','create_catalog_stop_proof')) OR (n.nspname='public' AND p.proname IN('save_ambulatory_care_admission','advance_ambulatory_care_admission','create_ambulatory_care_tariff','save_ambulatory_care_task','create_ambulatory_care_shift','advance_ambulatory_care_shift','manage_ambulatory_care_order','create_catalog_care_stop_proof')) LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',fn.signature);
  IF fn.signature::text NOT LIKE '%record_operations_event%' AND fn.signature::text NOT LIKE '%guard_tour_operations%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',fn.signature); END IF;
 END LOOP;
END $$;
COMMIT;
