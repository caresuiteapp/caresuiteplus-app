-- ==========================================================================
-- CareSuite+ — Migration 0234: Portal document permissions for cs_* signatures
-- Seeds portal.employee.documents.view (+ download) and client portal analogs
-- into permission_catalog, role_permissions, and role_template_permissions.
-- Idempotent — no hardcoded user IDs, no changes to 0233.
-- ==========================================================================

-- Ensure portal roles exist (some live DBs predate canonical role keys)
INSERT INTO public.roles (key, name, description)
SELECT v.key, v.name, v.description
FROM (
  VALUES
    ('employee_portal', 'Mitarbeiterportal', 'Mitarbeiterportal-Zugang'),
    ('client_portal', 'Klientenportal', 'Klient:innenportal'),
    ('family_portal', 'Angehörigenportal', 'Angehörigenportal')
) AS v(key, name, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles r WHERE r.key = v.key
);

INSERT INTO public.permission_catalog (key, module, category, label, risk_level, requires_audit)
VALUES
  ('portal.employee.documents.view', 'portal', 'employee', 'Freigegebene Dokumente ansehen', 'low', FALSE),
  ('portal.employee.documents.download', 'portal', 'employee', 'Dokumente herunterladen', 'low', FALSE),
  ('portal.client.documents.view', 'portal', 'client', 'Freigegebene Dokumente ansehen', 'low', FALSE),
  ('portal.client.documents.download', 'portal', 'client', 'Dokumente herunterladen', 'low', FALSE)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_template_permissions (role_template_id, permission_key, allowed)
SELECT rt.id, p.key, TRUE
FROM public.role_templates rt
CROSS JOIN (
  VALUES
    ('portal.employee.documents.view'),
    ('portal.employee.documents.download')
) AS p(key)
WHERE rt.tenant_id IS NULL
  AND rt.role_key = 'employee_portal'
ON CONFLICT (role_template_id, permission_key) DO NOTHING;

INSERT INTO public.role_template_permissions (role_template_id, permission_key, allowed)
SELECT rt.id, p.key, TRUE
FROM public.role_templates rt
CROSS JOIN (
  VALUES
    ('portal.client.documents.view'),
    ('portal.client.documents.download')
) AS p(key)
WHERE rt.tenant_id IS NULL
  AND rt.role_key = 'client_portal'
ON CONFLICT (role_template_id, permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('portal.employee.documents.view'),
    ('portal.employee.documents.download')
) AS p(key)
WHERE r.key = 'employee_portal'
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('portal.client.documents.view'),
    ('portal.client.documents.download')
) AS p(key)
WHERE r.key = 'client_portal'
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('portal.client.documents.view'),
    ('portal.client.documents.download')
) AS p(key)
WHERE r.key = 'family_portal'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Audit scripts (verify-cs-document-portal-permissions.mjs) read via service_role REST
GRANT SELECT ON public.permission_catalog TO service_role;
GRANT SELECT ON public.role_permissions TO service_role;
