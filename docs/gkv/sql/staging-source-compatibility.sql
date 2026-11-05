-- Old columns stay usable. Canonical rows project only verified source values.
CREATE FUNCTION care_security.gkv_staging_record_compatibility() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.source_receipt <> '{}'::jsonb THEN
  IF NEW.source_receipt->>'version' IS DISTINCT FROM 'workflow-assignment-record-v1'
   OR NEW.source_receipt->>'assignment_id' IS DISTINCT FROM NEW.assignment_id::text
   OR NEW.source_receipt->>'client_id' IS DISTINCT FROM NEW.client_id::text
   OR NEW.source_receipt->>'tenant_id' IS DISTINCT FROM NEW.tenant_id::text
   OR NEW.source_receipt->>'employee_id' IS DISTINCT FROM NEW.employee_id::text
   OR (NEW.source_receipt->>'actual_minutes')::integer IS DISTINCT FROM NEW.actual_minutes
   OR (NEW.source_receipt->>'service_started_at')::timestamptz IS NULL
   OR NEW.service_date IS DISTINCT FROM ((NEW.source_receipt->>'service_started_at')::timestamptz AT TIME ZONE 'Europe/Berlin')::date THEN
   RAISE EXCEPTION 'Legacy projection requires a verified, consistent source'; END IF;
  NEW.performed_at:=(NEW.source_receipt->>'service_started_at')::timestamptz;
  NEW.duration_minutes:=NEW.actual_minutes; NEW.service_type:=NEW.product_key::text;
  NEW.invoice_id:=NEW.billed_invoice_id;
 ELSE
  -- Preserve legacy data; a date is not a signature or an approval.
  IF NEW.service_date IS NULL THEN NEW.service_date:=(NEW.performed_at AT TIME ZONE 'Europe/Berlin')::date; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION care_security.gkv_staging_record_compatibility() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER gkv_staging_record_compatibility BEFORE INSERT OR UPDATE ON public.service_records
 FOR EACH ROW EXECUTE FUNCTION care_security.gkv_staging_record_compatibility();

CREATE FUNCTION care_security.gkv_staging_invoice_compatibility() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.office_managed THEN
  NEW.title:=COALESCE(NULLIF(NEW.title,''),'Rechnungsentwurf');
  NEW.total_cents:=round(NEW.total_amount*100)::integer;
  NEW.client_name:=NEW.recipient_name;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION care_security.gkv_staging_invoice_compatibility() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER gkv_staging_invoice_compatibility BEFORE INSERT OR UPDATE ON public.invoices
 FOR EACH ROW EXECUTE FUNCTION care_security.gkv_staging_invoice_compatibility();
