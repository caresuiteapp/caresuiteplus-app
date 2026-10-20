-- ==========================================================================
-- CareSuite+ — Migration 0154: Sync B.1 Permission Keys (Gruppe B.1c)
-- Referenz: docs/audit/B1-permission-p0-abschlussbericht.md
--           docs/audit/B1b-permission-runtime-sync-abschlussbericht.md
-- Quelle:   src/lib/permissions/staticRolePermissions.ts → ROLE_PERMISSIONS
-- Scope:    39 B.1-Keys (38 A4.3 + office.invoices.create) in role_permissions
-- Pattern:  INSERT … ON CONFLICT (role_id, permission_key) DO NOTHING
-- Keine DELETE/DROP/TRUNCATE, keine RLS-/Schema-Änderungen.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- business_admin — volle B.1-Matrix (Least-Privilege laut staticRolePermissions)
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
WHERE r.key = 'business_admin'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- business_manager — wie admin, ohne connect.configure
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
WHERE r.key = 'business_manager'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- billing — Abrechnung + Leserechte (kein Recruiting/Inventory/Geo-Dispatch)
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
-- dispatch — Einsatzplanung (Inventory-Dispatch-Subset, Geo-Dispatch, Absences)
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
WHERE r.key = 'dispatch'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- nurse — Feld-Geo + Compliance/Absences-Lesen
-- --------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('geo.routes.view'),
    ('geo.location.capture'),
    ('office.employees.compliance.view'),
    ('office.employees.absences.view')
) AS p(key)
WHERE r.key = 'nurse'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- caregiver — Feld-Geo
-- --------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('geo.routes.view'),
    ('geo.location.capture')
) AS p(key)
WHERE r.key = 'caregiver'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- counselor — Abwesenheiten lesen
-- --------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, 'office.employees.absences.view'
FROM public.roles r
WHERE r.key = 'counselor'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- employee_portal — Portal-Erweiterungen (Inventory, Absences, HR)
-- --------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('portal.employee.inventory.view'),
    ('portal.employee.absences.view'),
    ('portal.employee.absences.request'),
    ('portal.employee.hr.view')
) AS p(key)
WHERE r.key = 'employee_portal'
ON CONFLICT (role_id, permission_key) DO NOTHING;
