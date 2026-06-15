/** WP090 — RLS-Policy-Katalog (abgestimmt mit supabase/migrations/) */

export const AUTH_RLS_WP = 90 as const;

export type AuthRlsPolicyEntry = {
  name: string;
  table: string;
  migration: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'ALL' | 'MIXED';
  description: string;
};

export const AUTH_RLS_POLICIES: readonly AuthRlsPolicyEntry[] = [
  { name: 'tenants_select_own', table: 'tenants', migration: '0001_core_schema.sql', operation: 'SELECT', description: 'Mandant nur für eigenen Tenant sichtbar' },
  { name: 'tenants_update_own', table: 'tenants', migration: '0001_core_schema.sql', operation: 'UPDATE', description: 'Mandant nur durch Tenant-Admins änderbar' },
  { name: 'tenants_insert_onboarding', table: 'tenants', migration: '0002_rls_refinements.sql', operation: 'INSERT', description: 'Onboarding darf initialen Mandanten anlegen' },
  { name: 'tenant_addresses_tenant', table: 'tenant_addresses', migration: '0001_core_schema.sql', operation: 'ALL', description: 'Adressen mandantengebunden' },
  { name: 'tenant_contacts_tenant', table: 'tenant_contacts', migration: '0001_core_schema.sql', operation: 'ALL', description: 'Kontakte mandantengebunden' },
  { name: 'profiles_select_own', table: 'profiles', migration: '0001_core_schema.sql', operation: 'SELECT', description: 'Profile lesen (eigenes + Team)' },
  { name: 'profiles_update_own', table: 'profiles', migration: '0001_core_schema.sql', operation: 'UPDATE', description: 'Eigenes Profil aktualisieren' },
  { name: 'profiles_insert_own', table: 'profiles', migration: '0002_rls_refinements.sql', operation: 'INSERT', description: 'Profil bei Registrierung anlegen' },
  { name: 'roles_select_auth', table: 'roles', migration: '0001_core_schema.sql', operation: 'SELECT', description: 'Rollen für authentifizierte Nutzer' },
  { name: 'role_permissions_select_auth', table: 'role_permissions', migration: '0001_core_schema.sql', operation: 'SELECT', description: 'Rollen-Berechtigungen lesen' },
  { name: 'products_select_auth', table: 'products', migration: '0001_core_schema.sql', operation: 'SELECT', description: 'Produkte global lesbar' },
  { name: 'tenant_products_select_tenant', table: 'tenant_products', migration: '0001_core_schema.sql', operation: 'SELECT', description: 'Tenant-Produkte mandantengebunden' },
  { name: 'tenant_products_insert_admin', table: 'tenant_products', migration: '0002_rls_refinements.sql', operation: 'INSERT', description: 'Produkte durch Admin hinzufügen' },
  { name: 'tenant_products_update_admin', table: 'tenant_products', migration: '0002_rls_refinements.sql', operation: 'UPDATE', description: 'Produkte durch Admin ändern' },
  { name: 'tenant_subscriptions_select_tenant', table: 'tenant_subscriptions', migration: '0001_core_schema.sql', operation: 'SELECT', description: 'Abos mandantengebunden lesen' },
  { name: 'tenant_subscriptions_insert_admin', table: 'tenant_subscriptions', migration: '0002_rls_refinements.sql', operation: 'INSERT', description: 'Abos durch Admin anlegen' },
  { name: 'clients_select_tenant', table: 'clients', migration: '0003_office_clients.sql', operation: 'SELECT', description: 'Klient:innen mandantengebunden' },
  { name: 'clients_insert_tenant', table: 'clients', migration: '0003_office_clients.sql', operation: 'INSERT', description: 'Klient:innen anlegen' },
  { name: 'clients_update_tenant', table: 'clients', migration: '0003_office_clients.sql', operation: 'UPDATE', description: 'Klient:innen aktualisieren' },
  { name: 'client_contacts_select', table: 'client_contacts', migration: '0003_office_clients.sql', operation: 'SELECT', description: 'Kontakte lesen' },
  { name: 'client_contacts_write', table: 'client_contacts', migration: '0003_office_clients.sql', operation: 'MIXED', description: 'Kontakte schreiben' },
  { name: 'client_consents_select', table: 'client_consents', migration: '0003_office_clients.sql', operation: 'SELECT', description: 'Einwilligungen lesen' },
  { name: 'client_consents_write', table: 'client_consents', migration: '0003_office_clients.sql', operation: 'MIXED', description: 'Einwilligungen schreiben' },
  { name: 'client_audit_select', table: 'client_audit_entries', migration: '0003_office_clients.sql', operation: 'SELECT', description: 'Audit lesen' },
  { name: 'client_audit_insert', table: 'client_audit_entries', migration: '0003_office_clients.sql', operation: 'INSERT', description: 'Audit-Einträge anlegen' },
  { name: 'client_history_select', table: 'client_history_entries', migration: '0003_office_clients.sql', operation: 'SELECT', description: 'Historie lesen' },
  { name: 'client_history_insert', table: 'client_history_entries', migration: '0003_office_clients.sql', operation: 'INSERT', description: 'Historie schreiben' },
  { name: 'employees_select_tenant', table: 'employees', migration: '0005_employees_and_profiles.sql', operation: 'SELECT', description: 'Mitarbeitende lesen' },
  { name: 'employees_insert_tenant', table: 'employees', migration: '0005_employees_and_profiles.sql', operation: 'INSERT', description: 'Mitarbeitende anlegen' },
  { name: 'employees_update_tenant', table: 'employees', migration: '0005_employees_and_profiles.sql', operation: 'UPDATE', description: 'Mitarbeitende aktualisieren' },
  { name: 'appointments_tenant', table: 'appointments', migration: '0006_appointments_invoices.sql', operation: 'ALL', description: 'Termine mandantengebunden' },
  { name: 'invoices_tenant', table: 'invoices', migration: '0006_appointments_invoices.sql', operation: 'ALL', description: 'Rechnungen mandantengebunden' },
  { name: 'assignments_tenant', table: 'assignments', migration: '0007_assist_platform.sql', operation: 'ALL', description: 'Einsätze mandantengebunden' },
  { name: 'care_records_tenant', table: 'care_records', migration: '0007_assist_platform.sql', operation: 'ALL', description: 'Pflegenachweise mandantengebunden' },
  { name: 'trips_tenant', table: 'trips', migration: '0007_assist_platform.sql', operation: 'ALL', description: 'Fahrten mandantengebunden' },
  { name: 'catalogs_tenant', table: 'catalogs', migration: '0007_assist_platform.sql', operation: 'ALL', description: 'Kataloge mandantengebunden' },
  { name: 'integration_providers_tenant', table: 'integration_providers', migration: '0007_assist_platform.sql', operation: 'ALL', description: 'Integrationen mandantengebunden' },
  { name: 'ocr_jobs_tenant', table: 'ocr_jobs', migration: '0007_assist_platform.sql', operation: 'ALL', description: 'OCR-Jobs mandantengebunden' },
] as const;

export const AUTH_RLS_POLICY_NAMES = AUTH_RLS_POLICIES.map((p) => p.name);

export function getPoliciesForTable(table: string): AuthRlsPolicyEntry[] {
  return AUTH_RLS_POLICIES.filter((p) => p.table === table);
}
