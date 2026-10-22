BEGIN;
-- Staging only; requires the quarantined Wound workspace and photo-consent follow-up.
-- Privileged synthetic metadata fixture. No Auth HTTP, uploaded bytes, Storage access or real consent/clinical approval is proved.
DO $fixture$
DECLARE
 fx_t uuid:=gen_random_uuid();fx_u uuid:=gen_random_uuid();fx_c uuid:=gen_random_uuid();fx_other_c uuid:=gen_random_uuid();fx_w uuid:=gen_random_uuid();fx_a uuid:=gen_random_uuid();
 fx_consent uuid;fx_photo uuid;fx_base timestamptz:=date_trunc('minute',clock_timestamp())-interval '1 day';fx_granted_at timestamptz;fx_captured_at timestamptz;fx_expires_at timestamptz;
 fx_variant text;fx_kind text;fx_granted boolean;fx_consent_client uuid;fx_entry jsonb;fx_error text;fx_index integer:=0;fx_passed boolean:=false;
BEGIN
 BEGIN
  INSERT INTO public.tenants(id,name) VALUES(fx_t,'CP365 isolated synthetic Wound photo metadata');
  INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES(fx_u,fx_u||'@example.invalid','{}','{}');
  UPDATE public.profiles SET tenant_id=fx_t,is_active=true,status='active',display_name='Synthetic Photo Metadata Author' WHERE id=fx_u;
  INSERT INTO public.clients(id,tenant_id,first_name,last_name,status) VALUES(fx_c,fx_t,'Synthetic','Photo metadata','aktiv'),(fx_other_c,fx_t,'Synthetic','Other photo case','aktiv');
  -- Direct synthetic native setup; unknown measurements and onset remain null, and the case explicitly stays draft.
  INSERT INTO public.clinical_wound_cases(id,tenant_id,client_id,body_location,wound_type,etiology,onset_date,acquired_where,treatment_plan,physician_involved,ordering_physician,status,next_review_at,recorded_by,recorded_by_name)
  VALUES(fx_w,fx_t,fx_c,'Synthetischer Aufnahmebereich','Synthetischer Wundtyp','Keine klinische Feststellung aus Metadatentest',null,'Synthetische Testumgebung','Keine Versorgung aus Metadatentest',false,'','draft',null,fx_u,'Synthetic Photo Metadata Author');
  INSERT INTO public.clinical_wound_assessments(id,tenant_id,client_id,wound_case_id,assessed_at,length_cm,width_cm,depth_cm,wound_bed,exudate,odor,wound_edge,surrounding_skin,pain_score,infection_signs,intervention,response,photo_refs,recorded_by,recorded_by_name)
  VALUES(fx_a,fx_t,fx_c,fx_w,fx_base,null,null,null,'Synthetisch unbekannt','Synthetisch unbekannt','Synthetisch unbekannt','Synthetisch unbekannt','Synthetisch unbekannt',null,'Keine abgeleitete Diagnose','Keine tatsächliche Versorgung aus Metadatentest','Keine klinische Freigabe','[]',fx_u,'Synthetic Photo Metadata Author');
  FOREACH fx_variant IN ARRAY ARRAY['valid_foto_video','kommunikation','missing_grant','late_grant_microsecond','future_grant','not_granted','expired','foreign_client','future_capture','infinite_grant','infinite_capture'] LOOP
   fx_index:=fx_index+1;fx_consent:=gen_random_uuid();fx_photo:=gen_random_uuid();fx_kind:='foto_video';fx_granted:=true;fx_granted_at:=fx_base-interval '1 hour';fx_captured_at:=fx_base;fx_expires_at:=clock_timestamp()+interval '1 day';fx_consent_client:=fx_c;
   CASE fx_variant
    WHEN 'kommunikation' THEN fx_kind:='kommunikation';
    WHEN 'missing_grant' THEN fx_granted_at:=null;
    WHEN 'late_grant_microsecond' THEN fx_granted_at:=fx_base+interval '1 microsecond';
    WHEN 'future_grant' THEN fx_granted_at:=clock_timestamp()+interval '1 day';
    WHEN 'not_granted' THEN fx_granted:=false;
    WHEN 'expired' THEN fx_expires_at:=clock_timestamp()-interval '1 second';
    WHEN 'foreign_client' THEN fx_consent_client:=fx_other_c;
    WHEN 'future_capture' THEN fx_captured_at:=clock_timestamp()+interval '1 day';
    WHEN 'infinite_grant' THEN fx_granted_at:='-infinity'::timestamptz;
    WHEN 'infinite_capture' THEN fx_captured_at:='-infinity'::timestamptz;
    ELSE NULL;
   END CASE;
   INSERT INTO public.client_consents(id,tenant_id,client_id,title,scope,granted,granted_at,expires_at,consent_type,granted_by_profile_id,notes)
   VALUES(fx_consent,fx_t,fx_consent_client,'Synthetic explicit photo metadata scope','own',fx_granted,fx_granted_at,fx_expires_at,fx_kind,fx_u,'Privileged metadata fixture, no real consent established');
   INSERT INTO public.ambulatory_wound_photo_links(id,tenant_id,client_id,wound_case_id,assessment_id,consent_id,storage_path,file_name,content_sha256,captured_at,recorded_by,recorded_by_name)
   VALUES(fx_photo,fx_t,fx_c,fx_w,fx_a,fx_consent,'synthetic-no-storage-bytes/'||fx_photo,'synthetic-not-uploaded.png',lpad(to_hex(fx_index),64,'0'),fx_captured_at,fx_u,'Synthetic Photo Metadata Author');
   fx_entry:=jsonb_build_object('observation',jsonb_build_object('photoId',fx_photo,'assessmentId',fx_a,'photoConsentId',fx_consent),'person',jsonb_build_object('photoDecision','consented'));
   IF fx_variant='valid_foto_video' THEN
    PERFORM care_private.assert_wound_photo_current(fx_entry,fx_t,fx_c,fx_w);
    BEGIN PERFORM care_private.assert_wound_photo_current(jsonb_set(fx_entry,'{observation,assessmentId}',to_jsonb(gen_random_uuid())),fx_t,fx_c,fx_w);RAISE EXCEPTION 'Foreign assessment accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
    BEGIN PERFORM care_private.assert_wound_photo_current(jsonb_set(fx_entry,'{observation,photoConsentId}',to_jsonb(gen_random_uuid())),fx_t,fx_c,fx_w);RAISE EXCEPTION 'Foreign consent accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
    BEGIN UPDATE public.client_consents SET granted=false WHERE id=fx_consent;PERFORM care_private.assert_wound_photo_current(fx_entry,fx_t,fx_c,fx_w);RAISE EXCEPTION 'Revoked photo consent accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
    BEGIN UPDATE public.ambulatory_wound_photo_links SET file_name='changed.png' WHERE id=fx_photo;RAISE EXCEPTION 'Linked photo metadata mutable';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
    BEGIN DELETE FROM public.ambulatory_wound_photo_links WHERE id=fx_photo;RAISE EXCEPTION 'Linked photo metadata deletable';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
   ELSE
    BEGIN
     PERFORM care_private.assert_wound_photo_current(fx_entry,fx_t,fx_c,fx_w);
     RAISE EXCEPTION 'Invalid photo metadata accepted: %',fx_variant;
    EXCEPTION WHEN insufficient_privilege THEN
     GET STACKED DIAGNOSTICS fx_error=MESSAGE_TEXT;
     IF fx_error NOT LIKE 'Bildverwendung benötigt eine aktuell gültige ausdrückliche Fotoeinwilligung%' THEN RAISE EXCEPTION 'Unexpected denial for %: %',fx_variant,fx_error;END IF;
    END;
   END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='care_private' AND p.proname='assert_wound_photo_current' AND(has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE'))) THEN RAISE EXCEPTION 'Photo metadata helper quarantine missing';END IF;
  fx_passed:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
 EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;END;
 IF NOT fx_passed OR EXISTS(SELECT 1 FROM public.tenants t WHERE t.id=fx_t) OR EXISTS(SELECT 1 FROM auth.users u WHERE u.id=fx_u) OR EXISTS(SELECT 1 FROM public.ambulatory_wound_photo_links x WHERE x.tenant_id=fx_t) OR EXISTS(SELECT 1 FROM public.client_consents c WHERE c.tenant_id=fx_t) THEN RAISE EXCEPTION 'Wound photo metadata fixture or full rollback cleanup failed';END IF;
END $fixture$;

ROLLBACK;
