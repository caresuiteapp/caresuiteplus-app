-- Allow authenticated tenant members to hard-delete office messenger messages.
-- Attachments cascade via FK; storage cleanup is handled in application code.
GRANT DELETE ON public.messages TO authenticated;
GRANT DELETE ON public.message_attachments TO authenticated;

INSERT INTO public.permission_catalog (key, module, category, label, risk_level, requires_audit)
VALUES
  ('office.messages.archive', 'office', 'messages', 'Office-Nachrichten archivieren', 'medium', TRUE),
  ('office.messages.delete', 'office', 'messages', 'Office-Nachrichten vollständig löschen', 'high', TRUE)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_template_permissions (role_template_id, permission_key, allowed)
SELECT rt.id, p.key, TRUE
FROM public.role_templates rt
CROSS JOIN (VALUES ('office.messages.archive'), ('office.messages.delete')) AS p(key)
WHERE rt.tenant_id IS NULL
  AND rt.role_key IN ('business_admin', 'business_manager')
ON CONFLICT (role_template_id, permission_key) DO NOTHING;

INSERT INTO public.role_template_permissions (role_template_id, permission_key, allowed)
SELECT rt.id, 'office.messages.archive', TRUE
FROM public.role_templates rt
WHERE rt.tenant_id IS NULL AND rt.role_key = 'dispatch'
ON CONFLICT (role_template_id, permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (VALUES ('office.messages.archive'), ('office.messages.delete')) AS p(key)
WHERE r.key IN ('business_admin', 'business_manager')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, 'office.messages.archive'
FROM public.roles r
WHERE r.key = 'dispatch'
ON CONFLICT DO NOTHING;
