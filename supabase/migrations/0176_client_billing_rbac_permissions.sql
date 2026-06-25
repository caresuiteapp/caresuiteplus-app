-- ==========================================================================
-- CareSuite+ — Migration 0176: Client billing RBAC permission keys
-- Seeds clients.billing_profile.*, clients.budgets.*, system.budget_templates.*
-- ==========================================================================

INSERT INTO public.permission_catalog (key, module, category, label, risk_level, requires_audit)
VALUES
  ('clients.billing_profile.view', 'clients', 'billing', 'Klient:innen-Abrechnungsprofil ansehen', 'low', FALSE),
  ('clients.billing_profile.edit', 'clients', 'billing', 'Klient:innen-Abrechnungsprofil bearbeiten', 'medium', TRUE),
  ('clients.budgets.view', 'clients', 'budgets', 'Klient:innen-Budgets ansehen', 'low', FALSE),
  ('clients.budgets.edit', 'clients', 'budgets', 'Klient:innen-Budgets bearbeiten', 'medium', TRUE),
  ('clients.budgets.transactions.view', 'clients', 'budgets', 'Budgetverlauf ansehen', 'low', FALSE),
  ('clients.budgets.warnings.manage', 'clients', 'budgets', 'Abrechnungswarnungen verwalten', 'medium', TRUE),
  ('system.budget_templates.view', 'system', 'budgets', 'Budget-Vorlagen ansehen', 'low', FALSE),
  ('system.budget_templates.edit', 'system', 'budgets', 'Budget-Vorlagen bearbeiten', 'high', TRUE)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_template_permissions (role_template_id, permission_key, allowed)
SELECT rt.id, p.key, TRUE
FROM public.role_templates rt
CROSS JOIN (
  VALUES
    ('clients.billing_profile.view'),
    ('clients.billing_profile.edit'),
    ('clients.budgets.view'),
    ('clients.budgets.edit'),
    ('clients.budgets.transactions.view'),
    ('clients.budgets.warnings.manage'),
    ('system.budget_templates.view')
) AS p(key)
WHERE rt.tenant_id IS NULL
  AND rt.role_key IN ('business_admin', 'business_manager', 'billing', 'dispatch', 'nurse')
ON CONFLICT (role_template_id, permission_key) DO NOTHING;

INSERT INTO public.role_template_permissions (role_template_id, permission_key, allowed)
SELECT rt.id, 'system.budget_templates.edit', TRUE
FROM public.role_templates rt
WHERE rt.tenant_id IS NULL AND rt.role_key = 'business_admin'
ON CONFLICT (role_template_id, permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('clients.billing_profile.view'),
    ('clients.billing_profile.edit'),
    ('clients.budgets.view'),
    ('clients.budgets.edit'),
    ('clients.budgets.transactions.view'),
    ('clients.budgets.warnings.manage'),
    ('system.budget_templates.view')
) AS p(key)
WHERE r.key IN ('business_admin', 'business_manager', 'billing', 'dispatch', 'nurse')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, 'system.budget_templates.edit'
FROM public.roles r
WHERE r.key = 'business_admin'
ON CONFLICT DO NOTHING;
