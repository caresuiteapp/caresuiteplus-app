-- Optional billing master data stays empty until explicitly provided.
ALTER TABLE public.tenants
 ADD COLUMN legal_name text, ADD COLUMN street text, ADD COLUMN house_number text,
 ADD COLUMN postal_code text, ADD COLUMN city text, ADD COLUMN country text,
 ADD COLUMN tax_number text, ADD COLUMN vat_id text, ADD COLUMN register_court text,
 ADD COLUMN register_number text, ADD COLUMN ik_number text, ADD COLUMN representative_name text;
ALTER TABLE public.clients ADD COLUMN full_name text, ADD COLUMN house_number text, ADD COLUMN country text;
ALTER TABLE public.employees ADD COLUMN full_name text;
ALTER TABLE public.tenant_billing_settings
 ADD COLUMN bank_name text, ADD COLUMN iban text, ADD COLUMN bic text,
 ADD COLUMN invoice_footer_text text, ADD COLUMN invoice_prefix text,
 ADD COLUMN next_invoice_number integer CHECK(next_invoice_number>0);
