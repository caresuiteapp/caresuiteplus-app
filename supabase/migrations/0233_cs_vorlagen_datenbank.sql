-- ==========================================================================
-- CareSuite+ — Migration 0233: Vorlagen-Datenbank (cs_* Tabellen + Seed)
-- Zentrale mandantenfähige Dokument-, Signatur- und Portalvorlagen.
-- Juristische Muster sind technische Vorlagen — vor Produktion rechtlich prüfen.
-- ==========================================================================

begin;

create extension if not exists pgcrypto;

create table if not exists public.cs_template_categories (
  id uuid primary key default gen_random_uuid(),
  category_key text not null unique,
  name text not null,
  description text,
  display_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cs_template_placeholders (
  id uuid primary key default gen_random_uuid(),
  placeholder_key text not null unique,
  label text not null,
  entity text not null,
  description text,
  example text,
  required_context boolean not null default false,
  data_type text not null default 'text',
  pii_level text not null default 'normal',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cs_document_templates (
  id uuid primary key default gen_random_uuid(),
  owner_tenant_id uuid null,
  is_system_template boolean not null default true,
  template_key text not null unique,
  category_key text not null references public.cs_template_categories(category_key) on update cascade,
  title text not null,
  short_description text,
  document_type text not null,
  recipient_scope text not null check (recipient_scope in ('employee','client','both','office','payor','internal')),
  default_signature_requirement text not null check (default_signature_requirement in ('none','employee','client','both','office')),
  default_priority text not null check (default_priority in ('low','normal','high','urgent')),
  is_required_before_service boolean not null default false,
  portal_visible_until_completed boolean not null default true,
  tenant_can_edit_body boolean not null default true,
  tenant_can_clone boolean not null default true,
  tags text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cs_document_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.cs_document_templates(id) on delete cascade,
  version_no integer not null default 1,
  status text not null check (status in ('draft','active','archived')) default 'active',
  title text not null,
  body_html text not null,
  placeholder_schema jsonb not null default '{}'::jsonb,
  legal_notice text,
  created_by text not null default 'system',
  activated_at timestamptz null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(template_id, version_no)
);

create table if not exists public.cs_template_signature_fields (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.cs_document_template_versions(id) on delete cascade,
  signer_role text not null check (signer_role in ('employee','client','office','representative','payor')),
  label text not null,
  required boolean not null default true,
  anchor_token text not null,
  input_type text not null check (input_type in ('signature','date','checkbox','text')) default 'signature',
  order_index integer not null default 1,
  page_hint integer null,
  x numeric null,
  y numeric null,
  width numeric null,
  height numeric null,
  created_at timestamptz not null default now()
);

create table if not exists public.cs_template_delivery_defaults (
  template_id uuid primary key references public.cs_document_templates(id) on delete cascade,
  delivery_channel text not null check (delivery_channel in ('portal','email','print','portal_and_email')) default 'portal',
  due_in_days integer not null default 7,
  reminder_after_days integer not null default 2,
  max_reminders integer not null default 3,
  requires_office_review boolean not null default true,
  remove_from_portal_after_completion boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cs_document_requests (
  id uuid primary key default gen_random_uuid(),
  owner_tenant_id uuid not null,
  template_version_id uuid references public.cs_document_template_versions(id) on delete set null,
  source_template_key text null,
  title text not null,
  recipient_scope text not null check (recipient_scope in ('employee','client','both','office','payor','internal')),
  employee_id uuid null,
  client_id uuid null,
  representative_id uuid null,
  payor_id uuid null,
  assignment_id uuid null,
  invoice_id uuid null,
  priority text not null check (priority in ('low','normal','high','urgent')) default 'normal',
  status text not null check (status in ('draft','sent','opened','partially_signed','completed','rejected','expired','archived')) default 'draft',
  due_date date null,
  required_before_service boolean not null default false,
  portal_visible boolean not null default true,
  context_snapshot jsonb not null default '{}'::jsonb,
  rendered_html text null,
  completed_at timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cs_document_request_signatures (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.cs_document_requests(id) on delete cascade,
  signer_role text not null check (signer_role in ('employee','client','office','representative','payor')),
  signer_person_id uuid null,
  signer_name text null,
  status text not null check (status in ('pending','signed','declined','not_required')) default 'pending',
  signature_data_url text null,
  signature_file_path text null,
  signed_at timestamptz null,
  signed_ip inet null,
  signed_user_agent text null,
  audit_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cs_document_request_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.cs_document_requests(id) on delete cascade,
  file_kind text not null check (file_kind in ('source_pdf','rendered_pdf','signed_pdf','attachment','export')),
  storage_bucket text not null default 'documents',
  storage_path text not null,
  mime_type text not null default 'application/pdf',
  file_size_bytes bigint null,
  checksum_sha256 text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_cs_templates_category on public.cs_document_templates(category_key);
create index if not exists idx_cs_templates_owner on public.cs_document_templates(owner_tenant_id);
create index if not exists idx_cs_versions_template_status on public.cs_document_template_versions(template_id, status);
create index if not exists idx_cs_requests_tenant_status on public.cs_document_requests(owner_tenant_id, status);
create index if not exists idx_cs_requests_employee on public.cs_document_requests(employee_id) where employee_id is not null;
create index if not exists idx_cs_requests_client on public.cs_document_requests(client_id) where client_id is not null;

create or replace function public.cs_placeholder_value(_context jsonb, _path text)
returns text
language sql
stable
as $$
  select coalesce(_context #>> string_to_array(_path, '.'), '');
$$;

create or replace function public.cs_render_template_html(_html text, _context jsonb)
returns text
language plpgsql
stable
as $$
declare
  _result text := coalesce(_html, '');
  _key text;
  _value text;
begin
  for _key in
    select distinct match[1]
    from regexp_matches(_result, '\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}', 'g') as m(match)
  loop
    _value := public.cs_placeholder_value(_context, _key);
    _result := replace(_result, '{{' || _key || '}}', _value);
    _result := replace(_result, '{{ ' || _key || ' }}', _value);
  end loop;
  return _result;
end;
$$;

create or replace function public.cs_seed_template(
  _category_key text,
  _template_key text,
  _title text,
  _short_description text,
  _document_type text,
  _recipient_scope text,
  _signature_requirement text,
  _priority text,
  _required_before_service boolean,
  _tags text[],
  _body_html text,
  _signature_fields jsonb default '[]'::jsonb,
  _due_in_days integer default 7
)
returns void
language plpgsql
as $$
declare
  v_template_id uuid;
  v_version_id uuid;
  f jsonb;
begin
  insert into public.cs_document_templates (
    is_system_template, template_key, category_key, title, short_description, document_type,
    recipient_scope, default_signature_requirement, default_priority, is_required_before_service, tags, active, updated_at
  ) values (
    true, _template_key, _category_key, _title, _short_description, _document_type,
    _recipient_scope, _signature_requirement, _priority, _required_before_service, coalesce(_tags, ARRAY[]::text[]), true, now()
  )
  on conflict (template_key) do update set
    category_key = excluded.category_key,
    title = excluded.title,
    short_description = excluded.short_description,
    document_type = excluded.document_type,
    recipient_scope = excluded.recipient_scope,
    default_signature_requirement = excluded.default_signature_requirement,
    default_priority = excluded.default_priority,
    is_required_before_service = excluded.is_required_before_service,
    tags = excluded.tags,
    active = true,
    updated_at = now()
  returning id into v_template_id;

  insert into public.cs_document_template_versions (
    template_id, version_no, status, title, body_html, placeholder_schema, legal_notice, created_by, activated_at, updated_at
  ) values (
    v_template_id, 1, 'active', _title, _body_html,
    jsonb_build_object('placeholder_style','double_curly_dot_path','example','{{client.full_name}}'),
    'Technische/fachliche Muster-Vorlage. Vor produktiver Nutzung fachlich und rechtlich prüfen.',
    'system_seed', now(), now()
  )
  on conflict (template_id, version_no) do update set
    status = 'active',
    title = excluded.title,
    body_html = excluded.body_html,
    placeholder_schema = excluded.placeholder_schema,
    legal_notice = excluded.legal_notice,
    updated_at = now()
  returning id into v_version_id;

  delete from public.cs_template_signature_fields where version_id = v_version_id;
  for f in select * from jsonb_array_elements(coalesce(_signature_fields, '[]'::jsonb)) loop
    insert into public.cs_template_signature_fields (
      version_id, signer_role, label, required, anchor_token, input_type, order_index
    ) values (
      v_version_id,
      coalesce(f->>'signer_role','client'),
      coalesce(f->>'label','Unterschrift'),
      coalesce((f->>'required')::boolean, true),
      coalesce(f->>'anchor_token','signature'),
      coalesce(f->>'input_type','signature'),
      coalesce((f->>'order_index')::integer, 1)
    );
  end loop;

  insert into public.cs_template_delivery_defaults (
    template_id, delivery_channel, due_in_days, reminder_after_days, max_reminders, requires_office_review, remove_from_portal_after_completion, updated_at
  ) values (
    v_template_id, 'portal', coalesce(_due_in_days,7), 2, 3, true, true, now()
  )
  on conflict (template_id) do update set
    due_in_days = excluded.due_in_days,
    updated_at = now();
end;
$$;


-- Kategorien
insert into public.cs_template_categories (category_key, name, description, display_order, active, updated_at) values
('employee_contracts', 'Mitarbeitende – Verträge & Vereinbarungen', 'Arbeitsverträge, Zusatzvereinbarungen, Verpflichtungen und Übergaben.', 10, true, now()),
('employee_hr', 'Mitarbeitende – Personalvorgänge', 'Onboarding, Urlaub, Krankheit, Abmahnung, Kündigung, Zeugnisse und interne Freigaben.', 20, true, now()),
('client_contracts', 'Klient:innen – Verträge & Einwilligungen', 'Betreuungsverträge, Datenschutz, Schweigepflicht, Vollmachten und Zahlungsmandate.', 30, true, now()),
('client_care', 'Klient:innen – Aufnahme, Betreuung & Qualität', 'Aufnahme, Risiko, Hilfeplanung, Notfall, Feedback, Beschwerde und Verlauf.', 40, true, now()),
('assignments_proofs', 'Einsätze & Leistungsnachweise', 'Einsatzauftrag, Einsatzänderung, Einzelnachweis, Monatsnachweis und Signaturen.', 50, true, now()),
('payor_insurance', 'Kostenträger & Pflegekassen', 'Kostenübernahme, Abrechnung, Widerspruch, Korrektur, Mahnung und Kommunikation.', 60, true, now()),
('portal_communication', 'Portal & Kommunikation', 'Portal-Einladungen, Rundschreiben, Terminbestätigungen und Änderungsmitteilungen.', 70, true, now()),
('office_legal', 'Office, Recht & Datenschutz', 'Mahnung, DSGVO, Datenpanne, Vertragsende, interne Prüfvermerke und Aktennotizen.', 80, true, now()),
('quality_compliance', 'Qualität, Schulung & Compliance', 'QM, Unterweisungen, Hygiene, Arbeitsschutz, Datenschutzschulung und Audit.', 90, true, now()),
('incident_damage', 'Vorfälle, Schäden & Sondermeldungen', 'Unfall, Schaden, besondere Vorkommnisse, Datenschutzvorfälle und Eskalationen.', 100, true, now())
on conflict (category_key) do update set name = excluded.name, description = excluded.description, display_order = excluded.display_order, active = true, updated_at = now();

-- Platzhalter-Katalog
insert into public.cs_template_placeholders (placeholder_key, label, entity, description, example, required_context, data_type, pii_level, active, updated_at) values
('tenant.legal_name', 'Mandant – Rechtsform/Firma', 'tenant', 'Offizieller Firmenname des Mandanten.', 'Helferhasen+ UG (haftungsbeschränkt)', true, 'text', 'business', true, now()),
('tenant.trade_name', 'Mandant – Anzeigename', 'tenant', 'Öffentlicher oder kurzer Anzeigename.', 'Helferhasen+', false, 'text', 'business', true, now()),
('tenant.street', 'Mandant – Straße', 'tenant', 'Straße und Hausnummer.', 'Torgauer Straße 7', false, 'text', 'business', true, now()),
('tenant.postal_code', 'Mandant – PLZ', 'tenant', 'Postleitzahl.', '44263', false, 'text', 'business', true, now()),
('tenant.city', 'Mandant – Ort', 'tenant', 'Ort/Stadt.', 'Dortmund', false, 'text', 'business', true, now()),
('tenant.address_full', 'Mandant – vollständige Anschrift', 'tenant', 'Komplette Geschäftsanschrift.', 'Torgauer Straße 7, 44263 Dortmund', true, 'text', 'business', true, now()),
('tenant.phone', 'Mandant – Telefon', 'tenant', 'Zentrale Telefonnummer.', '0231 99 76 00 9-6', false, 'text', 'business', true, now()),
('tenant.fax', 'Mandant – Fax', 'tenant', 'Faxnummer.', '0231 99 76 00 9-0', false, 'text', 'business', true, now()),
('tenant.email', 'Mandant – E-Mail', 'tenant', 'Zentrale E-Mail-Adresse.', 'info@helferhasen.com', true, 'email', 'business', true, now()),
('tenant.website', 'Mandant – Website', 'tenant', 'Website des Mandanten.', 'www.helferhasen.com', false, 'text', 'business', true, now()),
('tenant.ceo_name', 'Mandant – Geschäftsführung', 'tenant', 'Name der Geschäftsführung/Vertretungsberechtigung.', 'Kevin Reinhardt', true, 'text', 'business', true, now()),
('tenant.register_court', 'Mandant – Registergericht', 'tenant', 'Zuständiges Registergericht.', 'Amtsgericht Dortmund', false, 'text', 'business', true, now()),
('tenant.register_number', 'Mandant – HRB', 'tenant', 'Handelsregister-Nummer.', 'HRB 37547', false, 'text', 'business', true, now()),
('tenant.vat_id', 'Mandant – USt-ID', 'tenant', 'Umsatzsteuer-ID.', 'DE457073674', false, 'text', 'business', true, now()),
('tenant.ik_number', 'Mandant – IK-Nummer', 'tenant', 'Institutionskennzeichen.', '462509667', false, 'text', 'business', true, now()),
('tenant.supervisory_authority', 'Mandant – Aufsichtsbehörde', 'tenant', 'Zuständige Aufsichtsbehörde.', 'Sozialamt Dortmund', false, 'text', 'business', true, now()),
('tenant.opening_hours', 'Mandant – Öffnungszeiten', 'tenant', 'Öffnungszeiten als Text.', 'Mo.–Fr. 11:00 bis 19:00 Uhr', false, 'text', 'business', true, now()),
('tenant.emergency_phone', 'Mandant – Notruf', 'tenant', '24/7 Notrufnummer oder Bereitschaftskontakt.', 'Notruf 24/7 an 365 Tagen im Jahr', false, 'text', 'business', true, now()),
('tenant.bank_name', 'Mandant – Bank', 'tenant', 'Bankname.', 'OLINDA', false, 'text', 'business', true, now()),
('tenant.iban', 'Mandant – IBAN', 'tenant', 'IBAN für Zahlungen.', 'DE11 1001 0123 4404 0326 61', false, 'text', 'business', true, now()),
('tenant.bic', 'Mandant – BIC', 'tenant', 'BIC/SWIFT.', 'QNTODEB2XXX', false, 'text', 'business', true, now()),
('employee.full_name', 'Mitarbeitende:r – Vollständiger Name', 'employee', 'Voller Name des/der Mitarbeitenden.', 'Kathrin Pott', true, 'text', 'personal', true, now()),
('employee.first_name', 'Mitarbeitende:r – Vorname', 'employee', 'Vorname.', 'Kathrin', false, 'text', 'personal', true, now()),
('employee.last_name', 'Mitarbeitende:r – Nachname', 'employee', 'Nachname.', 'Pott', false, 'text', 'personal', true, now()),
('employee.birth_date', 'Mitarbeitende:r – Geburtsdatum', 'employee', 'Geburtsdatum.', '1991-09-21', false, 'date', 'sensitive', true, now()),
('employee.address_full', 'Mitarbeitende:r – Anschrift', 'employee', 'Vollständige Privatanschrift.', 'Musterstraße 1, 44135 Dortmund', false, 'text', 'sensitive', true, now()),
('employee.email', 'Mitarbeitende:r – E-Mail', 'employee', 'E-Mail-Adresse.', 'mitarbeiter@example.de', false, 'email', 'personal', true, now()),
('employee.phone', 'Mitarbeitende:r – Telefon', 'employee', 'Telefonnummer.', '0170 000000', false, 'text', 'personal', true, now()),
('employee.personnel_number', 'Mitarbeitende:r – Personalnummer', 'employee', 'Interne Personalnummer.', 'HH-EMP-001', false, 'text', 'personal', true, now()),
('employee.job_title', 'Mitarbeitende:r – Position', 'employee', 'Funktionsbezeichnung.', 'Alltagsbegleiter:in', false, 'text', 'personal', true, now()),
('employee.employment_type', 'Mitarbeitende:r – Beschäftigungsart', 'employee', 'Minijob, Teilzeit, Vollzeit, Honorarkraft etc.', 'Teilzeit', false, 'text', 'personal', true, now()),
('employee.start_date', 'Mitarbeitende:r – Eintritt', 'employee', 'Eintrittsdatum.', '2026-01-01', false, 'date', 'personal', true, now()),
('employee.end_date', 'Mitarbeitende:r – Austritt', 'employee', 'Austrittsdatum.', '2026-06-30', false, 'date', 'personal', true, now()),
('employee.weekly_hours', 'Mitarbeitende:r – Wochenstunden', 'employee', 'Vereinbarte Wochenarbeitszeit.', '20', false, 'number', 'personal', true, now()),
('employee.hourly_wage', 'Mitarbeitende:r – Stundenlohn', 'employee', 'Vereinbarter Stundenlohn.', '14,00 €', false, 'money', 'sensitive', true, now()),
('employee.probation_end', 'Mitarbeitende:r – Probezeit Ende', 'employee', 'Ende der Probezeit.', '2026-06-30', false, 'date', 'personal', true, now()),
('employee.portal_username', 'Mitarbeitende:r – Portal-Benutzername', 'employee', 'Benutzername für Mitarbeiterportal.', 'kathrin.pott', false, 'text', 'personal', true, now()),
('employee.bank_iban', 'Mitarbeitende:r – IBAN', 'employee', 'Bankverbindung des Mitarbeitenden.', 'DE00 0000 0000 0000 0000 00', false, 'text', 'sensitive', true, now()),
('client.full_name', 'Klient:in – Vollständiger Name', 'client', 'Voller Name der Klientin/des Klienten.', 'Ramona König', true, 'text', 'personal', true, now()),
('client.first_name', 'Klient:in – Vorname', 'client', 'Vorname.', 'Ramona', false, 'text', 'personal', true, now()),
('client.last_name', 'Klient:in – Nachname', 'client', 'Nachname.', 'König', false, 'text', 'personal', true, now()),
('client.birth_date', 'Klient:in – Geburtsdatum', 'client', 'Geburtsdatum.', '1941-04-12', false, 'date', 'sensitive', true, now()),
('client.address_full', 'Klient:in – Anschrift', 'client', 'Vollständige Einsatz-/Wohnanschrift.', 'Musterweg 2, 58452 Witten', true, 'text', 'sensitive', true, now()),
('client.phone', 'Klient:in – Telefon', 'client', 'Telefonnummer.', '02302 000000', false, 'text', 'personal', true, now()),
('client.email', 'Klient:in – E-Mail', 'client', 'E-Mail-Adresse.', 'klient@example.de', false, 'email', 'personal', true, now()),
('client.care_level', 'Klient:in – Pflegegrad', 'client', 'Pflegegrad.', 'PG2', false, 'text', 'health', true, now()),
('client.insurance_name', 'Klient:in – Pflegekasse/Krankenkasse', 'client', 'Kostenträger/Pflegekasse.', 'Bosch BKK', false, 'text', 'health', true, now()),
('client.insurance_number', 'Klient:in – Versichertennummer', 'client', 'Versichertennummer.', 'A123456789', false, 'text', 'sensitive', true, now()),
('client.representative_name', 'Klient:in – gesetzliche Vertretung/Angehörige', 'client', 'Name der vertretenden Person.', 'Max Mustermann', false, 'text', 'personal', true, now()),
('client.representative_relation', 'Klient:in – Beziehung Vertretung', 'client', 'Beziehung zur vertretenden Person.', 'Sohn', false, 'text', 'personal', true, now()),
('client.emergency_contact_name', 'Klient:in – Notfallkontakt Name', 'client', 'Name des Notfallkontakts.', 'Erika Muster', false, 'text', 'personal', true, now()),
('client.emergency_contact_phone', 'Klient:in – Notfallkontakt Telefon', 'client', 'Telefonnummer des Notfallkontakts.', '0171 000000', false, 'text', 'personal', true, now()),
('client.budget_45b_remaining', 'Klient:in – Restbudget §45b', 'client', 'Noch verfügbares Entlastungsbudget.', '131,00 €', false, 'money', 'health', true, now()),
('client.budget_45a_available', 'Klient:in – Umwandlungsanspruch §45a', 'client', 'Verfügbares Umwandlungsbudget.', 'max. 40 % Sachleistung', false, 'text', 'health', true, now()),
('client.portal_code', 'Klient:in – Portalcode', 'client', 'Portalzugangscode.', '123456', false, 'text', 'sensitive', true, now()),
('client.access_notes', 'Klient:in – Zugangshinweise', 'client', 'Hinweise zur Wohnung/zum Zugang.', 'Klingel links, 2. Etage', false, 'text', 'sensitive', true, now()),
('representative.full_name', 'Vertretung – Name', 'representative', 'Name der bevollmächtigten/gesetzlichen Vertretung.', 'Max Mustermann', false, 'text', 'personal', true, now()),
('representative.address_full', 'Vertretung – Anschrift', 'representative', 'Anschrift der Vertretung.', 'Beispielstraße 3, 44135 Dortmund', false, 'text', 'personal', true, now()),
('representative.email', 'Vertretung – E-Mail', 'representative', 'E-Mail der Vertretung.', 'vertretung@example.de', false, 'email', 'personal', true, now()),
('representative.phone', 'Vertretung – Telefon', 'representative', 'Telefon der Vertretung.', '0172 000000', false, 'text', 'personal', true, now()),
('assignment.date', 'Einsatz – Datum', 'assignment', 'Datum des Einsatzes.', '2026-07-15', false, 'date', 'service', true, now()),
('assignment.start_time', 'Einsatz – Beginn', 'assignment', 'Geplanter oder tatsächlicher Beginn.', '09:00', false, 'time', 'service', true, now()),
('assignment.end_time', 'Einsatz – Ende', 'assignment', 'Geplantes oder tatsächliches Ende.', '11:00', false, 'time', 'service', true, now()),
('assignment.duration_hours', 'Einsatz – Dauer Stunden', 'assignment', 'Dauer in Stunden.', '2,00', false, 'number', 'service', true, now()),
('assignment.location', 'Einsatz – Ort', 'assignment', 'Einsatzort.', 'Wohnung Klient:in', false, 'text', 'service', true, now()),
('assignment.address_full', 'Einsatz – Anschrift', 'assignment', 'Einsatzadresse.', 'Musterweg 2, 58452 Witten', false, 'text', 'sensitive', true, now()),
('assignment.service_type', 'Einsatz – Leistungsart', 'assignment', 'Betreuung/Entlastung/Haushalt.', 'Alltagsbegleitung', false, 'text', 'service', true, now()),
('assignment.tasks', 'Einsatz – Aufgaben', 'assignment', 'Aufgabenliste als Text.', 'Einkauf, Haushalt, Begleitung', false, 'text', 'service', true, now()),
('assignment.documentation', 'Einsatz – Dokumentation', 'assignment', 'Einsatzdokumentation.', 'Einsatz ordnungsgemäß durchgeführt.', false, 'text', 'service', true, now()),
('assignment.cancel_reason', 'Einsatz – Absagegrund', 'assignment', 'Grund der Absage/Verschiebung.', 'Klient:in verhindert', false, 'text', 'service', true, now()),
('payor.name', 'Kostenträger – Name', 'payor', 'Name der Pflegekasse/Krankenkasse oder sonstigen Stelle.', 'Bosch BKK', false, 'text', 'business', true, now()),
('payor.address_full', 'Kostenträger – Anschrift', 'payor', 'Anschrift des Kostenträgers.', 'Musterkasse, 00000 Musterstadt', false, 'text', 'business', true, now()),
('payor.email', 'Kostenträger – E-Mail', 'payor', 'E-Mail-Adresse.', 'pflegekasse@example.de', false, 'email', 'business', true, now()),
('payor.fax', 'Kostenträger – Fax', 'payor', 'Faxnummer.', '0000 000000', false, 'text', 'business', true, now()),
('payor.case_number', 'Kostenträger – Aktenzeichen', 'payor', 'Akten-/Vorgangsnummer.', 'AZ-12345', false, 'text', 'service', true, now()),
('invoice.number', 'Rechnung – Nummer', 'invoice', 'Rechnungsnummer.', 'RE-2026-001', false, 'text', 'business', true, now()),
('invoice.date', 'Rechnung – Datum', 'invoice', 'Rechnungsdatum.', '2026-07-31', false, 'date', 'business', true, now()),
('invoice.amount', 'Rechnung – Betrag', 'invoice', 'Rechnungsbetrag.', '131,00 €', false, 'money', 'business', true, now()),
('invoice.due_date', 'Rechnung – Fälligkeitsdatum', 'invoice', 'Zahlungsziel.', '2026-08-14', false, 'date', 'business', true, now()),
('invoice.period', 'Rechnung – Leistungsmonat', 'invoice', 'Abrechnungszeitraum.', 'Juli 2026', false, 'text', 'business', true, now()),
('document.title', 'Dokument – Titel', 'document', 'Titel des Dokuments.', 'Datenschutzerklärung', true, 'text', 'document', true, now()),
('document.date', 'Dokument – Datum', 'document', 'Erstellungsdatum.', '2026-07-05', false, 'date', 'document', true, now()),
('document.due_date', 'Dokument – Fälligkeitsdatum', 'document', 'Datum, bis wann unterschrieben werden soll.', '2026-07-15', false, 'date', 'document', true, now()),
('document.priority', 'Dokument – Priorität', 'document', 'Niedrig, Normal, Hoch, Dringend.', 'Normal', false, 'text', 'document', true, now()),
('document.signature_required', 'Dokument – Unterschrift erforderlich', 'document', 'Mitarbeiter, Klient, Beide oder Nein.', 'Mitarbeiter', false, 'text', 'document', true, now()),
('document.version', 'Dokument – Version', 'document', 'Vorlagen-/Dokumentversion.', '1.0', false, 'text', 'document', true, now()),
('office.full_name', 'Office – Bearbeiter:in', 'office', 'Name der verantwortlichen Office-Person.', 'Kevin Reinhardt', false, 'text', 'personal', true, now()),
('office.email', 'Office – E-Mail', 'office', 'Office-E-Mail.', 'info@helferhasen.com', false, 'email', 'business', true, now()),
('office.phone', 'Office – Telefon', 'office', 'Office-Telefon.', '0231 99 76 00 9-6', false, 'text', 'business', true, now())
on conflict (placeholder_key) do update set label = excluded.label, entity = excluded.entity, description = excluded.description, example = excluded.example, required_context = excluded.required_context, data_type = excluded.data_type, pii_level = excluded.pii_level, active = true, updated_at = now();

-- System-Vorlagen

select public.cs_seed_template(
  'employee_contracts',
  'employee_employment_contract_full',
  'Arbeitsvertrag – Standard Mitarbeitende',
  'Standard-Arbeitsvertrag mit Portal-, Datenschutz- und Dokumentationspflicht.',
  'Arbeitsvertrag',
  'employee',
  'employee',
  'high',
  true,
  ARRAY['arbeitsvertrag','mitarbeiter','onboarding']::text[],
  '<h1>Arbeitsvertrag – Standard Mitarbeitende</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Beginn und Tätigkeit</h2>
<p>Das Arbeitsverhältnis beginnt am {{employee.start_date}}. Die Tätigkeit erfolgt als {{employee.job_title}} im Bereich Betreuung, Entlastung, Haushalt oder Office nach Dienstplanung.</p>
<h2>Arbeitszeit und Vergütung</h2>
<p>Die regelmäßige Arbeitszeit beträgt {{employee.weekly_hours}} Stunden pro Woche. Die Vergütung beträgt {{employee.hourly_wage}} pro Stunde, soweit nicht abweichend vereinbart.</p>
<h2>Dokumentation und Portal</h2>
<p>Dienstplanung, Einsatzdaten, Arbeitszeit, Nachrichten, Dokumente und Unterschriften werden über CareSuite+ geführt. Die Nutzung ist arbeitsvertragliche Nebenpflicht.</p>
<h2>Datenschutz und Schweigepflicht</h2>
<p>Klient:innen-, Mandanten- und Betriebsdaten sind vertraulich zu behandeln. Daten dürfen nicht außerhalb freigegebener Systeme verarbeitet werden.</p>
<h2>Probezeit und Beendigung</h2>
<p>Die Probezeit endet am {{employee.probation_end}}. Kündigungsfristen richten sich nach Vertrag und Gesetz.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  3
);

select public.cs_seed_template(
  'employee_contracts',
  'employee_minijob_contract',
  'Arbeitsvertrag – Minijob',
  'Minijob-Vertrag mit variabler Einsatzplanung und Portalpflicht.',
  'Arbeitsvertrag',
  'employee',
  'employee',
  'high',
  true,
  ARRAY['minijob','arbeitsvertrag']::text[],
  '<h1>Arbeitsvertrag – Minijob</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Beginn und Tätigkeit</h2>
<p>Das Arbeitsverhältnis beginnt am {{employee.start_date}}. Die Tätigkeit erfolgt als {{employee.job_title}} im Bereich Betreuung, Entlastung, Haushalt oder Office nach Dienstplanung.</p>
<h2>Arbeitszeit und Vergütung</h2>
<p>Die regelmäßige Arbeitszeit beträgt {{employee.weekly_hours}} Stunden pro Woche. Die Vergütung beträgt {{employee.hourly_wage}} pro Stunde, soweit nicht abweichend vereinbart.</p>
<h2>Dokumentation und Portal</h2>
<p>Dienstplanung, Einsatzdaten, Arbeitszeit, Nachrichten, Dokumente und Unterschriften werden über CareSuite+ geführt. Die Nutzung ist arbeitsvertragliche Nebenpflicht.</p>
<h2>Datenschutz und Schweigepflicht</h2>
<p>Klient:innen-, Mandanten- und Betriebsdaten sind vertraulich zu behandeln. Daten dürfen nicht außerhalb freigegebener Systeme verarbeitet werden.</p>
<h2>Probezeit und Beendigung</h2>
<p>Die Probezeit endet am {{employee.probation_end}}. Kündigungsfristen richten sich nach Vertrag und Gesetz.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  3
);

select public.cs_seed_template(
  'employee_contracts',
  'employee_parttime_contract',
  'Arbeitsvertrag – Teilzeit',
  'Teilzeit-Vertrag mit Wochenstunden, Einsatzplanung und Dokumentationspflicht.',
  'Arbeitsvertrag',
  'employee',
  'employee',
  'high',
  true,
  ARRAY['teilzeit','arbeitsvertrag']::text[],
  '<h1>Arbeitsvertrag – Teilzeit</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Beginn und Tätigkeit</h2>
<p>Das Arbeitsverhältnis beginnt am {{employee.start_date}}. Die Tätigkeit erfolgt als {{employee.job_title}} im Bereich Betreuung, Entlastung, Haushalt oder Office nach Dienstplanung.</p>
<h2>Arbeitszeit und Vergütung</h2>
<p>Die regelmäßige Arbeitszeit beträgt {{employee.weekly_hours}} Stunden pro Woche. Die Vergütung beträgt {{employee.hourly_wage}} pro Stunde, soweit nicht abweichend vereinbart.</p>
<h2>Dokumentation und Portal</h2>
<p>Dienstplanung, Einsatzdaten, Arbeitszeit, Nachrichten, Dokumente und Unterschriften werden über CareSuite+ geführt. Die Nutzung ist arbeitsvertragliche Nebenpflicht.</p>
<h2>Datenschutz und Schweigepflicht</h2>
<p>Klient:innen-, Mandanten- und Betriebsdaten sind vertraulich zu behandeln. Daten dürfen nicht außerhalb freigegebener Systeme verarbeitet werden.</p>
<h2>Probezeit und Beendigung</h2>
<p>Die Probezeit endet am {{employee.probation_end}}. Kündigungsfristen richten sich nach Vertrag und Gesetz.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  3
);

select public.cs_seed_template(
  'employee_contracts',
  'employee_additional_agreement',
  'Zusatzvereinbarung zum Arbeitsvertrag',
  'Ergänzung zu bestehenden Arbeitsbedingungen, Portalnutzung oder Einsatzregeln.',
  'Zusatzvereinbarung',
  'employee',
  'employee',
  'normal',
  false,
  ARRAY['zusatzvereinbarung']::text[],
  '<h1>Zusatzvereinbarung zum Arbeitsvertrag</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Vertragsparteien</h2>
<p>Dieses Dokument wird zwischen {{tenant.legal_name}}, vertreten durch {{tenant.ceo_name}}, und der oben genannten Person geschlossen.</p>
<h2>Gegenstand</h2>
<p>Geregelt werden Umfang, Pflichten, Kommunikation, Dokumentation, Datenschutz und die verbindliche Nutzung des CareSuite+ Portals.</p>
<h2>Portalpflicht</h2>
<p>Dokumente, Einsatzinformationen, Nachrichten und Unterschriften werden über das Portal bereitgestellt und nach Abschluss revisionssicher an das Office zurückgeführt.</p>
<h2>Datenschutz</h2>
<p>Personenbezogene Daten werden nur zweckgebunden verarbeitet. Zugriff erhält nur, wer fachlich und organisatorisch berechtigt ist.</p>
<h2>Schlussbestimmungen</h2>
<p>Änderungen bedürfen der Textform. Gesetzliche Rechte bleiben unberührt.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  7
);

select public.cs_seed_template(
  'employee_contracts',
  'employee_confidentiality',
  'Schweigepflichtverpflichtung Mitarbeitende',
  'Verpflichtung zur Verschwiegenheit über Klient:innen-, Gesundheits-, Betriebs- und Abrechnungsdaten.',
  'Schweigepflicht',
  'employee',
  'employee',
  'high',
  true,
  ARRAY['schweigepflicht','datenschutz']::text[],
  '<h1>Schweigepflichtverpflichtung Mitarbeitende</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Zweck</h2>
<p>Diese Unterweisung dient der sicheren, datenschutzkonformen und fachlich einheitlichen Durchführung der Tätigkeiten.</p>
<h2>Pflichten</h2>
<p>Die genannten Vorgaben sind verbindlich einzuhalten. Abweichungen, Risiken oder besondere Vorkommnisse sind unverzüglich an das Office zu melden.</p>
<h2>Portal und Dokumentation</h2>
<p>Einsatzzeiten, Aufgabenstatus, Dokumentation, Nachrichten und Unterschriften sind vollständig im Portal zu führen.</p>
<h2>Bestätigung</h2>
<p>Mit der Unterschrift wird bestätigt, dass Inhalt, Bedeutung und Konsequenzen verstanden wurden.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  2
);

select public.cs_seed_template(
  'employee_contracts',
  'employee_data_protection',
  'Datenschutzverpflichtung Mitarbeitende',
  'DSGVO-Verpflichtung mit Regeln zu mobilen Geräten, Messenger, Fotos und Portalnutzung.',
  'Datenschutz',
  'employee',
  'employee',
  'high',
  true,
  ARRAY['dsgvo','datenschutz']::text[],
  '<h1>Datenschutzverpflichtung Mitarbeitende</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Zweck</h2>
<p>Diese Unterweisung dient der sicheren, datenschutzkonformen und fachlich einheitlichen Durchführung der Tätigkeiten.</p>
<h2>Pflichten</h2>
<p>Die genannten Vorgaben sind verbindlich einzuhalten. Abweichungen, Risiken oder besondere Vorkommnisse sind unverzüglich an das Office zu melden.</p>
<h2>Portal und Dokumentation</h2>
<p>Einsatzzeiten, Aufgabenstatus, Dokumentation, Nachrichten und Unterschriften sind vollständig im Portal zu führen.</p>
<h2>Bestätigung</h2>
<p>Mit der Unterschrift wird bestätigt, dass Inhalt, Bedeutung und Konsequenzen verstanden wurden.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  2
);

select public.cs_seed_template(
  'quality_compliance',
  'employee_health_safety_instruction',
  'Unterweisung Arbeitsschutz',
  'Unterweisung zu sicheren Arbeitsabläufen, Wegezeiten, Haushaltsrisiken und Meldepflichten.',
  'Belehrung',
  'employee',
  'employee',
  'high',
  true,
  ARRAY['arbeitsschutz','unterweisung']::text[],
  '<h1>Unterweisung Arbeitsschutz</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Zweck</h2>
<p>Diese Unterweisung dient der sicheren, datenschutzkonformen und fachlich einheitlichen Durchführung der Tätigkeiten.</p>
<h2>Pflichten</h2>
<p>Die genannten Vorgaben sind verbindlich einzuhalten. Abweichungen, Risiken oder besondere Vorkommnisse sind unverzüglich an das Office zu melden.</p>
<h2>Portal und Dokumentation</h2>
<p>Einsatzzeiten, Aufgabenstatus, Dokumentation, Nachrichten und Unterschriften sind vollständig im Portal zu führen.</p>
<h2>Bestätigung</h2>
<p>Mit der Unterschrift wird bestätigt, dass Inhalt, Bedeutung und Konsequenzen verstanden wurden.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  7
);

select public.cs_seed_template(
  'quality_compliance',
  'employee_hygiene_instruction',
  'Hygieneunterweisung',
  'Unterweisung zu Hygiene, Infektionsschutz, Handschuhen, Desinfektion und Haushaltskontakt.',
  'Belehrung',
  'employee',
  'employee',
  'high',
  true,
  ARRAY['hygiene','infektionsschutz']::text[],
  '<h1>Hygieneunterweisung</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Zweck</h2>
<p>Diese Unterweisung dient der sicheren, datenschutzkonformen und fachlich einheitlichen Durchführung der Tätigkeiten.</p>
<h2>Pflichten</h2>
<p>Die genannten Vorgaben sind verbindlich einzuhalten. Abweichungen, Risiken oder besondere Vorkommnisse sind unverzüglich an das Office zu melden.</p>
<h2>Portal und Dokumentation</h2>
<p>Einsatzzeiten, Aufgabenstatus, Dokumentation, Nachrichten und Unterschriften sind vollständig im Portal zu führen.</p>
<h2>Bestätigung</h2>
<p>Mit der Unterschrift wird bestätigt, dass Inhalt, Bedeutung und Konsequenzen verstanden wurden.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  7
);

select public.cs_seed_template(
  'employee_contracts',
  'employee_vehicle_driving_policy',
  'Fahrzeug- und Fahrtenregelung',
  'Regelung für private/geschäftliche Fahrten, Fahrtenbuch und Verhalten bei Schäden.',
  'Vereinbarung',
  'employee',
  'employee',
  'normal',
  false,
  ARRAY['fahrzeug','fahrtenbuch']::text[],
  '<h1>Fahrzeug- und Fahrtenregelung</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Zweck</h2>
<p>Diese Unterweisung dient der sicheren, datenschutzkonformen und fachlich einheitlichen Durchführung der Tätigkeiten.</p>
<h2>Pflichten</h2>
<p>Die genannten Vorgaben sind verbindlich einzuhalten. Abweichungen, Risiken oder besondere Vorkommnisse sind unverzüglich an das Office zu melden.</p>
<h2>Portal und Dokumentation</h2>
<p>Einsatzzeiten, Aufgabenstatus, Dokumentation, Nachrichten und Unterschriften sind vollständig im Portal zu führen.</p>
<h2>Bestätigung</h2>
<p>Mit der Unterschrift wird bestätigt, dass Inhalt, Bedeutung und Konsequenzen verstanden wurden.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  7
);

select public.cs_seed_template(
  'employee_contracts',
  'employee_key_handover',
  'Schlüsselübergabe Mitarbeitende',
  'Dokumentation über erhaltene Schlüssel, Transponder oder Zugangsmittel.',
  'Übergabe',
  'employee',
  'employee',
  'high',
  false,
  ARRAY['schlüssel','übergabe']::text[],
  '<h1>Schlüsselübergabe Mitarbeitende</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Zweck</h2>
<p>Diese Unterweisung dient der sicheren, datenschutzkonformen und fachlich einheitlichen Durchführung der Tätigkeiten.</p>
<h2>Pflichten</h2>
<p>Die genannten Vorgaben sind verbindlich einzuhalten. Abweichungen, Risiken oder besondere Vorkommnisse sind unverzüglich an das Office zu melden.</p>
<h2>Portal und Dokumentation</h2>
<p>Einsatzzeiten, Aufgabenstatus, Dokumentation, Nachrichten und Unterschriften sind vollständig im Portal zu führen.</p>
<h2>Bestätigung</h2>
<p>Mit der Unterschrift wird bestätigt, dass Inhalt, Bedeutung und Konsequenzen verstanden wurden.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  1
);

select public.cs_seed_template(
  'employee_contracts',
  'employee_device_handover',
  'Geräteübergabe Mitarbeitende',
  'Übergabe von Diensthandy, Tablet, Zubehör oder Zugangsdaten.',
  'Übergabe',
  'employee',
  'employee',
  'normal',
  false,
  ARRAY['gerät','diensthandy','übergabe']::text[],
  '<h1>Geräteübergabe Mitarbeitende</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Zweck</h2>
<p>Diese Unterweisung dient der sicheren, datenschutzkonformen und fachlich einheitlichen Durchführung der Tätigkeiten.</p>
<h2>Pflichten</h2>
<p>Die genannten Vorgaben sind verbindlich einzuhalten. Abweichungen, Risiken oder besondere Vorkommnisse sind unverzüglich an das Office zu melden.</p>
<h2>Portal und Dokumentation</h2>
<p>Einsatzzeiten, Aufgabenstatus, Dokumentation, Nachrichten und Unterschriften sind vollständig im Portal zu führen.</p>
<h2>Bestätigung</h2>
<p>Mit der Unterschrift wird bestätigt, dass Inhalt, Bedeutung und Konsequenzen verstanden wurden.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  1
);

select public.cs_seed_template(
  'employee_hr',
  'employee_onboarding_checklist',
  'Onboarding-Checkliste Mitarbeitende',
  'Checkliste für Unterlagen, Portalzugang, Unterweisungen und erste Einsätze.',
  'Checkliste',
  'employee',
  'employee',
  'normal',
  true,
  ARRAY['onboarding','checkliste']::text[],
  '<h1>Onboarding-Checkliste Mitarbeitende</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Zweck</h2>
<p>Diese Unterweisung dient der sicheren, datenschutzkonformen und fachlich einheitlichen Durchführung der Tätigkeiten.</p>
<h2>Pflichten</h2>
<p>Die genannten Vorgaben sind verbindlich einzuhalten. Abweichungen, Risiken oder besondere Vorkommnisse sind unverzüglich an das Office zu melden.</p>
<h2>Portal und Dokumentation</h2>
<p>Einsatzzeiten, Aufgabenstatus, Dokumentation, Nachrichten und Unterschriften sind vollständig im Portal zu führen.</p>
<h2>Bestätigung</h2>
<p>Mit der Unterschrift wird bestätigt, dass Inhalt, Bedeutung und Konsequenzen verstanden wurden.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  5
);

select public.cs_seed_template(
  'employee_hr',
  'employee_policy_acknowledgement',
  'Bestätigung Dienstanweisung',
  'Bestätigung einer konkreten Dienstanweisung oder Regeländerung.',
  'Bestätigung',
  'employee',
  'employee',
  'high',
  false,
  ARRAY['dienstanweisung']::text[],
  '<h1>Bestätigung Dienstanweisung</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Zweck</h2>
<p>Diese Unterweisung dient der sicheren, datenschutzkonformen und fachlich einheitlichen Durchführung der Tätigkeiten.</p>
<h2>Pflichten</h2>
<p>Die genannten Vorgaben sind verbindlich einzuhalten. Abweichungen, Risiken oder besondere Vorkommnisse sind unverzüglich an das Office zu melden.</p>
<h2>Portal und Dokumentation</h2>
<p>Einsatzzeiten, Aufgabenstatus, Dokumentation, Nachrichten und Unterschriften sind vollständig im Portal zu führen.</p>
<h2>Bestätigung</h2>
<p>Mit der Unterschrift wird bestätigt, dass Inhalt, Bedeutung und Konsequenzen verstanden wurden.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  2
);

select public.cs_seed_template(
  'employee_hr',
  'employee_work_time_agreement',
  'Arbeitszeit- und Zeiterfassungsvereinbarung',
  'Regeln zur Zeiterfassung, Korrektur, Verspätung, Krankheit und Einsatzzeit.',
  'Vereinbarung',
  'employee',
  'employee',
  'high',
  true,
  ARRAY['arbeitszeit','zeiterfassung']::text[],
  '<h1>Arbeitszeit- und Zeiterfassungsvereinbarung</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Zweck</h2>
<p>Diese Unterweisung dient der sicheren, datenschutzkonformen und fachlich einheitlichen Durchführung der Tätigkeiten.</p>
<h2>Pflichten</h2>
<p>Die genannten Vorgaben sind verbindlich einzuhalten. Abweichungen, Risiken oder besondere Vorkommnisse sind unverzüglich an das Office zu melden.</p>
<h2>Portal und Dokumentation</h2>
<p>Einsatzzeiten, Aufgabenstatus, Dokumentation, Nachrichten und Unterschriften sind vollständig im Portal zu führen.</p>
<h2>Bestätigung</h2>
<p>Mit der Unterschrift wird bestätigt, dass Inhalt, Bedeutung und Konsequenzen verstanden wurden.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  3
);

select public.cs_seed_template(
  'employee_hr',
  'employee_vacation_request',
  'Urlaubsantrag Mitarbeitende',
  'Formular zur Beantragung, Prüfung und Genehmigung von Urlaub.',
  'Antrag',
  'employee',
  'employee',
  'normal',
  false,
  ARRAY['urlaub','antrag']::text[],
  '<h1>Urlaubsantrag Mitarbeitende</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Sachverhalt</h2>
<p>Der Vorgang wird mit den zum Zeitpunkt der Erstellung vorliegenden Informationen dokumentiert.</p>
<h2>Prüfung</h2>
<p>Die verantwortliche Stelle prüft Datenlage, Fristen, Nachweise, Kommunikation und erforderliche Folgemaßnahmen.</p>
<h2>Entscheidung</h2>
<p>Die Entscheidung und weitere Bearbeitung erfolgen nach fachlicher, organisatorischer und rechtlicher Bewertung.</p>
<h2>Ablage</h2>
<p>Das Dokument wird der passenden Akte zugeordnet und revisionssicher gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  14
);

select public.cs_seed_template(
  'employee_hr',
  'employee_sick_note_notice',
  'Krankmeldung und Nachweispflicht',
  'Hinweis-/Bestätigungsdokument zu Krankmeldung, AU und Meldefristen.',
  'Hinweis',
  'employee',
  'employee',
  'high',
  false,
  ARRAY['krankmeldung','au']::text[],
  '<h1>Krankmeldung und Nachweispflicht</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Zweck</h2>
<p>Diese Unterweisung dient der sicheren, datenschutzkonformen und fachlich einheitlichen Durchführung der Tätigkeiten.</p>
<h2>Pflichten</h2>
<p>Die genannten Vorgaben sind verbindlich einzuhalten. Abweichungen, Risiken oder besondere Vorkommnisse sind unverzüglich an das Office zu melden.</p>
<h2>Portal und Dokumentation</h2>
<p>Einsatzzeiten, Aufgabenstatus, Dokumentation, Nachrichten und Unterschriften sind vollständig im Portal zu führen.</p>
<h2>Bestätigung</h2>
<p>Mit der Unterschrift wird bestätigt, dass Inhalt, Bedeutung und Konsequenzen verstanden wurden.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  1
);

select public.cs_seed_template(
  'employee_hr',
  'employee_warning',
  'Abmahnung Mitarbeitende',
  'Formelle Abmahnung mit Sachverhalt, Pflichtverletzung und Erwartung.',
  'Abmahnung',
  'employee',
  'employee',
  'urgent',
  false,
  ARRAY['abmahnung','personal']::text[],
  '<h1>Abmahnung Mitarbeitende</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Sachverhalt</h2>
<p>Der Vorgang wird mit den zum Zeitpunkt der Erstellung vorliegenden Informationen dokumentiert.</p>
<h2>Prüfung</h2>
<p>Die verantwortliche Stelle prüft Datenlage, Fristen, Nachweise, Kommunikation und erforderliche Folgemaßnahmen.</p>
<h2>Entscheidung</h2>
<p>Die Entscheidung und weitere Bearbeitung erfolgen nach fachlicher, organisatorischer und rechtlicher Bewertung.</p>
<h2>Ablage</h2>
<p>Das Dokument wird der passenden Akte zugeordnet und revisionssicher gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  2
);

select public.cs_seed_template(
  'employee_hr',
  'employee_termination_acknowledgement',
  'Kündigungsbestätigung Mitarbeitende',
  'Bestätigung des Zugangs einer Kündigung und Rückgabe offener Gegenstände.',
  'Kündigung',
  'employee',
  'employee',
  'urgent',
  false,
  ARRAY['kündigung','austritt']::text[],
  '<h1>Kündigungsbestätigung Mitarbeitende</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Sachverhalt</h2>
<p>Der Vorgang wird mit den zum Zeitpunkt der Erstellung vorliegenden Informationen dokumentiert.</p>
<h2>Prüfung</h2>
<p>Die verantwortliche Stelle prüft Datenlage, Fristen, Nachweise, Kommunikation und erforderliche Folgemaßnahmen.</p>
<h2>Entscheidung</h2>
<p>Die Entscheidung und weitere Bearbeitung erfolgen nach fachlicher, organisatorischer und rechtlicher Bewertung.</p>
<h2>Ablage</h2>
<p>Das Dokument wird der passenden Akte zugeordnet und revisionssicher gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  2
);

select public.cs_seed_template(
  'employee_hr',
  'employee_training_confirmation',
  'Teilnahmebestätigung Schulung',
  'Bestätigung einer internen Schulung oder Pflichtunterweisung.',
  'Schulung',
  'employee',
  'employee',
  'normal',
  false,
  ARRAY['schulung','bestätigung']::text[],
  '<h1>Teilnahmebestätigung Schulung</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Zweck</h2>
<p>Diese Unterweisung dient der sicheren, datenschutzkonformen und fachlich einheitlichen Durchführung der Tätigkeiten.</p>
<h2>Pflichten</h2>
<p>Die genannten Vorgaben sind verbindlich einzuhalten. Abweichungen, Risiken oder besondere Vorkommnisse sind unverzüglich an das Office zu melden.</p>
<h2>Portal und Dokumentation</h2>
<p>Einsatzzeiten, Aufgabenstatus, Dokumentation, Nachrichten und Unterschriften sind vollständig im Portal zu führen.</p>
<h2>Bestätigung</h2>
<p>Mit der Unterschrift wird bestätigt, dass Inhalt, Bedeutung und Konsequenzen verstanden wurden.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  7
);

select public.cs_seed_template(
  'portal_communication',
  'employee_portal_access_letter',
  'Portalzugang Mitarbeitende',
  'Zugangsinformationen und Nutzungsregeln für das Mitarbeiterportal.',
  'Portal',
  'employee',
  'employee',
  'high',
  true,
  ARRAY['portal','zugang']::text[],
  '<h1>Portalzugang Mitarbeitende</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Zweck</h2>
<p>Diese Unterweisung dient der sicheren, datenschutzkonformen und fachlich einheitlichen Durchführung der Tätigkeiten.</p>
<h2>Pflichten</h2>
<p>Die genannten Vorgaben sind verbindlich einzuhalten. Abweichungen, Risiken oder besondere Vorkommnisse sind unverzüglich an das Office zu melden.</p>
<h2>Portal und Dokumentation</h2>
<p>Einsatzzeiten, Aufgabenstatus, Dokumentation, Nachrichten und Unterschriften sind vollständig im Portal zu führen.</p>
<h2>Bestätigung</h2>
<p>Mit der Unterschrift wird bestätigt, dass Inhalt, Bedeutung und Konsequenzen verstanden wurden.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  1
);

select public.cs_seed_template(
  'incident_damage',
  'employee_accident_report',
  'Unfallmeldung Mitarbeitende',
  'Meldung eines Arbeits-, Wege- oder Einsatzunfalls.',
  'Vorfällmeldung',
  'employee',
  'employee',
  'urgent',
  false,
  ARRAY['unfall','meldung']::text[],
  '<h1>Unfallmeldung Mitarbeitende</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Sachverhalt</h2>
<p>Der Vorgang wird mit den zum Zeitpunkt der Erstellung vorliegenden Informationen dokumentiert.</p>
<h2>Prüfung</h2>
<p>Die verantwortliche Stelle prüft Datenlage, Fristen, Nachweise, Kommunikation und erforderliche Folgemaßnahmen.</p>
<h2>Entscheidung</h2>
<p>Die Entscheidung und weitere Bearbeitung erfolgen nach fachlicher, organisatorischer und rechtlicher Bewertung.</p>
<h2>Ablage</h2>
<p>Das Dokument wird der passenden Akte zugeordnet und revisionssicher gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  1
);

select public.cs_seed_template(
  'client_contracts',
  'client_service_contract',
  'Betreuungs- und Entlastungsvertrag',
  'Grundvertrag für Klient:innen mit Leistungen, Abrechnung, Portal und Nachweisen.',
  'Betreuungsvertrag',
  'client',
  'client',
  'high',
  true,
  ARRAY['vertrag','klient']::text[],
  '<h1>Betreuungs- und Entlastungsvertrag</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Vertragsparteien</h2>
<p>Der Vertrag wird zwischen {{tenant.legal_name}}, vertreten durch {{tenant.ceo_name}}, und {{client.full_name}} geschlossen. Eine Vertretung handelt, sofern hinterlegt, durch {{representative.full_name}}.</p>
<h2>Leistungen</h2>
<p>Vereinbart werden Leistungen im Bereich Alltagsbegleitung, haushaltsnahe Unterstützung, Entlastung pflegender Angehöriger und individuelle Hilfen nach Auftrag.</p>
<h2>Budget und Abrechnung</h2>
<p>Die Abrechnung erfolgt je nach Anspruch über Entlastungsbetrag, Umwandlungsanspruch, Selbstzahlung oder Kostenträger. Hinterlegte Pflegekasse: {{client.insurance_name}}.</p>
<h2>Portal und Unterschriften</h2>
<p>Dokumente, Einsatzübersicht, Nachrichten und Leistungsnachweise können im Portal bereitgestellt und digital unterschrieben werden.</p>
<h2>Kündigung und Änderungen</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung oder gewünschten Leistungen sind unverzüglich mitzuteilen.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  3
);

select public.cs_seed_template(
  'client_contracts',
  'client_data_protection_consent',
  'Datenschutzerklärung und Einwilligung Klient:in',
  'DSGVO-Information und Einwilligung zur Datenverarbeitung im Rahmen der Leistung.',
  'Datenschutz',
  'client',
  'client',
  'high',
  true,
  ARRAY['dsgvo','einwilligung']::text[],
  '<h1>Datenschutzerklärung und Einwilligung Klient:in</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  3
);

select public.cs_seed_template(
  'client_contracts',
  'client_power_of_attorney_cost_carrier',
  'Vollmacht Kostenträgerkommunikation',
  'Vollmacht zur Kommunikation mit Pflegekasse/Kostenträgern und zur Einreichung von Unterlagen.',
  'Vollmacht',
  'client',
  'client',
  'high',
  false,
  ARRAY['vollmacht','kostenträger']::text[],
  '<h1>Vollmacht Kostenträgerkommunikation</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  3
);

select public.cs_seed_template(
  'client_contracts',
  'client_release_confidentiality',
  'Schweigepflichtentbindung',
  'Entbindung zur Kommunikation mit Angehörigen, Ärzten, Betreuern oder Kostenträgern.',
  'Einwilligung',
  'client',
  'client',
  'high',
  false,
  ARRAY['schweigepflicht','entbindung']::text[],
  '<h1>Schweigepflichtentbindung</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  3
);

select public.cs_seed_template(
  'client_contracts',
  'client_sepa_mandate',
  'SEPA-Lastschriftmandat',
  'Mandat für Selbstzahleranteile, Zuzahlungen oder private Leistungen.',
  'SEPA',
  'client',
  'client',
  'normal',
  false,
  ARRAY['sepa','zahlung']::text[],
  '<h1>SEPA-Lastschriftmandat</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  7
);

select public.cs_seed_template(
  'client_contracts',
  'client_cancellation_instruction',
  'Widerrufsbelehrung und Verbraucherinformation',
  'Information zu Widerruf, Leistungsbeginn und Verbraucherrechten.',
  'Belehrung',
  'client',
  'client',
  'high',
  true,
  ARRAY['widerruf','verbraucher']::text[],
  '<h1>Widerrufsbelehrung und Verbraucherinformation</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  3
);

select public.cs_seed_template(
  'client_care',
  'client_initial_assessment',
  'Aufnahmebogen Klient:in',
  'Strukturierter Aufnahmebogen mit Stammdaten, Pflegegrad, Kostenträger, Notfall und Wünschen.',
  'Aufnahme',
  'client',
  'client',
  'high',
  true,
  ARRAY['aufnahme','stammdaten']::text[],
  '<h1>Aufnahmebogen Klient:in</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  3
);

select public.cs_seed_template(
  'client_care',
  'client_emergency_sheet',
  'Notfallblatt Klient:in',
  'Notfallkontakte, Besonderheiten, Risiken und wichtige Hinweise für Einsätze.',
  'Notfallblatt',
  'client',
  'client',
  'high',
  true,
  ARRAY['notfall','einsatz']::text[],
  '<h1>Notfallblatt Klient:in</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  3
);

select public.cs_seed_template(
  'client_care',
  'client_care_plan_household_assistance',
  'Hilfeplan Haushalt und Betreuung',
  'Vereinbarter Hilfeplan mit Aufgaben, Wünschen, Grenzen und Dokumentationshinweisen.',
  'Hilfeplan',
  'client',
  'client',
  'high',
  true,
  ARRAY['hilfeplan','aufgaben']::text[],
  '<h1>Hilfeplan Haushalt und Betreuung</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  5
);

select public.cs_seed_template(
  'client_care',
  'client_risk_assessment',
  'Risikoeinschätzung Haushalt/Einsatz',
  'Bewertung von Sturz-, Hygiene-, Zugang-, Haustier-, Konflikt- und Umgebungsrisiken.',
  'Risikoeinschätzung',
  'client',
  'client',
  'high',
  false,
  ARRAY['risiko','qm']::text[],
  '<h1>Risikoeinschätzung Haushalt/Einsatz</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  5
);

select public.cs_seed_template(
  'client_care',
  'client_medication_note',
  'Medikations- und Gesundheitshinweis',
  'Hinweisblatt zu bekannten Medikations- und Gesundheitsinformationen ohne pflegerische Anordnung.',
  'Hinweis',
  'client',
  'client',
  'normal',
  false,
  ARRAY['medikation','gesundheit']::text[],
  '<h1>Medikations- und Gesundheitshinweis</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  5
);

select public.cs_seed_template(
  'client_care',
  'client_key_handover',
  'Schlüsselübergabe Klient:in',
  'Dokumentation über Schlüssel, Transponder oder Zugangscodes von Klient:innen.',
  'Übergabe',
  'client',
  'client',
  'high',
  false,
  ARRAY['schlüssel','zugang']::text[],
  '<h1>Schlüsselübergabe Klient:in</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  1
);

select public.cs_seed_template(
  'client_contracts',
  'client_budget_advice_45b',
  'Beratung Entlastungsbetrag §45b',
  'Information zum Entlastungsbetrag, Budgetnutzung und Abrechnung.',
  'Beratung',
  'client',
  'client',
  'normal',
  false,
  ARRAY['45b','budget']::text[],
  '<h1>Beratung Entlastungsbetrag §45b</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  7
);

select public.cs_seed_template(
  'client_contracts',
  'client_budget_conversion_45a',
  'Beratung Umwandlungsanspruch §45a',
  'Information zur Nutzung von bis zu 40 Prozent ambulanter Sachleistungen.',
  'Beratung',
  'client',
  'client',
  'normal',
  false,
  ARRAY['45a','umwandlung']::text[],
  '<h1>Beratung Umwandlungsanspruch §45a</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  7
);

select public.cs_seed_template(
  'client_care',
  'client_home_visit_protocol',
  'Hausbesuchsprotokoll',
  'Protokoll einer Neuaufnahme, Beratung, Beschwerde oder Qualitätskontrolle beim Klienten.',
  'Protokoll',
  'client',
  'client',
  'normal',
  false,
  ARRAY['hausbesuch','protokoll']::text[],
  '<h1>Hausbesuchsprotokoll</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  7
);

select public.cs_seed_template(
  'assignments_proofs',
  'client_assignment_confirmation',
  'Einsatzbestätigung Klient:in',
  'Bestätigung geplanter wiederkehrender Einsätze und Leistungsumfang.',
  'Einsatz',
  'client',
  'client',
  'normal',
  false,
  ARRAY['einsatz','bestätigung']::text[],
  '<h1>Einsatzbestätigung Klient:in</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  7
);

select public.cs_seed_template(
  'assignments_proofs',
  'client_service_proof_single',
  'Leistungsnachweis Einzelnachweis',
  'Einzelnachweis für einen konkreten Einsatz mit Zeiten, Aufgaben, Doku und Unterschrift.',
  'Leistungsnachweis',
  'both',
  'both',
  'high',
  true,
  ARRAY['leistungsnachweis','einsatz']::text[],
  '<h1>Leistungsnachweis Einzelnachweis</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Einsatzdaten</h2>
<p>Datum: {{assignment.date}}, Beginn: {{assignment.start_time}}, Ende: {{assignment.end_time}}, Dauer: {{assignment.duration_hours}} Stunden, Leistungsart: {{assignment.service_type}}.</p>
<h2>Aufgaben</h2>
<p>Durchgeführte Aufgaben: {{assignment.tasks}}.</p>
<h2>Dokumentation</h2>
<p>Dokumentation: {{assignment.documentation}}.</p>
<h2>Bestätigung</h2>
<p>Mitarbeiter:in und Klient:in bestätigen die Richtigkeit der Angaben.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}, {"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 2}]'::jsonb,
  1
);

select public.cs_seed_template(
  'assignments_proofs',
  'client_service_proof_monthly',
  'Leistungsnachweis Monatsnachweis',
  'Monatsnachweis mit zusammengefassten Einsätzen, Budget und Unterschrift.',
  'Leistungsnachweis',
  'client',
  'client',
  'high',
  true,
  ARRAY['monatsnachweis','abrechnung']::text[],
  '<h1>Leistungsnachweis Monatsnachweis</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  5
);

select public.cs_seed_template(
  'assignments_proofs',
  'client_signature_sheet',
  'Unterschriftenblatt Klient:in',
  'Separates Unterschriftenblatt für Portal- oder Papierprozesse.',
  'Unterschrift',
  'client',
  'client',
  'normal',
  false,
  ARRAY['unterschrift']::text[],
  '<h1>Unterschriftenblatt Klient:in</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  3
);

select public.cs_seed_template(
  'client_care',
  'client_complaint_form',
  'Beschwerdeformular Klient:in',
  'Formular zur Erfassung und Bearbeitung einer Beschwerde oder Rückmeldung.',
  'Beschwerde',
  'client',
  'client',
  'normal',
  false,
  ARRAY['beschwerde','feedback']::text[],
  '<h1>Beschwerdeformular Klient:in</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  7
);

select public.cs_seed_template(
  'client_contracts',
  'client_termination_service_contract',
  'Kündigung Betreuungsvertrag',
  'Kündigung oder Vertragsbeendigung aus Sicht Klient:in oder Dienstleister.',
  'Kündigung',
  'client',
  'client',
  'urgent',
  false,
  ARRAY['kündigung','vertrag']::text[],
  '<h1>Kündigung Betreuungsvertrag</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Sachverhalt</h2>
<p>Der Vorgang wird mit den zum Zeitpunkt der Erstellung vorliegenden Informationen dokumentiert.</p>
<h2>Prüfung</h2>
<p>Die verantwortliche Stelle prüft Datenlage, Fristen, Nachweise, Kommunikation und erforderliche Folgemaßnahmen.</p>
<h2>Entscheidung</h2>
<p>Die Entscheidung und weitere Bearbeitung erfolgen nach fachlicher, organisatorischer und rechtlicher Bewertung.</p>
<h2>Ablage</h2>
<p>Das Dokument wird der passenden Akte zugeordnet und revisionssicher gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  3
);

select public.cs_seed_template(
  'payor_insurance',
  'payor_cost_coverage_request',
  'Kostenübernahme-Anfrage Pflegekasse',
  'Anfrage an Pflegekasse/Kostenträger zur Kostenübernahme oder Budgetbestätigung.',
  'Kostenträger',
  'client',
  'client',
  'normal',
  false,
  ARRAY['pflegekasse','kostenübernahme']::text[],
  '<h1>Kostenübernahme-Anfrage Pflegekasse</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  7
);

select public.cs_seed_template(
  'payor_insurance',
  'payor_invoice_cover_letter',
  'Anschreiben Rechnung an Kostenträger',
  'Begleitschreiben zur Rechnung mit Leistungszeitraum, Betrag und Kontodaten.',
  'Abrechnung',
  'client',
  'client',
  'normal',
  false,
  ARRAY['rechnung','kostenträger']::text[],
  '<h1>Anschreiben Rechnung an Kostenträger</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Rechnung</h2>
<p>Rechnungsnummer {{invoice.number}} vom {{invoice.date}} über {{invoice.amount}} für den Zeitraum {{invoice.period}}.</p>
<h2>Zahlung</h2>
<p>Bitte überweisen Sie den Betrag bis {{invoice.due_date}} auf {{tenant.iban}} / {{tenant.bic}}.</p>
<h2>Zuordnung</h2>
<p>Klient:in: {{client.full_name}}, Versichertennummer: {{client.insurance_number}}, Pflegekasse: {{payor.name}}, Aktenzeichen: {{payor.case_number}}.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  14
);

select public.cs_seed_template(
  'payor_insurance',
  'payor_payment_reminder_friendly',
  'Zahlungserinnerung freundlich',
  'Freundliche Erinnerung an offene Rechnung oder fehlende Erstattung.',
  'Mahnung',
  'client',
  'client',
  'normal',
  false,
  ARRAY['zahlungserinnerung']::text[],
  '<h1>Zahlungserinnerung freundlich</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Sachverhalt</h2>
<p>Der Vorgang wird mit den zum Zeitpunkt der Erstellung vorliegenden Informationen dokumentiert.</p>
<h2>Prüfung</h2>
<p>Die verantwortliche Stelle prüft Datenlage, Fristen, Nachweise, Kommunikation und erforderliche Folgemaßnahmen.</p>
<h2>Entscheidung</h2>
<p>Die Entscheidung und weitere Bearbeitung erfolgen nach fachlicher, organisatorischer und rechtlicher Bewertung.</p>
<h2>Ablage</h2>
<p>Das Dokument wird der passenden Akte zugeordnet und revisionssicher gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  7
);

select public.cs_seed_template(
  'payor_insurance',
  'payor_last_reminder',
  'Letzte außergerichtliche Mahnung',
  'Letzte Mahnung vor Inkasso/Rechtsverfolgung mit Fristsetzung.',
  'Mahnung',
  'client',
  'client',
  'urgent',
  false,
  ARRAY['mahnung','inkasso']::text[],
  '<h1>Letzte außergerichtliche Mahnung</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Sachverhalt</h2>
<p>Der Vorgang wird mit den zum Zeitpunkt der Erstellung vorliegenden Informationen dokumentiert.</p>
<h2>Prüfung</h2>
<p>Die verantwortliche Stelle prüft Datenlage, Fristen, Nachweise, Kommunikation und erforderliche Folgemaßnahmen.</p>
<h2>Entscheidung</h2>
<p>Die Entscheidung und weitere Bearbeitung erfolgen nach fachlicher, organisatorischer und rechtlicher Bewertung.</p>
<h2>Ablage</h2>
<p>Das Dokument wird der passenden Akte zugeordnet und revisionssicher gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  3
);

select public.cs_seed_template(
  'payor_insurance',
  'payor_objection_care_fund',
  'Widerspruch/Einwand Pflegekasse',
  'Vorlage für Widerspruch oder sachlichen Einwand gegenüber Pflegekasse/Kostenträger.',
  'Widerspruch',
  'client',
  'client',
  'high',
  false,
  ARRAY['widerspruch','pflegekasse']::text[],
  '<h1>Widerspruch/Einwand Pflegekasse</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Sachverhalt</h2>
<p>Der Vorgang wird mit den zum Zeitpunkt der Erstellung vorliegenden Informationen dokumentiert.</p>
<h2>Prüfung</h2>
<p>Die verantwortliche Stelle prüft Datenlage, Fristen, Nachweise, Kommunikation und erforderliche Folgemaßnahmen.</p>
<h2>Entscheidung</h2>
<p>Die Entscheidung und weitere Bearbeitung erfolgen nach fachlicher, organisatorischer und rechtlicher Bewertung.</p>
<h2>Ablage</h2>
<p>Das Dokument wird der passenden Akte zugeordnet und revisionssicher gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  7
);

select public.cs_seed_template(
  'payor_insurance',
  'payor_correction_bank_details',
  'Korrektur Bankverbindung Kostenträger',
  'Mitteilung korrigierter Bankdaten und Bitte um erneute Zahlung/Zuordnung.',
  'Korrektur',
  'client',
  'client',
  'high',
  false,
  ARRAY['bankverbindung','korrektur']::text[],
  '<h1>Korrektur Bankverbindung Kostenträger</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Sachverhalt</h2>
<p>Der Vorgang wird mit den zum Zeitpunkt der Erstellung vorliegenden Informationen dokumentiert.</p>
<h2>Prüfung</h2>
<p>Die verantwortliche Stelle prüft Datenlage, Fristen, Nachweise, Kommunikation und erforderliche Folgemaßnahmen.</p>
<h2>Entscheidung</h2>
<p>Die Entscheidung und weitere Bearbeitung erfolgen nach fachlicher, organisatorischer und rechtlicher Bewertung.</p>
<h2>Ablage</h2>
<p>Das Dokument wird der passenden Akte zugeordnet und revisionssicher gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  3
);

select public.cs_seed_template(
  'portal_communication',
  'portal_invitation_employee',
  'Portal-Einladung Mitarbeitende',
  'Einladung mit Zugangs- und Nutzungsinformationen zum Mitarbeiterportal.',
  'Portal',
  'employee',
  'employee',
  'high',
  true,
  ARRAY['portal','einladung']::text[],
  '<h1>Portal-Einladung Mitarbeitende</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Zweck</h2>
<p>Diese Unterweisung dient der sicheren, datenschutzkonformen und fachlich einheitlichen Durchführung der Tätigkeiten.</p>
<h2>Pflichten</h2>
<p>Die genannten Vorgaben sind verbindlich einzuhalten. Abweichungen, Risiken oder besondere Vorkommnisse sind unverzüglich an das Office zu melden.</p>
<h2>Portal und Dokumentation</h2>
<p>Einsatzzeiten, Aufgabenstatus, Dokumentation, Nachrichten und Unterschriften sind vollständig im Portal zu führen.</p>
<h2>Bestätigung</h2>
<p>Mit der Unterschrift wird bestätigt, dass Inhalt, Bedeutung und Konsequenzen verstanden wurden.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  1
);

select public.cs_seed_template(
  'portal_communication',
  'portal_invitation_client',
  'Portal-Einladung Klient:in',
  'Einladung mit Portalcode, Sichtbarkeit von Einsätzen, Nachrichten und Dokumenten.',
  'Portal',
  'client',
  'client',
  'normal',
  false,
  ARRAY['portal','einladung']::text[],
  '<h1>Portal-Einladung Klient:in</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  7
);

select public.cs_seed_template(
  'portal_communication',
  'appointment_confirmation',
  'Terminbestätigung',
  'Bestätigung eines Termins, Hausbesuchs, Einsatzes oder Gespräches.',
  'Nachricht',
  'client',
  'client',
  'normal',
  false,
  ARRAY['termin']::text[],
  '<h1>Terminbestätigung</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  7
);

select public.cs_seed_template(
  'assignments_proofs',
  'deployment_change_notice',
  'Einsatzänderung / Dienstplanänderung',
  'Information über geänderte Einsatzzeit, Mitarbeitendenwechsel oder Verschiebung.',
  'Einsatz',
  'both',
  'both',
  'high',
  false,
  ARRAY['dienstplan','änderung']::text[],
  '<h1>Einsatzänderung / Dienstplanänderung</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Änderung</h2>
<p>Der Einsatz für {{client.full_name}} am {{assignment.date}} wird wie folgt geändert: Beginn {{assignment.start_time}}, Ende {{assignment.end_time}}, Mitarbeiter:in {{employee.full_name}}.</p>
<h2>Grund</h2>
<p>Grund/Hinweis: {{assignment.cancel_reason}}.</p>
<h2>Rückmeldung</h2>
<p>Bitte prüfen Sie die Änderung im Portal. Rückfragen sind direkt über die Nachrichtenfunktion möglich.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}, {"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 2}]'::jsonb,
  1
);

select public.cs_seed_template(
  'assignments_proofs',
  'cancellation_notice',
  'Einsatzabsage',
  'Information und Dokumentation einer Einsatzabsage.',
  'Einsatz',
  'both',
  'both',
  'high',
  false,
  ARRAY['absage','einsatz']::text[],
  '<h1>Einsatzabsage</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Sachverhalt</h2>
<p>Der Vorgang wird mit den zum Zeitpunkt der Erstellung vorliegenden Informationen dokumentiert.</p>
<h2>Prüfung</h2>
<p>Die verantwortliche Stelle prüft Datenlage, Fristen, Nachweise, Kommunikation und erforderliche Folgemaßnahmen.</p>
<h2>Entscheidung</h2>
<p>Die Entscheidung und weitere Bearbeitung erfolgen nach fachlicher, organisatorischer und rechtlicher Bewertung.</p>
<h2>Ablage</h2>
<p>Das Dokument wird der passenden Akte zugeordnet und revisionssicher gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}, {"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 2}]'::jsonb,
  1
);

select public.cs_seed_template(
  'portal_communication',
  'client_information_circular',
  'Rundschreiben Klient:innen',
  'Allgemeines Rundschreiben an Klient:innen/Angehörige.',
  'Rundschreiben',
  'client',
  'client',
  'normal',
  false,
  ARRAY['rundschreiben']::text[],
  '<h1>Rundschreiben Klient:innen</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  14
);

select public.cs_seed_template(
  'portal_communication',
  'employee_information_circular',
  'Rundschreiben Mitarbeitende',
  'Allgemeines Rundschreiben an Mitarbeitende.',
  'Rundschreiben',
  'employee',
  'employee',
  'normal',
  false,
  ARRAY['rundschreiben']::text[],
  '<h1>Rundschreiben Mitarbeitende</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Zweck</h2>
<p>Diese Unterweisung dient der sicheren, datenschutzkonformen und fachlich einheitlichen Durchführung der Tätigkeiten.</p>
<h2>Pflichten</h2>
<p>Die genannten Vorgaben sind verbindlich einzuhalten. Abweichungen, Risiken oder besondere Vorkommnisse sind unverzüglich an das Office zu melden.</p>
<h2>Portal und Dokumentation</h2>
<p>Einsatzzeiten, Aufgabenstatus, Dokumentation, Nachrichten und Unterschriften sind vollständig im Portal zu führen.</p>
<h2>Bestätigung</h2>
<p>Mit der Unterschrift wird bestätigt, dass Inhalt, Bedeutung und Konsequenzen verstanden wurden.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  14
);

select public.cs_seed_template(
  'office_legal',
  'dsgvo_information_request',
  'DSGVO-Auskunftsersuchen',
  'Vorlage zur Bearbeitung und Beantwortung eines Auskunftsersuchens.',
  'DSGVO',
  'client',
  'client',
  'high',
  false,
  ARRAY['dsgvo','auskunft']::text[],
  '<h1>DSGVO-Auskunftsersuchen</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Sachverhalt</h2>
<p>Der Vorgang wird mit den zum Zeitpunkt der Erstellung vorliegenden Informationen dokumentiert.</p>
<h2>Prüfung</h2>
<p>Die verantwortliche Stelle prüft Datenlage, Fristen, Nachweise, Kommunikation und erforderliche Folgemaßnahmen.</p>
<h2>Entscheidung</h2>
<p>Die Entscheidung und weitere Bearbeitung erfolgen nach fachlicher, organisatorischer und rechtlicher Bewertung.</p>
<h2>Ablage</h2>
<p>Das Dokument wird der passenden Akte zugeordnet und revisionssicher gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  30
);

select public.cs_seed_template(
  'office_legal',
  'dsgvo_deletion_request_response',
  'DSGVO-Löschanfrage Antwort',
  'Antwort auf Lösch-/Berichtigungs-/Einschränkungsersuchen.',
  'DSGVO',
  'client',
  'client',
  'high',
  false,
  ARRAY['dsgvo','löschung']::text[],
  '<h1>DSGVO-Löschanfrage Antwort</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Sachverhalt</h2>
<p>Der Vorgang wird mit den zum Zeitpunkt der Erstellung vorliegenden Informationen dokumentiert.</p>
<h2>Prüfung</h2>
<p>Die verantwortliche Stelle prüft Datenlage, Fristen, Nachweise, Kommunikation und erforderliche Folgemaßnahmen.</p>
<h2>Entscheidung</h2>
<p>Die Entscheidung und weitere Bearbeitung erfolgen nach fachlicher, organisatorischer und rechtlicher Bewertung.</p>
<h2>Ablage</h2>
<p>Das Dokument wird der passenden Akte zugeordnet und revisionssicher gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  30
);

select public.cs_seed_template(
  'office_legal',
  'data_breach_protocol',
  'Datenschutzvorfall Protokoll',
  'Internes Protokoll zur Erfassung eines Datenschutzvorfalls.',
  'Protokoll',
  'office',
  'office',
  'urgent',
  false,
  ARRAY['datenschutzvorfall']::text[],
  '<h1>Datenschutzvorfall Protokoll</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<h2>Sachverhalt</h2>
<p>Der Vorgang wird mit den zum Zeitpunkt der Erstellung vorliegenden Informationen dokumentiert.</p>
<h2>Prüfung</h2>
<p>Die verantwortliche Stelle prüft Datenlage, Fristen, Nachweise, Kommunikation und erforderliche Folgemaßnahmen.</p>
<h2>Entscheidung</h2>
<p>Die Entscheidung und weitere Bearbeitung erfolgen nach fachlicher, organisatorischer und rechtlicher Bewertung.</p>
<h2>Ablage</h2>
<p>Das Dokument wird der passenden Akte zugeordnet und revisionssicher gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Office/Geschäftsführung:</strong> <span data-signature-anchor="office_signature">[SIGNATURE:office]</span></p>',
  '[{"signer_role": "office", "label": "Office / Geschäftsführung unterschreibt", "anchor_token": "office_signature", "required": true, "order_index": 1}]'::jsonb,
  1
);

select public.cs_seed_template(
  'incident_damage',
  'incident_report',
  'Besonderes Vorkommnis',
  'Meldung besonderer Vorkommnisse im Einsatz oder in der Versorgungssituation.',
  'Vorfällmeldung',
  'both',
  'both',
  'urgent',
  false,
  ARRAY['vorkommnis','eskalation']::text[],
  '<h1>Besonderes Vorkommnis</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Sachverhalt</h2>
<p>Der Vorgang wird mit den zum Zeitpunkt der Erstellung vorliegenden Informationen dokumentiert.</p>
<h2>Prüfung</h2>
<p>Die verantwortliche Stelle prüft Datenlage, Fristen, Nachweise, Kommunikation und erforderliche Folgemaßnahmen.</p>
<h2>Entscheidung</h2>
<p>Die Entscheidung und weitere Bearbeitung erfolgen nach fachlicher, organisatorischer und rechtlicher Bewertung.</p>
<h2>Ablage</h2>
<p>Das Dokument wird der passenden Akte zugeordnet und revisionssicher gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}, {"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 2}]'::jsonb,
  1
);

select public.cs_seed_template(
  'incident_damage',
  'property_damage_report',
  'Schadensmeldung',
  'Meldung eines Sachschadens bei Klient:in, Mitarbeitenden oder Mandant.',
  'Schaden',
  'both',
  'both',
  'urgent',
  false,
  ARRAY['schaden']::text[],
  '<h1>Schadensmeldung</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Sachverhalt</h2>
<p>Der Vorgang wird mit den zum Zeitpunkt der Erstellung vorliegenden Informationen dokumentiert.</p>
<h2>Prüfung</h2>
<p>Die verantwortliche Stelle prüft Datenlage, Fristen, Nachweise, Kommunikation und erforderliche Folgemaßnahmen.</p>
<h2>Entscheidung</h2>
<p>Die Entscheidung und weitere Bearbeitung erfolgen nach fachlicher, organisatorischer und rechtlicher Bewertung.</p>
<h2>Ablage</h2>
<p>Das Dokument wird der passenden Akte zugeordnet und revisionssicher gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}, {"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 2}]'::jsonb,
  1
);

select public.cs_seed_template(
  'quality_compliance',
  'qm_audit_checklist',
  'QM-Audit Checkliste',
  'Interne Prüfcheckliste für Akten, Nachweise, Dokumente und Portalprozesse.',
  'QM',
  'office',
  'office',
  'normal',
  false,
  ARRAY['qm','audit']::text[],
  '<h1>QM-Audit Checkliste</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<h2>Sachverhalt</h2>
<p>Der Vorgang wird mit den zum Zeitpunkt der Erstellung vorliegenden Informationen dokumentiert.</p>
<h2>Prüfung</h2>
<p>Die verantwortliche Stelle prüft Datenlage, Fristen, Nachweise, Kommunikation und erforderliche Folgemaßnahmen.</p>
<h2>Entscheidung</h2>
<p>Die Entscheidung und weitere Bearbeitung erfolgen nach fachlicher, organisatorischer und rechtlicher Bewertung.</p>
<h2>Ablage</h2>
<p>Das Dokument wird der passenden Akte zugeordnet und revisionssicher gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Office/Geschäftsführung:</strong> <span data-signature-anchor="office_signature">[SIGNATURE:office]</span></p>',
  '[{"signer_role": "office", "label": "Office / Geschäftsführung unterschreibt", "anchor_token": "office_signature", "required": true, "order_index": 1}]'::jsonb,
  14
);

select public.cs_seed_template(
  'quality_compliance',
  'staff_instruction_confirmation',
  'Pflichtunterweisung Sammelbestätigung',
  'Sammelbestätigung für Datenschutz, Hygiene, Arbeitsschutz und Portalregeln.',
  'Belehrung',
  'employee',
  'employee',
  'high',
  true,
  ARRAY['pflichtunterweisung']::text[],
  '<h1>Pflichtunterweisung Sammelbestätigung</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<h2>Zweck</h2>
<p>Diese Unterweisung dient der sicheren, datenschutzkonformen und fachlich einheitlichen Durchführung der Tätigkeiten.</p>
<h2>Pflichten</h2>
<p>Die genannten Vorgaben sind verbindlich einzuhalten. Abweichungen, Risiken oder besondere Vorkommnisse sind unverzüglich an das Office zu melden.</p>
<h2>Portal und Dokumentation</h2>
<p>Einsatzzeiten, Aufgabenstatus, Dokumentation, Nachrichten und Unterschriften sind vollständig im Portal zu führen.</p>
<h2>Bestätigung</h2>
<p>Mit der Unterschrift wird bestätigt, dass Inhalt, Bedeutung und Konsequenzen verstanden wurden.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}]'::jsonb,
  7
);

select public.cs_seed_template(
  'quality_compliance',
  'client_feedback_form',
  'Feedbackbogen Klient:in',
  'Feedback zu Zufriedenheit, Pünktlichkeit, Aufgabenqualität und Kommunikation.',
  'Feedback',
  'client',
  'client',
  'normal',
  false,
  ARRAY['feedback','qualität']::text[],
  '<h1>Feedbackbogen Klient:in</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  14
);

select public.cs_seed_template(
  'office_legal',
  'document_upload_notice',
  'Dokument wurde im Portal bereitgestellt',
  'Benachrichtigung über neues Dokument mit Frist und Signaturanforderung.',
  'Portal',
  'both',
  'both',
  'normal',
  false,
  ARRAY['portal','dokument']::text[],
  '<h1>Dokument wurde im Portal bereitgestellt</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Mitarbeiter:in:</strong> {{employee.full_name}} · Personalnummer: {{employee.personnel_number}} · Anschrift: {{employee.address_full}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Mitarbeiter:in:</strong> <span data-signature-anchor="employee_signature">[SIGNATURE:employee]</span></p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "employee", "label": "Mitarbeiter:in unterschreibt", "anchor_token": "employee_signature", "required": true, "order_index": 1}, {"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 2}]'::jsonb,
  7
);

select public.cs_seed_template(
  'client_contracts',
  'client_photo_media_consent',
  'Foto- und Medien-Einwilligung',
  'Einwilligung oder Ablehnung zur Nutzung von Fotos/Medien, sofern erforderlich.',
  'Einwilligung',
  'client',
  'client',
  'normal',
  false,
  ARRAY['foto','medien']::text[],
  '<h1>Foto- und Medien-Einwilligung</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  14
);

select public.cs_seed_template(
  'client_contracts',
  'client_medical_records_consent',
  'Einwilligung Gesundheitsunterlagen',
  'Einwilligung zur Entgegennahme, Speicherung und Zuordnung relevanter Gesundheits-/Pflegeunterlagen.',
  'Einwilligung',
  'client',
  'client',
  'high',
  false,
  ARRAY['gesundheitsunterlagen']::text[],
  '<h1>Einwilligung Gesundheitsunterlagen</h1>
<p><strong>{{tenant.legal_name}}</strong><br>{{tenant.address_full}}<br>Telefon: {{tenant.phone}} · E-Mail: {{tenant.email}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}} · Pflegegrad: {{client.care_level}} · Anschrift: {{client.address_full}}</p>
<h2>Leistungsinhalt</h2>
<p>Die Unterstützung erfolgt im Rahmen der vereinbarten Alltagsbegleitung, Entlastung, Haushaltsunterstützung oder individuellen Hilfe.</p>
<h2>Kosten und Kostenträger</h2>
<p>Abrechnung und Budgetprüfung erfolgen anhand der hinterlegten Daten zu Pflegegrad, Pflegekasse und Leistungsbudget.</p>
<h2>Mitwirkung</h2>
<p>Änderungen bei Pflegegrad, Kostenträger, Adresse, Vertretung, Notfallkontakt oder Einsatzwünschen sind zeitnah mitzuteilen.</p>
<h2>Dokumentation und Nachweise</h2>
<p>Einsätze werden digital dokumentiert und durch Unterschrift bestätigt. Nachweise werden in der Akte gespeichert.</p>
<p><strong>Dokument:</strong> {{document.title}} · Version {{document.version}} · Erstellt am {{document.date}} · Fällig bis {{document.due_date}}</p>
<p><strong>Unterschrift Klient:in / Vertretung:</strong> <span data-signature-anchor="client_signature">[SIGNATURE:client]</span></p>',
  '[{"signer_role": "client", "label": "Klient:in / Vertretung unterschreibt", "anchor_token": "client_signature", "required": true, "order_index": 1}]'::jsonb,
  7
);


-- RLS — nutzt public.current_tenant_id() wie übrige CareSuite-Migrationen
ALTER TABLE public.cs_template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_template_placeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_document_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_template_signature_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_template_delivery_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_document_request_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_document_request_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cs template categories readable" ON public.cs_template_categories;
CREATE POLICY "cs template categories readable" ON public.cs_template_categories
  FOR SELECT TO authenticated USING (active = true);

DROP POLICY IF EXISTS "cs template placeholders readable" ON public.cs_template_placeholders;
CREATE POLICY "cs template placeholders readable" ON public.cs_template_placeholders
  FOR SELECT TO authenticated USING (active = true);

DROP POLICY IF EXISTS "cs templates readable by tenant" ON public.cs_document_templates;
CREATE POLICY "cs templates readable by tenant" ON public.cs_document_templates
  FOR SELECT TO authenticated USING (
    active = true
    AND (is_system_template = true OR owner_tenant_id = public.current_tenant_id())
  );

DROP POLICY IF EXISTS "cs template versions readable" ON public.cs_document_template_versions;
CREATE POLICY "cs template versions readable" ON public.cs_document_template_versions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.cs_document_templates t
      WHERE t.id = template_id
        AND t.active = true
        AND (t.is_system_template = true OR t.owner_tenant_id = public.current_tenant_id())
    )
  );

DROP POLICY IF EXISTS "cs signature fields readable" ON public.cs_template_signature_fields;
CREATE POLICY "cs signature fields readable" ON public.cs_template_signature_fields
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "cs delivery defaults readable" ON public.cs_template_delivery_defaults;
CREATE POLICY "cs delivery defaults readable" ON public.cs_template_delivery_defaults
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "cs document requests office access" ON public.cs_document_requests;
CREATE POLICY "cs document requests office access" ON public.cs_document_requests
  FOR ALL TO authenticated
  USING (owner_tenant_id = public.current_tenant_id())
  WITH CHECK (owner_tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "cs document requests portal employee select" ON public.cs_document_requests;
CREATE POLICY "cs document requests portal employee select" ON public.cs_document_requests
  FOR SELECT TO authenticated
  USING (
    owner_tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
    AND portal_visible = true
    AND status IN ('sent', 'opened', 'partially_signed', 'completed', 'archived')
    AND recipient_scope IN ('employee', 'both')
  );

DROP POLICY IF EXISTS "cs document requests portal employee update" ON public.cs_document_requests;
CREATE POLICY "cs document requests portal employee update" ON public.cs_document_requests
  FOR UPDATE TO authenticated
  USING (
    owner_tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
    AND portal_visible = true
    AND status IN ('sent', 'opened', 'partially_signed')
    AND recipient_scope IN ('employee', 'both')
  )
  WITH CHECK (
    owner_tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
  );

DROP POLICY IF EXISTS "cs document requests portal client select" ON public.cs_document_requests;
CREATE POLICY "cs document requests portal client select" ON public.cs_document_requests
  FOR SELECT TO authenticated
  USING (
    owner_tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
    AND portal_visible = true
    AND status IN ('sent', 'opened', 'partially_signed', 'completed', 'archived')
    AND recipient_scope IN ('client', 'both')
  );

DROP POLICY IF EXISTS "cs document requests portal client update" ON public.cs_document_requests;
CREATE POLICY "cs document requests portal client update" ON public.cs_document_requests
  FOR UPDATE TO authenticated
  USING (
    owner_tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND portal_visible = true
    AND status IN ('sent', 'opened', 'partially_signed')
    AND recipient_scope IN ('client', 'both')
  )
  WITH CHECK (
    owner_tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
  );

DROP POLICY IF EXISTS "cs signatures via request tenant" ON public.cs_document_request_signatures;
CREATE POLICY "cs signatures via request tenant" ON public.cs_document_request_signatures
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cs_document_requests r
      WHERE r.id = request_id AND r.owner_tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cs_document_requests r
      WHERE r.id = request_id AND r.owner_tenant_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS "cs signatures portal employee" ON public.cs_document_request_signatures;
CREATE POLICY "cs signatures portal employee" ON public.cs_document_request_signatures
  FOR ALL TO authenticated
  USING (
    signer_role = 'employee'
    AND EXISTS (
      SELECT 1 FROM public.cs_document_requests r
      WHERE r.id = request_id
        AND r.owner_tenant_id = public.current_tenant_id()
        AND r.employee_id = public.resolve_current_employee_id()
        AND r.portal_visible = true
    )
  )
  WITH CHECK (
    signer_role = 'employee'
    AND EXISTS (
      SELECT 1 FROM public.cs_document_requests r
      WHERE r.id = request_id
        AND r.owner_tenant_id = public.current_tenant_id()
        AND r.employee_id = public.resolve_current_employee_id()
    )
  );

DROP POLICY IF EXISTS "cs signatures portal client" ON public.cs_document_request_signatures;
CREATE POLICY "cs signatures portal client" ON public.cs_document_request_signatures
  FOR ALL TO authenticated
  USING (
    signer_role IN ('client', 'representative')
    AND EXISTS (
      SELECT 1 FROM public.cs_document_requests r
      WHERE r.id = request_id
        AND r.owner_tenant_id = public.current_tenant_id()
        AND r.client_id = public.current_client_id()
        AND r.portal_visible = true
    )
  )
  WITH CHECK (
    signer_role IN ('client', 'representative')
    AND EXISTS (
      SELECT 1 FROM public.cs_document_requests r
      WHERE r.id = request_id
        AND r.owner_tenant_id = public.current_tenant_id()
        AND r.client_id = public.current_client_id()
    )
  );

DROP POLICY IF EXISTS "cs files via request tenant" ON public.cs_document_request_files;
CREATE POLICY "cs files via request tenant" ON public.cs_document_request_files
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cs_document_requests r
      WHERE r.id = request_id AND r.owner_tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cs_document_requests r
      WHERE r.id = request_id AND r.owner_tenant_id = public.current_tenant_id()
    )
  );

GRANT SELECT ON public.cs_template_categories TO authenticated;
GRANT SELECT ON public.cs_template_placeholders TO authenticated;
GRANT SELECT ON public.cs_document_templates TO authenticated;
GRANT SELECT ON public.cs_document_template_versions TO authenticated;
GRANT SELECT ON public.cs_template_signature_fields TO authenticated;
GRANT SELECT ON public.cs_template_delivery_defaults TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cs_document_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cs_document_request_signatures TO authenticated;
GRANT SELECT, INSERT ON public.cs_document_request_files TO authenticated;
GRANT EXECUTE ON FUNCTION public.cs_placeholder_value(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cs_render_template_html(text, jsonb) TO authenticated;

-- Schnelle Testabfrage:
-- select t.template_key, t.title, v.body_html
-- from public.cs_document_templates t
-- join public.cs_document_template_versions v on v.template_id = t.id and v.status = 'active'
-- order by t.category_key, t.title;

-- Beispiel Rendering:
-- select public.cs_render_template_html(
--   (select v.body_html from public.cs_document_templates t join public.cs_document_template_versions v on v.template_id=t.id where t.template_key='client_service_proof_single' limit 1),
--   '{"tenant":{"legal_name":"Helferhasen+ UG (haftungsbeschränkt)","address_full":"Torgauer Straße 7, 44263 Dortmund","phone":"0231 99 76 00 9-6","email":"info@helferhasen.com"},"client":{"full_name":"Ramona König","care_level":"PG2","address_full":"Witten"},"employee":{"full_name":"Kathrin Pott","personnel_number":"HH-EMP-001","address_full":"Dortmund"},"assignment":{"date":"2026-07-15","start_time":"09:00","end_time":"11:00","duration_hours":"2,00","service_type":"Alltagsbegleitung","tasks":"Einkauf, Haushalt","documentation":"Einsatz durchgeführt."},"document":{"title":"Leistungsnachweis","version":"1.0","date":"2026-07-05","due_date":"2026-07-15"}}'::jsonb
-- );

commit;
