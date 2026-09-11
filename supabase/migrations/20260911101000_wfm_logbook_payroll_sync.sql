-- Keep the linked reimbursement in the trip's current period and review state.
-- Existing statements and paid reimbursements remain immutable.
CREATE OR REPLACE FUNCTION public.sync_employee_logbook_to_payroll()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_log_id UUID;
  v_changed BOOLEAN;
BEGIN
  SELECT id INTO v_log_id FROM public.assist_driving_log
    WHERE tenant_id=NEW.tenant_id AND employee_id=NEW.employee_id
      AND notes=('employee_logbook_trip:'||NEW.id::text) LIMIT 1 FOR UPDATE;
  v_changed := TG_OP='INSERT' OR ROW(NEW.started_at,NEW.ended_at,NEW.distance_final_km,NEW.route_type,NEW.assignment_id,NEW.mileage_amount_cents,NEW.purpose)
    IS DISTINCT FROM ROW(OLD.started_at,OLD.ended_at,OLD.distance_final_km,OLD.route_type,OLD.assignment_id,OLD.mileage_amount_cents,OLD.purpose)
    OR (NEW.status IN ('completed','corrected','confirmed')) IS DISTINCT FROM (OLD.status IN ('completed','corrected','confirmed'));
  IF v_log_id IS NOT NULL AND v_changed AND EXISTS (
    SELECT 1 FROM public.employee_expense_claims WHERE tenant_id=NEW.tenant_id AND driving_log_id=v_log_id AND status='reimbursed'
  ) THEN
    RAISE EXCEPTION 'Die Fahrt wurde bereits erstattet. Bitte eine gesonderte Erstattungskorrektur veranlassen.' USING ERRCODE='55000';
  END IF;
  IF NEW.status NOT IN ('completed','corrected','confirmed') OR NEW.ended_at IS NULL THEN
    IF v_log_id IS NOT NULL THEN
      UPDATE public.assist_driving_log SET payroll_eligible=FALSE,work_time_eligible=FALSE,updated_at=NOW() WHERE id=v_log_id;
      UPDATE public.employee_expense_claims SET status='rejected',approved_amount_cents=NULL,
        rejection_reason='Die zugehörige Fahrt ist storniert oder noch nicht abgeschlossen.',updated_at=NOW()
        WHERE tenant_id=NEW.tenant_id AND driving_log_id=v_log_id AND status<>'reimbursed';
    END IF;
    RETURN NEW;
  END IF;
  IF v_log_id IS NULL THEN
    INSERT INTO public.assist_driving_log(tenant_id,visit_id,employee_id,purpose,travel_type,started_at,ended_at,distance_km,start_address,end_address,status,notes,payroll_eligible,work_time_eligible,logbook_eligible,mileage_rate_cents,mileage_amount_cents)
    VALUES(NEW.tenant_id,NULL,NEW.employee_id,NEW.purpose,NEW.route_type,NEW.started_at,NEW.ended_at,NEW.distance_final_km,NEW.start_address,NEW.end_address,CASE WHEN NEW.status='corrected' THEN 'corrected' ELSE 'completed' END,'employee_logbook_trip:'||NEW.id::text,NEW.route_type<>'private_non_business',NEW.counts_as_work_time,TRUE,NEW.mileage_rate_cents,NEW.mileage_amount_cents)
    RETURNING id INTO v_log_id;
  ELSE
    UPDATE public.assist_driving_log SET purpose=NEW.purpose,travel_type=NEW.route_type,started_at=NEW.started_at,ended_at=NEW.ended_at,distance_km=NEW.distance_final_km,start_address=NEW.start_address,end_address=NEW.end_address,status=CASE WHEN NEW.status='corrected' THEN 'corrected' ELSE 'completed' END,payroll_eligible=NEW.route_type<>'private_non_business',work_time_eligible=NEW.counts_as_work_time,mileage_rate_cents=NEW.mileage_rate_cents,mileage_amount_cents=NEW.mileage_amount_cents,updated_at=NOW() WHERE id=v_log_id;
  END IF;
  IF NEW.route_type <> 'private_non_business' AND NEW.mileage_amount_cents > 0 THEN
    INSERT INTO public.employee_expense_claims(
      tenant_id,employee_id,expense_date,category,description,amount_cents,approved_amount_cents,
      mileage_km,mileage_rate_cents,origin,destination,business_purpose,tax_treatment,status,
      submitted_at,assignment_id,driving_log_id,travel_type,automatic_source
    ) VALUES(
      NEW.tenant_id,NEW.employee_id,(NEW.started_at AT TIME ZONE 'Europe/Berlin')::date,'mileage','Automatische Kilometervergütung aus Mitarbeiter-Fahrtenbuch',
      NEW.mileage_amount_cents,NULL,NEW.distance_final_km,NEW.mileage_rate_cents,
      NEW.start_address,NEW.end_address,NEW.purpose,'review','submitted',NOW(),NEW.assignment_id,v_log_id,NEW.route_type,TRUE
    ) ON CONFLICT(tenant_id,driving_log_id) WHERE driving_log_id IS NOT NULL DO UPDATE SET
      expense_date=EXCLUDED.expense_date,assignment_id=EXCLUDED.assignment_id,travel_type=EXCLUDED.travel_type,
      amount_cents=EXCLUDED.amount_cents,
      approved_amount_cents=CASE WHEN v_changed THEN NULL ELSE public.employee_expense_claims.approved_amount_cents END,
      mileage_km=EXCLUDED.mileage_km,mileage_rate_cents=EXCLUDED.mileage_rate_cents,
      origin=EXCLUDED.origin,destination=EXCLUDED.destination,business_purpose=EXCLUDED.business_purpose,
      status=CASE WHEN v_changed THEN 'submitted' ELSE public.employee_expense_claims.status END,
      tax_treatment=CASE WHEN v_changed THEN 'review' ELSE public.employee_expense_claims.tax_treatment END,
      reviewed_at=CASE WHEN v_changed THEN NULL ELSE public.employee_expense_claims.reviewed_at END,
      reviewed_by=CASE WHEN v_changed THEN NULL ELSE public.employee_expense_claims.reviewed_by END,
      rejection_reason=NULL,updated_at=NOW();
  ELSE
    UPDATE public.employee_expense_claims SET status='rejected',approved_amount_cents=NULL,
      rejection_reason='Für die geänderte Fahrt ist keine Kilometervergütung vorgesehen.',updated_at=NOW()
      WHERE tenant_id=NEW.tenant_id AND driving_log_id=v_log_id AND status<>'reimbursed';
  END IF;
  RETURN NEW;
END $$;

-- Changing only the start time also changes duration and the assigned period.
DROP TRIGGER IF EXISTS employee_logbook_prepare_trip ON public.employee_logbook_trips;
CREATE TRIGGER employee_logbook_prepare_trip BEFORE INSERT OR UPDATE OF started_at,ended_at,route_type,distance_final_km,employee_id
ON public.employee_logbook_trips FOR EACH ROW EXECUTE FUNCTION public.prepare_employee_logbook_trip();

DO $$
DECLARE v_table TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    FOREACH v_table IN ARRAY ARRAY['employee_logbook_trips','employee_logbook_profiles','employee_logbook_vehicles','employee_logbook_receipts','workforce_time_events','assist_time_events','workforce_time_entry_reviews','workforce_time_accounts','workforce_absences','assist_visits','assignments','employee_contract_settings','employee_payroll_settings','employee_expense_claims','payroll_month_statements'] LOOP
      IF to_regclass('public.'||v_table) IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=v_table) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',v_table);
      END IF;
    END LOOP;
  END IF;
END $$;
