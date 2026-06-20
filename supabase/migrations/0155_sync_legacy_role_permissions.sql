-- ==========================================================================
-- CareSuite+ — Migration 0155: Sync B.1 Permission Keys auf Legacy-Rollen
-- Referenz: docs/audit/B1i-role-key-alignment-analysebericht.md
--           docs/audit/B1h-migration-0154-apply-abschlussbericht.md
-- Vorgänger: 0154_sync_b1_permission_keys.sql (CS+-RoleKeys → No-Ops remote)
--
-- Zweck:
--   B.1-PermissionKeys (A4.3 + office.invoices.create) auf tatsächliche
--   Remote-Legacy-Rollen verteilen (owner, admin, billing, planning, …).
--
-- Regeln:
--   * INSERT-only, ON CONFLICT (role_id, permission_key) DO NOTHING
--   * Keine Rollen-Umbenennung, keine CS+-Rollen remote erzwingen
--   * Keine RLS-/Schema-Änderungen, kein DELETE/DROP/TRUNCATE
--   * Tenant-scoped roles: WHERE r.key = '<legacy>' (alle Mandanten)
--   * No-Op-sicher wenn Rolle fehlt
-- ==========================================================================

-- --------------------------------------------------------------------------
-- owner — entspricht business_admin (0154), inkl. office.invoices.create
-- --------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('connect.view'),
    ('connect.configure'),
    ('inventory.view'),
    ('inventory.manage_items'),
    ('inventory.issue'),
    ('inventory.return_manage'),
    ('inventory.audit_view'),
    ('inventory.report_damage'),
    ('inventory.offboarding'),
    ('messages.broadcast.create'),
    ('geo.routes.view'),
    ('geo.location.capture'),
    ('geo.live_tracking'),
    ('geo.mileage.manage'),
    ('office.recruiting.view'),
    ('office.recruiting.manage'),
    ('office.recruiting.view_sensitive'),
    ('office.recruiting.convert'),
    ('office.recruiting.onboarding.manage'),
    ('office.employees.compliance.view'),
    ('office.employees.compliance.manage'),
    ('office.employees.absences.view'),
    ('office.employees.absences.view_sensitive'),
    ('office.employees.absences.manage'),
    ('office.employees.absences.approve'),
    ('office.appointments.edit'),
    ('office.employees.hr.view'),
    ('office.employees.hr.manage'),
    ('office.employees.hr.finalize'),
    ('office.employee_time.view'),
    ('office.employee_time.manage'),
    ('office.employee_time.export'),
    ('office.invoices.create')
) AS p(key)
WHERE r.key = 'owner'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- admin — wie owner / business_admin
-- --------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('connect.view'),
    ('connect.configure'),
    ('inventory.view'),
    ('inventory.manage_items'),
    ('inventory.issue'),
    ('inventory.return_manage'),
    ('inventory.audit_view'),
    ('inventory.report_damage'),
    ('inventory.offboarding'),
    ('messages.broadcast.create'),
    ('geo.routes.view'),
    ('geo.location.capture'),
    ('geo.live_tracking'),
    ('geo.mileage.manage'),
    ('office.recruiting.view'),
    ('office.recruiting.manage'),
    ('office.recruiting.view_sensitive'),
    ('office.recruiting.convert'),
    ('office.recruiting.onboarding.manage'),
    ('office.employees.compliance.view'),
    ('office.employees.compliance.manage'),
    ('office.employees.absences.view'),
    ('office.employees.absences.view_sensitive'),
    ('office.employees.absences.manage'),
    ('office.employees.absences.approve'),
    ('office.appointments.edit'),
    ('office.employees.hr.view'),
    ('office.employees.hr.manage'),
    ('office.employees.hr.finalize'),
    ('office.employee_time.view'),
    ('office.employee_time.manage'),
    ('office.employee_time.export'),
    ('office.invoices.create')
) AS p(key)
WHERE r.key = 'admin'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- management — entspricht business_manager (0154), ohne connect.configure
-- --------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('connect.view'),
    ('inventory.view'),
    ('inventory.manage_items'),
    ('inventory.issue'),
    ('inventory.return_manage'),
    ('inventory.audit_view'),
    ('inventory.report_damage'),
    ('inventory.offboarding'),
    ('messages.broadcast.create'),
    ('geo.routes.view'),
    ('geo.location.capture'),
    ('geo.live_tracking'),
    ('geo.mileage.manage'),
    ('office.recruiting.view'),
    ('office.recruiting.manage'),
    ('office.recruiting.view_sensitive'),
    ('office.recruiting.convert'),
    ('office.recruiting.onboarding.manage'),
    ('office.employees.compliance.view'),
    ('office.employees.compliance.manage'),
    ('office.employees.absences.view'),
    ('office.employees.absences.view_sensitive'),
    ('office.employees.absences.manage'),
    ('office.employees.absences.approve'),
    ('office.appointments.edit'),
    ('office.employees.hr.view'),
    ('office.employees.hr.manage'),
    ('office.employees.hr.finalize'),
    ('office.employee_time.view'),
    ('office.employee_time.manage'),
    ('office.employee_time.export'),
    ('office.invoices.create')
) AS p(key)
WHERE r.key = 'management'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- billing — idempotent (0154-Subset, ggf. bereits teilweise vorhanden)
-- --------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('connect.view'),
    ('messages.broadcast.create'),
    ('office.employees.compliance.view'),
    ('office.employees.absences.view'),
    ('office.employees.hr.view'),
    ('office.employee_time.view'),
    ('office.employee_time.export'),
    ('office.invoices.create')
) AS p(key)
WHERE r.key = 'billing'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- planning — entspricht dispatch (0154), Remote-Key für Einsatzplanung
-- --------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('connect.view'),
    ('inventory.view'),
    ('inventory.issue'),
    ('inventory.return_manage'),
    ('inventory.audit_view'),
    ('messages.broadcast.create'),
    ('geo.routes.view'),
    ('geo.location.capture'),
    ('geo.live_tracking'),
    ('geo.mileage.manage'),
    ('office.recruiting.view'),
    ('office.employees.absences.view'),
    ('office.employees.absences.manage'),
    ('office.employees.absences.approve'),
    ('office.appointments.edit')
) AS p(key)
WHERE r.key = 'planning'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- office — Verwaltung ohne Admin-Vollrechte (kein invoice.create, kein inventory full)
-- --------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('connect.view'),
    ('messages.broadcast.create'),
    ('office.recruiting.view'),
    ('office.employees.compliance.view'),
    ('office.employees.absences.view'),
    ('office.employees.hr.view'),
    ('office.appointments.edit'),
    ('office.employee_time.view')
) AS p(key)
WHERE r.key = 'office'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- readonly — nur Leserechte (B.1-View-Keys), keine Create/Manage-Keys
-- --------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('connect.view'),
    ('office.employees.compliance.view'),
    ('office.employees.absences.view'),
    ('office.employees.hr.view'),
    ('office.employee_time.view')
) AS p(key)
WHERE r.key = 'readonly'
ON CONFLICT (role_id, permission_key) DO NOTHING;
