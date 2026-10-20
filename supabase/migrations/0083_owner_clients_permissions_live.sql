-- Owner-Rolle: explizite office.clients.* Keys für RLS has_permission
-- (Legacy-Matrix „clients“ reicht oft, granulare Keys sind konsistenter mit 0060/0061.)

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('office.clients.view'),
    ('office.clients.create'),
    ('office.clients.edit'),
    ('office.clients.status_change'),
    ('office.clients.archive'),
    ('office.clients.view_sensitive'),
    ('office.clients.manage_consents')
) AS p(key)
WHERE r.key IN ('owner', 'admin', 'management', 'geschaeftsfuehrung')
ON CONFLICT (role_id, permission_key) DO NOTHING;
