-- Apply after ambulatory_care_operations.sql and the existing portal identity migrations.
BEGIN;
CREATE OR REPLACE FUNCTION care_private.portal_care_proofs(p_offset integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); c uuid:=public.current_client_id();
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR c IS NULL OR public.current_portal_type() IS DISTINCT FROM 'client'
 OR NOT EXISTS(SELECT 1 FROM public.clients WHERE id=c AND tenant_id=t) THEN
 RAISE EXCEPTION 'Keine Berechtigung für eigene Pflegenachweise.' USING ERRCODE='42501'; END IF;
 IF p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'Ungültige Seitenauswahl.' USING ERRCODE='23514'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'date',p.service_date,'startedAt',p.started_at,'endedAt',p.ended_at,'service',p.service_label,'employee',p.employee_name_snapshot,'note',p.performance_note,'amountCents',p.gross_amount_cents,'status',p.status,'signer',p.client_signature_name,'signedAt',p.client_signed_at,'signature',NULL,'rejectionReason',p.rejection_reason) ORDER BY p.service_date DESC,p.id)
 FROM (SELECT * FROM public.pfleger_service_proofs WHERE tenant_id=t AND client_id=c AND status IN('submitted','signed','approved','rejected') ORDER BY service_date DESC,id LIMIT 25 OFFSET p_offset) p), '[]'::jsonb);
END $$;
CREATE OR REPLACE FUNCTION care_private.portal_sign_care_proof(p_id uuid,p_name text,p_png text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); c uuid:=public.current_client_id(); r public.pfleger_service_proofs; evidence uuid; old jsonb;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR c IS NULL OR public.current_portal_type() IS DISTINCT FROM 'client'
 OR NOT EXISTS(SELECT 1 FROM public.clients WHERE id=c AND tenant_id=t) THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.pfleger_service_proofs WHERE id=p_id AND tenant_id=t AND client_id=c FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Nachweis nicht verfügbar.' USING ERRCODE='42501'; END IF;
 IF r.status='signed' AND EXISTS(SELECT 1 FROM public.pfleger_signature_evidence WHERE proof_id=r.id AND captured_by=auth.uid() AND signer_name=btrim(p_name) AND png_data_url=p_png) THEN RETURN jsonb_build_object('id',r.id); END IF;
 IF r.status<>'submitted' THEN RAISE EXCEPTION 'Dieser Nachweis steht nicht zur Unterschrift bereit.' USING ERRCODE='23514'; END IF;
 IF COALESCE(btrim(p_name),'')='' OR length(p_name)>200 OR COALESCE(p_png,'')!~'^data:image/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$' OR length(p_png) NOT BETWEEN 100 AND 1048576 THEN RAISE EXCEPTION 'Name und gültige PNG-Unterschrift sind erforderlich.' USING ERRCODE='23514'; END IF;
 old:=to_jsonb(r);
 INSERT INTO public.pfleger_signature_evidence(tenant_id,proof_id,signer_name,png_data_url,captured_by) VALUES(t,r.id,btrim(p_name),p_png,auth.uid()) RETURNING id INTO evidence;
 UPDATE public.pfleger_service_proofs SET status='signed',client_signature_name=btrim(p_name),client_signed_at=clock_timestamp(),signature_ref=evidence::text,updated_at=clock_timestamp() WHERE id=r.id RETURNING * INTO r;
 INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,before_data,after_data,actor_id,actor_name)
 VALUES(t,c,'pflege_service_proof',r.id,'portal_signed','Klient:in hat den eigenen Nachweis im Portal unterschrieben.',old,to_jsonb(r),auth.uid(),btrim(p_name));
 RETURN jsonb_build_object('id',r.id);
END $$;
CREATE OR REPLACE FUNCTION care_private.portal_care_tours(p_day date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); e uuid:=public.resolve_current_employee_id();
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR e IS NULL OR public.current_portal_type() IS DISTINCT FROM 'employee'
 OR NOT EXISTS(SELECT 1 FROM public.employees WHERE id=e AND tenant_id=t AND deleted_at IS NULL AND status::text='active' AND 'pfleger'=ANY(allowed_products::text[])) THEN
 RAISE EXCEPTION 'Keine aktive Pflegekraft im Mitarbeiterportal.' USING ERRCODE='42501'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',tr.id,'date',tr.tour_date,'name',tr.name,'status',tr.status,'vehicle',tr.vehicle_label_snapshot,'stops',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'client',s.client_name_snapshot,'address',s.address_snapshot,'start',s.planned_start,'end',s.planned_end,'service',s.service_summary,'status',s.status,'note',s.notes) ORDER BY s.sequence_no) FROM public.care_tour_stops s WHERE s.tour_id=tr.id AND s.tenant_id=t),'[]'::jsonb)) ORDER BY tr.name,tr.id) FROM public.care_tours tr WHERE tr.tenant_id=t AND tr.employee_id=e AND tr.tour_date=p_day AND tr.status IN('published','in_progress','completed')), '[]'::jsonb);
END $$;
CREATE OR REPLACE FUNCTION public.get_my_ambulatory_care_proofs(p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.portal_care_proofs(p_offset)$$;
CREATE OR REPLACE FUNCTION public.sign_my_ambulatory_care_proof(p_id uuid,p_name text,p_png text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.portal_sign_care_proof(p_id,p_name,p_png)$$;
CREATE OR REPLACE FUNCTION public.get_my_ambulatory_care_tours(p_day date) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.portal_care_tours(p_day)$$;
REVOKE ALL ON FUNCTION care_private.portal_care_proofs(integer),care_private.portal_sign_care_proof(uuid,text,text),care_private.portal_care_tours(date),public.get_my_ambulatory_care_proofs(integer),public.sign_my_ambulatory_care_proof(uuid,text,text),public.get_my_ambulatory_care_tours(date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION care_private.portal_care_proofs(integer),care_private.portal_sign_care_proof(uuid,text,text),care_private.portal_care_tours(date),public.get_my_ambulatory_care_proofs(integer),public.sign_my_ambulatory_care_proof(uuid,text,text),public.get_my_ambulatory_care_tours(date) TO authenticated;

CREATE OR REPLACE FUNCTION care_private.assert_own_care_tour(p_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); e uuid:=public.resolve_current_employee_id();
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR e IS NULL OR public.current_portal_type() IS DISTINCT FROM 'employee'
 OR NOT EXISTS(SELECT 1 FROM public.employees WHERE id=e AND tenant_id=t AND deleted_at IS NULL AND status::text='active' AND 'pfleger'=ANY(allowed_products::text[]))
 OR NOT EXISTS(SELECT 1 FROM public.care_tours WHERE id=p_id AND tenant_id=t AND employee_id=e) THEN RAISE EXCEPTION 'Keine Berechtigung für diese Tour.' USING ERRCODE='42501'; END IF;
 RETURN t;
END $$;
REVOKE ALL ON FUNCTION care_private.assert_own_care_tour(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION care_private.portal_advance_tour(p_tour_id uuid,p_status text,p_expected_status text,p_reason text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=care_private.assert_own_care_tour(p_tour_id); r public.care_tours;
BEGIN
 -- Serialize planning against this employee; all callers acquire employee then tour.
 PERFORM 1 FROM public.employees WHERE id=(SELECT employee_id FROM public.care_tours WHERE id=p_tour_id AND tenant_id=t) FOR UPDATE;
 SELECT * INTO r FROM public.care_tours WHERE id=p_tour_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tour nicht gefunden.' USING ERRCODE='42501'; END IF;
 PERFORM care_private.assert_own_care_tour(r.id);
 IF r.employee_id IS DISTINCT FROM public.resolve_current_employee_id() THEN RAISE EXCEPTION 'Tour wurde neu zugeordnet.' USING ERRCODE='42501'; END IF;
 IF p_status NOT IN('in_progress','completed') THEN RAISE EXCEPTION 'Nur eigene Tour starten oder abschließen.' USING ERRCODE='42501'; END IF;
 IF p_status='in_progress' AND r.tour_date<>(clock_timestamp() AT TIME ZONE 'Europe/Berlin')::date THEN RAISE EXCEPTION 'Tour kann nur am geplanten Tag gestartet werden.'; END IF;
 IF r.status IS DISTINCT FROM p_expected_status THEN RAISE EXCEPTION 'Tour wurde zwischenzeitlich geändert. Bitte aktualisieren.' USING ERRCODE='40001'; END IF;
 IF NOT ((r.status='draft' AND p_status='published') OR (r.status='published' AND p_status='in_progress') OR (r.status='in_progress' AND p_status='completed') OR (r.status IN('draft','published') AND p_status='cancelled')) THEN
  RAISE EXCEPTION 'Dieser Tourstatuswechsel ist nicht zulässig.' USING ERRCODE='23514';
 END IF;
 IF p_status IN('published','in_progress') THEN
  IF NOT EXISTS(SELECT 1 FROM public.employees WHERE id=r.employee_id AND tenant_id=t AND deleted_at IS NULL AND status::text='active' AND 'pfleger'=ANY(allowed_products::text[])) THEN RAISE EXCEPTION 'Die zugeordnete Pflegekraft ist nicht aktiv.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.care_tour_stops WHERE tour_id=r.id AND tenant_id=t) OR EXISTS(SELECT 1 FROM public.care_tour_stops WHERE tour_id=r.id AND tenant_id=t AND (client_id IS NULL OR NOT public.is_active_pfleger_client(client_id))) THEN RAISE EXCEPTION 'Tour benötigt ausschließlich aktive, zugeordnete Pflegefälle.'; END IF;
  IF EXISTS(SELECT 1 FROM public.care_tours other JOIN public.care_tour_stops os ON os.tour_id=other.id JOIN public.care_tour_stops ns ON ns.tour_id=r.id
   WHERE other.tenant_id=t AND other.id<>r.id AND other.tour_date=r.tour_date AND other.employee_id=r.employee_id AND other.status IN('published','in_progress')
   AND os.status<>'cancelled' AND ns.status<>'cancelled' AND os.planned_start<ns.planned_end AND ns.planned_start<os.planned_end) THEN RAISE EXCEPTION 'Pflegekraft hat einen überlappenden Einsatz in einer anderen Tour.'; END IF;
 END IF;
 IF p_status='completed' AND (NOT EXISTS(SELECT 1 FROM public.care_tour_stops WHERE tour_id=r.id) OR EXISTS(SELECT 1 FROM public.care_tour_stops WHERE tour_id=r.id AND status NOT IN('completed','cancelled'))) THEN RAISE EXCEPTION 'Alle Einsätze müssen dokumentiert oder begründet ausgefallen sein.'; END IF;
 IF p_status='cancelled' THEN
  IF COALESCE(btrim(p_reason),'')='' THEN RAISE EXCEPTION 'Ein Absagegrund ist erforderlich.'; END IF;
  UPDATE public.care_tour_stops SET status='cancelled',notes=btrim(p_reason),updated_at=clock_timestamp() WHERE tour_id=r.id AND tenant_id=t;
 END IF;
 UPDATE public.care_tours SET status=p_status,updated_by=auth.uid(),updated_at=clock_timestamp() WHERE id=r.id;
 INSERT INTO public.care_tour_events(tenant_id,tour_id,actor_id,actor_name,action,note) VALUES(t,r.id,auth.uid(),r.employee_name_snapshot,r.status||'→'||p_status,COALESCE(btrim(p_reason),''));
 RETURN jsonb_build_object('id',r.id);
END $$;
CREATE OR REPLACE FUNCTION care_private.portal_advance_stop(p_stop_id uuid,p_status text,p_expected_status text,p_note text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=care_private.assert_own_care_tour((SELECT tour_id FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=public.current_tenant_id())); r public.care_tour_stops; tr public.care_tours; doc public.clinical_documentation_entries;
BEGIN
 PERFORM 1 FROM public.employees WHERE id=(SELECT employee_id FROM public.care_tours WHERE id=(SELECT tour_id FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t) AND tenant_id=t) FOR UPDATE;
 SELECT * INTO tr FROM public.care_tours WHERE id=(SELECT tour_id FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t) AND tenant_id=t FOR UPDATE;
 PERFORM care_private.assert_own_care_tour(tr.id);
 IF tr.employee_id IS DISTINCT FROM public.resolve_current_employee_id() THEN RAISE EXCEPTION 'Tour wurde neu zugeordnet.' USING ERRCODE='42501'; END IF;
 IF p_status IN('arrived','in_progress') AND tr.tour_date<>(clock_timestamp() AT TIME ZONE 'Europe/Berlin')::date THEN RAISE EXCEPTION 'Einsatz kann nur am geplanten Tag gestartet werden.'; END IF;
 IF tr.id IS NULL OR tr.status<>'in_progress' THEN RAISE EXCEPTION 'Tour muss zuerst gestartet werden.'; END IF;
 SELECT * INTO r FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND OR r.status IS DISTINCT FROM p_expected_status THEN RAISE EXCEPTION 'Einsatz wurde zwischenzeitlich geändert. Bitte aktualisieren.' USING ERRCODE='40001'; END IF;
 IF NOT ((r.status='planned' AND p_status='arrived') OR (r.status='arrived' AND p_status='in_progress') OR (r.status='in_progress' AND p_status='completed') OR (r.status IN('planned','arrived','in_progress') AND p_status='cancelled')) THEN RAISE EXCEPTION 'Dieser Einsatzstatuswechsel ist nicht zulässig.'; END IF;
 IF p_status IN('completed','cancelled') AND COALESCE(btrim(p_note),'')='' THEN RAISE EXCEPTION 'Durchführungsnachweis bzw. Ausfallgrund ist erforderlich.'; END IF;
 IF p_status='in_progress' THEN
  IF NOT public.is_active_pfleger_client(r.client_id) THEN RAISE EXCEPTION 'Kein aktiver Pflegefall.'; END IF;
  IF EXISTS(SELECT 1 FROM public.care_tour_stops s JOIN public.care_tours ct ON ct.id=s.tour_id WHERE ct.tenant_id=t AND ct.employee_id=tr.employee_id AND s.id<>r.id AND s.status='in_progress') THEN RAISE EXCEPTION 'Ein anderer Einsatz läuft bereits.'; END IF;
 END IF;
 IF p_status='completed' THEN
  INSERT INTO public.clinical_documentation_entries(tenant_id,client_id,entry_type,title,content,interventions,recorded_by,recorded_by_name) VALUES(t,r.client_id,'visit','Ambulanter Einsatz: '||r.service_summary,btrim(p_note),r.service_summary,COALESCE(public.clinical_actor_id(),auth.uid()),tr.employee_name_snapshot) RETURNING * INTO doc;
  INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name) VALUES(t,r.client_id,'clinical_documentation',doc.id,'created','Durchführung im Mitarbeiterportal dokumentiert.',to_jsonb(doc),auth.uid(),tr.employee_name_snapshot);
 END IF;
 UPDATE public.care_tour_stops SET status=p_status,
 documentation_entry_id=COALESCE(doc.id,documentation_entry_id),
 actual_started_at=CASE WHEN p_status='in_progress' THEN clock_timestamp() ELSE actual_started_at END,
 actual_ended_at=CASE WHEN p_status IN('completed','cancelled') AND actual_started_at IS NOT NULL THEN clock_timestamp() ELSE actual_ended_at END,
 notes=CASE WHEN p_status IN('completed','cancelled') THEN btrim(p_note) ELSE notes END,updated_at=clock_timestamp() WHERE id=r.id;
 INSERT INTO public.care_tour_events(tenant_id,tour_id,stop_id,actor_id,actor_name,action,note) VALUES(t,tr.id,r.id,auth.uid(),tr.employee_name_snapshot,r.status||'→'||p_status,COALESCE(btrim(p_note),''));
 RETURN jsonb_build_object('id',r.id);
END $$;

CREATE OR REPLACE FUNCTION public.advance_my_ambulatory_care_tour(p_tour_id uuid,p_status text,p_expected_status text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.portal_advance_tour(p_tour_id,p_status,p_expected_status,'')$$;
CREATE OR REPLACE FUNCTION public.advance_my_ambulatory_care_stop(p_stop_id uuid,p_status text,p_expected_status text,p_note text DEFAULT '') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.portal_advance_stop(p_stop_id,p_status,p_expected_status,p_note)$$;
REVOKE ALL ON FUNCTION care_private.portal_advance_tour(uuid,text,text,text),care_private.portal_advance_stop(uuid,text,text,text),public.advance_my_ambulatory_care_tour(uuid,text,text),public.advance_my_ambulatory_care_stop(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION care_private.portal_advance_tour(uuid,text,text,text),care_private.portal_advance_stop(uuid,text,text,text),public.advance_my_ambulatory_care_tour(uuid,text,text),public.advance_my_ambulatory_care_stop(uuid,text,text,text) TO authenticated;


CREATE OR REPLACE FUNCTION care_private.portal_care_signature(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); c uuid:=public.current_client_id(); result jsonb;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR c IS NULL OR public.current_portal_type() IS DISTINCT FROM 'client' OR NOT EXISTS(SELECT 1 FROM public.clients WHERE id=c AND tenant_id=t) THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('pngDataUrl',e.png_data_url,'signerName',e.signer_name,'capturedAt',e.captured_at) INTO result
 FROM public.pfleger_signature_evidence e JOIN public.pfleger_service_proofs p ON p.id=e.proof_id AND p.tenant_id=e.tenant_id
 WHERE p.id=p_id AND p.tenant_id=t AND p.client_id=c AND p.status IN('signed','approved','rejected');
 IF result IS NULL THEN RAISE EXCEPTION 'Keine eigene gespeicherte Unterschrift verfügbar.' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.get_my_ambulatory_care_signature(p_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.portal_care_signature(p_id)$$;
REVOKE ALL ON FUNCTION care_private.portal_care_signature(uuid),public.get_my_ambulatory_care_signature(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION care_private.portal_care_signature(uuid),public.get_my_ambulatory_care_signature(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION care_private.portal_care_proof_export(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); c uuid:=public.current_client_id(); result jsonb;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR c IS NULL OR public.current_portal_type() IS DISTINCT FROM 'client' OR NOT EXISTS(SELECT 1 FROM public.clients WHERE id=c AND tenant_id=t) THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('proof',jsonb_build_object('id',p.id,'clientId',p.client_id,'clientName',concat_ws(' ',cl.first_name,cl.last_name),'serviceDate',p.service_date,'startedAt',p.started_at,'endedAt',p.ended_at,'durationMinutes',p.duration_minutes,'serviceCode',p.service_code,'serviceLabel',p.service_label,'legalBasis',p.legal_basis,'prescriptionReference',p.prescription_reference,'costCarrierName',p.cost_carrier_name,'grossAmountCents',p.gross_amount_cents,'performanceNote',p.performance_note,'employeeName',p.employee_name_snapshot,'clientSignatureName',p.client_signature_name,'status',p.status,'rejectionReason',p.rejection_reason,'createdAt',p.created_at), 'signature',CASE WHEN e.id IS NOT NULL THEN jsonb_build_object('dataUrl',e.png_data_url,'signerName',e.signer_name,'capturedAt',e.captured_at) ELSE NULL END)
 INTO result FROM public.pfleger_service_proofs p JOIN public.clients cl ON cl.id=p.client_id AND cl.tenant_id=p.tenant_id LEFT JOIN public.pfleger_signature_evidence e ON e.proof_id=p.id AND e.tenant_id=p.tenant_id
 WHERE p.id=p_id AND p.tenant_id=t AND p.client_id=c AND p.status IN('submitted','signed','approved','rejected');
 IF result IS NULL THEN RAISE EXCEPTION 'Eigener bereitgestellter Nachweis nicht verfügbar.' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.get_my_ambulatory_care_proof_export(p_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.portal_care_proof_export(p_id)$$;
REVOKE ALL ON FUNCTION care_private.portal_care_proof_export(uuid),public.get_my_ambulatory_care_proof_export(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION care_private.portal_care_proof_export(uuid),public.get_my_ambulatory_care_proof_export(uuid) TO authenticated;

COMMIT;
