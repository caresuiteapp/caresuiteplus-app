/** Assist Leistungskatalog — Tabellen-Registry für zukünftige Supabase-Anbindung. */

export const ASSIST_SERVICE_CATALOG_ITEMS_TABLE = 'assist_service_catalog_items';
export const ASSIST_SERVICE_TASK_TEMPLATES_TABLE = 'assist_service_task_templates';
export const ASSIST_SERVICE_RATE_VERSIONS_TABLE = 'assist_service_rate_versions';
export const ASSIST_SERVICE_BILLING_RULES_TABLE = 'assist_service_billing_rules';
export const ASSIST_SERVICE_DOCUMENTATION_REQUIREMENTS_TABLE =
  'assist_service_documentation_requirements';
export const ASSIST_SERVICE_CATALOG_AUDIT_EVENTS_TABLE = 'assist_service_catalog_audit_events';

/** Erweitert tenant_service_rates aus Migration 0050 — keine Duplikation der Abrechnungslogik. */
export const TENANT_SERVICE_RATES_TABLE = 'tenant_service_rates';

export const ASSIST_SERVICE_CATALOG_REQUIRED_MIGRATION = '0053_assist_service_catalog_prepared.sql';

export const ASSIST_SERVICE_CATALOG_SELECT_COLUMNS =
  'id, tenant_id, service_key, title, description, category, billable, requires_signature, requires_documentation, default_duration_minutes, allowed_modules, tax_mode, budget_eligible, status, created_at, updated_at';
