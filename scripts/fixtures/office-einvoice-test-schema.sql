-- Isolated fixture only: schema shape uses the existing invoice tables, while all
-- users, companies, permissions, jobs and business rows are synthetic test data.
-- The hosted Auth/Storage integrations are replaced with explicit local adapters.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA care_security; CREATE SCHEMA storage; CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA auth,care_security,storage,extensions TO authenticated,service_role;
CREATE TYPE public.billing_party AS ENUM ('care_insurance','health_insurance','self_payer','social_welfare','other');
CREATE TYPE public.invoice_recipient_type AS ENUM ('client','relative','care_insurance','health_insurance','social_welfare','company','other');
CREATE TYPE public.invoice_status AS ENUM ('draft','ready','sent','partly_paid','paid','overdue','cancelled','written_off');
CREATE TYPE public.product_key AS ENUM ('assist','pflege','stationaer','office','beratung','akademie');
CREATE TYPE public.service_record_status AS ENUM ('draft','signature_required','signed','review_required','approved','billable','billed','corrected','cancelled');
CREATE TYPE public.payment_method AS ENUM ('bank_transfer','direct_debit','cash','card','paypal','stripe','other');
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  billing_run_id uuid,
  client_id uuid,
  invoice_number text,
  invoice_date date DEFAULT CURRENT_DATE,
  service_month date,
  due_date date,
  recipient_type invoice_recipient_type DEFAULT 'client'::invoice_recipient_type,
  recipient_name text,
  recipient_street text,
  recipient_house_number text,
  recipient_postal_code text,
  recipient_city text,
  recipient_country text DEFAULT 'Deutschland'::text,
  recipient_email text,
  cost_bearer_name text,
  cost_bearer_reference text,
  billing_party billing_party DEFAULT 'care_insurance'::billing_party,
  subtotal_amount numeric DEFAULT 0,
  vat_rate numeric DEFAULT 0,
  vat_amount numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  paid_amount numeric DEFAULT 0,
  open_amount numeric DEFAULT 0,
  status invoice_status DEFAULT 'draft'::invoice_status,
  pdf_url text,
  pdf_file_path text,
  sent_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  payment_reference text,
  notes text,
  footer_text text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  service_period_from date,
  service_period_to date
);
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  invoice_id uuid,
  service_record_id uuid,
  client_budget_id uuid,
  product_key product_key,
  service_date date,
  description text,
  quantity numeric DEFAULT 1,
  unit text DEFAULT 'Stunde'::text,
  unit_price numeric DEFAULT 0,
  vat_rate numeric DEFAULT 0,
  net_amount numeric DEFAULT 0,
  vat_amount numeric DEFAULT 0,
  gross_amount numeric DEFAULT 0,
  sort_order int4 DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.service_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  assignment_id uuid,
  documentation_entry_id uuid,
  signature_id uuid,
  client_id uuid,
  employee_id uuid,
  product_key product_key DEFAULT 'assist'::product_key,
  record_number text,
  service_date date,
  service_month date,
  planned_minutes int4,
  actual_minutes int4,
  billable_minutes int4,
  hourly_rate numeric,
  total_amount numeric,
  status service_record_status DEFAULT 'draft'::service_record_status,
  pdf_url text,
  approved_by uuid,
  approved_at timestamptz,
  billed_invoice_id uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  assist_visit_id uuid,
  source_receipt jsonb DEFAULT '{}'::jsonb
);
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  legal_name text,
  legal_form text,
  street text,
  house_number text,
  postal_code text,
  city text,
  country text DEFAULT 'Deutschland'::text,
  phone text,
  fax text,
  email text,
  website text,
  ik_number text,
  tax_number text,
  vat_id text,
  register_court text,
  register_number text,
  supervisory_authority text,
  representative_name text,
  representative_position text,
  status text DEFAULT 'trial'::text,
  trial_starts_at timestamptz DEFAULT now(),
  trial_ends_at timestamptz DEFAULT (now() + '14 days'::interval),
  billing_email text,
  billing_reference text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  slug text,
  industry text,
  legal_form_key text,
  industry_key text,
  registration_catalog_version text
);
CREATE TABLE public.tenant_billing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  default_hourly_rate numeric DEFAULT 32.75,
  self_payer_vat_rate numeric DEFAULT 19.00,
  insurance_vat_rate numeric DEFAULT 0.00,
  payment_terms_days int4 DEFAULT 14,
  dunning_after_days int4 DEFAULT 30,
  dunning_fee numeric DEFAULT 10.00,
  invoice_prefix text DEFAULT 'CS'::text,
  next_invoice_number int4 DEFAULT 1001,
  bank_name text,
  iban text,
  bic text,
  account_holder text,
  invoice_footer_text text,
  invoice_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.tenant_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  label text,
  account_holder text,
  bank_name text,
  iban text,
  bic text,
  is_primary bool DEFAULT false,
  sort_order int4 DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.tenant_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  app_name text DEFAULT 'CareSuite+'::text,
  logo_url text,
  favicon_url text,
  light_primary_color text DEFAULT '#051A7A'::text,
  light_secondary_color text DEFAULT '#4B4BFF'::text,
  light_accent_color text DEFAULT '#62F3FF'::text,
  light_background_color text DEFAULT '#F7F8FA'::text,
  light_surface_color text DEFAULT '#FFFFFF'::text,
  light_card_color text DEFAULT '#FFFFFF'::text,
  light_text_primary_color text DEFAULT '#0E1320'::text,
  light_text_secondary_color text DEFAULT '#5D6678'::text,
  light_border_color text DEFAULT '#E3E8F0'::text,
  dark_primary_color text DEFAULT '#62F3FF'::text,
  dark_secondary_color text DEFAULT '#4B4BFF'::text,
  dark_accent_color text DEFAULT '#8B5CFF'::text,
  dark_background_color text DEFAULT '#0E1320'::text,
  dark_surface_color text DEFAULT '#151B2D'::text,
  dark_card_color text DEFAULT '#1C2235'::text,
  dark_text_primary_color text DEFAULT '#FFFFFF'::text,
  dark_text_secondary_color text DEFAULT '#B8C0D4'::text,
  dark_border_color text DEFAULT '#2B3448'::text,
  font_family text DEFAULT 'Inter'::text,
  border_radius_card int4 DEFAULT 24,
  border_radius_button int4 DEFAULT 16,
  button_height int4 DEFAULT 54,
  use_robot_visuals bool DEFAULT true,
  use_soft_shadows bool DEFAULT true,
  use_gradients bool DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  client_number text,
  first_name text,
  last_name text,
  full_name text,
  date_of_birth date,
  gender text,
  email text,
  phone text,
  mobile text,
  street text,
  house_number text,
  postal_code text,
  city text,
  country text DEFAULT 'Deutschland'::text,
  floor text,
  doorbell_name text,
  access_notes text,
  status text DEFAULT 'lead'::text,
  care_level text DEFAULT 'unknown'::text,
  insurance_name text,
  insurance_number text,
  cost_bearer text,
  billing_party billing_party DEFAULT 'care_insurance'::billing_party,
  default_product_key product_key DEFAULT 'assist'::product_key,
  emergency_notes text,
  allergies text,
  diagnoses_notes text,
  mobility_notes text,
  pets text,
  key_management_notes text,
  internal_notes text,
  visible_notes_for_employee text,
  portal_enabled bool DEFAULT true,
  admission_date date,
  discharge_date date,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  apartment_number text,
  deleted_at timestamptz,
  salutation text,
  service_start date,
  housing_form text,
  special_notes text,
  preferred_contact text
);
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  invoice_id uuid,
  client_id uuid,
  payment_date date DEFAULT CURRENT_DATE,
  value_date date,
  amount numeric,
  currency text DEFAULT 'EUR'::text,
  status text DEFAULT 'open'::text,
  payment_method payment_method DEFAULT 'bank_transfer'::payment_method,
  payer_name text,
  payer_iban text,
  reference text,
  bank_booking_text text,
  matched_at timestamptz,
  matched_by uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.roles(id uuid PRIMARY KEY,key text,is_admin_role boolean,tenant_id uuid);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,auth_user_id uuid,tenant_id uuid,role_id uuid,is_active boolean,status text);
CREATE TABLE public.role_permissions(role_id uuid,tenant_id uuid,permission_key text,can_view boolean);
CREATE TABLE public.tenant_tax_profiles(tenant_id uuid PRIMARY KEY,tax_scheme text,kleinunternehmer boolean,reverse_charge boolean,tax_notes text);
CREATE TABLE public.assignments(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,employee_id uuid,status text,actual_start_at timestamptz,actual_end_at timestamptz);
CREATE TABLE public.documentation_entries(id uuid PRIMARY KEY);
CREATE TABLE public.signatures(id uuid PRIMARY KEY);
CREATE TABLE public.workflow_proof_attestations(id uuid PRIMARY KEY);
CREATE TABLE public.payroll_month_statements(id uuid PRIMARY KEY,tenant_id uuid,pdf_path text);
CREATE TABLE public.document_render_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,related_entity_table text,related_entity_id uuid,job_status text,pdf_path text,created_by uuid);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1,'/') $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('role',current_setting('test.jwt_role',true)) $$;
CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.tenant',true),'')::uuid $$;
CREATE FUNCTION public.current_portal_type() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.portal',true),'') $$;
CREATE FUNCTION care_security.generated_pdf_reader(text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION care_security.office_actor(p_tenant uuid,p_permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
SELECT auth.uid() IS NOT NULL AND p_tenant=public.current_tenant_id() AND EXISTS(
 SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
 WHERE (p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid())) AND p.tenant_id=p_tenant
 AND p.is_active AND p.status='active' AND lower(r.key) NOT IN ('employee_portal','client_portal','family_portal','employee','client','family','relative','caregiver','nurse')
 AND (r.is_admin_role OR EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_key=p_permission AND rp.can_view)))
$$;
CREATE FUNCTION public.fixture_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at:=greatest(clock_timestamp(),OLD.updated_at+interval '1 microsecond');RETURN NEW;END $$;
CREATE TRIGGER fixture_invoice_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.fixture_touch_updated_at();
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_invoices ON public.invoices FOR ALL TO authenticated USING(tenant_id=public.current_tenant_id()) WITH CHECK(tenant_id=public.current_tenant_id());
CREATE POLICY fixture_lines ON public.invoice_items FOR ALL TO authenticated USING(tenant_id=public.current_tenant_id()) WITH CHECK(tenant_id=public.current_tenant_id());
CREATE POLICY fixture_payments ON public.payments FOR ALL TO authenticated USING(tenant_id=public.current_tenant_id()) WITH CHECK(tenant_id=public.current_tenant_id());
GRANT ALL ON ALL TABLES IN SCHEMA public,storage TO authenticated,service_role;
