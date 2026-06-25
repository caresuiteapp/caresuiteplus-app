-- ==========================================================================
-- CareSuite+ — Migration 0174: RBAC seed — catalog + system role templates
-- Seeds from existing roles/role_permissions + supplemental permission keys
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Seed permission_catalog from distinct role_permissions keys
-- --------------------------------------------------------------------------
INSERT INTO public.permission_catalog (key, module, category, label, risk_level, requires_audit)
SELECT DISTINCT
  rp.permission_key,
  split_part(rp.permission_key, '.', 1),
  COALESCE(split_part(rp.permission_key, '.', 2), 'general'),
  rp.permission_key,
  CASE
    WHEN rp.permission_key LIKE '%.delete%' OR rp.permission_key = 'business.tenant.manage' THEN 'critical'
    WHEN rp.permission_key LIKE '%view_sensitive%' OR rp.permission_key LIKE '%.admin%' THEN 'high'
    WHEN rp.permission_key LIKE '%.create%' OR rp.permission_key LIKE '%.manage%' OR rp.permission_key LIKE '%.edit%' THEN 'medium'
    ELSE 'low'
  END,
  CASE
    WHEN rp.permission_key LIKE '%.delete%' OR rp.permission_key = 'business.tenant.manage' THEN TRUE
    WHEN rp.permission_key LIKE '%view_sensitive%' OR rp.permission_key LIKE '%.admin%' THEN TRUE
    ELSE FALSE
  END
FROM public.role_permissions rp
ON CONFLICT (key) DO NOTHING;

-- Supplemental keys (time tracking + recent staticRolePermissions additions)
INSERT INTO public.permission_catalog (key, module, category, label, risk_level, requires_audit)
VALUES
  ('time.tracking.own.start', 'time', 'tracking', 'Eigene Arbeitszeit starten', 'low', FALSE),
  ('time.tracking.own.pause', 'time', 'tracking', 'Eigene Arbeitszeit pausieren', 'low', FALSE),
  ('time.tracking.own.resume', 'time', 'tracking', 'Eigene Arbeitszeit fortsetzen', 'low', FALSE),
  ('time.tracking.own.switch', 'time', 'tracking', 'Tätigkeit / Zuordnung wechseln', 'medium', FALSE),
  ('time.tracking.own.close', 'time', 'tracking', 'Arbeitstag abschließen', 'medium', FALSE),
  ('time.tracking.own.view', 'time', 'tracking', 'Eigene Arbeitszeit einsehen', 'low', FALSE),
  ('time.tracking.team.view', 'time', 'tracking', 'Team-Arbeitszeiten einsehen', 'medium', FALSE),
  ('time.tracking.admin.view', 'time', 'tracking', 'Arbeitszeit-Administration einsehen', 'high', TRUE),
  ('time.tracking.admin.correct', 'time', 'tracking', 'Arbeitszeit-Korrekturen bearbeiten', 'high', TRUE),
  ('time.tracking.admin.export', 'time', 'tracking', 'Arbeitszeit exportieren', 'medium', FALSE),
  ('time.audit.view', 'time', 'audit', 'Arbeitszeit-Audit einsehen', 'high', TRUE),
  ('time.settings.manage', 'time', 'settings', 'Homeoffice-Arbeitszeit konfigurieren', 'high', TRUE)
ON CONFLICT (key) DO NOTHING;

-- --------------------------------------------------------------------------
-- 2. Seed system role_templates from roles table
-- --------------------------------------------------------------------------
INSERT INTO public.role_templates (tenant_id, role_key, name, description, level, is_system_role, is_editable)
SELECT
  NULL,
  r.key,
  r.name,
  r.description,
  CASE r.key
    WHEN 'business_admin' THEN 100
    WHEN 'business_manager' THEN 90
    WHEN 'dispatch' THEN 75
    WHEN 'billing' THEN 70
    WHEN 'akademie_admin' THEN 60
    WHEN 'nurse' THEN 50
    WHEN 'counselor' THEN 45
    WHEN 'caregiver' THEN 40
    WHEN 'employee_portal' THEN 10
    WHEN 'client_portal' THEN 5
    WHEN 'family_portal' THEN 5
    ELSE 0
  END,
  TRUE,
  FALSE
FROM public.roles r
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- 3. Seed role_template_permissions from role_permissions
-- --------------------------------------------------------------------------
INSERT INTO public.role_template_permissions (role_template_id, permission_key, allowed)
SELECT rt.id, rp.permission_key, TRUE
FROM public.role_templates rt
JOIN public.roles r ON r.key = rt.role_key AND rt.tenant_id IS NULL
JOIN public.role_permissions rp ON rp.role_id = r.id
WHERE EXISTS (SELECT 1 FROM public.permission_catalog pc WHERE pc.key = rp.permission_key)
ON CONFLICT (role_template_id, permission_key) DO NOTHING;

-- Supplemental time permissions for roles that have them in staticRolePermissions
INSERT INTO public.role_template_permissions (role_template_id, permission_key, allowed)
SELECT rt.id, p.key, TRUE
FROM public.role_templates rt
CROSS JOIN (
  VALUES
    ('time.tracking.own.start'),
    ('time.tracking.own.pause'),
    ('time.tracking.own.resume'),
    ('time.tracking.own.switch'),
    ('time.tracking.own.close'),
    ('time.tracking.own.view')
) AS p(key)
WHERE rt.tenant_id IS NULL
  AND rt.role_key IN ('caregiver', 'nurse', 'counselor', 'employee_portal', 'dispatch', 'billing', 'business_manager', 'business_admin')
ON CONFLICT (role_template_id, permission_key) DO NOTHING;

INSERT INTO public.role_template_permissions (role_template_id, permission_key, allowed)
SELECT rt.id, p.key, TRUE
FROM public.role_templates rt
CROSS JOIN (
  VALUES
    ('time.tracking.team.view')
) AS p(key)
WHERE rt.tenant_id IS NULL
  AND rt.role_key IN ('dispatch', 'billing', 'business_manager', 'business_admin')
ON CONFLICT (role_template_id, permission_key) DO NOTHING;

INSERT INTO public.role_template_permissions (role_template_id, permission_key, allowed)
SELECT rt.id, p.key, TRUE
FROM public.role_templates rt
CROSS JOIN (
  VALUES
    ('time.tracking.admin.view'),
    ('time.tracking.admin.correct'),
    ('time.tracking.admin.export'),
    ('time.audit.view'),
    ('time.settings.manage')
) AS p(key)
WHERE rt.tenant_id IS NULL
  AND rt.role_key IN ('business_manager', 'business_admin')
ON CONFLICT (role_template_id, permission_key) DO NOTHING;
