const fs = require('fs');

const views = [
  'v_ai_conversation_overview','v_ai_message_overview','v_ai_prompt_template_overview',
  'v_app_compliance_overview','v_app_release_overview','v_assessment_question_overview',
  'v_assessment_template_overview','v_assignment_overview','v_automation_overview',
  'v_billing_dashboard_stats','v_business_app_state','v_care_plan_overview',
  'v_care_report_overview','v_caresuite_flutterflow_ready_check','v_caresuite_global_counts',
  'v_caresuite_health_overview','v_caresuite_setup_progress','v_caresuite_supabase_final_dashboard',
  'v_catalog_source_overview','v_certificate_overview','v_client_budget_overview',
  'v_client_overview','v_client_portal_app_state','v_client_portal_appointment_detail',
  'v_client_portal_documents','v_consent_overview','v_consultation_case_overview',
  'v_consultation_protocol_overview','v_consultation_recommendation_overview',
  'v_cost_bearer_dropdown','v_course_enrollment_overview','v_course_lesson_overview',
  'v_course_overview','v_dashboard_widget_overview','v_document_overview',
  'v_documentation_phrase_overview','v_drag_drop_card_overview','v_dunning_case_overview',
  'v_employee_overview','v_employee_portal_app_state','v_employee_portal_assignment_detail',
  'v_employee_portal_documents','v_employee_today_assignments','v_error_log_overview',
  'v_exam_overview','v_final_readiness_overview','v_flutterflow_binding_overview',
  'v_follow_up_overview','v_form_template_field_overview','v_form_template_overview',
  'v_handover_overview','v_icd10gm_dropdown','v_import_profile_overview',
  'v_integration_provider_overview','v_invoice_item_overview','v_invoice_overview',
  'v_job_overview','v_kpi_snapshot_overview','v_legal_template_overview',
  'v_live_tracking_latest','v_living_area_overview','v_localization_overview',
  'v_measure_overview','v_media_library_overview','v_medication_dropdown',
  'v_medication_overview','v_message_overview','v_message_thread_overview',
  'v_mileage_log_overview','v_navigation_resolved','v_notification_overview',
  'v_open_production_tasks','v_operational_dashboard_stats','v_operations_dashboard_stats',
  'v_option_dropdown','v_outbound_message_queue','v_payment_overview',
  'v_pdf_job_overview','v_physician_dropdown','v_portal_message_thread_overview',
  'v_prescription_overview','v_product_access','v_product_world_dashboard_stats',
  'v_qm_task_overview','v_quick_action_resolved','v_report_definition_overview',
  'v_report_snapshot_overview','v_room_assignment_overview','v_room_overview',
  'v_rule_set_overview','v_service_catalog_item_dropdown','v_service_record_overview',
  'v_storage_bucket_runtime_status','v_subscription_overview',
  'v_support_ticket_message_overview','v_support_ticket_overview',
  'v_system_catalog_dashboard_stats','v_system_coverage_overview',
  'v_system_dashboard_stats','v_system_template_overview','v_task_library_overview',
  'v_template_pack_overview','v_template_placeholder_overview',
  'v_template_system_dashboard_stats','v_tenant_dashboard_base','v_tour_overview',
  'v_tour_stop_overview','v_vital_sign_overview','v_wound_overview'
];

const secdefFns = [
  'add_ai_message','add_live_tracking_event','add_support_ticket_message',
  'book_payment_for_invoice','calculate_assessment_score','check_release_readiness',
  'complete_follow_up','complete_measure','copy_system_template_to_tenant',
  'create_access_code_for_client','create_access_code_for_employee','create_ai_conversation',
  'create_audit_log','create_care_report','create_dunning_case_for_invoice',
  'create_invoice_from_service_record','create_service_record_from_assignment',
  'create_support_ticket','current_profile_id','current_tenant_id',
  'employee_portal_save_documentation','employee_portal_save_signature',
  'employee_portal_set_assignment_status','enqueue_outbound_message',
  'enqueue_pdf_generation_job','generate_invoice_number','generate_support_ticket_number',
  'get_business_bootstrap','get_final_readiness_report','get_options_for_group',
  'get_portal_bootstrap','get_tenant_subscription_status','handle_new_user',
  'has_module_access','has_permission','has_product_access','has_role_permission',
  'is_feature_enabled','is_tenant_admin','log_app_event','log_error','log_portal_event',
  'mark_notification_read','portal_send_message','refresh_demo_health_checks',
  'refresh_final_readiness','render_template_preview','rls_auto_enable',
  'search_catalog_items','search_documentation_phrases','send_thread_message',
  'set_assignment_status','start_portal_session_by_code','update_course_progress',
  'update_health_check','validate_access_code','validate_portal_session'
];

let sql = `-- ==========================================================================
-- CareSuite+ — Migration 0019: Security Advisor Remediation
-- Behebt P0/P1: security_invoker Views, fehlende RLS-Policies, anon-Revokes,
-- search_path, Storage-Lücken. Keine DROP TABLE/COLUMN/TRUNCATE/DELETE.
-- service_role GRANTs aus 0018 bleiben erhalten (idempotent re-GRANT).
-- ==========================================================================

-- --------------------------------------------------------------------------
-- P0: Alle öffentlichen Views auf security_invoker (109 Advisor ERROR)
-- Unterliegende Tabellen-RLS gilt für authenticated; keine SECURITY DEFINER Views.
-- --------------------------------------------------------------------------
DO $$
DECLARE
  v_name text;
  v_names text[] := ARRAY[
${views.map(v => `    '${v}'`).join(',\n')}
  ];
BEGIN
  FOREACH v_name IN ARRAY v_names LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = v_name AND c.relkind = 'v'
    ) THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v_name);
    END IF;
  END LOOP;
END $$;

-- Portal mgmt views (0017) — idempotent sicherstellen
ALTER VIEW IF EXISTS public.employee_portal_accounts_mgmt SET (security_invoker = true);
ALTER VIEW IF EXISTS public.client_portal_codes_mgmt SET (security_invoker = true);
ALTER VIEW IF EXISTS public.relative_portal_codes_mgmt SET (security_invoker = true);

-- --------------------------------------------------------------------------
-- P1: Fehlende RLS-Policies (9 Advisor INFO) — Migration 0012/0009 Drift
-- --------------------------------------------------------------------------

-- communication_assignments
DROP POLICY IF EXISTS "communication_assignments_select" ON public.communication_assignments;
CREATE POLICY "communication_assignments_select"
  ON public.communication_assignments FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.view_center'));

DROP POLICY IF EXISTS "communication_assignments_write" ON public.communication_assignments;
CREATE POLICY "communication_assignments_write"
  ON public.communication_assignments FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.assign_thread'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('communication.assign_thread'));

-- communication_reactions
DROP POLICY IF EXISTS "communication_reactions_select" ON public.communication_reactions;
CREATE POLICY "communication_reactions_select"
  ON public.communication_reactions FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.view_center'));

DROP POLICY IF EXISTS "communication_reactions_write" ON public.communication_reactions;
CREATE POLICY "communication_reactions_write"
  ON public.communication_reactions FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.react'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('communication.react'));

-- communication_read_receipts
DROP POLICY IF EXISTS "communication_read_receipts_select" ON public.communication_read_receipts;
CREATE POLICY "communication_read_receipts_select"
  ON public.communication_read_receipts FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.view_center'));

DROP POLICY IF EXISTS "communication_read_receipts_write" ON public.communication_read_receipts;
CREATE POLICY "communication_read_receipts_write"
  ON public.communication_read_receipts FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.send_message'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('communication.send_message'));

-- communication_notifications
DROP POLICY IF EXISTS "communication_notifications_select" ON public.communication_notifications;
CREATE POLICY "communication_notifications_select"
  ON public.communication_notifications FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.view_center'));

DROP POLICY IF EXISTS "communication_notifications_write" ON public.communication_notifications;
CREATE POLICY "communication_notifications_write"
  ON public.communication_notifications FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.view_center'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('communication.view_center'));

-- communication_audit_events (append-only)
DROP POLICY IF EXISTS "communication_audit_events_select" ON public.communication_audit_events;
CREATE POLICY "communication_audit_events_select"
  ON public.communication_audit_events FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.view_center'));

DROP POLICY IF EXISTS "communication_audit_events_insert" ON public.communication_audit_events;
CREATE POLICY "communication_audit_events_insert"
  ON public.communication_audit_events FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id());

-- TI/KIM (aus 0009, remote fehlend)
DROP POLICY IF EXISTS "ti_provider_checks_select" ON public.ti_provider_checks;
CREATE POLICY "ti_provider_checks_select"
  ON public.ti_provider_checks FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.view'));

DROP POLICY IF EXISTS "ti_provider_checks_insert" ON public.ti_provider_checks;
CREATE POLICY "ti_provider_checks_insert"
  ON public.ti_provider_checks FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('ti.provider.manage'));

DROP POLICY IF EXISTS "kim_attachments_select" ON public.kim_attachments;
CREATE POLICY "kim_attachments_select"
  ON public.kim_attachments FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.kim.view'));

DROP POLICY IF EXISTS "kim_attachments_write" ON public.kim_attachments;
CREATE POLICY "kim_attachments_write"
  ON public.kim_attachments FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.kim.manage'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('ti.kim.manage'));

DROP POLICY IF EXISTS "ti_consents_select" ON public.ti_consents;
CREATE POLICY "ti_consents_select"
  ON public.ti_consents FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.view'));

DROP POLICY IF EXISTS "ti_consents_write" ON public.ti_consents;
CREATE POLICY "ti_consents_write"
  ON public.ti_consents FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.consent.manage'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('ti.consent.manage'));

DROP POLICY IF EXISTS "ti_audit_events_select" ON public.ti_audit_events;
CREATE POLICY "ti_audit_events_select"
  ON public.ti_audit_events FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.audit.view'));

DROP POLICY IF EXISTS "ti_audit_events_insert" ON public.ti_audit_events;
CREATE POLICY "ti_audit_events_insert"
  ON public.ti_audit_events FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id());

-- --------------------------------------------------------------------------
-- P1: SECURITY DEFINER — anon darf keine privilegierten RPCs ausführen
-- authenticated behält EXECUTE (RLS-Helfer + App-RPCs); Edge Fn nutzt service_role.
-- --------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- P1: search_path fix (2 Advisor WARN)
-- --------------------------------------------------------------------------
ALTER FUNCTION public.generate_six_digit_code() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;

-- Alle SECURITY DEFINER Funktionen: search_path härten (pg_temp gegen Hijacking)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- Hash-Tabellen: authenticated nur mgmt-Views (0017/0018 re-apply)
-- --------------------------------------------------------------------------
REVOKE SELECT ON public.employee_portal_accounts FROM authenticated, anon;
REVOKE SELECT ON public.client_portal_codes FROM authenticated, anon;
REVOKE SELECT ON public.relative_portal_codes FROM authenticated, anon;
REVOKE SELECT ON public.portal_sessions FROM anon;

GRANT INSERT, UPDATE ON public.employee_portal_accounts TO authenticated;
GRANT INSERT, UPDATE ON public.client_portal_codes TO authenticated;
GRANT INSERT, UPDATE ON public.relative_portal_codes TO authenticated;

GRANT SELECT ON public.employee_portal_accounts_mgmt TO authenticated;
GRANT SELECT ON public.client_portal_codes_mgmt TO authenticated;
GRANT SELECT ON public.relative_portal_codes_mgmt TO authenticated;

-- --------------------------------------------------------------------------
-- service_role GRANTs (0018) — idempotent, Edge Functions unverändert
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_products TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_addresses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_contacts TO service_role;
GRANT SELECT ON public.products TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_portal_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_portal_codes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relative_portal_codes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.login_audit_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.password_reset_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_block_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_access_permissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permission_sets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_module_permissions TO service_role;

-- --------------------------------------------------------------------------
-- Storage: fehlende Policies communication-voice / communication-images + UPDATE
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "comm_voice_select" ON storage.objects;
CREATE POLICY "comm_voice_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'communication-voice'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

DROP POLICY IF EXISTS "comm_voice_insert" ON storage.objects;
CREATE POLICY "comm_voice_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'communication-voice'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND public.has_permission('communication.upload_attachment')
  );

DROP POLICY IF EXISTS "comm_voice_update" ON storage.objects;
CREATE POLICY "comm_voice_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'communication-voice'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = 'communication-voice'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

DROP POLICY IF EXISTS "comm_images_select" ON storage.objects;
CREATE POLICY "comm_images_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'communication-images'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

DROP POLICY IF EXISTS "comm_images_insert" ON storage.objects;
CREATE POLICY "comm_images_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'communication-images'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND public.has_permission('communication.upload_attachment')
  );

DROP POLICY IF EXISTS "comm_images_update" ON storage.objects;
CREATE POLICY "comm_images_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'communication-images'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = 'communication-images'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

DROP POLICY IF EXISTS "comm_attachments_update" ON storage.objects;
CREATE POLICY "comm_attachments_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'communication-attachments'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = 'communication-attachments'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

DROP POLICY IF EXISTS "office_docs_update" ON storage.objects;
CREATE POLICY "office_docs_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );
`;

const outPath = 'C:/Users/Kevin Reinhardt/Documents/CareSuite+/supabase/migrations/0019_security_advisor_remediation.sql';
fs.writeFileSync(outPath, sql);
console.log('Wrote', outPath, 'bytes:', sql.length);
