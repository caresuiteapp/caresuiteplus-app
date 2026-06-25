-- ==========================================================================
-- CareSuite+ — Migration 0165: Assist Catalog Permission Keys
-- C.ASSIST-OFFICE-TEMPLATE.1 — feingranulare Office/Assist-Rechte
-- Pattern: 0154_sync_b1_permission_keys.sql
-- ==========================================================================

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('office.catalogs.create'),
    ('office.catalogs.update'),
    ('office.catalogs.deactivate'),
    ('office.catalogs.restore'),
    ('office.catalogs.copy_system'),
    ('office.templates.view'),
    ('office.templates.create'),
    ('office.templates.update'),
    ('office.templates.activate'),
    ('office.templates.archive'),
    ('office.templates.version_view'),
    ('office.templates.bindings_manage'),
    ('assist.assignment.use_templates'),
    ('assist.documentation.use_quick_blocks'),
    ('assist.intake.use_templates')
) AS p(key)
WHERE r.key IN ('business_admin', 'business_manager')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- billing: view-only catalog access
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('office.catalogs.create'),
    ('office.templates.view'),
    ('office.templates.version_view')
) AS p(key)
WHERE r.key = 'billing'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- dispatch + assist manage roles: template usage
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('assist.assignment.use_templates'),
    ('assist.documentation.use_quick_blocks'),
    ('assist.intake.use_templates')
) AS p(key)
WHERE r.key IN ('dispatch', 'nurse', 'caregiver', 'counselor', 'business_admin', 'business_manager')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Legacy keys: business_admin/manager already have office.catalogs.view/edit via prior migrations
