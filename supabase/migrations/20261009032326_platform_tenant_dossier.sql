-- Owner-only, paginated company dossier. No business record is changed by this migration.
-- Public entry points are security invokers; privileged code lives outside the API schema.
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.platform_dossier_registry()
RETURNS TABLE(section_key text, label text, scope text, parent_column text)
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $registry$
  VALUES
    ('tenants','Unternehmensstammdaten','company',null),
    ('platform_tenants','Plattformakte und Kontakt','company',null),
    ('tenant_branding','Logo und Unternehmensgestaltung','company',null),
    ('tenant_contacts','Kontaktpersonen','company',null),
    ('tenant_representatives','Geschäftsführung und Vertretung','company',null),
    ('tenant_bank_accounts','Bankverbindungen','company',null),
    ('tenant_legal_profiles','Rechtliche Angaben','company',null),
    ('tenant_tax_profiles','Steuerangaben','company',null),
    ('tenant_register_profiles','Registerangaben','company',null),
    ('tenant_billing_settings','Eigene Abrechnungseinstellungen','company',null),
    ('tenant_document_settings','Dokumentengestaltung','company',null),
    ('tenant_document_templates','Eigene Dokumentvorlagen','company',null),
    ('tenant_template_settings','Vorlageneinstellungen','company',null),
    ('tenant_module_settings','Funktionskonfiguration','company',null),
    ('platform_tenant_modules','Gespeicherte Funktionsfreigaben','company',null),
    ('tenant_portal_settings','Portale und Sichtbarkeit','company',null),
    ('tenant_client_portal_defaults','Vorgaben für Klientenportale','company',null),
    ('tenant_notification_settings','Benachrichtigungen','company',null),
    ('tenant_service_catalog','Leistungskatalog','company',null),
    ('tenant_service_prices','Leistungspreise','company',null),
    ('tenant_service_price_versions','Preisänderungen','company',null),
    ('service_catalog_items','Weitere Katalogleistungen','company',null),
    ('tenant_client_service_types','Leistungsarten','company',null),
    ('tenant_service_type_billing_rules','Abrechnungsregeln je Leistungsart','company',null),
    ('tenant_service_type_budget_rules','Budgetregeln je Leistungsart','company',null),
    ('tenant_service_type_portal_rules','Portalregeln je Leistungsart','company',null),
    ('tenant_service_type_rules','Weitere Leistungsregeln','company',null),
    ('tenant_service_visit_types','Einsatzarten','company',null),
    ('tenant_service_task_catalog','Aufgabenkatalog','company',null),
    ('tenant_service_proof_templates','Nachweisvorlagen','company',null),
    ('tenant_service_intake_sections','Aufnahmebereiche','company',null),
    ('tenant_client_billing_handoff_settings','Abrechnungsübergabe','company',null),
    ('tenant_budget_types','Budgetarten','company',null),
    ('tenant_budget_years','Budgetjahre','company',null),
    ('tenant_budget_defaults','Budgetvorgaben','company',null),
    ('tenant_cost_carrier_overrides','Kostenträgeranpassungen','company',null),
    ('tenant_custom_field_groups','Gruppen individueller Felder','company',null),
    ('tenant_custom_field_definitions','Individuelle Felder','company',null),
    ('tenant_custom_field_values','Individuelle Angaben','company',null),
    ('tenant_time_tracking_settings','Zeiterfassungseinstellungen','company',null),
    ('tenant_activity_types','Tätigkeitsarten','company',null),
    ('tenant_work_organizations','Organisationseinheiten','company',null),
    ('tenant_cost_centers','Kostenstellen','company',null),
    ('tenant_projects','Projekte','company',null),
    ('tenant_environment_settings','Datenumgebung','company',null),
    ('tenant_users','Unternehmenskonten und Rollen','company',null),
    ('clients','Klient:innen','clients',null),
    ('client_addresses','Weitere Adressen','clients','client_id'),
    ('client_contacts','Angehörige und Kontaktpersonen','clients','client_id'),
    ('client_insurance_profiles','Versicherungen','clients','client_id'),
    ('client_care_levels','Pflegegrade','clients','client_id'),
    ('client_care_entitlement','Pflegeansprüche','clients','client_id'),
    ('client_care_contexts','Versorgungskontexte','clients','client_id'),
    ('client_ambulatory_details','Ambulante Versorgung','clients','client_id'),
    ('client_stationary_details','Stationäre Versorgung','clients','client_id'),
    ('client_notes','Notizen','clients','client_id'),
    ('client_preferences','Wünsche und Präferenzen','clients','client_id'),
    ('client_risks','Risiken','clients','client_id'),
    ('client_support_preferences','Unterstützungsbedarf','clients','client_id'),
    ('client_contracts','Verträge','clients','client_id'),
    ('client_contract_selection','Vertragszuordnung','clients','client_id'),
    ('client_consents','Einwilligungen','clients','client_id'),
    ('client_consent_status','Einwilligungsstatus','clients','client_id'),
    ('client_documents','Dokumentenangaben','clients','client_id'),
    ('client_intake_documents','Aufnahmeunterlagen','clients','client_id'),
    ('client_service_profiles','Leistungsprofile','clients','client_id'),
    ('client_service_entitlements','Leistungsansprüche','clients','client_id'),
    ('client_module_assignments','Funktionszuordnungen','clients','client_id'),
    ('client_assignment_profiles','Einsatzprofile','clients','client_id'),
    ('client_scheduling_wishes','Planungswünsche','clients','client_id'),
    ('client_tasks','Aufgaben','clients','client_id'),
    ('client_billing_profiles','Abrechnungsangaben','clients','client_id'),
    ('client_cost_carrier_assignments','Kostenträgerzuordnungen','clients','client_id'),
    ('client_funding_selections','Finanzierungszuordnungen','clients','client_id'),
    ('client_billing_priority_rules','Abrechnungsprioritäten','clients','client_id'),
    ('client_budgets','Budgets','clients','client_id'),
    ('client_budget_accounts','Budgetkonten','clients','client_id'),
    ('client_budget_settings','Budgeteinstellungen','clients','client_id'),
    ('client_budget_mode','Budgetmodell','clients','client_id'),
    ('client_budget_movements','Budgetbewegungen','clients','client_id'),
    ('client_budget_transactions','Budgetbuchungen','clients','client_id'),
    ('client_portal_settings','Klientenportaleinstellungen','clients','client_id'),
    ('client_service_portal_settings','Sichtbarkeit von Leistungen','clients','client_id'),
    ('client_vital_sign_settings','Vitalwerteinstellungen','clients','client_id'),
    ('client_history_entries','Aktenhistorie','clients','client_id'),
    ('client_audit_entries','Klientenaktenprotokoll','clients','client_id'),
    ('client_billing_candidates','Abrechnungskandidaten','clients','client_id'),
    ('client_billing_warnings','Abrechnungshinweise','clients','client_id'),
    ('client_billing_audit_log','Abrechnungsprotokoll','clients','client_id'),
    ('client_document_events','Dokumentenverlauf','clients','client_id'),
    ('client_document_signatures','Unterschriftenstatus','clients','client_id'),
    ('client_offboarding_cases','Versorgungsende','clients','client_id'),
    ('client_offboarding_actions','Schritte zum Versorgungsende','clients','client_id'),
    ('client_offboarding_checks','Prüfungen zum Versorgungsende','clients','client_id'),
    ('client_offboarding_audit_events','Protokoll zum Versorgungsende','clients','client_id'),
    ('client_portal_access_requests','Anfragen für Portalzugriff','clients','client_id'),
    ('client_timeline_events','Versorgungsverlauf','clients','client_id'),
    ('care_diagnoses','Pflegediagnosen','clients','client_id'),
    ('care_medical_orders','Ärztliche Anordnungen','clients','client_id'),
    ('care_plans','Pflegepläne','clients','client_id'),
    ('care_plan_evaluations','Pflegeplanevaluationen','clients','client_id'),
    ('care_plan_measure_reviews','Maßnahmenbewertungen','clients','client_id'),
    ('care_reports','Pflegeberichte','clients','client_id'),
    ('care_quality_visits','Qualitätssicherungsbesuche','clients','client_id'),
    ('care_quality_deviations','Qualitätsabweichungen','clients','client_id'),
    ('care_tour_stops','Pflegeeinsätze in Touren','clients','client_id'),
    ('care_audit_events','Pflegeprotokoll','clients','client_id'),
    ('employees','Mitarbeitende','employees',null),
    ('employee_contract_settings','Vertragsangaben','employees','employee_id'),
    ('employee_work_settings','Arbeitszeit und Beschäftigung','employees','employee_id'),
    ('employee_payroll_settings','Gehaltsangaben','employees','employee_id'),
    ('employee_tax_settings','Lohnsteuerangaben','employees','employee_id'),
    ('employee_social_insurance','Sozialversicherung','employees','employee_id'),
    ('employee_qualifications','Qualifikationen und Nachweise','employees','employee_id'),
    ('employee_background_checks','Führungszeugnisse','employees','employee_id'),
    ('employee_secondary_employments','Nebenbeschäftigungen','employees','employee_id'),
    ('employee_documents','Personaldokumente','employees','employee_id'),
    ('employee_absences','Abwesenheiten','employees','employee_id'),
    ('employee_consent_bundle','Einwilligungen','employees','employee_id'),
    ('employee_location_consents','Standorteinwilligungen','employees','employee_id'),
    ('employee_role_assignments','Rollenzuordnungen','employees','employee_id'),
    ('employee_module_assignments','Funktionszuordnungen','employees','employee_id'),
    ('employee_permission_states','Berechtigungsstatus','employees','employee_id'),
    ('employee_permission_overrides','Individuelle Berechtigungen','employees','employee_id'),
    ('employee_data_scopes','Datenzugriffsbereiche','employees','employee_id'),
    ('employee_mobility_settings','Mobilität','employees','employee_id'),
    ('employee_logbook_profiles','Fahrtenbuchprofile','employees','employee_id'),
    ('employee_logbook_vehicles','Fahrzeuge','employees','employee_id'),
    ('employee_logbook_trips','Fahrten','employees','employee_id'),
    ('employee_expense_claims','Auslagen','employees','employee_id'),
    ('employee_audit_events','Personalaktenprotokoll','employees','employee_id'),
    ('employee_access_revocations','Beendete Zugriffsrechte','employees','employee_id'),
    ('employee_final_clearance','Abschlussfreigaben','employees','employee_id'),
    ('employee_offboarding_sessions','Austrittsvorgänge','employees','employee_id'),
    ('employee_offboarding_steps','Austrittsschritte','employees','employee_id'),
    ('employee_offboarding_checks','Austrittsprüfungen','employees','employee_id'),
    ('employee_logbook_daily_confirmations','Tagesbestätigungen des Fahrtenbuchs','employees','employee_id'),
    ('employee_logbook_receipts','Fahrtenbuchbelege','employees','employee_id'),
    ('employee_visit_mobility_selections','Mobilitätswahl je Einsatz','employees','employee_id'),
    ('client_portal_access','Klientenportalzugänge','clients','client_id'),
    ('medications','Medikationsangaben','clients','client_id'),
    ('medication_administrations','Medikamentengaben','clients','client_id'),
    ('prescriptions','Verordnungen','clients','client_id'),
    ('vital_signs','Vitalwerte','clients','client_id'),
    ('vital_sign_measurements','Vitalwertmessungen','clients','client_id'),
    ('vital_sign_events','Vitalwerteverlauf','clients','client_id'),
    ('wounds','Wundangaben','clients','client_id'),
    ('clinical_wound_cases','Klinische Wundfälle','clients','client_id'),
    ('clinical_wound_assessments','Wundbewertungen','clients','client_id'),
    ('clinical_medication_orders','Klinische Medikationsanordnungen','clients','client_id'),
    ('clinical_medication_administrations','Klinische Medikamentengaben','clients','client_id'),
    ('clinical_treatment_executions','Behandlungsdurchführungen','clients','client_id'),
    ('clinical_documentation_entries','Klinische Dokumentation','clients','client_id'),
    ('clinical_handovers','Klinische Übergaben','clients','client_id'),
    ('pressure_injury_assessments','Dekubitusbewertungen','clients','client_id'),
    ('measures','Versorgungsmaßnahmen','clients','client_id'),
    ('body_map_markers','Körperbefunde','clients','client_id'),
    ('body_map_finding_history','Verlauf der Körperbefunde','clients','client_id'),
    ('body_map_finding_media','Medien zu Körperbefunden','clients','client_id'),
    ('consultation_cases','Beratungsvorgänge','clients','client_id'),
    ('follow_ups','Nachverfolgungen','clients','client_id'),
    ('invoices','Klientenrechnungen','clients','client_id'),
    ('payments','Zahlungsangaben','clients','client_id'),
    ('dunning_cases','Mahnvorgänge','clients','client_id'),
    ('assignment_budget_allocations','Budgetzuordnung je Einsatz','clients','client_id'),
    ('pfleger_billing_cases','Pflegeabrechnungsvorgänge','clients','client_id'),
    ('pfleger_invoice_foundations','Grundlagen der Pflegeabrechnung','clients','client_id'),
    ('pfleger_service_proofs','Pflegeleistungsnachweise','clients','client_id'),
    ('room_assignments','Zimmerzuordnungen','clients','client_id'),
    ('portal_activities','Klientenportalaktivitäten','clients','client_id'),
    ('portal_requests','Klientenportalanfragen','clients','client_id'),
    ('portal_budget_snapshots','Portalbudgetstände','clients','client_id'),
    ('employee_portal_accounts','Mitarbeitendenportalzugänge','employees','employee_id'),
    ('calendar_employee_month_plans','Monatsplanung','employees','employee_id'),
    ('care_staff_shifts','Pflegedienste','employees','employee_id'),
    ('care_tours','Pflegetouren','employees','employee_id'),
    ('certificates','Zertifikate','employees','employee_id'),
    ('course_enrollments','Fortbildungsteilnahmen','employees','employee_id'),
    ('time_entries','Zeiteinträge','employees','employee_id'),
    ('homeoffice_workdays','Homeoffice-Arbeitstage','employees','employee_id'),
    ('payroll_month_statements','Monatsabrechnungen','employees','employee_id'),
    ('payroll_month_audit_log','Protokoll der Monatsabrechnung','employees','employee_id'),
    ('workforce_absences','Arbeitszeitbezogene Abwesenheiten','employees','employee_id'),
    ('workforce_approvals','Arbeitszeitfreigaben','employees','employee_id'),
    ('workforce_time_accounts','Arbeitszeitkonten','employees','employee_id'),
    ('workforce_time_entry_reviews','Arbeitszeitprüfungen','employees','employee_id'),
    ('workforce_time_events','Arbeitszeitereignisse','employees','employee_id'),
    ('workforce_time_export_items','Arbeitszeitexporte','employees','employee_id'),
    ('workforce_work_sessions','Arbeitszeitsitzungen','employees','employee_id'),
    ('workforce_rule_violations','Arbeitszeithinweise','employees','employee_id'),
    ('workforce_team_meeting_attendees','Teambesprechungsteilnahmen','employees','employee_id'),
    ('employee_logbook_audit_events','Fahrtenbuchprotokoll','employees','employee_id'),
    ('employee_logbook_segments','Fahrtenbuchabschnitte','employees','employee_id'),
    ('employee_logbook_prompt_decisions','Fahrtenbuchentscheidungen','employees','employee_id'),
    ('assist_driving_log','Einsatzfahrten','employees','employee_id'),
    ('mileage_logs','Kilometerangaben','employees','employee_id'),
    ('trips','Fahrten und Reisezeiten','employees','employee_id'),
    ('inventory_damage_reports','Inventarschäden','employees','employee_id'),
    ('inventory_return_protocols','Inventarrückgabeprotokolle','employees','employee_id'),
    ('inventory_return_records','Inventarrückgaben','employees','employee_id'),
    ('offboarding_audit_events','Austrittsprotokoll','employees','employee_id'),
    ('assist_visits','Operative Einsätze','operations',null),
    ('assessment_runs','Assessments','operations',null),
    ('documentation_entries','Dokumentationseinträge','operations',null),
    ('generated_documents','Erstellte Dokumente','operations',null),
    ('consent_records','Einwilligungsnachweise','operations',null),
    ('data_subject_requests','Betroffenenanfragen','operations',null),
    ('portal_signature_documents','Portalunterlagen zur Unterschrift','operations',null),
    ('portal_uploads','Portaluploads','operations',null),
    ('support_tickets','Unternehmenssupportfälle','operations',null),
    ('tours','Tourenplanung','operations',null),
    ('tour_stops','Tourenstationen','operations',null),
    ('wound_records','Wunddokumentationen','operations',null),
    ('assignments','Einsätze und Planung','operations',null),
    ('documents','Dokumentenübersicht','operations',null),
    ('service_records','Leistungsnachweise','operations',null)
$registry$;
REVOKE ALL ON FUNCTION private.platform_dossier_registry() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.platform_dossier_clean(p_value jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $clean$
DECLARE result jsonb; pair record;
BEGIN
  IF jsonb_typeof(p_value) = 'object' THEN
    result := '{}';
    FOR pair IN SELECT key,value FROM jsonb_each(p_value) LOOP
      IF pair.key ~* '(password|passwort|secret|token|credential|api.?key|private.?key|code.?hash|recovery|lease|signature_data|signature_base64)'
        OR pair.key ~* '^(access_code|portal_code|code_plain|encrypted_password|authorization|cookie)$' THEN CONTINUE; END IF;
      result := result || jsonb_build_object(pair.key, private.platform_dossier_clean(pair.value));
    END LOOP;
    RETURN result;
  ELSIF jsonb_typeof(p_value) = 'array' THEN
    SELECT coalesce(jsonb_agg(private.platform_dossier_clean(value) ORDER BY ord), '[]') INTO result
      FROM jsonb_array_elements(p_value) WITH ORDINALITY AS item(value,ord);
    RETURN result;
  END IF;
  RETURN p_value;
END
$clean$;
REVOKE ALL ON FUNCTION private.platform_dossier_clean(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.platform_dossier_assert_owner(p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $owner$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.platform_users u WHERE u.user_id=auth.uid() AND u.role='platform_owner' AND u.status='active'
  ) THEN RAISE EXCEPTION 'dossier_owner_required' USING ERRCODE='42501'; END IF;
  IF p_tenant_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.tenants t WHERE t.id=p_tenant_id)
    THEN RAISE EXCEPTION 'tenant_not_found' USING ERRCODE='P0002'; END IF;
END
$owner$;
REVOKE ALL ON FUNCTION private.platform_dossier_assert_owner(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.platform_dossier_page(
  p_tenant_id uuid, p_section text, p_parent_id uuid DEFAULT NULL, p_record_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL, p_status text DEFAULT NULL, p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 50, p_include_deleted boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $page$
DECLARE source record; predicate text; sort text; all_count bigint; last_change text; items jsonb; statuses jsonb;
  page_limit integer:=greatest(1,least(coalesce(p_limit,50),100)); page_offset integer:=greatest(coalesce(p_offset,0),0);
BEGIN
  SELECT * INTO source FROM private.platform_dossier_registry() WHERE section_key=p_section ORDER BY scope LIMIT 1;
  IF source IS NULL THEN RAISE EXCEPTION 'dossier_section_invalid' USING ERRCODE='22023'; END IF;
  IF to_regclass(format('public.%I',source.section_key)) IS NULL THEN
    RETURN jsonb_build_object('tenantId',p_tenant_id,'section',p_section,'available',false,'rows','[]'::jsonb,'total',null,'offset',page_offset,'limit',page_limit,'hasMore',false,'checkedAt',transaction_timestamp());
  END IF;
  predicate := CASE WHEN source.section_key='tenants' THEN 'r.id=$1' ELSE 'r.tenant_id=$1' END;
  IF source.parent_column IS NOT NULL AND p_parent_id IS NOT NULL THEN
    predicate:=predicate||format(' AND r.%I=$2',source.parent_column);
  END IF;
  EXECUTE format('SELECT coalesce(jsonb_agg(x.status ORDER BY x.status),''[]''::jsonb) FROM (SELECT DISTINCT to_jsonb(r)->>''status'' AS status FROM public.%I r WHERE %s AND to_jsonb(r)->>''status'' IS NOT NULL) x',source.section_key,predicate)
    INTO statuses USING p_tenant_id,p_parent_id;
  predicate:=predicate||' AND ($3::uuid IS NULL OR to_jsonb(r)->>''id''=$3::text)';
  IF source.section_key IN ('clients','employees') THEN
    predicate:=predicate||' AND ($6::boolean OR nullif(to_jsonb(r)->>''deleted_at'','''') IS NULL)';
    sort:='lower(coalesce(to_jsonb(r)->>''last_name'','''')),lower(coalesce(to_jsonb(r)->>''first_name'','''')),coalesce(to_jsonb(r)->>''id'','''')';
  ELSIF source.section_key='tenant_bank_accounts' THEN
    sort:='coalesce(to_jsonb(r)->>''is_primary'',''false'') DESC,coalesce(to_jsonb(r)->>''sort_order'',''0''),coalesce(to_jsonb(r)->>''id'','''')';
  ELSE
    sort:='coalesce(to_jsonb(r)->>''created_at'',to_jsonb(r)->>''updated_at'','''') DESC,coalesce(to_jsonb(r)->>''id'',to_jsonb(r)->>''tenant_id'','''')';
  END IF;
  predicate:=predicate||' AND ($4::text IS NULL OR $4='''' OR strpos(lower(private.platform_dossier_clean(to_jsonb(r))::text),lower($4))>0)'
    ||' AND ($5::text IS NULL OR $5='''' OR coalesce(to_jsonb(r)->>''status'','''')=$5)';
  EXECUTE format('SELECT count(*),max(coalesce(to_jsonb(r)->>''updated_at'',to_jsonb(r)->>''created_at'')) FROM public.%I r WHERE %s',source.section_key,predicate)
    INTO all_count,last_change USING p_tenant_id,p_parent_id,p_record_id,p_search,p_status,p_include_deleted;
  EXECUTE format('SELECT coalesce(jsonb_agg(x.row ORDER BY x.ord),''[]''::jsonb) FROM (SELECT private.platform_dossier_clean(to_jsonb(r)) AS row,row_number() OVER(ORDER BY %s) AS ord FROM public.%I r WHERE %s ORDER BY %s LIMIT $7 OFFSET $8) x',sort,source.section_key,predicate,sort)
    INTO items USING p_tenant_id,p_parent_id,p_record_id,p_search,p_status,p_include_deleted,page_limit,page_offset;
  RETURN jsonb_build_object('tenantId',p_tenant_id,'section',p_section,'available',true,'rows',items,'total',all_count,
    'offset',page_offset,'limit',page_limit,'hasMore',page_offset+jsonb_array_length(items)<all_count,'updatedAt',last_change,'checkedAt',transaction_timestamp(),'statuses',statuses);
END
$page$;
REVOKE ALL ON FUNCTION private.platform_dossier_page(uuid,text,uuid,uuid,text,text,integer,integer,boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.platform_dossier_summary(p_tenant_id uuid,p_inventory boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $summary$
DECLARE company jsonb; platform_record jsonb; branding jsonb; billing jsonb; portal jsonb; bank jsonb; tax jsonb; register_record jsonb;
  client_counts jsonb; employee_counts jsonb; accounts bigint; admin_accounts bigint; logged_in bigint; last_login timestamptz;
  services bigint:=0; priced_services bigint:=0; assignments bigint; documents bigint;
  inventory jsonb:='[]'; source record; source_count bigint; source_change text; timestamp_expression text;
  portal_employee_ids uuid[]:='{}';
BEGIN
  SELECT private.platform_dossier_clean(to_jsonb(t)) INTO company FROM public.tenants t WHERE t.id=p_tenant_id;
  SELECT private.platform_dossier_clean(to_jsonb(t)) INTO platform_record FROM public.platform_tenants t WHERE t.tenant_id=p_tenant_id;
  SELECT jsonb_build_object('total',count(*) FILTER(WHERE c.deleted_at IS NULL),'active',count(*) FILTER(WHERE c.deleted_at IS NULL AND c.status::text IN ('active','aktiv')),
    'deleted',count(*) FILTER(WHERE c.deleted_at IS NOT NULL),'complete',count(*) FILTER(WHERE c.deleted_at IS NULL
      AND nullif(btrim(c.first_name),'') IS NOT NULL AND nullif(btrim(c.last_name),'') IS NOT NULL
      AND nullif(btrim(c.street),'') IS NOT NULL AND nullif(btrim(c.postal_code),'') IS NOT NULL AND nullif(btrim(c.city),'') IS NOT NULL),
    'portalEnabled',count(*) FILTER(WHERE c.deleted_at IS NULL AND c.portal_enabled),'portalLinked',0)
    INTO client_counts FROM public.clients c WHERE c.tenant_id=p_tenant_id;
  IF to_regclass('public.employee_portal_accounts') IS NOT NULL THEN
    EXECUTE 'SELECT coalesce(array_agg(employee_id),''{}''::uuid[]) FROM public.employee_portal_accounts WHERE tenant_id=$1 AND status::text=''active'' AND auth_user_id IS NOT NULL'
      INTO portal_employee_ids USING p_tenant_id;
  END IF;
  SELECT jsonb_build_object('total',count(*) FILTER(WHERE e.deleted_at IS NULL),'active',count(*) FILTER(WHERE e.deleted_at IS NULL AND e.status::text IN ('active','aktiv')),
    'deleted',count(*) FILTER(WHERE e.deleted_at IS NOT NULL),'complete',count(*) FILTER(WHERE e.deleted_at IS NULL
      AND nullif(btrim(e.first_name),'') IS NOT NULL AND nullif(btrim(e.last_name),'') IS NOT NULL
      AND coalesce(nullif(btrim(e.email),''),nullif(btrim(e.phone),''),nullif(btrim(e.mobile),'')) IS NOT NULL
      AND nullif(e.employment_type::text,'') IS NOT NULL AND e.entry_date IS NOT NULL),
    'portalEnabled',count(*) FILTER(WHERE e.deleted_at IS NULL AND e.portal_enabled),
    'portalLinked',count(*) FILTER(WHERE e.deleted_at IS NULL AND e.portal_enabled AND (
      EXISTS(SELECT 1 FROM public.tenant_users u WHERE u.tenant_id=p_tenant_id AND u.employee_id=e.id AND u.auth_user_id IS NOT NULL AND u.status='active' AND u.archived_at IS NULL)
      OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.tenant_id=p_tenant_id AND p.id=e.profile_id AND p.auth_user_id IS NOT NULL AND p.status::text='active')
      OR e.id=ANY(portal_employee_ids)
    ))) INTO employee_counts FROM public.employees e WHERE e.tenant_id=p_tenant_id;
  SELECT count(*) FILTER(WHERE u.archived_at IS NULL),
    count(*) FILTER(WHERE u.archived_at IS NULL AND u.status='active' AND u.auth_user_id IS NOT NULL AND u.role_key IN ('owner','admin','business_admin','manager')),
    count(*) FILTER(WHERE u.archived_at IS NULL AND u.last_login_at IS NOT NULL),max(u.last_login_at) FILTER(WHERE u.archived_at IS NULL)
    INTO accounts,admin_accounts,logged_in,last_login FROM public.tenant_users u WHERE u.tenant_id=p_tenant_id;
  branding:=(private.platform_dossier_page(p_tenant_id,'tenant_branding',p_limit=>1))->'rows'->0;
  billing:=(private.platform_dossier_page(p_tenant_id,'tenant_billing_settings',p_limit=>1))->'rows'->0;
  portal:=(private.platform_dossier_page(p_tenant_id,'tenant_portal_settings',p_limit=>1))->'rows'->0;
  bank:=(private.platform_dossier_page(p_tenant_id,'tenant_bank_accounts',p_limit=>1))->'rows'->0;
  tax:=(private.platform_dossier_page(p_tenant_id,'tenant_tax_profiles',p_limit=>1))->'rows'->0;
  register_record:=(private.platform_dossier_page(p_tenant_id,'tenant_register_profiles',p_limit=>1))->'rows'->0;
  IF to_regclass('public.tenant_service_catalog') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.tenant_service_catalog s WHERE s.tenant_id=$1 AND s.is_active' INTO services USING p_tenant_id;
    IF to_regclass('public.tenant_service_prices') IS NOT NULL THEN
      EXECUTE 'SELECT count(*) FROM public.tenant_service_catalog s WHERE s.tenant_id=$1 AND s.is_active AND EXISTS(SELECT 1 FROM public.tenant_service_prices p WHERE p.tenant_id=$1 AND p.catalog_id=s.id AND p.price_net IS NOT NULL AND (p.valid_from IS NULL OR p.valid_from<=current_date) AND (p.valid_to IS NULL OR p.valid_to>=current_date))' INTO priced_services USING p_tenant_id;
    END IF;
  END IF;
  IF services=0 AND to_regclass('public.service_catalog_items') IS NOT NULL THEN
    EXECUTE 'SELECT count(*),count(*) FILTER(WHERE s.default_price_net IS NOT NULL) FROM public.service_catalog_items s WHERE s.tenant_id=$1 AND s.status::text=''active''' INTO services,priced_services USING p_tenant_id;
  END IF;
  IF to_regclass('public.assignments') IS NOT NULL THEN EXECUTE 'SELECT count(*) FROM public.assignments WHERE tenant_id=$1' INTO assignments USING p_tenant_id; END IF;
  IF to_regclass('public.documents') IS NOT NULL THEN EXECUTE 'SELECT count(*) FROM public.documents WHERE tenant_id=$1' INTO documents USING p_tenant_id; END IF;
  IF p_inventory THEN
    FOR source IN SELECT DISTINCT ON(section_key) *,to_regclass(format('public.%I',section_key)) AS relation FROM private.platform_dossier_registry() ORDER BY section_key,scope LOOP
      source_count:=NULL; source_change:=NULL;
      IF source.relation IS NOT NULL THEN
        SELECT CASE
          WHEN EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid=source.relation AND a.attname='updated_at' AND NOT a.attisdropped) THEN 'max(r.updated_at)::text'
          WHEN EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid=source.relation AND a.attname='created_at' AND NOT a.attisdropped) THEN 'max(r.created_at)::text'
          ELSE 'NULL::text' END INTO timestamp_expression;
        EXECUTE format('SELECT count(*),%s FROM public.%I r WHERE %s',timestamp_expression,source.section_key,
          CASE WHEN source.section_key='tenants' THEN 'r.id=$1' ELSE 'r.tenant_id=$1' END)
          INTO source_count,source_change USING p_tenant_id;
      END IF;
      inventory:=inventory||jsonb_build_array(jsonb_build_object('key',source.section_key,'label',source.label,'scope',source.scope,
        'available',source.relation IS NOT NULL,'count',source_count,'updatedAt',source_change));
    END LOOP;
  END IF;
  RETURN jsonb_build_object('tenantId',p_tenant_id,'checkedAt',transaction_timestamp(),'company',company,'platform',coalesce(platform_record,'{}'),
    'branding',branding,'billing',billing,'portal',portal,'bank',bank,'tax',tax,'register',register_record,'sections',inventory,
    'counts',jsonb_build_object('clients',client_counts,'employees',employee_counts,'accounts',accounts,'adminAccounts',admin_accounts,
      'loggedInAccounts',logged_in,'lastLoginAt',last_login,'services',services,'pricedServices',priced_services,'assignments',assignments,'documents',documents));
END
$summary$;
REVOKE ALL ON FUNCTION private.platform_dossier_summary(uuid,boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.platform_read_tenant_dossier(
  p_tenant_id uuid, p_section text DEFAULT 'summary', p_parent_id uuid DEFAULT NULL, p_record_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL, p_status text DEFAULT NULL, p_offset integer DEFAULT 0, p_limit integer DEFAULT 50,
  p_include_deleted boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $read$
DECLARE source record; result jsonb; history_sql text; history_count bigint; history_rows jsonb;
  page_limit integer:=greatest(1,least(coalesce(p_limit,50),100)); page_offset integer:=greatest(coalesce(p_offset,0),0);
BEGIN
  PERFORM private.platform_dossier_assert_owner(p_tenant_id);
  IF length(coalesce(p_search,''))>200 THEN RAISE EXCEPTION 'dossier_search_invalid' USING ERRCODE='22023'; END IF;
  IF p_section='summary' THEN
    result:=private.platform_dossier_summary(p_tenant_id,true);
  ELSIF p_section='history' THEN
    history_sql:='SELECT a.id::text AS id,a.action,a.created_at,a.actor_user_id::text AS actor_id,coalesce(u.full_name,a.actor_role,''Nicht hinterlegt'') AS actor_name,a.target_type AS area,a.target_id::text AS record_id,a.reason,private.platform_dossier_clean(a.before) AS before,private.platform_dossier_clean(a.after) AS after,''Plattformprotokoll'' AS source FROM public.platform_audit_log a LEFT JOIN public.platform_users u ON u.user_id=a.actor_user_id WHERE a.tenant_id=$1 AND a.action<>''tenant.dossier_read''';
    IF to_regclass('public.audit_logs') IS NOT NULL THEN
      history_sql:=history_sql||' UNION ALL SELECT a.id::text,a.action::text,a.created_at,a.profile_id::text,coalesce(p.full_name,''Nicht hinterlegt''),a.table_name,a.record_id::text,coalesce(a.description,a.title),private.platform_dossier_clean(a.old_data),private.platform_dossier_clean(a.new_data),''Unternehmensprotokoll'' FROM public.audit_logs a LEFT JOIN public.profiles p ON p.id=a.profile_id AND p.tenant_id=$1 WHERE a.tenant_id=$1';
    END IF;
    history_sql:='SELECT * FROM ('||history_sql||') h WHERE ($2::text IS NULL OR $2='''' OR strpos(lower(to_jsonb(h)::text),lower($2))>0) AND ($3::text IS NULL OR $3='''' OR h.action=$3)';
    EXECUTE 'SELECT count(*) FROM ('||history_sql||') x' INTO history_count USING p_tenant_id,p_search,p_status;
    EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC,x.id),''[]''::jsonb) FROM ('||history_sql||' ORDER BY created_at DESC,id LIMIT $4 OFFSET $5) x' INTO history_rows USING p_tenant_id,p_search,p_status,page_limit,page_offset;
    result:=jsonb_build_object('tenantId',p_tenant_id,'section','history','rows',history_rows,'total',history_count,'offset',page_offset,'limit',page_limit,'hasMore',page_offset+jsonb_array_length(history_rows)<history_count,'available',true,'checkedAt',transaction_timestamp());
  ELSE
    SELECT * INTO source FROM private.platform_dossier_registry() WHERE section_key=p_section ORDER BY scope LIMIT 1;
    IF source IS NULL THEN RAISE EXCEPTION 'dossier_section_invalid' USING ERRCODE='22023'; END IF;
    IF source.parent_column IS NOT NULL AND p_parent_id IS NOT NULL THEN
      IF source.parent_column='client_id' AND NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.tenant_id=p_tenant_id AND c.id=p_parent_id)
        OR source.parent_column='employee_id' AND NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.tenant_id=p_tenant_id AND e.id=p_parent_id)
        THEN RAISE EXCEPTION 'dossier_record_not_found' USING ERRCODE='P0002'; END IF;
    END IF;
    result:=private.platform_dossier_page(p_tenant_id,p_section,p_parent_id,p_record_id,p_search,p_status,p_offset,p_limit,p_include_deleted);
  END IF;
  -- Log access scope only, without copying person data into the platform audit log.
  PERFORM public.platform_write_audit_log('tenant.dossier_read','tenant_dossier',p_record_id,p_tenant_id,NULL,
    jsonb_build_object('section',p_section,'parentId',p_parent_id,'offset',page_offset,'limit',page_limit), 'Mandantenakte durch Plattforminhaber eingesehen');
  RETURN result;
END
$read$;
REVOKE ALL ON FUNCTION private.platform_read_tenant_dossier(uuid,text,uuid,uuid,text,text,integer,integer,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.platform_read_tenant_dossier(uuid,text,uuid,uuid,text,text,integer,integer,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_read_tenant_dossier(
  p_tenant_id uuid, p_section text DEFAULT 'summary', p_parent_id uuid DEFAULT NULL, p_record_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL, p_status text DEFAULT NULL, p_offset integer DEFAULT 0, p_limit integer DEFAULT 50,
  p_include_deleted boolean DEFAULT false
)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $api$
  SELECT private.platform_read_tenant_dossier(p_tenant_id,p_section,p_parent_id,p_record_id,p_search,p_status,p_offset,p_limit,p_include_deleted)
$api$;
REVOKE ALL ON FUNCTION public.platform_read_tenant_dossier(uuid,text,uuid,uuid,text,text,integer,integer,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_read_tenant_dossier(uuid,text,uuid,uuid,text,text,integer,integer,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION private.platform_list_tenant_dossier_summaries(p_tenant_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $list$
DECLARE tenant_id uuid; items jsonb:='[]';
BEGIN
  IF cardinality(p_tenant_ids)>50 THEN RAISE EXCEPTION 'dossier_page_invalid' USING ERRCODE='22023'; END IF;
  -- Validate every requested tenant before returning any company data.
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_users u WHERE u.user_id=auth.uid() AND u.role='platform_owner' AND u.status='active')
    THEN RAISE EXCEPTION 'dossier_owner_required' USING ERRCODE='42501'; END IF;
  FOR tenant_id IN SELECT DISTINCT unnest(p_tenant_ids) LOOP
    PERFORM private.platform_dossier_assert_owner(tenant_id);
    items:=items||jsonb_build_array(private.platform_dossier_summary(tenant_id,false));
  END LOOP;
  RETURN jsonb_build_object('items',items);
END
$list$;
REVOKE ALL ON FUNCTION private.platform_list_tenant_dossier_summaries(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.platform_list_tenant_dossier_summaries(uuid[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.platform_list_tenant_dossier_summaries(p_tenant_ids uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $api$
  SELECT private.platform_list_tenant_dossier_summaries(p_tenant_ids)
$api$;
REVOKE ALL ON FUNCTION public.platform_list_tenant_dossier_summaries(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_list_tenant_dossier_summaries(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.platform_read_tenant_dossier(uuid,text,uuid,uuid,text,text,integer,integer,boolean)
  IS 'Plattforminhaber: vollständige Unternehmensakte mit Personen, Konfigurationen und belegter Historie. Vollständige Seitenzählung, feste Datenquellen, keine Anmeldeschlüssel.';
NOTIFY pgrst, 'reload schema';
